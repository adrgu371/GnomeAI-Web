// ======================================================
// WebGnome content.js – UNIVERSAL EXTRACTOR (Shadow-Aware)
// ======================================================

console.log("[WebGnome] Content Script Loaded");

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "WEBGNOME_REQUEST_DOM") return;

    // 1. Text selectat
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
        sendReply("USER SELECTED TEXT:\n" + selection);
        return;
    }

    // 2. Extragere
    const text = extractVisibleText();
    sendReply(text);
});

function sendReply(text) {
    chrome.runtime.sendMessage({
        type: "WEBGNOME_DOM_REPLY",
        dom: { url: location.href, title: document.title, visible_text: text }
    });
}

function extractVisibleText() {
    const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "NAV", "FOOTER", "LINK", "META"]);
    
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.parentElement) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            
            // 1. Ignorăm interfața noastră (Shadow Host)
            if (parent.id === "webgnome-host" || parent.closest("#webgnome-host")) {
                return NodeFilter.FILTER_REJECT;
            }

            // 2. Ignorăm tag-uri tehnice
            if (EXCLUDED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            
            // 3. Vizibilitate
            const style = window.getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0" || parent.offsetHeight === 0) {
                return NodeFilter.FILTER_REJECT;
            }
            
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let chunks = [];
    let node;
    while ((node = walker.nextNode())) {
        let text = node.textContent.trim();
        // Prindem și cuvinte scurte (ex: titluri, date)
        if (text.length > 2) {
            chunks.push(text);
        }
    }
    
    // Fallback: Dacă TreeWalker nu a găsit aproape nimic (pagina complexă tip React/Digi24 uneori)
    if (chunks.length < 5) {
        // Luăm innerText din body, eliminând scripturile manual
        const clone = document.body.cloneNode(true);
        const host = clone.querySelector("#webgnome-host");
        if(host) host.remove(); // Scoatem UI-ul nostru
        
        ["script", "style", "nav", "footer"].forEach(tag => {
            clone.querySelectorAll(tag).forEach(el => el.remove());
        });
        return clone.innerText.replace(/\n{3,}/g, "\n").slice(0, 30000);
    }

    return chunks.join("\n").slice(0, 30000);
}
