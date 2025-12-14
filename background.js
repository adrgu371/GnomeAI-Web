import { braveSearch } from "./search.js";

console.log("[WebGnome] Background Loaded (Analysis Mode - No Gmail)");

// =====================================================
// STATE
// =====================================================
let MODEL = "granite4:3b";
const WEB_CACHE = new Map();
let activeController = null;

chrome.storage.local.get(["ollama_model"], d => { if (d.ollama_model) MODEL = d.ollama_model; });
chrome.storage.onChanged.addListener(c => { if (c.ollama_model) MODEL = c.ollama_model.newValue; });

// =====================================================
// TIME & CONTEXT
// =====================================================
function getTimeContext() {
    const now = new Date();
    return `CURRENT DATE AND TIME: ${now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

// =====================================================
// INTENT DETECTORS
// =====================================================
function needsPageAnalysis(prompt) {
    const p = prompt.toLowerCase();
    const refs = ["what you see", "this page", "this article", "summarize", "analyze", "content", "opinion", "think about", "read", "ce vezi", "analizeaza"];
    return refs.some(k => p.includes(k));
}

function shouldWebSearch(q) {
    q = q.toLowerCase().trim();
    if (q.startsWith("/web ") || q.startsWith("search ") || q.startsWith("find ")) return true;
    const keys = ["who ", "what ", "when ", "where ", "weather", "price", "news", "mayor", "president", "result"];
    if (keys.some(k => q.startsWith(k))) return true;
    return q.includes("?") && q.length > 5;
}

// =====================================================
// ACTIONS
// =====================================================

// 1. PAGE ANALYSIS
async function requestVisibleArticle() {
    return new Promise(resolve => {
        const listener = (msg) => {
            if (msg.type === "WEBGNOME_DOM_REPLY") {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(msg.dom);
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (!tabs || !tabs[0]) { resolve(null); return; }
            chrome.tabs.sendMessage(tabs[0].id, { type: "WEBGNOME_REQUEST_DOM" });
        });
    });
}

async function performPageAnalysis(port, userPrompt) {
    const dom = await requestVisibleArticle();
    const visibleText = dom?.visible_text || "";

    if (visibleText.length < 50) {
        port.postMessage({type: "CHUNK", data: "⚠️ The page seems empty or I cannot read the text."});
        port.postMessage({type: "DONE"});
        return;
    }

    const llmPrompt = `
SYSTEM INSTRUCTION:
${getTimeContext()}
You are an intelligent web analyst.
Your task is to analyze the VISIBLE PAGE TEXT provided below and answer the user's request.

RULES:
1. Base your answer strictly on the content of the text below.
2. You CAN summarize, analyze, or form an opinion based on the facts presented in the text.
3. If the user asks for your opinion, derive it from the tone and content of the article.

PAGE TEXT:
---------------------
${visibleText}
---------------------

USER REQUEST:
${userPrompt}
`;
    await streamLLM(port, llmPrompt);
}

// 2. WEB SEARCH
async function performWebSearch(port, query) {
    const cleanQuery = query.replace(/^\/web |^search |^find /i, "").trim();
    if (WEB_CACHE.has(cleanQuery)) return WEB_CACHE.get(cleanQuery);

    const apiKey = await new Promise(r => chrome.storage.local.get("brave_api_key", d => r(d.brave_api_key)));
    if (!apiKey) {
        port.postMessage({type:"CHUNK", data:"⚠️ Missing Brave API Key."});
        return [];
    }

    try {
        const results = await braveSearch(cleanQuery, apiKey);
        if (results && results.length) {
            WEB_CACHE.set(cleanQuery, results);
            return results;
        }
        port.postMessage({type:"CHUNK", data:"⚠️ No results found."});
        return [];
    } catch (e) {
        port.postMessage({type:"CHUNK", data:"❌ Brave Error: " + e.message});
        return [];
    }
}

// =====================================================
// STREAMING
// =====================================================
async function streamLLM(port, prompt) {
    if (activeController) activeController.abort();
    activeController = new AbortController();

    try {
        const res = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: "user", content: prompt }],
                stream: true,
                options: { temperature: 0.3 }
            }),
            signal: activeController.signal
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            chunk.split("\n").forEach(line => {
                if (!line.trim()) return;
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) port.postMessage({ type: "CHUNK", data: json.message.content });
                } catch {}
            });
        }
    } catch (e) {
        if (e.name === 'AbortError') port.postMessage({ type: "CHUNK", data: "\n[STOPPED]" });
        else port.postMessage({ type: "CHUNK", data: "\nError connecting to Ollama." });
    } finally {
        activeController = null;
        port.postMessage({ type: "DONE" });
    }
}

// =====================================================
// ROUTER
// =====================================================
chrome.runtime.onConnect.addListener(port => {
    if (port.name !== "webgnomeStream") return;

    port.onMessage.addListener(async msg => {
        if (msg.type === "STOP") { if (activeController) activeController.abort(); return; }
        if (msg.type !== "CHAT") return;

        const prompt = msg.text || "";

        if (needsPageAnalysis(prompt)) return performPageAnalysis(port, prompt);

        if (msg.force_websearch || shouldWebSearch(prompt)) {
            port.postMessage({ type: "CHUNK", data: "🌍 Searching web..." });
            const results = await performWebSearch(port, prompt);
            
            let webContext = "";
            if (results.length) {
                webContext = "\nWEB SEARCH RESULTS:\n" + results.map(r => `• ${r.title}\n${r.snippet}`).join("\n\n");
            }
            
            const finalPrompt = `
${getTimeContext()}
System: You are a helpful assistant. Use these search results to answer.
${webContext}
USER QUESTION: ${prompt}
`;
            await streamLLM(port, finalPrompt);
        } else {
            const finalPrompt = `
${getTimeContext()}
System: You are a helpful assistant.
USER QUESTION: ${prompt}
`;
            await streamLLM(port, finalPrompt);
        }
    });
});
