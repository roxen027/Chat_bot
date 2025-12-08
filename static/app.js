// app.js - front-end logic
(() => {
  const chatWindow = document.getElementById('chatWindow');
  const inputForm = document.getElementById('inputForm');
  const messageInput = document.getElementById('messageInput');
  const typingIndicator = document.getElementById('typingIndicator');
  const btnNewConv = document.getElementById('btnNewConv');
  const btnClearAll = document.getElementById('btnClearAll');
  const historyList = document.getElementById('historyList');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebar = document.getElementById('sidebar');
  const toast = document.getElementById('toast');
  const themeToggle = document.getElementById('themeToggle');

  // State
  let conversations = []; // {id,title, messages:[{role,text,ts}]}
  let activeConvId = null;
  const LS_KEY = 'aurora_conversations_v1';
  const LS_THEME = 'aurora_theme_v1';

  // Utils
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  const now = () => new Date().toLocaleString();
  const showToast = (text, ms=3000) => {
    toast.textContent = text;
    toast.classList.remove('hidden');
    setTimeout(()=>toast.classList.add('hidden'), ms);
  };

  // Persistence
  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if(raw) conversations = JSON.parse(raw);
      else {
        // create initial conv
        const id = uid();
        conversations = [{id, title:'New Conversation', messages:[]}];
        activeConvId = id;
        saveState();
      }
      if(!activeConvId) activeConvId = conversations[0]?.id;
    } catch(e){ conversations = []; activeConvId = null }
  }
  function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(conversations)); }
  function setActive(id){
    activeConvId = id;
    renderHistory();
    renderMessages();
  }

  // Renderers
  function renderHistory(){
    historyList.innerHTML = '';
    conversations.forEach(conv=>{
      const li = document.createElement('li');
      li.className = 'history-item';
      li.title = conv.title;
      li.innerHTML = `<div><strong>${conv.title}</strong><div class="meta">${(conv.messages.length? conv.messages[conv.messages.length-1].text.slice(0,60):'Empty')}</div></div>
                      <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn small btn-load" data-id="${conv.id}">Open</button>
                        <button class="btn small btn-delete" data-id="${conv.id}">Del</button>
                      </div>`;
      historyList.appendChild(li);
    });

    // bind buttons
    historyList.querySelectorAll('.btn-load').forEach(b => b.onclick = (e) => {
      setActive(e.target.dataset.id);
    });
    historyList.querySelectorAll('.btn-delete').forEach(b => b.onclick = (e) => {
      const id = e.target.dataset.id;
      const idx = conversations.findIndex(c=>c.id===id);
      if(idx>-1){
        conversations.splice(idx,1);
        if(conversations.length===0){
          const id2 = uid();
          conversations.push({id:id2,title:'New Conversation',messages:[]});
          activeConvId = id2;
        } else if(activeConvId === id){
          activeConvId = conversations[0].id;
        }
        saveState();
        renderHistory();
        renderMessages();
      }
    });
  }

  function renderMessages(){
    chatWindow.innerHTML = '';
    const conv = conversations.find(c=>c.id===activeConvId) || conversations[0];
    if(!conv) return;
    // set title
    document.querySelector('.title .name').textContent = 'Aurora';
    // render messages
    conv.messages.forEach(m => {
      const el = document.createElement('div');
      el.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot');
      if(m.role === 'bot' && m.meta) el.innerHTML = `<div class="meta">${m.meta}</div><div>${escapeHtml(m.text)}</div>`;
      else el.innerHTML = `<div>${escapeHtml(m.text)}</div>`;
      chatWindow.appendChild(el);
    });
    scrollToBottom();
  }

  function escapeHtml(t){ return String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  function scrollToBottom(){
    chatWindow.scrollTo({top: chatWindow.scrollHeight, behavior: 'smooth'});
  }

  // Core flow: send user message and show bot reply
  async function sendMessage(raw) {
    const conv = conversations.find(c=>c.id===activeConvId);
    if(!conv) return;
    const message = raw.trim();
    if(!message) return;

    // push user message
    const userMsg = {role:'user', text:message, ts: Date.now()};
    conv.messages.push(userMsg);
    saveState();
    renderMessages();

    // show typing
    typingIndicator.classList.remove('hidden');
    typingIndicator.setAttribute('aria-hidden','false');
    scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ prompt: message })
      });

      if(!res.ok) throw new Error('Server error: ' + res.status);

      const data = await res.json();
      const text = (data && data.reply) ? data.reply : 'Sorry — no reply.';
      const botMsg = {role:'bot', text, ts: Date.now()};
      conv.messages.push(botMsg);
      saveState();
      renderMessages();
    } catch(err){
      console.error(err);
      showToast('Error: ' + err.message, 4000);
      const botMsg = {role:'bot', text:`⚠️ Failed to fetch reply: ${err.message}`, ts: Date.now()};
      conv.messages.push(botMsg);
      saveState();
      renderMessages();
    } finally {
      typingIndicator.classList.add('hidden');
      typingIndicator.setAttribute('aria-hidden','true');
      messageInput.value = '';
      messageInput.focus();
    }
  }

  // New conversation
  function newConversation() {
    const id = uid();
    const conv = {id, title: 'Conversation ' + (conversations.length + 1), messages:[]};
    conversations.unshift(conv);
    setActive(id);
    saveState();
  }

  // Clear all conversations
  function clearAll(){
    if(!confirm('Clear all conversations? This cannot be undone.')) return;
    conversations = [];
    const id = uid();
    conversations.push({id,title:'New Conversation',messages:[]});
    activeConvId = id;
    saveState();
    renderHistory();
    renderMessages();
    showToast('All conversations cleared');
  }

  // Theme
  function applyTheme(t){
    document.documentElement.style.setProperty('--bg', t === 'dark' ? '#0f1724' : '#f5f7fb');
    document.documentElement.style.setProperty('--text', t === 'dark' ? '#e6eef8' : '#111827');
    localStorage.setItem(LS_THEME, t);
    themeToggle.checked = (t === 'light');
  }
  function initTheme(){
    const t = localStorage.getItem(LS_THEME) || 'dark';
    applyTheme(t);
    themeToggle.onchange = () => applyTheme(themeToggle.checked ? 'light' : 'dark');
  }

  // Helpers
  inputForm.addEventListener('submit', e => {
    e.preventDefault();
    sendMessage(messageInput.value);
  });

  btnNewConv.onclick = () => newConversation();
  btnClearAll.onclick = () => clearAll();
  btnToggleSidebar.onclick = () => {
    if(sidebar.classList.contains('hidden')) sidebar.classList.remove('hidden');
    else sidebar.classList.add('hidden');
  };

  // keyboard: Enter sends, Shift+Enter newline
  messageInput.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputForm.requestSubmit();
    }
  });

  // init
  loadState();
  if(!activeConvId && conversations[0]) activeConvId = conversations[0].id;
  renderHistory();
  renderMessages();
  initTheme();

  // Small accessibility: focus input on load
  messageInput.focus();

})();
