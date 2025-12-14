(() => {
    if (window.__WEBGNOME_SIDEBAR_LOADED__) return;
    window.__WEBGNOME_SIDEBAR_LOADED__ = true;

    // ======================================================
    // STATE
    // ======================================================
    let shadowRoot, sidebar, chatContainer, inputEl, sendBtn, stopBtn, fileBtn, fileInput, filePreview, tabList, toggleBtn, menuBtn;
    let chats = {}, currentChatId = null, port = null, streaming = false, pendingFileContent = null, buffer = "";

    // ======================================================
    // CSS ISOLATED (Shadow DOM)
    // ======================================================
    const cssContent = `
        :host { all: initial; }
        * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, sans-serif; }

        #webgnome-wrapper {
            position: fixed; top: 0; right: 0; width: 450px; height: 100vh;
            background: #1e1e1e; color: #fff; z-index: 2147483647; display: flex;
            box-shadow: -5px 0 15px rgba(0,0,0,0.5); font-size: 14px; border-left: 1px solid #333;
        }

        /* TABS AREA */
        #webgnome-tabs { width: 50px; background: #111; border-right: 1px solid #333; display: flex; flex-direction: column; align-items: center; padding: 10px 0; gap: 8px; overflow-y: auto; transition: width 0.2s, padding 0.2s; }
        #webgnome-tabs.hidden { width: 0; padding: 0; border: none; overflow: hidden; }
        
        .wg-tab { width: 36px; height: 36px; min-height: 36px; border-radius: 8px; background: #222; color: #888; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; transition: 0.2s; user-select: none; border: 1px solid transparent; }
        .wg-tab:hover { background: #333; color: #fff; }
        .wg-tab.active { background: #2563eb; color: #fff; }
        #wg-add-chat { font-size: 20px; color: #4aa8ff; }

        /* MAIN AREA */
        #webgnome-main { flex: 1; display: flex; flex-direction: column; height: 100%; }
        #webgnome-header { padding: 12px; background: #161616; display: flex; align-items: center; border-bottom: 1px solid #333; font-size: 16px; gap: 10px; }
        #webgnome-chat { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; background: #1e1e1e; }
        
        .wg-msg { padding: 10px 14px; border-radius: 10px; max-width: 90%; word-wrap: break-word; white-space: pre-wrap; font-size: 14px; line-height: 1.4; }
        .wg-user { align-self: flex-end; background: #2563eb; border-radius: 12px 12px 2px 12px; }
        .wg-ai { align-self: flex-start; background: #2a2a2a; border: 1px solid #333; border-radius: 12px 12px 12px 2px; }

        #webgnome-footer { padding: 12px; background: #161616; border-top: 1px solid #333; }
        #wg-toolbar { display: flex; gap: 10px; margin-bottom: 8px; align-items: center; }
        #wg-input-area { display: flex; gap: 8px; align-items: center; }
        
        textarea#wg-input { flex: 1; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 6px; padding: 10px; resize: none; height: 44px; outline: none; font-size: 14px; font-family: inherit; margin: 0; }
        textarea#wg-input:focus { border-color: #2563eb; }
        
        button.wg-btn { border: none; border-radius: 6px; cursor: pointer; color: white; font-weight: bold; display: flex; justify-content: center; align-items: center; padding: 0; margin: 0; font-size: 14px; }
        #wg-send { background: #2563eb; width: 50px; height: 44px; }
        #wg-stop { background: #dc2626; width: 50px; height: 44px; display: none; }
        #wg-attach { background: #333; width: 32px; height: 32px; font-size: 18px; }
        #wg-menu { background: transparent; width: 24px; height: 24px; font-size: 18px; color: #888; }
        #wg-menu:hover { color: #fff; }
        
        #webgnome-toggle { position: fixed; right: 20px; bottom: 20px; width: 50px; height: 50px; background: #2563eb; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: grab; z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 20px; user-select: none; }
    `;

    // ======================================================
    // LOGIC
    // ======================================================

    function initShadow() {
        const host = document.createElement('div');
        host.id = 'webgnome-host';
        document.body.appendChild(host);
        shadowRoot = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = cssContent;
        shadowRoot.appendChild(style);
    }

    // --- STORAGE & CHAT ---
    function loadData() { chrome.storage.local.get(["webgnome_chats", "webgnome_active_id"], d => { chats=d.webgnome_chats||{}; currentChatId=d.webgnome_active_id||null; if(!currentChatId || !chats[currentChatId]) createNewChat(); else { renderTabs(); renderCurrentChat(); } }); }
    function saveData() { chrome.storage.local.set({ webgnome_chats: chats, webgnome_active_id: currentChatId }); }
    function createNewChat() { chats[Date.now()]=[]; currentChatId=Date.now().toString(); saveData(); renderTabs(); renderCurrentChat(); }
    function deleteChat(id, e) { e.stopPropagation(); if(!confirm("Delete?"))return; delete chats[id]; if(id==currentChatId) currentChatId=Object.keys(chats).pop()||null; if(!currentChatId) createNewChat(); else { saveData(); renderTabs(); renderCurrentChat(); } }
    function switchChat(id) { currentChatId=id; saveData(); renderTabs(); renderCurrentChat(); }

    function renderTabs() {
        if(!tabList) return;
        tabList.innerHTML = "";
        const add = document.createElement("div"); add.id="wg-add-chat"; add.className="wg-tab"; add.textContent="+"; add.onclick=createNewChat; tabList.appendChild(add);
        Object.keys(chats).forEach((id, idx) => {
            const t = document.createElement("div"); t.className=`wg-tab ${id==currentChatId?'active':''}`; t.textContent=idx+1; 
            t.onclick=()=>switchChat(id); t.oncontextmenu=(e)=>{e.preventDefault(); deleteChat(id, e)}; tabList.appendChild(t);
        });
    }
    
    function renderCurrentChat() {
        if(!chatContainer) return;
        chatContainer.innerHTML = "";
        if(currentChatId && chats[currentChatId]) chats[currentChatId].forEach(m => addMsg(m.role, m.text));
        setTimeout(() => chatContainer.scrollTop = chatContainer.scrollHeight, 50);
    }

    function addMsg(role, text) {
        const d = document.createElement("div"); d.className = `wg-msg ${role==='user'?'wg-user':'wg-ai'}`; d.textContent = text; chatContainer.appendChild(d); return d;
    }

    function buildSidebar() {
        if(!shadowRoot) initShadow();
        sidebar = document.createElement("div"); sidebar.id = "webgnome-wrapper"; sidebar.style.display = "none";
        sidebar.innerHTML = `
            <div id="webgnome-tabs"></div>
            <div id="webgnome-main">
                <div id="webgnome-header">
                    <button id="wg-menu" class="wg-btn" title="Toggle Chats">☰</button>
                    <strong style="color:#4aa8ff; flex:1;">WebGnome</strong>
                    <button id="wg-close" class="wg-btn" style="width:auto;background:none;color:#888" title="Close">✕</button>
                </div>
                <div id="webgnome-chat"></div>
                <div id="webgnome-footer">
                    <div id="wg-toolbar"><button id="wg-attach" class="wg-btn">📎</button><span id="wg-file-preview" style="display:none;font-size:11px;color:#4aa8ff;margin-left:5px"></span><input type="file" id="wg-file-in" style="display:none"></div>
                    <div id="wg-input-area"><textarea id="wg-input" placeholder="Type message..."></textarea><button id="wg-stop" class="wg-btn">STOP</button><button id="wg-send" class="wg-btn">➤</button></div>
                </div>
            </div>`;
        shadowRoot.appendChild(sidebar);

        tabList = shadowRoot.getElementById("webgnome-tabs");
        chatContainer = shadowRoot.getElementById("webgnome-chat");
        inputEl = shadowRoot.getElementById("wg-input");
        sendBtn = shadowRoot.getElementById("wg-send");
        stopBtn = shadowRoot.getElementById("wg-stop");
        fileBtn = shadowRoot.getElementById("wg-attach");
        fileInput = shadowRoot.getElementById("wg-file-in");
        filePreview = shadowRoot.getElementById("wg-file-preview");
        menuBtn = shadowRoot.getElementById("wg-menu");

        shadowRoot.getElementById("wg-close").onclick = toggleSidebar;
        
        // --- LOGICA NOUĂ PENTRU TOGGLE TABS ---
        menuBtn.onclick = () => {
            if (tabList.classList.contains("hidden")) {
                tabList.classList.remove("hidden");
            } else {
                tabList.classList.add("hidden");
            }
        };

        sendBtn.onclick = sendMessage;
        stopBtn.onclick = () => { if(port) port.postMessage({type:"STOP"}); streaming=false; stopBtn.style.display="none"; sendBtn.style.display="block"; };
        inputEl.onkeydown = (e) => { if(e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
        fileBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => { const f=e.target.files[0]; if(f){ filePreview.style.display="inline"; filePreview.textContent=f.name; const r=new FileReader(); r.onload=evt=>pendingFileContent=`\n[FILE: ${f.name}]\n${evt.target.result}\n`; r.readAsText(f); }};
        
        loadData();
    }

    function toggleSidebar() {
        if (!sidebar) buildSidebar();

        const isHidden = sidebar.style.display === "none";
        sidebar.style.display = isHidden ? "flex" : "none";
        
        const shift = isHidden ? "450px" : "0px";
        document.body.style.transition = "margin-right 0.3s ease";
        document.body.style.marginRight = shift;
    }

    function buildButton() {
        if(!shadowRoot) initShadow();
        toggleBtn = document.createElement("div"); toggleBtn.id = "webgnome-toggle"; toggleBtn.textContent = "G";
        shadowRoot.appendChild(toggleBtn);
        let dragging=false, sx, sy, ir, ib;
        toggleBtn.onmousedown = e => { dragging=true; sx=e.clientX; sy=e.clientY; const r=toggleBtn.getBoundingClientRect(); ir=window.innerWidth-r.right; ib=window.innerHeight-r.bottom; };
        window.onmousemove = e => { if(dragging) { e.preventDefault(); toggleBtn.style.right=(ir+(sx-e.clientX))+"px"; toggleBtn.style.bottom=(ib+(sy-e.clientY))+"px"; }};
        window.onmouseup = () => setTimeout(()=>dragging=false, 100);
        toggleBtn.onclick = () => { if(!dragging) toggleSidebar(); };
    }

    function sendMessage() {
        if(streaming) return;
        const txt = inputEl.value.trim();
        if(!txt && !pendingFileContent) return;
        inputEl.value=""; filePreview.style.display="none"; fileInput.value="";

        let show = txt + (pendingFileContent ? "\n[📎 File]" : "");
        let send = (pendingFileContent || "") + "\nUSER: " + txt;
        pendingFileContent=null;

        addMsg("user", show);
        if(currentChatId) { chats[currentChatId].push({role:"user", text:show}); saveData(); }
        
        streaming=true; sendBtn.style.display="none"; stopBtn.style.display="block";
        const aiDiv = addMsg("ai", "...");
        buffer="";

        if(port) try{port.disconnect();}catch(e){}
        port = chrome.runtime.connect({ name: "webgnomeStream" });
        port.onMessage.addListener(msg => {
            if(msg.type==="CHUNK") { buffer+=msg.data; aiDiv.textContent=buffer; chatContainer.scrollTop=chatContainer.scrollHeight; }
            if(msg.type==="DONE") { streaming=false; if(currentChatId){chats[currentChatId].push({role:"ai", text:buffer}); saveData();} stopBtn.style.display="none"; sendBtn.style.display="block"; }
        });
        port.postMessage({type:"CHAT", text:send});
    }

    buildButton();
})();
