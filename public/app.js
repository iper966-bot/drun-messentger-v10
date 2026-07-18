function applyTheme(){const e=localStorage.getItem("nova_theme")==="dark";document.documentElement.classList.toggle("theme-dark",e)}applyTheme();const API="";let token=localStorage.getItem("nova_token")||null,me=null;try{me=JSON.parse(localStorage.getItem("nova_me")||"null")}catch{me=null}let users=[],chats=[],activePeer=null,activeChatId=null,messages=[],ws=null,wsConnectedOnce=!1,onlineUsers=new Set;function isOnline(e){return onlineUsers.has(e)}function presenceDotHtml(e){return`<span class="presence-dot ${isOnline(e)?"online":""}" data-presence="${escapeHtml(e)}"></span>`}function refreshPresenceUI(){const e=document.getElementById("searchInput");renderChatList(e?e.value:""),document.querySelectorAll("[data-presence]").forEach(n=>{n.classList.toggle("online",isOnline(n.dataset.presence))});const t=document.getElementById("peerStatusLine");t&&activePeer&&(t.innerHTML=isOnline(activePeer)?'<span class="status-online">\u0432 \u0441\u0435\u0442\u0438</span>':"@"+escapeHtml(activePeer))}const GRADIENTS=["linear-gradient(135deg,#8b5cf6,#ec4899)","linear-gradient(135deg,#f472b6,#8b5cf6)","linear-gradient(135deg,#6366f1,#ec4899)","linear-gradient(135deg,#c084fc,#f472b6)","linear-gradient(135deg,#a78bfa,#f9a8d4)","linear-gradient(135deg,#7c3aed,#db2777)"];function gradFor(e){let t=0;for(let n=0;n<e.length;n++)t=e.charCodeAt(n)+((t<<5)-t);return GRADIENTS[Math.abs(t)%GRADIENTS.length]}function showGiftFlash(giftKind,titleText,subText){try{const tier=(typeof GIFT_TIERS!=="undefined"&&GIFT_TIERS[giftKind])||null;const img=tier&&tier.image?tier.image:"/mascot-burmaldaets.png";const overlay=document.createElement("div");overlay.className="gift-flash-overlay";const sparkEmojis=["\u2728","\u{1F31F}","\u{1F49C}","\u2B50"];let sparksHtml="";for(let i=0;i<6;i++){const ang=i*60;const dist=70;const x=50+Math.cos(ang*Math.PI/180)*dist*.01*100;const y=50+Math.sin(ang*Math.PI/180)*dist*.01*100;sparksHtml+=`<span class="gift-flash-spark" style="left:${x}%;top:${y}%;animation-delay:${(i*0.07).toFixed(2)}s">${sparkEmojis[i%sparkEmojis.length]}</span>`}overlay.innerHTML=`<div class="gift-flash-card">${sparksHtml}<div class="gift-flash-img-wrap"><img src="${img}" alt=""></div><div class="gift-flash-title">${escapeHtml(titleText||"")}</div>${subText?`<div class="gift-flash-sub">${escapeHtml(subText)}</div>`:""}</div>`;document.body.appendChild(overlay);setTimeout(()=>{overlay.remove()},2100)}catch{}}function initials(e){return(e||"?").trim().split(/\s+/).map(t=>t[0]).slice(0,2).join("").toUpperCase()}function escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}function formatTime(e){const t=new Date(e);return t.getHours().toString().padStart(2,"0")+":"+t.getMinutes().toString().padStart(2,"0")}function avatarInnerHtml(e){return e&&e.avatar?`<img src="${e.avatar}" alt="">`:escapeHtml(initials(e?e.nickname:"?"))}function avatarStyle(e){return e&&e.avatar?"":`background:${gradFor(e&&e.username||"?")}`}let authMode="login",twofaPending=!1;function resetAuthTabs(){document.getElementById("tabLogin").classList.remove("active"),document.getElementById("tabRegister").classList.remove("active"),document.getElementById("tabOwner").classList.remove("active"),document.getElementById("ownerCodeField").classList.add("hidden"),document.getElementById("twofaField").classList.add("hidden"),document.getElementById("authTwofaCode").value="",twofaPending=!1}document.getElementById("tabLogin").onclick=()=>{authMode="login",resetAuthTabs(),document.getElementById("tabLogin").classList.add("active"),document.getElementById("authSubtitle").textContent="\u0412\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u043E\u0431\u0449\u0435\u043D\u0438\u0435",document.getElementById("authSubmit").textContent="\u0412\u043E\u0439\u0442\u0438",document.getElementById("authError").textContent="",document.getElementById("nicknameField").classList.add("hidden"),document.getElementById("usernameHint").classList.add("hidden"),document.getElementById("authUsername").placeholder="\u0418\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F"},document.getElementById("tabRegister").onclick=()=>{authMode="register",resetAuthTabs(),document.getElementById("tabRegister").classList.add("active"),document.getElementById("authSubtitle").textContent="\u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C",document.getElementById("authSubmit").textContent="\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F",document.getElementById("authError").textContent="",document.getElementById("nicknameField").classList.remove("hidden"),document.getElementById("usernameHint").classList.remove("hidden"),document.getElementById("authUsername").placeholder="\u041B\u043E\u0433\u0438\u043D \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0435\u0439 (\u043F\u043E \u043D\u0435\u043C\u0443 \u0432\u0430\u0441 \u0438\u0449\u0443\u0442)"},document.getElementById("tabOwner").onclick=()=>{authMode="register-owner",resetAuthTabs(),document.getElementById("tabOwner").classList.add("active"),document.getElementById("authSubtitle").textContent="\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044F \u2014 \u043D\u0443\u0436\u0435\u043D \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0430",document.getElementById("authSubmit").textContent="\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u043A\u0430\u043A \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C",document.getElementById("authError").textContent="",document.getElementById("nicknameField").classList.remove("hidden"),document.getElementById("usernameHint").classList.remove("hidden"),document.getElementById("authUsername").placeholder="\u041B\u043E\u0433\u0438\u043D \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0435\u0439 (\u043F\u043E \u043D\u0435\u043C\u0443 \u0432\u0430\u0441 \u0438\u0449\u0443\u0442)",document.getElementById("ownerCodeField").classList.remove("hidden")};async function submitAuth(){const e=document.getElementById("authNickname").value.trim(),t=document.getElementById("authUsername").value.trim(),n=document.getElementById("authPassword").value,i=document.getElementById("authError");if(i.textContent="",!t||!n){i.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438 \u043F\u0430\u0440\u043E\u043B\u044C";return}if(authMode==="register-owner"&&!document.getElementById("authOwnerCode").value){i.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044F";return}const s=document.getElementById("authSubmit");s.disabled=!0;try{const a={username:t,password:n};(authMode==="register"||authMode==="register-owner")&&(a.nickname=e),authMode==="register-owner"&&(a.code=document.getElementById("authOwnerCode").value),authMode==="login"&&twofaPending&&(a.code=document.getElementById("authTwofaCode").value.trim());const l=await fetch("/api/"+(authMode==="register-owner"?"register-owner":authMode),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)}),c=await l.json();if(!l.ok){if(c.twofa_required){twofaPending=!0,document.getElementById("twofaField").classList.remove("hidden"),document.getElementById("authTwofaCode").focus(),i.textContent=c.error||"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0434 \u0438\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F-\u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440\u0430",s.disabled=!1;return}i.textContent=c.error||"\u041E\u0448\u0438\u0431\u043A\u0430",s.disabled=!1;return}twofaPending=!1,token=c.token,me=c.user,localStorage.setItem("nova_token",token),localStorage.setItem("nova_me",JSON.stringify(me)),enterApp()}catch{i.textContent="\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C"}s.disabled=!1}document.getElementById("authSubmit").onclick=submitAuth,["authNickname","authUsername","authPassword","authOwnerCode","authTwofaCode"].forEach(e=>{document.getElementById(e).addEventListener("keydown",t=>{t.key==="Enter"&&submitAuth()})});function doLogout(){localStorage.removeItem("nova_token"),localStorage.removeItem("nova_me"),token=null,me=null,activePeer=null,activeChatId=null,chats=[],ws&&ws.close(),closeHammamModal(),document.getElementById("appScreen").classList.add("hidden"),document.getElementById("authScreen").classList.remove("hidden")}document.getElementById("settingsBtn").onclick=openSettingsModal,document.getElementById("settingsBtnMobile").onclick=openSettingsModal;async function apiFetch(e,t={}){const n=await fetch(""+e,{...t,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...t.headers||{}}});if(n.status===401)throw doLogout(),new Error("Unauthorized");const raw=await n.text();let i;try{i=raw?JSON.parse(raw):{}}catch{const s=new Error(n.ok?"\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043D\u0443\u043B \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043e\u0442\u0432\u0435\u0442. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443 \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c.":"\u0421\u0435\u0440\u0432\u0435\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d (\u043a\u043e\u0434 "+n.status+"). \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435 \u0438\u043b\u0438 \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0443.");throw s.data={error:s.message},s}if(!n.ok){const s=new Error(i.error||"\u041E\u0448\u0438\u0431\u043A\u0430");throw s.data=i,s}return i}async function loadUsers(){try{users=(await apiFetch("/api/users")).users||[],renderChatList(document.getElementById("searchInput").value)}catch{}}async function loadChats(){try{chats=(await apiFetch("/api/chats")).chats||[],renderChatList(document.getElementById("searchInput").value)}catch{}}async function loadMessages(e){try{messages=(await apiFetch("/api/messages/"+encodeURIComponent(e))).messages||[],renderMessages()}catch{}}async function loadChatMessages(e){try{messages=(await apiFetch("/api/chats/"+e+"/messages")).messages||[],renderMessages()}catch{}}function getRecentContacts(){try{return JSON.parse(localStorage.getItem("nova_recent")||"[]")}catch{return[]}}function addRecentContact(e){const t=getRecentContacts().filter(n=>n!==e);t.unshift(e),localStorage.setItem("nova_recent",JSON.stringify(t.slice(0,200)))}function renderChatList(e=""){const t=document.getElementById("chatList");t.innerHTML="";const n=(e||"").trim().toLowerCase();if(!n){const o=getRecentContacts().map(l=>users.find(c=>c.username===l)).filter(Boolean);if(o.length===0&&chats.length===0){t.innerHTML=`<div class="no-users">
        \u041F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u043E.<br>\u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A\u0430 \u0447\u0435\u0440\u0435\u0437 \u043F\u043E\u0438\u0441\u043A \u0432\u044B\u0448\u0435 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0433\u0440\u0443\u043F\u043F\u0443/\u043A\u0430\u043D\u0430\u043B \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \xAB+\xBB.
      </div>`;return}chats.forEach(l=>t.appendChild(buildGroupChatItem(l))),o.forEach(l=>t.appendChild(buildChatItem(l)));return}const i=users.filter(a=>a.username.toLowerCase().includes(n)||a.nickname.toLowerCase().includes(n)),s=chats.filter(a=>a.title.toLowerCase().includes(n));if(i.length===0&&s.length===0){t.innerHTML='<div class="no-users">\u041D\u0438\u043A\u043E\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E. \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.</div>';return}s.forEach(a=>t.appendChild(buildGroupChatItem(a))),i.forEach(a=>t.appendChild(buildChatItem(a)))}function groupAvatarInner(e){return e.avatar?`<img src="${e.avatar}" alt="">`:e.kind==="channel"?"\u{1F4E2}":"\u{1F465}"}function buildGroupChatItem(e){const t=document.createElement("div");return t.className="chat-item"+(activeChatId===e.id?" selected":""),t.onclick=()=>selectChat(e.id),t.innerHTML=`
    <div class="avatar group-avatar" style="background:${gradFor("chat"+e.id)}">${groupAvatarInner(e)}</div>
    <div class="chat-name-wrap">
      <div class="chat-name">${escapeHtml(e.title)}<span class="chat-badge ${e.kind==="channel"?"channel":""}">${e.kind==="channel"?"\u043A\u0430\u043D\u0430\u043B":"\u0433\u0440\u0443\u043F\u043F\u0430"}</span></div>
      <div class="chat-sub">${e.member_count} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A${e.member_count===1?"":e.member_count>=2&&e.member_count<=4?"\u0430":"\u043E\u0432"}</div>
    </div>
  `,t}function buildChatItem(e){const t=document.createElement("div");return t.className="chat-item"+(activePeer===e.username?" selected":""),t.onclick=()=>selectChat(null,e.username),t.innerHTML=`
    <div class="avatar-with-status">
      <div class="avatar" style="${avatarStyle(e)}">${avatarInnerHtml(e)}</div>
      ${presenceDotHtml(e.username)}
    </div>
    <div class="chat-name-wrap">
      <div class="chat-name">${escapeHtml(e.nickname)}</div>
      <div class="chat-sub">${isOnline(e.username)?"\u0432 \u0441\u0435\u0442\u0438":"@"+escapeHtml(e.username)}</div>
    </div>
  `,t}function findUser(e){return users.find(t=>t.username===e)||{username:e,nickname:e,avatar:null}}function findChat(e){return chats.find(t=>t.id===e)||null}function selectChat(e,t){sendStopTyping(),clearTyping(),e?(activeChatId=e,activePeer=null):(activePeer=t,activeChatId=null,addRecentContact(t)),document.getElementById("searchInput").value="",renderChatList(""),renderConversationHeader(),activeChatId?loadChatMessages(activeChatId):loadMessages(activePeer),document.getElementById("appScreen").classList.add("chat-open")}function selectPeer(e){selectChat(null,e)}function closeConversationMobile(){document.getElementById("appScreen").classList.remove("chat-open")}let typingPeers=new Map,typingSend={lastSent:0,stopTimer:null};function sendTypingSignal(){if(!ws||ws.readyState!==1)return;const e=activeChatId?{chatId:activeChatId}:activePeer?{to:activePeer}:null;if(!e)return;const t=Date.now();t-typingSend.lastSent>2500&&(typingSend.lastSent=t,ws.send(JSON.stringify({type:"typing",...e}))),typingSend.stopTimer&&clearTimeout(typingSend.stopTimer),typingSend.stopTimer=setTimeout(sendStopTyping,3500)}function sendStopTyping(){if(typingSend.stopTimer&&(clearTimeout(typingSend.stopTimer),typingSend.stopTimer=null),typingSend.lastSent=0,!ws||ws.readyState!==1)return;const e=activeChatId?{chatId:activeChatId}:activePeer?{to:activePeer}:null;e&&ws.send(JSON.stringify({type:"stop_typing",...e}))}function typingBelongsToOpen(e){return e.scope==="dm"?!!activePeer&&e.from===activePeer:e.scope==="chat"?activeChatId===e.chatId:!1}function handleTypingSignal(e){if(e.type==="typing"){if(!typingBelongsToOpen(e))return;typingPeers.has(e.from)&&clearTimeout(typingPeers.get(e.from)),typingPeers.set(e.from,setTimeout(()=>{typingPeers.delete(e.from),renderTyping()},5e3)),renderTyping()}else clearTypingFor(e.from)}function clearTypingFor(e){typingPeers.has(e)&&(clearTimeout(typingPeers.get(e)),typingPeers.delete(e),renderTyping())}function clearTyping(){typingPeers.forEach(e=>clearTimeout(e)),typingPeers.clear(),renderTyping()}function renderTyping(){const e=document.getElementById("typingRow");if(!e)return;const t=[...typingPeers.keys()];if(t.length===0){e.classList.add("hidden"),e.innerHTML="";return}let n;if(!activeChatId)n="\u043F\u0435\u0447\u0430\u0442\u0430\u0435\u0442";else{const i=t.map(s=>escapeHtml(findUser(s).nickname||s));i.length===1?n=i[0]+" \u043F\u0435\u0447\u0430\u0442\u0430\u0435\u0442":i.length===2?n=i[0]+" \u0438 "+i[1]+" \u043F\u0435\u0447\u0430\u0442\u0430\u044E\u0442":n="\u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u043F\u0435\u0447\u0430\u0442\u0430\u044E\u0442"}e.innerHTML=`<span class="typing-dots"><i></i><i></i><i></i></span><span class="typing-text">${n}\u2026</span>`,e.classList.remove("hidden")}function renderConversationHeader(){const e=document.getElementById("conversation");if(!activePeer&&!activeChatId){e.innerHTML=`<div class="empty-state">
      <div class="logo burm-glow" style="width:96px;height:96px;background:#000;"><img src="/drun-logo.png" alt="\u0414\u0440\u0443\u043D" style="border-radius:50%;"></div>
      <div>\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0430 \u0441\u043B\u0435\u0432\u0430, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0443</div>
    </div>`;return}if(activeChatId){const a=findChat(activeChatId);if(!a)return;const o=a.kind!=="channel"||a.my_role==="owner"||a.my_role==="admin";if(e.innerHTML=`
      <div class="conv-header">
        <div class="back-btn" id="backBtn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <div class="avatar group-avatar" style="width:42px;height:42px;font-size:16px;background:${gradFor("chat"+a.id)}">${groupAvatarInner(a)}</div>
        <div style="flex:1;cursor:pointer;" id="chatHeaderInfo">
          <h2 class="conv-name">${escapeHtml(a.title)}<span class="chat-badge ${a.kind==="channel"?"channel":""}">${a.kind==="channel"?"\u043A\u0430\u043D\u0430\u043B":"\u0433\u0440\u0443\u043F\u043F\u0430"}</span></h2>
          <div class="conv-sub">${a.member_count} \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432</div>
        </div>
      </div>
      <div class="messages" id="messagesPane"></div>
      <div class="typing-row hidden" id="typingRow"></div>
      ${o?`
      ${voiceRecordingBarHtml()}
      ${mediaPreviewHtml()}
      <div class="composer">
        ${attachBtnHtml()}
        <div class="composer-box">
          <textarea id="msgInput" rows="1" placeholder="\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435\u2026"></textarea>
        </div>
        ${voiceBtnHtml()}
        ${stickerBtnHtml()}
        <button class="send-btn" id="sendBtn" title="\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
      </div>`:'<div class="mine-status" style="padding:14px;">\u0422\u043E\u043B\u044C\u043A\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u043A\u0430\u043D\u0430\u043B\u0430 \u043C\u043E\u0436\u0435\u0442 \u043F\u0438\u0441\u0430\u0442\u044C \u0441\u044E\u0434\u0430</div>'}
    `,document.getElementById("backBtn").onclick=closeConversationMobile,document.getElementById("chatHeaderInfo").onclick=()=>openChatInfoModal(a.id),o){let r=function(){const d=l.value.trim();!d&&!pendingMedia||(l.value="",sendStopTyping(),sendChatMessage(d))};var s=r;const l=document.getElementById("msgInput"),c=document.getElementById("sendBtn");c.onclick=r,l.addEventListener("keydown",d=>{d.key==="Enter"&&!d.shiftKey&&(d.preventDefault(),r())}),l.addEventListener("input",sendTypingSignal),wireMediaControls(r),wireVoiceControls(sendChatMessage),wireStickerControls(sendChatSticker),l.focus()}return}const t=findUser(activePeer);e.innerHTML=`
    <div class="conv-header">
      <div class="back-btn" id="backBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </div>
      <div class="avatar-with-status">
        <div class="avatar" style="width:42px;height:42px;font-size:14px;${avatarStyle(t)}">${avatarInnerHtml(t)}</div>
        ${presenceDotHtml(t.username)}
      </div>
      <div style="flex:1;cursor:pointer;" id="peerHeaderInfo">
        <h2 class="conv-name">${escapeHtml(t.nickname)}</h2>
        <div class="conv-sub" id="peerStatusLine">${isOnline(t.username)?'<span class="status-online">\u0432 \u0441\u0435\u0442\u0438</span>':"@"+escapeHtml(t.username)}</div>
      </div>
      <div class="call-controls">
        <button class="call-hdr-btn" id="callAudioBtn" title="\u0410\u0443\u0434\u0438\u043E\u0437\u0432\u043E\u043D\u043E\u043A">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>
        </button>
        <button class="call-hdr-btn" id="callVideoBtn" title="\u0412\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043E\u043A">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        </button>
      </div>
    </div>
    <div class="messages" id="messagesPane"></div>
    <div class="typing-row hidden" id="typingRow"></div>
    ${voiceRecordingBarHtml()}
    ${mediaPreviewHtml()}
    <div class="composer">
      <button class="gift-btn" id="giftBtn" title="\u041F\u043E\u0434\u0430\u0440\u0438\u0442\u044C \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430">
        <img src="/mascot-burmaldaets.png" alt="\u041F\u043E\u0434\u0430\u0440\u043E\u043A">
      </button>
      ${attachBtnHtml()}
      <div class="composer-box">
        <textarea id="msgInput" rows="1" placeholder="\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435\u2026"></textarea>
      </div>
      ${voiceBtnHtml()}
      ${stickerBtnHtml()}
      <button class="send-btn" id="sendBtn" title="\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `,document.getElementById("backBtn").onclick=closeConversationMobile,document.getElementById("giftBtn").onclick=()=>openGiftModal(activePeer),document.getElementById("peerHeaderInfo").onclick=()=>openUserProfileModal(activePeer),document.getElementById("callAudioBtn").onclick=()=>startCall(activePeer,"audio"),document.getElementById("callVideoBtn").onclick=()=>startCall(activePeer,"video");const n=document.getElementById("msgInput"),i=document.getElementById("sendBtn");function s(){const a=n.value.trim();!a&&!pendingMedia||(n.value="",sendStopTyping(),sendMessage(a))}i.onclick=s,n.addEventListener("keydown",a=>{a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),s())}),n.addEventListener("input",sendTypingSignal),wireMediaControls(s),wireVoiceControls(sendMessage),wireStickerControls(sendPeerSticker),n.focus()}let pendingMedia=null;const MAX_MEDIA_BYTES=25*1024*1024,IMAGE_MAX_SIDE=1600,IMAGE_QUALITY=.82;function attachBtnHtml(){return`
    <input type="file" id="mediaInput" accept="image/*,video/*" style="display:none">
    <button class="attach-btn" id="attachBtn" title="\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u043E\u0442\u043E \u0438\u043B\u0438 \u0432\u0438\u0434\u0435\u043E">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
    </button>
  `}function mediaPreviewHtml(){return`
    <div class="media-preview" id="mediaPreview"></div>
    <div class="upload-bar" id="uploadBar"></div>
  `}function voiceBtnHtml(){return`
    <button class="voice-btn" id="voiceBtn" title="\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    </button>
  `}function voiceRecordingBarHtml(){return`<div class="voice-recording-bar" id="voiceRecBar">
    <div class="voice-rec-dot"></div>
    <div class="voice-rec-time" id="voiceRecTime">0:00</div>
    <div class="voice-rec-label">\u0417\u0430\u043F\u0438\u0441\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0433\u043E\u2026</div>
    <button class="voice-rec-cancel" id="voiceRecCancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
    <button class="voice-rec-stop" id="voiceRecStop">\u0413\u043E\u0442\u043E\u0432\u043E</button>
  </div>`}let voiceRecorder=null,voiceChunks=[],voiceStream=null,voiceStartedAt=0,voiceTimerInterval=null;const VOICE_MAX_MS=180*1e3;function wireVoiceControls(e){const t=document.getElementById("voiceBtn");if(!t)return;t.onclick=()=>startVoiceRecording(e);const n=document.getElementById("voiceRecCancel"),i=document.getElementById("voiceRecStop");n&&(n.onclick=cancelVoiceRecording),i&&(i.onclick=()=>stopVoiceRecording(e))}function pickVoiceMime(){const e=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"];for(const t of e)if(window.MediaRecorder&&MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))return t;return""}async function startVoiceRecording(e){if(voiceRecorder)return;if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){alert("\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442 \u0437\u0430\u043F\u0438\u0441\u044C \u0437\u0432\u0443\u043A\u0430");return}try{voiceStream=await navigator.mediaDevices.getUserMedia({audio:!0})}catch{alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443");return}const t=pickVoiceMime();voiceChunks=[];try{voiceRecorder=t?new MediaRecorder(voiceStream,{mimeType:t}):new MediaRecorder(voiceStream)}catch{voiceRecorder=new MediaRecorder(voiceStream)}voiceRecorder.ondataavailable=a=>{a.data&&a.data.size&&voiceChunks.push(a.data)},voiceRecorder.start(),voiceStartedAt=Date.now();const n=document.getElementById("voiceRecBar"),i=document.getElementById("voiceBtn");n&&n.classList.add("show"),i&&i.classList.add("recording");const s=document.getElementById("voiceRecTime");voiceTimerInterval=setInterval(()=>{const a=Date.now()-voiceStartedAt;s&&(s.textContent=formatVoiceTime(a)),a>=VOICE_MAX_MS&&stopVoiceRecording(e)},200)}function formatVoiceTime(e){const t=Math.floor(e/1e3),n=Math.floor(t/60),i=t%60;return`${n}:${String(i).padStart(2,"0")}`}function teardownVoiceRecording(){voiceTimerInterval&&(clearInterval(voiceTimerInterval),voiceTimerInterval=null),voiceStream&&(voiceStream.getTracks().forEach(n=>n.stop()),voiceStream=null),voiceRecorder=null,voiceChunks=[];const e=document.getElementById("voiceRecBar"),t=document.getElementById("voiceBtn");e&&e.classList.remove("show"),t&&t.classList.remove("recording")}function cancelVoiceRecording(){voiceRecorder&&voiceRecorder.state!=="inactive"&&(voiceRecorder.onstop=null,voiceRecorder.stop()),teardownVoiceRecording()}function stopVoiceRecording(e){if(!voiceRecorder||voiceRecorder.state==="inactive")return;const t=Date.now()-voiceStartedAt;voiceRecorder.onstop=async()=>{const n=voiceRecorder.mimeType||"audio/webm",i=new Blob(voiceChunks,{type:n});if(teardownVoiceRecording(),!(t<700||i.size<500))try{pendingMedia={dataUrl:await blobToDataUrl(i),mime:n,kind:"audio",name:"\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435",dur:Math.round(t/1e3)},await sendVoiceMessage(e)}catch{alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")}},voiceRecorder.stop()}function blobToDataUrl(e){return new Promise((t,n)=>{const i=new FileReader;i.onload=()=>t(i.result),i.onerror=()=>n(new Error("read failed")),i.readAsDataURL(e)})}async function sendVoiceMessage(e){await e("")}const VOICE_WAVE_PATTERN=[6,10,16,9,20,13,24,11,18,8,15,22,10,17,7,13,19,9,14,6];function voiceBubbleHtml(e){const t=e.media_dur||0,n=VOICE_WAVE_PATTERN.map((i,s)=>`<span style="height:${i}px" data-bar="${s}"></span>`).join("");return`
    <div class="voice-bubble" data-voice-id="${e.id}">
      <button class="voice-play-btn" data-voice-play="${e.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
      </button>
      <div class="voice-wave" data-voice-wave="${e.id}">${n}</div>
      <div class="voice-dur" data-voice-dur="${e.id}">${formatVoiceTime((t||0)*1e3)}</div>
      <audio data-voice-audio="${e.id}" src="${e.media_url}" preload="none"></audio>
    </div>
  `}let voiceCurrentlyPlayingId=null;function wireVoicePlayers(e){e.querySelectorAll("[data-voice-play]").forEach(t=>{const n=t.dataset.voicePlay;t.onclick=()=>toggleVoicePlayback(n)})}function toggleVoicePlayback(e){const t=document.querySelector(`audio[data-voice-audio="${e}"]`),n=document.querySelector(`[data-voice-play="${e}"]`),i=document.querySelector(`[data-voice-wave="${e}"]`),s=document.querySelector(`[data-voice-dur="${e}"]`);if(!t)return;const a=messages.find(c=>String(c.id)===String(e)),o=a&&a.media_dur?a.media_dur:0,l=()=>isFinite(t.duration)&&t.duration>0?t.duration:o;if(voiceCurrentlyPlayingId&&voiceCurrentlyPlayingId!==e){const c=document.querySelector(`audio[data-voice-audio="${voiceCurrentlyPlayingId}"]`);c&&c.pause()}if(t.paused)t.play().catch(()=>{}),voiceCurrentlyPlayingId=e,setPlayIcon(n,!0);else{t.pause(),setPlayIcon(n,!1);return}t.ontimeupdate=()=>{const c=l();if(!c)return;const r=Math.min(1,t.currentTime/c);if(i){const u=i.querySelectorAll("span"),d=Math.round(r*u.length);u.forEach((m,v)=>m.classList.toggle("on",v<d)),i.classList.add("played")}s&&(s.textContent=formatVoiceTime(Math.max(0,c-t.currentTime)*1e3))},t.onended=()=>{setPlayIcon(n,!1),i&&(i.querySelectorAll("span").forEach(c=>c.classList.remove("on")),i.classList.remove("played")),s&&(s.textContent=formatVoiceTime(l()*1e3)),voiceCurrentlyPlayingId=null},t.onpause=()=>{t.ended||setPlayIcon(n,!1)}}function setPlayIcon(e,t){e&&(e.innerHTML=t?'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>')}let stickersCache=null;function stickerBtnHtml(){return`
    <button class="sticker-btn" id="stickerBtn" title="\u0421\u0442\u0438\u043A\u0435\u0440\u044B">
      <span>\u{1F439}</span>
      <div class="sticker-panel" id="stickerPanel"></div>
    </button>
  `}async function loadStickers(){if(stickersCache)return stickersCache;try{stickersCache=(await apiFetch("/api/stickers")).stickers||[]}catch{stickersCache=[]}return stickersCache}function wireStickerControls(e){const t=document.getElementById("stickerBtn"),n=document.getElementById("stickerPanel");!t||!n||(t.onclick=async i=>{i.stopPropagation();const s=!n.classList.contains("show");if(closeAllStickerPanels(),!!s){if(!n.dataset.loaded){n.innerHTML=`<div class="sticker-panel-grid">${"".padStart(0)}</div>`;const a=await loadStickers();n.innerHTML=`<div class="sticker-panel-grid">${a.map(o=>`<div class="sticker-panel-item" data-sticker-kind="${escapeHtml(o.kind)}" title="${escapeHtml(o.label)}"><img src="${o.image}" alt="${escapeHtml(o.label)}"></div>`).join("")}</div>`,n.dataset.loaded="1",n.querySelectorAll("[data-sticker-kind]").forEach(o=>{o.onclick=()=>{closeAllStickerPanels(),e(o.dataset.stickerKind)}})}n.classList.add("show")}},document.body.dataset.stickerOutsideWired||(document.body.dataset.stickerOutsideWired="1",document.addEventListener("click",closeAllStickerPanels)))}function closeAllStickerPanels(){document.querySelectorAll(".sticker-panel.show").forEach(e=>e.classList.remove("show"))}async function sendPeerSticker(e){if(activePeer)try{const t=await apiFetch("/api/messages/"+encodeURIComponent(activePeer)+"/sticker",{method:"POST",body:JSON.stringify({kind:e})});t.message&&(messages.push(t.message),renderMessages())}catch(t){alert(t&&t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0438\u043A\u0435\u0440")}}async function sendChatSticker(e){if(activeChatId)try{const t=await apiFetch("/api/chats/"+activeChatId+"/messages/sticker",{method:"POST",body:JSON.stringify({kind:e})});t.message&&(messages.some(i=>i.id===t.message.id)||(messages.push(t.message),renderMessages()))}catch(t){alert(t&&t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u0442\u0438\u043A\u0435\u0440")}}function stickerBubbleHtml(e){const t=(stickersCache||[]).find(s=>s.kind===e.sticker_kind),n=t?t.image:`/stickers/${e.sticker_kind}.svg`,i=t?t.label:e.text||"\u0421\u0442\u0438\u043A\u0435\u0440";return`<img src="${n}" alt="${escapeHtml(i)}">`}function wireMediaControls(e){const t=document.getElementById("attachBtn"),n=document.getElementById("mediaInput"),i=document.getElementById("msgInput");if(!t||!n)return;clearPendingMedia(),t.onclick=()=>n.click(),n.onchange=async()=>{const a=n.files&&n.files[0];n.value="",a&&await setPendingMedia(a)},i&&i.addEventListener("paste",async a=>{const o=a.clipboardData&&a.clipboardData.files||[];o.length&&(a.preventDefault(),await setPendingMedia(o[0]))});const s=document.getElementById("conversation");s&&!s.dataset.dropWired&&(s.dataset.dropWired="1",s.addEventListener("dragover",a=>{a.preventDefault()}),s.addEventListener("drop",async a=>{a.preventDefault();const o=a.dataTransfer&&a.dataTransfer.files&&a.dataTransfer.files[0];o&&await setPendingMedia(o)}))}async function setPendingMedia(e){if(!e)return;const t=e.type.startsWith("image/"),n=e.type.startsWith("video/");if(!t&&!n){alert("\u041C\u043E\u0436\u043D\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u043E\u0442\u043E \u0438 \u0432\u0438\u0434\u0435\u043E");return}try{if(t&&e.type!=="image/gif")pendingMedia=await compressImage(e);else{const i=await fileToDataUrl(e);if(Math.round((i.length-i.indexOf(",")-1)*.75)>MAX_MEDIA_BYTES){alert("\u0424\u0430\u0439\u043B \u0431\u043E\u043B\u044C\u0448\u0435 25 \u041C\u0411 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043E\u043C\u0435\u043D\u044C\u0448\u0435 \u0438\u043B\u0438 \u0441\u043E\u0436\u043C\u0438\u0442\u0435 \u0435\u0433\u043E");return}const a=n?await videoDimensions(i):{w:null,h:null};pendingMedia={dataUrl:i,mime:e.type,kind:n?"video":"image",name:e.name,w:a.w,h:a.h}}renderMediaPreview()}catch{alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0444\u0430\u0439\u043B")}}function fileToDataUrl(e){return new Promise((t,n)=>{const i=new FileReader;i.onload=()=>t(i.result),i.onerror=()=>n(new Error("read failed")),i.readAsDataURL(e)})}function compressImage(e){return new Promise(async(t,n)=>{try{const i=await fileToDataUrl(e),s=new Image;s.onload=()=>{let{width:a,height:o}=s;const l=Math.min(1,IMAGE_MAX_SIDE/Math.max(a,o));a=Math.round(a*l),o=Math.round(o*l);const c=document.createElement("canvas");c.width=a,c.height=o,c.getContext("2d").drawImage(s,0,0,a,o);const u=c.toDataURL("image/jpeg",IMAGE_QUALITY);t({dataUrl:u,mime:"image/jpeg",kind:"image",name:e.name,w:a,h:o})},s.onerror=()=>n(new Error("decode failed")),s.src=i}catch(i){n(i)}})}function videoDimensions(e){return new Promise(t=>{const n=document.createElement("video");n.preload="metadata",n.onloadedmetadata=()=>t({w:n.videoWidth||null,h:n.videoHeight||null}),n.onerror=()=>t({w:null,h:null}),n.src=e})}function renderMediaPreview(){const e=document.getElementById("mediaPreview");if(!e)return;if(!pendingMedia){e.classList.remove("show"),e.innerHTML="";return}const t=pendingMedia.kind==="video"?`<video src="${pendingMedia.dataUrl}" muted></video>`:pendingMedia.kind==="audio"?'<div style="width:44px;height:44px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;">\u{1F399}\uFE0F</div>':`<img src="${pendingMedia.dataUrl}" alt="">`,n=pendingMedia.kind==="video"?"\u0412\u0438\u0434\u0435\u043E":pendingMedia.kind==="audio"?"\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435":"\u0424\u043E\u0442\u043E";e.classList.add("show"),e.innerHTML=`
    ${t}
    <div style="flex:1;min-width:0;">
      <div class="media-preview-name">${escapeHtml(pendingMedia.name||n)}</div>
      <div class="media-preview-drop">${n} \u0433\u043E\u0442\u043E\u0432\u043E \u043A \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0435</div>
    </div>
    <button class="media-preview-x" id="mediaPreviewX" title="\u0423\u0431\u0440\u0430\u0442\u044C">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `,document.getElementById("mediaPreviewX").onclick=clearPendingMedia}function clearPendingMedia(){pendingMedia=null,renderMediaPreview(),setUploadProgress(0)}function setUploadProgress(e){const t=document.getElementById("uploadBar");t&&(t.style.width=e+"%")}function openLightbox(e,t){const n=document.createElement("div");n.className="lightbox",n.innerHTML=t==="video"?`<video src="${e}" controls autoplay playsinline></video>`:`<img src="${e}" alt="">`;const i=document.createElement("button");i.className="lightbox-close",i.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',n.appendChild(i);const s=()=>{n.remove(),document.removeEventListener("keydown",a)},a=o=>{o.key==="Escape"&&s()};n.addEventListener("click",o=>{o.target===n&&s()}),i.onclick=s,document.addEventListener("keydown",a),document.body.appendChild(n)}let REACTION_SET=["\u{1F44D}","\u2764\uFE0F","\u{1F602}","\u{1F525}","\u{1F62E}","\u{1F622}","\u{1F37E}"];async function loadReactionSet(){try{const e=await apiFetch("/api/reactions");e.reactions&&e.reactions.length&&(REACTION_SET=e.reactions)}catch{}}function reactionsHtml(e){return!e.reactions||!e.reactions.length?"":'<div class="reactions">'+e.reactions.map(t=>`
    <div class="reaction-chip ${t.mine?"mine":""}" data-react-msg="${e.id}" data-react-emoji="${escapeHtml(t.emoji)}">
      <span>${t.emoji}</span><span class="reaction-count">${t.count}</span>
    </div>
  `).join("")+"</div>"}function reactBtnHtml(e){return e.id?`<button class="react-btn" data-react-open="${e.id}" title="\u0420\u0435\u0430\u043A\u0446\u0438\u044F">\u263A</button>`:""}function canDeleteMsg(e){return!!e.id&&(e.from_user===me.username||me&&me.is_owner)}function msgDeleteBtnHtml(e){return canDeleteMsg(e)?`<button class="msg-del-btn" data-del-msg="${e.id}" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
  </button>`:""}async function deleteMessage(e){if(confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u0442\u043E \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435?"))try{await apiFetch("/api/messages/"+e,{method:"DELETE"}),messages=messages.filter(t=>t.id!==e),renderMessages({keepScroll:!0})}catch(t){alert(t&&t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")}}function closeReactPopup(){const e=document.getElementById("reactPopup");e&&e.remove()}function openReactPopup(e,t){closeReactPopup();const n=messages.find(d=>d.id===e),i=n&&n.reactions?(n.reactions.find(d=>d.mine)||{}).emoji:null,s=document.createElement("div");s.className="react-popup",s.id="reactPopup",s.innerHTML=REACTION_SET.map(d=>`<button data-emoji="${escapeHtml(d)}" class="${d===i?"mine":""}">${d}</button>`).join(""),document.body.appendChild(s);const a=t.getBoundingClientRect(),o=s.offsetWidth,l=s.offsetHeight;let c=Math.min(Math.max(8,a.left+a.width/2-o/2),window.innerWidth-o-8),r=a.top-l-8;r<8&&(r=a.bottom+8),s.style.left=c+"px",s.style.top=r+"px",s.querySelectorAll("button").forEach(d=>{d.onclick=()=>{closeReactPopup(),toggleReaction(e,d.dataset.emoji)}}),setTimeout(()=>{document.addEventListener("click",u,{once:!0})},0);function u(d){s.contains(d.target)||closeReactPopup()}}async function toggleReaction(e,t){const n=messages.find(s=>s.id===e),i=n&&n.reactions&&n.reactions.some(s=>s.mine&&s.emoji===t);try{const s=await apiFetch(`/api/messages/${e}/react`,{method:"POST",body:JSON.stringify({emoji:i?null:t})});applyReactions(e,s.reactions)}catch{}}function applyReactions(e,t){const n=messages.find(i=>i.id===e);n&&(n.reactions=t||[],renderMessages({keepScroll:!0}))}function renderMessages(e={}){const t=document.getElementById("messagesPane");if(!t)return;if(messages.length===0){t.innerHTML='<div class="no-messages">\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439. \u041D\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u043C!</div>';return}const n=t.scrollTop,i=t.scrollHeight-t.scrollTop-t.clientHeight<60,s=!!activeChatId;t.innerHTML=messages.map(a=>{const o=a.from_user===me.username,l=s&&!o?`<div class="msg-sender">${escapeHtml(a.from_nickname||a.from_user)}</div>`:"";let c;if(a.type==="gift"){const r=GIFT_TIERS[a.gift_kind]||GIFT_TIERS[DEFAULT_GIFT_KIND],u=r&&r.image?r.image:"/mascot-burmaldaets.png";c=`
        <div class="bubble gift-bubble gift-bubble-${a.gift_kind||DEFAULT_GIFT_KIND}">
          <img src="${u}" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446">
          <div class="gift-bubble-text">
            <div class="gift-bubble-title">${o?`\u0412\u044B \u043F\u043E\u0434\u0430\u0440\u0438\u043B\u0438: ${r.label}`:`\u0412\u0430\u043C \u043F\u043E\u0434\u0430\u0440\u0438\u043B\u0438: ${r.label}`}</div>
            <div class="gift-bubble-cost">${a.gift_amount||0} \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
          </div>
          <span class="msg-time">${formatTime(a.created_at)}</span>
        </div>
      `}else if(a.type==="sticker"&&a.sticker_kind)c=`
        <div class="bubble sticker-bubble">
          ${l}
          ${stickerBubbleHtml(a)}
          <span class="msg-time">${formatTime(a.created_at)}</span>
        </div>
      `;else if(a.type==="audio"&&a.media_url)c=`
        <div class="bubble">
          ${l}
          ${voiceBubbleHtml(a)}
          <span class="msg-time">${formatTime(a.created_at)}</span>
        </div>
      `;else if((a.type==="image"||a.type==="video")&&a.media_url){const r=!!(a.text&&a.text.trim()),u=a.media_w&&a.media_h?`aspect-ratio:${a.media_w}/${a.media_h};width:${Math.min(320,a.media_w)}px;`:"",d=a.type==="video"?`<video class="media-el" style="${u}" src="${a.media_url}" controls preload="metadata" playsinline></video>`:`<img class="media-el" style="${u}" src="${a.media_url}" alt="\u0424\u043E\u0442\u043E" loading="lazy" data-lightbox="${a.media_url}">`;c=`
        <div class="bubble media-bubble ${r?"":"media-only"}">
          ${l}
          ${d}
          ${r?`<div class="media-caption">${escapeHtml(a.text)}</div>`:""}
          <span class="msg-time">${formatTime(a.created_at)}</span>
        </div>
      `}else c=`<div class="bubble">${l}${escapeHtml(a.text)}<span class="msg-time">${formatTime(a.created_at)}</span></div>`;return`
      <div class="msg-row ${o?"out":"in"}">
        <div class="msg-wrap">
          <div class="msg-actions">
            ${reactBtnHtml(a)}
            ${msgDeleteBtnHtml(a)}
          </div>
          ${c}
          ${reactionsHtml(a)}
        </div>
      </div>
    `}).join(""),t.querySelectorAll("[data-lightbox]").forEach(a=>{a.onclick=()=>openLightbox(a.dataset.lightbox,"image")}),wireVoicePlayers(t),t.querySelectorAll("[data-react-open]").forEach(a=>{a.onclick=o=>{o.stopPropagation(),openReactPopup(Number(a.dataset.reactOpen),a)}}),t.querySelectorAll("[data-react-msg]").forEach(a=>{a.onclick=()=>toggleReaction(Number(a.dataset.reactMsg),a.dataset.reactEmoji)}),t.querySelectorAll("[data-del-msg]").forEach(a=>{a.onclick=o=>{o.stopPropagation(),deleteMessage(Number(a.dataset.delMsg))}}),e.keepScroll&&!i?t.scrollTop=n:t.scrollTop=t.scrollHeight}async function sendMessage(e){if(!activePeer)return;const t=activePeer,n=pendingMedia;clearPendingMedia(),n&&setUploadProgress(30);try{const i=await apiFetch("/api/messages/"+encodeURIComponent(t),{method:"POST",body:JSON.stringify(n?{text:e,media:n.dataUrl,mediaW:n.w,mediaH:n.h,mediaDur:n.dur}:{text:e})});i.message&&activePeer===t&&!activeChatId&&(messages.some(a=>a.id===i.message.id)||(messages.push(i.message),renderMessages())),activePeer===t&&setUploadProgress(0)}catch(i){activePeer===t&&(setUploadProgress(0),n&&(pendingMedia=n,renderMediaPreview())),i&&i.message&&alert(i.message)}}async function sendChatMessage(e){if(!activeChatId)return;const t=activeChatId,n=pendingMedia;clearPendingMedia(),n&&setUploadProgress(30);try{const i=await apiFetch("/api/chats/"+t+"/messages",{method:"POST",body:JSON.stringify(n?{text:e,media:n.dataUrl,mediaW:n.w,mediaH:n.h,mediaDur:n.dur}:{text:e})});i.message&&activeChatId===t&&(messages.some(a=>a.id===i.message.id)||(messages.push(i.message),renderMessages())),activeChatId===t&&setUploadProgress(0)}catch(i){activeChatId===t&&(setUploadProgress(0),n&&(pendingMedia=n,renderMediaPreview())),alert(i&&i.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435")}}function requestNotifPermission(){try{if(!("Notification"in window))return;Notification.permission==="default"&&Notification.requestPermission().catch(()=>{})}catch{}}function notifPreview(e){return e.type==="image"?"\u{1F4F7} \u0424\u043E\u0442\u043E":e.type==="video"?"\u{1F3AC} \u0412\u0438\u0434\u0435\u043E":e.type==="audio"?"\u{1F3A4} \u0413\u043E\u043B\u043E\u0441\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435":e.type==="gift"?"\u{1F381} \u041F\u043E\u0434\u0430\u0440\u043E\u043A":e.type==="sticker"?"\u{1F430} \u0421\u0442\u0438\u043A\u0435\u0440":(e.text||"").slice(0,120)}function maybeNotify(e,t){try{if(!("Notification"in window)||Notification.permission!=="granted"||document.hasFocus())return;const n=findUser(e.from_user).nickname||e.from_user;let i,s,a;if(t){const l=findChat(t);i=l?l.title:"\u041D\u043E\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435",s=n+": "+notifPreview(e),a="chat:"+t}else i=n,s=notifPreview(e),a="dm:"+e.from_user;const o=new Notification(i,{body:s,tag:a,icon:"/mascot-burmaldaets.png",renotify:!0});o.onclick=()=>{window.focus(),t?selectChat(t,null):selectChat(null,e.from_user),o.close()}}catch{}}function connectWs(){const e=location.protocol==="https:"?"wss:":"ws:";ws=new WebSocket(e+"//"+location.host+"/ws?token="+encodeURIComponent(token)),ws.onopen=()=>{document.getElementById("connStatus").textContent="\u0432 \u0441\u0435\u0442\u0438",document.getElementById("connStatus").classList.add("online"),wsConnectedOnce&&(loadUsers(),loadChats()),wsConnectedOnce=!0},ws.onclose=()=>{document.getElementById("connStatus").textContent="\u043E\u0444\u043B\u0430\u0439\u043D",document.getElementById("connStatus").classList.remove("online"),setTimeout(()=>{token&&connectWs()},2e3)},ws.onmessage=t=>{try{const n=JSON.parse(t.data);if(n.type==="message"){const i=n.message,s=i.from_user===me.username?i.to_user:i.from_user;addRecentContact(s),i.from_user!==me.username&&clearTypingFor(i.from_user),activePeer&&(i.from_user===activePeer||i.to_user===activePeer)&&(messages.some(o=>o.id===i.id)||(messages.push(i),renderMessages())),i.from_user!==me.username&&i.type==="gift"&&(()=>{const tier=GIFT_TIERS[i.gift_kind]||GIFT_TIERS[DEFAULT_GIFT_KIND];showGiftFlash(i.gift_kind,`${findUser(i.from_user).nickname||i.from_user} \u043F\u043E\u0434\u0430\u0440\u0438\u043B \u0432\u0430\u043C ${(tier&&tier.label)||""}`,`${i.gift_amount||0} \u0447\u0435\u043A\u0443\u0448\u0435\u043A`)})(),i.from_user!==me.username&&maybeNotify(i,null),renderChatList(document.getElementById("searchInput").value)}else if(n.type==="chat_message"){const i=n.message;i.from_user!==me.username&&clearTypingFor(i.from_user),activeChatId===n.chatId&&(messages.some(a=>a.id===i.id)||(messages.push(i),renderMessages())),i.from_user!==me.username&&maybeNotify(i,n.chatId),renderChatList(document.getElementById("searchInput").value)}else if(n.type==="typing"||n.type==="stop_typing")handleTypingSignal(n);else if(n.type==="reaction_update")(n.chatId?activeChatId===n.chatId:activePeer)&&applyReactions(n.messageId,n.reactions);else if(n.type==="chat_created"){const i=chats.findIndex(s=>s.id===n.chat.id);i>=0?chats[i]=n.chat:chats.unshift(n.chat),renderChatList(document.getElementById("searchInput").value)}else if(n.type==="profile_update"){const i=n.user,s=users.findIndex(a=>a.username===i.username);s>=0&&(users[s]=i),renderChatList(document.getElementById("searchInput").value),activePeer===i.username&&renderConversationHeader(),activePeer===i.username&&loadMessages(activePeer)}else if(n.type==="user_new"){const i=n.user;i&&i.username!==me.username&&!users.some(s=>s.username===i.username)&&(users.push(i),users.sort((s,a)=>(s.nickname||"").localeCompare(a.nickname||"","ru",{sensitivity:"base"})),renderChatList(document.getElementById("searchInput").value))}else if(n.type==="user_removed")users=users.filter(i=>i.username!==n.username),activePeer===n.username&&(activePeer=null,renderConversationHeader()),renderChatList(document.getElementById("searchInput").value);else if(n.type==="presence_list")onlineUsers=new Set(n.online||[]),refreshPresenceUI();else if(n.type==="presence")n.online?onlineUsers.add(n.username):onlineUsers.delete(n.username),refreshPresenceUI(),n.online||(call&&call.peer===n.username&&(callToast("\u0421\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F"),endCall(!1)),incomingCall&&incomingCall.peer===n.username&&(incomingCall=null,ringTimeout&&clearTimeout(ringTimeout),hideCallUI()));else if(n.type==="message_deleted"){const i=n.chatId?activeChatId===n.chatId:!!activePeer,s=messages.length;messages=messages.filter(a=>a.id!==n.id),i&&messages.length!==s&&renderMessages({keepScroll:!0})}else n.type&&n.type.indexOf("call_")===0&&handleCallSignal(n)}catch{}}}document.getElementById("searchInput").addEventListener("input",e=>{renderChatList(e.target.value)}),document.getElementById("newChatBtn").onclick=openNewChatModal;function renderMe(){document.getElementById("meAvatar").style.cssText=avatarStyle(me),document.getElementById("meAvatar").innerHTML=avatarInnerHtml(me),document.getElementById("meAvatar").title=me.nickname,document.getElementById("meAvatarMobile").style.cssText=avatarStyle(me),document.getElementById("meAvatarMobile").innerHTML=avatarInnerHtml(me),document.getElementById("meAvatarMobile").title=me.nickname,renderBalance()}function renderBalance(){const e=me&&typeof me.balance=="number"?me.balance:0,t=document.getElementById("balanceValueRail"),n=document.getElementById("balanceValueMobile");t&&(t.textContent=e),n&&(n.textContent=e)}function enterApp(){document.getElementById("authScreen").classList.add("hidden"),document.getElementById("appScreen").classList.remove("hidden"),renderMe(),requestNotifPermission(),loadUsers(),loadChats(),connectWs(),loadGiftTiers(),loadReactionSet(),loadStickers()}let pendingAvatar;function openProfileModal(){pendingAvatar=void 0;const e=document.createElement("div");e.className="modal-overlay",e.id="profileOverlay",e.innerHTML=`
    <div class="modal-card" style="position:relative;">
      <div class="modal-close" id="profileClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">\u041F\u0440\u043E\u0444\u0438\u043B\u044C</h2>
      <div class="modal-avatar-row">
        <div class="modal-avatar" id="modalAvatarPreview" style="${avatarStyle(me)}">${avatarInnerHtml(me)}</div>
        <div class="avatar-actions">
          <button class="pill-btn" id="changePhotoBtn">\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0444\u043E\u0442\u043E</button>
          <button class="pill-btn danger ${me.avatar?"":"hidden"}" id="removePhotoBtn">\u0423\u0434\u0430\u043B\u0438\u0442\u044C</button>
        </div>
      </div>
      <div class="auth-field-label">\u041D\u0438\u043A</div>
      <input class="auth-input" id="profileNickname" value="${escapeHtml(me.nickname)}" maxlength="40">
      <div class="modal-static-field">\u0418\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: <b>@${escapeHtml(me.username)}</b><br>\u043F\u043E \u043D\u0435\u043C\u0443 \u0432\u0430\u0441 \u043D\u0430\u0445\u043E\u0434\u044F\u0442 \u0432 \u043F\u043E\u0438\u0441\u043A\u0435, \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F</div>
      <div class="auth-error" id="profileError"></div>
      <div class="modal-actions">
        <button class="pill-btn" id="profileCancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button class="auth-button" id="profileSave">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button>
      </div>
    </div>
  `,document.body.appendChild(e);const t=document.getElementById("avatarFileInput");document.getElementById("changePhotoBtn").onclick=()=>{t.value="",t.click()},t.onchange=async()=>{const n=t.files[0];if(n)try{const i=await resizeImageToDataUrl(n,256);pendingAvatar=i;const s=document.getElementById("modalAvatarPreview");s.style.cssText="",s.innerHTML=`<img src="${i}" alt="">`,document.getElementById("removePhotoBtn").classList.remove("hidden")}catch{document.getElementById("profileError").textContent="\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0444\u043E\u0442\u043E"}},document.getElementById("removePhotoBtn").onclick=()=>{pendingAvatar=null;const n=document.getElementById("modalAvatarPreview");n.style.cssText=avatarStyle({username:me.username}),n.innerHTML=escapeHtml(initials(me.nickname)),document.getElementById("removePhotoBtn").classList.add("hidden")},document.getElementById("profileClose").onclick=closeProfileModal,document.getElementById("profileCancel").onclick=closeProfileModal,e.addEventListener("click",n=>{n.target===e&&closeProfileModal()}),document.getElementById("profileSave").onclick=saveProfile}function closeProfileModal(){const e=document.getElementById("profileOverlay");e&&e.remove()}async function saveProfile(){const e=document.getElementById("profileError"),t=document.getElementById("profileNickname").value.trim();if(!t){e.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0438\u043A";return}const n=document.getElementById("profileSave");n.disabled=!0;try{const i={nickname:t};pendingAvatar!==void 0&&(i.avatar=pendingAvatar),me=(await apiFetch("/api/profile",{method:"PATCH",body:JSON.stringify(i)})).user,localStorage.setItem("nova_me",JSON.stringify(me)),renderMe(),closeProfileModal()}catch(i){e.textContent=i&&i.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",n.disabled=!1}}function resizeImageToDataUrl(e,t){return new Promise((n,i)=>{const s=new Image,a=new FileReader;a.onload=()=>{s.src=a.result},a.onerror=i,s.onload=()=>{const o=Math.min(s.width,s.height),l=(s.width-o)/2,c=(s.height-o)/2,r=document.createElement("canvas");r.width=t,r.height=t,r.getContext("2d").drawImage(s,l,c,o,o,0,0,t,t),n(r.toDataURL("image/jpeg",.85))},s.onerror=i,a.readAsDataURL(e)})}document.getElementById("meAvatarBtn").onclick=openProfileModal,document.getElementById("meAvatarBtnMobile").onclick=openProfileModal,document.getElementById("balancePill").onclick=openSettingsModal,document.getElementById("balancePillMobile").onclick=openSettingsModal;function openSettingsModal(){const e=document.createElement("div");e.className="modal-overlay",e.id="settingsOverlay";const t=localStorage.getItem("nova_sound_pref")!=="off";if(e.innerHTML=`
    <div class="modal-card" style="position:relative;">
      <div class="modal-close" id="settingsClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438</h2>

      <div class="settings-section-label">\u041A\u043E\u0448\u0435\u043B\u0451\u043A</div>
      <div class="wallet-card">
        <div class="wallet-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 2h6M10 2v5.5L5.5 15A3 3 0 008 20h8a3 3 0 002.5-5L14 7.5V2"/></svg>
        </div>
        <div style="flex:1;">
          <div class="wallet-balance"><span id="settingsBalanceValue">${me.balance||0}</span> \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
          <div class="wallet-hint">\u0427\u0435\u043A\u0443\u0448\u043A\u0438 \u0434\u043E\u0431\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0448\u0430\u0445\u0442\u0435 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</div>
        </div>
      </div>

      <button class="mine-launch-btn" id="hammamLaunchBtn" style="margin-top:10px;">
        <span class="mine-launch-emoji">\u2668\uFE0F</span>
        <span style="flex:1;text-align:left;">
          <div class="settings-row-title">\u0425\u0430\u043C\u043C\u0430\u043C</div>
          <div class="settings-row-sub">\u041F\u0440\u043E\u043A\u0430\u0447\u0430\u0442\u044C \u0437\u0430 \u0447\u0435\u043A\u0443\u0448\u043A\u0438</div>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button class="mine-launch-btn" id="mineLaunchBtn" style="margin-top:10px;">
        <span class="mine-launch-emoji">\u26CF\uFE0F</span>
        <span style="flex:1;text-align:left;">
          <div class="settings-row-title">\u0428\u0430\u0445\u0442\u0430 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</div>
          <div class="settings-row-sub">\u041A\u043E\u043F\u0430\u0442\u044C \u0438 \u0438\u0441\u043A\u0430\u0442\u044C \u0447\u0435\u043A\u0443\u0448\u043A\u0438</div>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <button class="slots-launch-btn" id="slotsLaunchBtn">
        <span class="slots-launch-emoji">\u{1F3B0}</span>
        <span style="flex:1;text-align:left;">
          <div class="settings-row-title">\u0410\u0432\u0442\u043E\u043C\u0430\u0442 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</div>
          <div class="settings-row-sub">\u041A\u0440\u0443\u0442\u0438\u0442\u044C \u0431\u0430\u0440\u0430\u0431\u0430\u043D\u044B \u043D\u0430 \u0443\u0434\u0430\u0447\u0443</div>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>

      <div class="settings-section-label" style="margin-top:18px;">\u041F\u0440\u043E\u0444\u0438\u043B\u044C</div>
      <div class="settings-row" id="settingsEditProfile">
        <div class="avatar" style="width:36px;height:36px;font-size:13px;${avatarStyle(me)}">${avatarInnerHtml(me)}</div>
        <div style="flex:1;">
          <div class="settings-row-title">${escapeHtml(me.nickname)}</div>
          <div class="settings-row-sub">@${escapeHtml(me.username)}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      <div class="settings-section-label" style="margin-top:18px;">\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F</div>
      <div class="settings-row" id="soundToggleRow">
        <div style="flex:1;">
          <div class="settings-row-title">\u0417\u0432\u0443\u043A \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439</div>
        </div>
        <div class="switch ${t?"on":""}" id="soundToggle"><div class="switch-knob"></div></div>
      </div>

      <div class="settings-row" id="themeToggleRow">
        <div style="flex:1;">
          <div class="settings-row-title">Тёмная тема</div>
        </div>
        <div class="switch ${localStorage.getItem("nova_theme")==="dark"?"on":""}" id="themeToggle"><div class="switch-knob"></div></div>
      </div>

      <div class="settings-section-label" style="margin-top:18px;">\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C</div>
      <div class="settings-row" id="settingsTwofa">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(52,224,161,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--online)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div style="flex:1;">
          <div class="settings-row-title">\u0414\u0432\u0443\u0445\u0444\u0430\u043A\u0442\u043E\u0440\u043D\u0430\u044F \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F</div>
          <div class="settings-row-sub">${me.totp_enabled?'<span class="status-online">\u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430</span>':"\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430"}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>

      ${me.is_owner?`
      <div class="settings-section-label" style="margin-top:18px;">\u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C</div>
      <div class="settings-row" id="settingsOwnerPanel">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(247,207,106,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2"><path d="M12 2l2.4 6.8L21 9l-5 4.5L17.5 21 12 17.2 6.5 21 8 13.5 3 9l6.6-.2z"/></svg>
        </div>
        <div style="flex:1;">
          <div class="settings-row-title">\u041F\u0430\u043D\u0435\u043B\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044F</div>
          <div class="settings-row-sub">\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438, \u0447\u0430\u0442\u044B, \u0431\u0430\u043B\u0430\u043D\u0441</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
      `:""}

      <button class="pill-btn danger" id="settingsLogout" style="width:100%;margin-top:22px;padding:12px 0;border-radius:12px;">\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430</button>
    </div>
  `,document.body.appendChild(e),document.getElementById("settingsClose").onclick=closeSettingsModal,e.addEventListener("click",n=>{n.target===e&&closeSettingsModal()}),document.getElementById("settingsEditProfile").onclick=()=>{closeSettingsModal(),openProfileModal()},document.getElementById("settingsTwofa").onclick=()=>{closeSettingsModal(),open2FAModal()},document.getElementById("settingsLogout").onclick=doLogout,document.getElementById("mineLaunchBtn").onclick=()=>{closeSettingsModal(),openMineModal()},document.getElementById("hammamLaunchBtn").onclick=()=>{closeSettingsModal(),openHammamModal()},document.getElementById("slotsLaunchBtn").onclick=()=>{closeSettingsModal(),openSlotsModal()},me.is_owner){const n=document.getElementById("settingsOwnerPanel");n&&(n.onclick=()=>{closeSettingsModal(),openOwnerPanelModal()})}document.getElementById("soundToggle").onclick=()=>{const n=document.getElementById("soundToggle"),i=!n.classList.contains("on");n.classList.toggle("on",i),localStorage.setItem("nova_sound_pref",i?"on":"off")};document.getElementById("themeToggle").onclick=()=>{const n=document.getElementById("themeToggle"),i=!n.classList.contains("on");n.classList.toggle("on",i),localStorage.setItem("nova_theme",i?"dark":"light"),applyTheme()}}function closeSettingsModal(){const e=document.getElementById("settingsOverlay");e&&e.remove()}function close2FAModal(){const e=document.getElementById("twofaOverlay");e&&e.remove()}function formatSecret(e){return(e||"").replace(/(.{4})/g,"$1 ").trim()}async function open2FAModal(){const e=document.createElement("div");e.className="modal-overlay",e.id="twofaOverlay",e.innerHTML=`<div class="modal-card" style="position:relative;">
    <div class="modal-close" id="twofaClose">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
    </div>
    <h2 class="modal-title">\u0414\u0432\u0443\u0445\u0444\u0430\u043A\u0442\u043E\u0440\u043D\u0430\u044F \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F</h2>
    <div id="twofaBody"><div class="twofa-loading">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div></div>
  </div>`,document.body.appendChild(e),document.getElementById("twofaClose").onclick=close2FAModal,e.addEventListener("click",t=>{t.target===e&&close2FAModal()}),me.totp_enabled?render2FADisable():await render2FASetup()}async function render2FASetup(){const e=document.getElementById("twofaBody");e.innerHTML='<div class="twofa-loading">\u0413\u043E\u0442\u043E\u0432\u0438\u043C \u0441\u0435\u043A\u0440\u0435\u0442\u2026</div>';let t;try{t=await apiFetch("/api/2fa/setup",{method:"POST"})}catch(l){e.innerHTML=`<div class="twofa-error">${escapeHtml(l&&l.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0447\u0430\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0443")}</div>`;return}e.innerHTML=`
    <p class="twofa-text">\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435-\u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 (Google Authenticator, Aegis, 1Password \u0438 \u0442.\u043F.), \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0438 \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u044D\u0442\u043E\u0442 \u043A\u043B\u044E\u0447:</p>
    <div class="twofa-secret" id="twofaSecret">${formatSecret(t.secret)}</div>
    <button class="pill-btn ghost twofa-copy" id="twofaCopy">\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u043B\u044E\u0447</button>
    <p class="twofa-text" style="margin-top:16px;">\u0417\u0430\u0442\u0435\u043C \u0432\u0432\u0435\u0434\u0438\u0442\u0435 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434 \u0438\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0437\u0430\u0449\u0438\u0442\u0443:</p>
    <input class="auth-input" id="twofaEnableCode" inputmode="numeric" maxlength="6" placeholder="6 \u0446\u0438\u0444\u0440">
    <div class="twofa-error" id="twofaEnableErr"></div>
    <button class="auth-button" id="twofaEnableBtn">\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C</button>
  `;const n=document.getElementById("twofaCopy");n.onclick=()=>{const l=t.secret||"";navigator.clipboard&&navigator.clipboard.writeText(l).then(()=>{n.textContent="\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2713",setTimeout(()=>{n.textContent="\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043A\u043B\u044E\u0447"},1500)}).catch(()=>{})};const i=document.getElementById("twofaEnableBtn"),s=document.getElementById("twofaEnableCode"),a=document.getElementById("twofaEnableErr");async function o(){const l=s.value.trim();if(a.textContent="",!/^\d{6}$/.test(l)){a.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 6 \u0446\u0438\u0444\u0440";return}i.disabled=!0;try{me=(await apiFetch("/api/2fa/enable",{method:"POST",body:JSON.stringify({code:l})})).user,localStorage.setItem("nova_me",JSON.stringify(me)),e.innerHTML='<div class="twofa-done">\u2705 \u0414\u0432\u0443\u0445\u0444\u0430\u043A\u0442\u043E\u0440\u043D\u0430\u044F \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430.<br>\u0422\u0435\u043F\u0435\u0440\u044C \u043F\u0440\u0438 \u0432\u0445\u043E\u0434\u0435 \u043F\u043E\u043D\u0430\u0434\u043E\u0431\u0438\u0442\u0441\u044F \u043A\u043E\u0434 \u0438\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F.</div>',setTimeout(close2FAModal,1800)}catch(c){a.textContent=c&&c.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C",i.disabled=!1}}i.onclick=o,s.addEventListener("keydown",l=>{l.key==="Enter"&&o()}),s.focus()}function render2FADisable(){const e=document.getElementById("twofaBody");e.innerHTML=`
    <p class="twofa-text">\u0417\u0430\u0449\u0438\u0442\u0430 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u0430. \u0427\u0442\u043E\u0431\u044B \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0434\u0432\u0443\u0445\u0444\u0430\u043A\u0442\u043E\u0440\u043D\u0443\u044E \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044E, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u043A\u043E\u0434 \u0438\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F:</p>
    <input class="auth-input" id="twofaDisableCode" inputmode="numeric" maxlength="6" placeholder="6 \u0446\u0438\u0444\u0440">
    <div class="twofa-error" id="twofaDisableErr"></div>
    <button class="auth-button danger" id="twofaDisableBtn">\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C 2FA</button>
  `;const t=document.getElementById("twofaDisableBtn"),n=document.getElementById("twofaDisableCode"),i=document.getElementById("twofaDisableErr");async function s(){const a=n.value.trim();if(i.textContent="",!/^\d{6}$/.test(a)){i.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 6 \u0446\u0438\u0444\u0440";return}t.disabled=!0;try{me=(await apiFetch("/api/2fa/disable",{method:"POST",body:JSON.stringify({code:a})})).user,localStorage.setItem("nova_me",JSON.stringify(me)),e.innerHTML='<div class="twofa-done">\u0414\u0432\u0443\u0445\u0444\u0430\u043A\u0442\u043E\u0440\u043D\u0430\u044F \u0430\u0443\u0442\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u043E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u0430.</div>',setTimeout(close2FAModal,1400)}catch(o){i.textContent=o&&o.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C",t.disabled=!1}}t.onclick=s,n.addEventListener("keydown",a=>{a.key==="Enter"&&s()}),n.focus()}let ownerTab="users",ownerUsersCache=[],ownerChatsCache=[];function openOwnerPanelModal(){const e=document.createElement("div");e.className="modal-overlay",e.id="ownerOverlay",ownerTab="users",e.innerHTML=`
    <div class="modal-card owner-modal-card" style="position:relative;">
      <div class="modal-close" id="ownerClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">\u041F\u0430\u043D\u0435\u043B\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044F</h2>
      <div class="owner-tabs">
        <div class="owner-tab active" id="ownerTabUsers">\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438</div>
        <div class="owner-tab" id="ownerTabChats">\u0427\u0430\u0442\u044B</div>
        <div class="owner-tab" id="ownerTabBans">\u0411\u0430\u043D\u044B</div>
      </div>
      <div class="owner-list" id="ownerList">
        <div class="owner-empty">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>
      </div>
    </div>
  `,document.body.appendChild(e),document.getElementById("ownerClose").onclick=closeOwnerPanelModal,e.addEventListener("click",t=>{t.target===e&&closeOwnerPanelModal()}),document.getElementById("ownerTabUsers").onclick=()=>switchOwnerTab("users"),document.getElementById("ownerTabChats").onclick=()=>switchOwnerTab("chats"),document.getElementById("ownerTabBans").onclick=()=>switchOwnerTab("bans"),loadOwnerUsers()}function closeOwnerPanelModal(){const e=document.getElementById("ownerOverlay");e&&e.remove()}function switchOwnerTab(e){ownerTab=e,document.getElementById("ownerTabUsers").classList.toggle("active",e==="users"),document.getElementById("ownerTabChats").classList.toggle("active",e==="chats"),document.getElementById("ownerTabBans").classList.toggle("active",e==="bans"),e==="users"?loadOwnerUsers():e==="chats"?loadOwnerChats():loadOwnerBans()}async function loadOwnerUsers(){const e=document.getElementById("ownerList");if(e){e.innerHTML='<div class="owner-empty">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>';try{ownerUsersCache=(await apiFetch("/api/owner/users")).users||[],renderOwnerUsers()}catch(t){e.innerHTML=`<div class="owner-empty">${escapeHtml(t.message||"\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438")}</div>`}}}function renderOwnerUsers(){const e=document.getElementById("ownerList");if(e){if(!ownerUsersCache.length){e.innerHTML='<div class="owner-empty">\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u043D\u0435\u0442</div>';return}e.innerHTML=ownerUsersCache.map(t=>`
    <div class="owner-row" data-username="${escapeHtml(t.username)}">
      <div class="owner-row-top">
        <div class="avatar" style="width:34px;height:34px;font-size:12px;${avatarStyle(t)}">${avatarInnerHtml(t)}</div>
        <div style="flex:1;">
          <div class="owner-row-name">${escapeHtml(t.nickname)}${t.is_owner?'<span class="owner-crown" title="\u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C">\u{1F451}</span>':""}</div>
          <div class="owner-row-sub">@${escapeHtml(t.username)} \xB7 ${t.balance||0} \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
        </div>
      </div>
      <div class="owner-row-actions">
        <button class="pill-btn owner-kick-btn">\u041A\u0438\u043A\u043D\u0443\u0442\u044C</button>
        ${t.username===me.username?"":'<button class="pill-btn danger owner-delete-btn">\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442</button>'}
        ${t.username===me.username?"":'<button class="pill-btn danger owner-ban-btn">\u0417\u0430\u0431\u0430\u043D\u0438\u0442\u044C</button>'}
      </div>
      <div class="owner-balance-form">
        <input type="number" step="1" placeholder="\xB1\u0447\u0435\u043A\u0443\u0448\u043A\u0438" class="owner-balance-input">
        <button class="pill-btn owner-balance-btn">\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C</button>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".owner-row").forEach(t=>{const n=t.getAttribute("data-username");t.querySelector(".owner-kick-btn").onclick=()=>ownerKickUser(n);const i=t.querySelector(".owner-delete-btn");i&&(i.onclick=()=>ownerDeleteUser(n));const b=t.querySelector(".owner-ban-btn");b&&(b.onclick=()=>ownerBanUser(n)),t.querySelector(".owner-balance-btn").onclick=()=>{const s=t.querySelector(".owner-balance-input");ownerAdjustBalance(n,s.value)}})}}async function ownerKickUser(e){try{await apiFetch(`/api/owner/users/${encodeURIComponent(e)}/kick`,{method:"POST"})}catch(t){alert(t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043A\u0438\u043A\u043D\u0443\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F")}}async function ownerDeleteUser(e){if(confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442 @${e} \u0431\u0435\u0437 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F?`))try{await apiFetch(`/api/owner/users/${encodeURIComponent(e)}`,{method:"DELETE"}),ownerUsersCache=ownerUsersCache.filter(t=>t.username!==e),renderOwnerUsers()}catch(t){alert(t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F")}}async function ownerBanUser(e){const t=prompt(`\u0417\u0430\u0431\u0430\u043D\u0438\u0442\u044C @${e} \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430? \u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0451\u043D, \u0430 \u0441 \u044D\u0442\u043E\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430/\u0441\u0435\u0442\u0438 \u043D\u0435\u043B\u044C\u0437\u044F \u0431\u0443\u0434\u0435\u0442 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0437\u0430\u043D\u043E\u0432\u043E.\n\u041F\u0440\u0438\u0447\u0438\u043D\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E):`);if(t===null)return;try{await apiFetch(`/api/owner/users/${encodeURIComponent(e)}/ban`,{method:"POST",body:JSON.stringify({reason:t||null})}),ownerUsersCache=ownerUsersCache.filter(n=>n.username!==e),renderOwnerUsers()}catch(n){alert(n.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0431\u0430\u043D\u0438\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F")}}async function ownerAdjustBalance(e,t){const n=parseInt(t,10);if(!Number.isFinite(n)||n===0){alert("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0446\u0435\u043B\u043E\u0435 \u0447\u0438\u0441\u043B\u043E, \u043E\u0442\u043B\u0438\u0447\u043D\u043E\u0435 \u043E\u0442 \u043D\u0443\u043B\u044F");return}try{const i=await apiFetch(`/api/owner/users/${encodeURIComponent(e)}/balance`,{method:"POST",body:JSON.stringify({amount:n})}),s=ownerUsersCache.findIndex(a=>a.username===e);s!==-1&&i.user&&(ownerUsersCache[s]={...ownerUsersCache[s],balance:i.user.balance}),renderOwnerUsers()}catch(i){alert(i.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441")}}async function loadOwnerChats(){const e=document.getElementById("ownerList");if(e){e.innerHTML='<div class="owner-empty">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>';try{ownerChatsCache=(await apiFetch("/api/owner/chats")).chats||[],renderOwnerChats()}catch(t){e.innerHTML=`<div class="owner-empty">${escapeHtml(t.message||"\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438")}</div>`}}}function renderOwnerChats(){const e=document.getElementById("ownerList");if(e){if(!ownerChatsCache.length){e.innerHTML='<div class="owner-empty">\u0413\u0440\u0443\u043F\u043F \u0438 \u043A\u0430\u043D\u0430\u043B\u043E\u0432 \u043D\u0435\u0442</div>';return}e.innerHTML=ownerChatsCache.map(t=>`
    <div class="owner-row" data-chat-id="${t.id}">
      <div class="owner-row-top">
        <div class="avatar group-avatar" style="width:34px;height:34px;font-size:14px;${avatarStyle(t)}">${t.kind==="channel"?"\u{1F4E2}":"\u{1F465}"}</div>
        <div style="flex:1;">
          <div class="owner-row-name">${escapeHtml(t.title)}<span class="chat-badge ${t.kind==="channel"?"channel":""}">${t.kind==="channel"?"\u043A\u0430\u043D\u0430\u043B":"\u0433\u0440\u0443\u043F\u043F\u0430"}</span></div>
          <div class="owner-row-sub">\u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 @${escapeHtml(t.owner_username)} \xB7 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432: ${t.member_count}</div>
        </div>
      </div>
      <div class="owner-row-actions">
        <button class="pill-btn danger owner-delete-chat-btn">\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0447\u0430\u0442</button>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".owner-row").forEach(t=>{const n=t.getAttribute("data-chat-id");t.querySelector(".owner-delete-chat-btn").onclick=()=>ownerDeleteChat(n)})}}async function ownerDeleteChat(e){if(confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u044D\u0442\u043E\u0442 \u0447\u0430\u0442 \u0432\u043C\u0435\u0441\u0442\u0435 \u0441\u043E \u0432\u0441\u0435\u043C\u0438 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F\u043C\u0438?"))try{await apiFetch(`/api/owner/chats/${e}`,{method:"DELETE"}),ownerChatsCache=ownerChatsCache.filter(t=>String(t.id)!==String(e)),renderOwnerChats()}catch(t){alert(t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0447\u0430\u0442")}}let ownerBansCache=[];async function loadOwnerBans(){const e=document.getElementById("ownerList");if(e){e.innerHTML='<div class="owner-empty">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>';try{ownerBansCache=(await apiFetch("/api/owner/bans")).bans||[],renderOwnerBans()}catch(t){e.innerHTML=`<div class="owner-empty">${escapeHtml(t.message||"\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438")}</div>`}}}function renderOwnerBans(){const e=document.getElementById("ownerList");if(e){if(!ownerBansCache.length){e.innerHTML='<div class="owner-empty">\u0411\u0430\u043D\u043E\u0432 \u043D\u0435\u0442</div>';return}e.innerHTML=ownerBansCache.map(t=>`
    <div class="owner-row" data-ban-ip="${escapeHtml(t.ip)}">
      <div class="owner-row-top">
        <div style="flex:1;">
          <div class="owner-row-name">${t.username?"@"+escapeHtml(t.username):"\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E"}</div>
          <div class="owner-row-sub">${escapeHtml(t.ip)}${t.reason?" \xB7 "+escapeHtml(t.reason):""}</div>
        </div>
      </div>
      <div class="owner-row-actions">
        <button class="pill-btn owner-unban-btn">\u0420\u0430\u0437\u0431\u0430\u043D\u0438\u0442\u044C</button>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".owner-row").forEach(t=>{const n=t.getAttribute("data-ban-ip");t.querySelector(".owner-unban-btn").onclick=()=>ownerUnban(n)})}}async function ownerUnban(e){try{await apiFetch(`/api/owner/bans/${encodeURIComponent(e)}`,{method:"DELETE"}),ownerBansCache=ownerBansCache.filter(t=>t.ip!==e),renderOwnerBans()}catch(t){alert(t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043D\u044F\u0442\u044C \u0431\u0430\u043D")}}const DEFAULT_GIFT_KIND="bronze";let GIFT_TIERS={bronze:{label:"\u0411\u0440\u043E\u043D\u0437\u043E\u0432\u044B\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446",cost:5,emoji:"\u{1F949}"},silver:{label:"\u0421\u0435\u0440\u0435\u0431\u0440\u044F\u043D\u044B\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446",cost:15,emoji:"\u{1F948}"},gold:{label:"\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446",cost:30,emoji:"\u{1F947}"},diamond:{label:"\u0411\u0440\u0438\u043B\u043B\u0438\u0430\u043D\u0442\u043E\u0432\u044B\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446",cost:50,emoji:"\u{1F48E}"},macro:{label:"\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446 \u043A\u0440\u0443\u043F\u043D\u044B\u043C \u043F\u043B\u0430\u043D\u043E\u043C",cost:100,emoji:"\u{1F439}",image:"/gift-macro-burm.jpg"},golden_statue:{label:"\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446-\u0441\u0442\u0430\u0442\u0443\u044F",cost:6767,emoji:"\u{1F3C6}",image:"/gift-golden-burm.jpg"},throne:{label:"\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446 \u043D\u0430 \u0442\u0440\u043E\u043D\u0435",cost:777,emoji:"\u{1F451}",image:"/gift-burm-throne.jpg"},golden_blob:{label:"\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446",cost:6767,emoji:"\u2728",image:"/gift-burm-golden-blob.jpg"}},selectedGiftKind=DEFAULT_GIFT_KIND;async function loadGiftTiers(){try{const e=await apiFetch("/api/gifts");if(e.gifts&&e.gifts.length){const t={};e.gifts.forEach(n=>{t[n.kind]=n}),GIFT_TIERS=t}}catch{}}function openGiftModal(e){if(!e)return;const t=findUser(e);selectedGiftKind=DEFAULT_GIFT_KIND;const n=document.createElement("div");n.className="modal-overlay",n.id="giftOverlay",n.innerHTML=`
    <div class="modal-card" style="position:relative;text-align:center;">
      <div class="modal-close" id="giftClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">\u041F\u043E\u0434\u0430\u0440\u0438\u0442\u044C \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</h2>
      <div class="burm-glow" style="width:110px;height:110px;background:#000;margin:0 auto 14px;">
        <img src="/mascot-burmaldaets.png" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
      </div>
      <div style="color:var(--text-mid);font-size:13.5px;margin-bottom:14px;">${escapeHtml(t.nickname)} \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430 \u0432 \u0447\u0430\u0442</div>
      <div id="giftTierList" class="gift-tier-list"></div>
      <div class="auth-error" id="giftError"></div>
      <div class="modal-actions">
        <button class="pill-btn" id="giftCancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button class="auth-button" id="giftSend">\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C</button>
      </div>
    </div>
  `,document.body.appendChild(n),renderGiftTierList(e),document.getElementById("giftClose").onclick=closeGiftModal,document.getElementById("giftCancel").onclick=closeGiftModal,n.addEventListener("click",i=>{i.target===n&&closeGiftModal()}),document.getElementById("giftSend").onclick=()=>sendGift(e)}function renderGiftTierList(e){const t=document.getElementById("giftTierList");if(!t)return;const n=me&&typeof me.balance=="number"?me.balance:0,i=Object.entries(GIFT_TIERS).sort((s,a)=>s[1].cost-a[1].cost);t.innerHTML=i.map(([s,a])=>{const o=n>=a.cost,l=selectedGiftKind===s,c=a.image?`<img class="gift-tier-thumb" src="${a.image}" alt="">`:`<span class="gift-tier-emoji">${a.emoji}</span>`;return`
      <button type="button" class="gift-tier-option gift-tier-${s} ${l?"active":""}" data-kind="${s}" ${o?"":"disabled"}>
        ${c}
        <span class="gift-tier-name">${escapeHtml(a.label)}</span>
        <span class="gift-tier-price">${a.cost} \u0447\u0435\u043A\u0443\u0448\u0435\u043A</span>
      </button>
    `}).join(""),t.querySelectorAll(".gift-tier-option").forEach(s=>{s.onclick=()=>{s.disabled||(selectedGiftKind=s.dataset.kind,renderGiftTierList(e),updateGiftSendState())}}),updateGiftSendState()}function updateGiftSendState(){const e=document.getElementById("giftSend"),t=document.getElementById("giftError");if(!e)return;const n=me&&typeof me.balance=="number"?me.balance:0,i=GIFT_TIERS[selectedGiftKind],s=i&&n>=i.cost;e.disabled=!s,t&&(t.textContent=s?"":"\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u0447\u0435\u043A\u0443\u0448\u0435\u043A \u2014 \u043D\u0430\u043A\u043E\u043F\u0430\u0439\u0442\u0435 \u0435\u0449\u0451 \u0432 \u0448\u0430\u0445\u0442\u0435 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430")}function closeGiftModal(){const e=document.getElementById("giftOverlay");e&&e.remove()}async function sendGift(e){const t=document.getElementById("giftSend"),n=document.getElementById("giftError");t.disabled=!0;try{const i=await apiFetch("/api/gift/"+encodeURIComponent(e)+"/"+encodeURIComponent(selectedGiftKind),{method:"POST"});i.user&&(me=i.user,localStorage.setItem("nova_me",JSON.stringify(me)),renderBalance()),i.message&&activePeer===e&&(messages.some(a=>a.id===i.message.id)||(messages.push(i.message),renderMessages())),(()=>{const tier=GIFT_TIERS[selectedGiftKind]||GIFT_TIERS[DEFAULT_GIFT_KIND];showGiftFlash(selectedGiftKind,`\u0412\u044B \u043F\u043E\u0434\u0430\u0440\u0438\u043B\u0438 ${(tier&&tier.label)||""}`,`${(tier&&tier.cost)||0} \u0447\u0435\u043A\u0443\u0448\u0435\u043A`)})(),closeGiftModal()}catch(i){n.textContent=i&&i.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0434\u0430\u0440\u043E\u043A",updateGiftSendState()}}let mineState=null,mineBusy=!1,mineCooldownInterval=null;function closeMineModal(){const e=document.getElementById("mineOverlay");e&&e.remove(),mineCooldownInterval&&(clearInterval(mineCooldownInterval),mineCooldownInterval=null)}function mineCellEmoji(e){return e==null?"":e==="empty"?"\u{1FAA8}":e==="chekushka"||e==="chekushka2"||e==="chekushka5"?"\u{1F37E}":e==="gem"?"\u{1F48E}":e==="trap"?"\u{1F4A5}":"\u2753"}function mineCellClass(e){return e==="gem"?"gem":e==="trap"?"trap":""}function formatMs(e){const t=Math.max(0,Math.ceil(e/1e3)),n=Math.floor(t/60),i=t%60;return`${n}:${String(i).padStart(2,"0")}`}async function openMineModal(){const e=document.createElement("div");e.className="modal-overlay",e.id="mineOverlay",e.innerHTML=`
    <div class="modal-card mine-modal-card" style="position:relative;">
      <div class="modal-close" id="mineClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <div class="mine-header">
        <h2 class="modal-title" style="margin:0;">\u26CF\uFE0F \u0428\u0430\u0445\u0442\u0430 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</h2>
      </div>
      <div id="mineBody">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>
    </div>
  `,document.body.appendChild(e),document.getElementById("mineClose").onclick=closeMineModal,e.addEventListener("click",t=>{t.target===e&&closeMineModal()});try{const t=await apiFetch("/api/mine/status");t.active?(mineState=t,renderMineGrid()):t.remainingMs>0?renderMineCooldown(t.remainingMs):renderMineIntro()}catch{document.getElementById("mineBody").innerHTML='<div class="mine-status">\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0448\u0430\u0445\u0442\u0443</div>'}}function renderMineIntro(){const e=document.getElementById("mineBody");e&&(e.innerHTML=`
    <div class="mine-cooldown">
      <div class="mine-burm"><img src="/mascot-burmaldaets.png" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446"></div>
      <div>\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446 \u0431\u0435\u0440\u0451\u0442 \u043A\u0430\u0439\u043B\u043E \u0438 \u0441\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0432 \u0448\u0430\u0445\u0442\u0443 \u0438\u0441\u043A\u0430\u0442\u044C \u0447\u0435\u043A\u0443\u0448\u043A\u0438. \u0420\u0430\u0441\u043A\u043E\u043F\u0430\u0439 6 \u043A\u043B\u0435\u0442\u043E\u043A \u2014 \u0433\u0434\u0435-\u0442\u043E \u043F\u0443\u0441\u0442\u043E, \u0433\u0434\u0435-\u0442\u043E \u043A\u043B\u0430\u0434, \u0430 \u0433\u0434\u0435-\u0442\u043E \u043E\u0431\u0432\u0430\u043B.</div>
      <button class="auth-button" id="mineStartBtn" style="width:100%;">\u041D\u0430\u0447\u0430\u0442\u044C \u043A\u043E\u043F\u0430\u0442\u044C</button>
    </div>
  `,document.getElementById("mineStartBtn").onclick=startMineRound)}function renderMineCooldown(e){const t=document.getElementById("mineBody");if(!t)return;mineCooldownInterval&&(clearInterval(mineCooldownInterval),mineCooldownInterval=null);let n=e;t.innerHTML=`
    <div class="mine-cooldown">
      <div class="mine-burm"><img src="/mascot-burmaldaets.png" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446"></div>
      <div>\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446 \u043E\u0442\u0434\u044B\u0445\u0430\u0435\u0442 \u043F\u043E\u0441\u043B\u0435 \u0441\u043C\u0435\u043D\u044B \u0432 \u0448\u0430\u0445\u0442\u0435.</div>
      <div class="mine-cooldown-timer" id="mineCooldownTimer">${formatMs(n)}</div>
      <div style="font-size:12px;color:var(--text-low);">\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0442\u0435\u0441\u044C \u043F\u043E\u0437\u0436\u0435 \u0437\u0430 \u043D\u043E\u0432\u044B\u043C\u0438 \u0447\u0435\u043A\u0443\u0448\u043A\u0430\u043C\u0438</div>
    </div>
  `,mineCooldownInterval=setInterval(()=>{n-=1e3;const i=document.getElementById("mineCooldownTimer");if(n<=0){clearInterval(mineCooldownInterval),mineCooldownInterval=null,renderMineIntro();return}i&&(i.textContent=formatMs(n))},1e3)}async function startMineRound(){const e=document.getElementById("mineStartBtn");e&&(e.disabled=!0);try{mineState=await apiFetch("/api/mine/start",{method:"POST"}),renderMineGrid()}catch(t){if(t.data&&t.data.remainingMs)renderMineCooldown(t.data.remainingMs);else{const n=document.getElementById("mineBody");n&&(n.innerHTML=`<div class="mine-status">${escapeHtml(t&&t.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0447\u0430\u0442\u044C")}</div>`)}}}function renderMineGrid(){const e=document.getElementById("mineBody");if(!e||!mineState)return;const t=[];for(let n=0;n<mineState.gridSize;n++){const i=mineState.revealed[n],s=i!=null;t.push(`<div class="mine-cell ${s?"dug "+mineCellClass(i):""} ${mineState.digsLeft<=0&&!s?"disabled":""}" data-idx="${n}">${s?mineCellEmoji(i):""}</div>`)}e.innerHTML=`
    <div class="mine-stats">
      <div>\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043F\u044B\u0442\u043E\u043A: <b>${mineState.digsLeft}</b></div>
      <div>\u041D\u0430\u0439\u0434\u0435\u043D\u043E: <b>${mineState.earned}</b> \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
    </div>
    <div class="mine-grid" id="mineGridEl">${t.join("")}</div>
    <div class="mine-status" id="mineStatusEl">\u0412\u044B\u0431\u0435\u0440\u0438 \u043A\u043B\u0435\u0442\u043A\u0443 \u0438 \u043A\u043E\u043F\u0430\u0439</div>
  `,document.getElementById("mineGridEl").querySelectorAll(".mine-cell").forEach(n=>{n.onclick=()=>digMineCell(Number(n.dataset.idx))})}async function digMineCell(e){if(!(mineBusy||!mineState)&&!(mineState.digsLeft<=0)&&!(mineState.revealed[e]!==null&&mineState.revealed[e]!==void 0)){mineBusy=!0;try{const t=await apiFetch("/api/mine/dig",{method:"POST",body:JSON.stringify({cell:e})});mineState.revealed=t.revealed,mineState.digsLeft=t.digsLeft,mineState.earned=t.earned,renderMineGrid();const n=document.querySelector(`.mine-cell[data-idx="${e}"]`);n&&n.classList.add("pop");const i=document.getElementById("mineStatusEl");if(i){const s=t.value>0?"+":"";i.textContent=`${t.emoji} ${t.label} (${s}${t.value})`,i.className="mine-status"+(t.value>0?" good":"")}if(t.finished){if(t.user){me=t.user,localStorage.setItem("nova_me",JSON.stringify(me)),renderBalance();const s=document.getElementById("settingsBalanceValue");s&&(s.textContent=me.balance)}setTimeout(()=>{const s=document.getElementById("mineBody");s&&(s.innerHTML=`
          <div class="mine-cooldown">
            <div class="mine-burm"><img src="/mascot-burmaldaets.png" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446"></div>
            <div class="mine-status good" style="font-size:16px;">\u0421\u043C\u0435\u043D\u0430 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430! \u041F\u043E\u043B\u0443\u0447\u0435\u043D\u043E: ${t.payout} \u0447\u0435\u043A\u0443\u0448\u0435\u043A \u{1F37E}</div>
            <button class="pill-btn" id="mineCloseAfter">\u0417\u0430\u043A\u0440\u044B\u0442\u044C</button>
          </div>
        `,document.getElementById("mineCloseAfter").onclick=closeMineModal)},900)}}catch(t){const n=document.getElementById("mineStatusEl");n&&(n.textContent=t&&t.message||"\u041E\u0448\u0438\u0431\u043A\u0430")}mineBusy=!1}}let slotsBusy=!1,slotsCooldownInterval=null;function closeSlotsModal(){const e=document.getElementById("slotsOverlay");e&&e.remove(),slotsCooldownInterval&&(clearInterval(slotsCooldownInterval),slotsCooldownInterval=null)}const SLOTS_PAYTABLE=[{emoji:"\u{1F451}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u043A\u043E\u0440\u043E\u043D",value:200},{emoji:"\u{1F48E}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u0430\u043B\u043C\u0430\u0437\u043E\u0432",value:60},{emoji:"\u{1F947}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u0437\u043E\u043B\u043E\u0442\u0430",value:25},{emoji:"\u{1F37E}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u0447\u0435\u043A\u0443\u0448\u0435\u043A",value:12},{emoji:"\u{1F439}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0435\u0432",value:5},{emoji:"\u{1FAA8}",label:"\u0422\u0440\u043E\u0439\u043A\u0430 \u043A\u0430\u043C\u043D\u0435\u0439",value:2}];async function openSlotsModal(){const e=document.createElement("div");e.className="modal-overlay",e.id="slotsOverlay",e.innerHTML=`
    <div class="modal-card slots-modal-card" style="position:relative;">
      <div class="modal-close" id="slotsClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <div class="mine-header">
        <h2 class="modal-title" style="margin:0;">\u{1F3B0} \u0410\u0432\u0442\u043E\u043C\u0430\u0442 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</h2>
      </div>
      <div id="slotsBody">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>
    </div>
  `,document.body.appendChild(e),document.getElementById("slotsClose").onclick=closeSlotsModal,e.addEventListener("click",t=>{t.target===e&&closeSlotsModal()});try{const t=await apiFetch("/api/slots/status");t.remainingMs>0?renderSlotsCooldown(t.remainingMs):renderSlotsMachine()}catch{document.getElementById("slotsBody").innerHTML='<div class="mine-status">\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442</div>'}}function slotsPaytableHtml(){return`<div class="slots-paytable">${SLOTS_PAYTABLE.map(e=>`<div><span>${e.emoji}${e.emoji}${e.emoji}</span><b>+${e.value}</b></div>`).join("")}</div>`}function renderSlotsMachine(e){const t=document.getElementById("slotsBody");if(!t)return;const n=e||[{emoji:"\u{1FAA8}"},{emoji:"\u{1FAA8}"},{emoji:"\u{1FAA8}"}];t.innerHTML=`
    <div class="slots-reels" id="slotsReelsEl">
      ${n.map((i,s)=>`<div class="slots-reel" data-reel="${s}"><div class="slots-reel-inner">${i.emoji}</div></div>`).join("")}
    </div>
    <div class="slots-status" id="slotsStatusEl">\u041A\u0440\u0443\u0442\u0438 \u0431\u0430\u0440\u0430\u0431\u0430\u043D\u044B \u2014 \u0432\u0434\u0440\u0443\u0433 \u043F\u043E\u0432\u0435\u0437\u0451\u0442 \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0443</div>
    <button class="auth-button" id="slotsSpinBtn" style="width:100%;">\u041A\u0440\u0443\u0442\u0438\u0442\u044C (\u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E)</button>
    ${slotsPaytableHtml()}
  `,document.getElementById("slotsSpinBtn").onclick=spinSlots}function renderSlotsCooldown(e){const t=document.getElementById("slotsBody");if(!t)return;slotsCooldownInterval&&(clearInterval(slotsCooldownInterval),slotsCooldownInterval=null);let n=e;t.innerHTML=`
    <div class="mine-cooldown">
      <div class="mine-burm"><img src="/mascot-burmaldaets.png" alt="\u0411\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0435\u0446"></div>
      <div>\u0410\u0432\u0442\u043E\u043C\u0430\u0442 \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0436\u0430\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u043E\u0448\u043B\u043E\u0433\u043E \u0441\u043F\u0438\u043D\u0430.</div>
      <div class="mine-cooldown-timer" id="slotsCooldownTimer">${formatMs(n)}</div>
      <div style="font-size:12px;color:var(--text-low);">\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439\u0442\u0435\u0441\u044C \u043F\u043E\u0437\u0436\u0435 \u0437\u0430 \u043D\u043E\u0432\u044B\u043C \u0441\u043F\u0438\u043D\u043E\u043C</div>
    </div>
    ${slotsPaytableHtml()}
  `,slotsCooldownInterval=setInterval(()=>{n-=1e3;const i=document.getElementById("slotsCooldownTimer");if(n<=0){clearInterval(slotsCooldownInterval),slotsCooldownInterval=null,renderSlotsMachine();return}i&&(i.textContent=formatMs(n))},1e3)}async function spinSlots(){if(slotsBusy)return;slotsBusy=!0;const e=document.getElementById("slotsSpinBtn"),t=document.getElementById("slotsStatusEl");e&&(e.disabled=!0),t&&(t.textContent="\u041A\u0440\u0443\u0442\u0438\u043C \u0431\u0430\u0440\u0430\u0431\u0430\u043D\u044B\u2026",t.className="slots-status"),document.querySelectorAll(".slots-reel").forEach(n=>n.classList.add("spinning"));try{const n=await apiFetch("/api/slots/spin",{method:"POST"});if(await new Promise(i=>setTimeout(i,700)),document.querySelectorAll(".slots-reel").forEach((i,s)=>{i.classList.remove("spinning");const a=n.reels[s];i.querySelector(".slots-reel-inner").textContent=a.emoji,i.classList.toggle("win",n.outcome==="triple")}),t&&(n.outcome==="triple"?(t.textContent=`\u{1F389} \u0422\u0440\u0438 \u0432 \u0440\u044F\u0434! +${n.payout} \u0447\u0435\u043A\u0443\u0448\u0435\u043A`,t.className="slots-status good"):n.outcome==="pair"?(t.textContent=`\u041F\u043E\u0447\u0442\u0438! \u041F\u0430\u0440\u0430 \u0441\u043E\u0432\u043F\u0430\u043B\u0430 \u2014 +${n.payout} \u0447\u0435\u043A\u0443\u0448\u0435\u043A`,t.className="slots-status"):(t.textContent="\u041D\u0435 \u043F\u043E\u0432\u0435\u0437\u043B\u043E \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0437",t.className="slots-status bad")),n.user){me=n.user,localStorage.setItem("nova_me",JSON.stringify(me)),renderBalance();const i=document.getElementById("settingsBalanceValue");i&&(i.textContent=me.balance)}setTimeout(()=>{const i=n;renderSlotsCooldownAfterSpin()},1100)}catch(n){document.querySelectorAll(".slots-reel").forEach(i=>i.classList.remove("spinning")),n.data&&n.data.remainingMs?renderSlotsCooldown(n.data.remainingMs):t&&(t.textContent=n&&n.message||"\u041E\u0448\u0438\u0431\u043A\u0430",t.className="slots-status bad",e&&(e.disabled=!1))}slotsBusy=!1}async function renderSlotsCooldownAfterSpin(){try{const e=await apiFetch("/api/slots/status");e.remainingMs>0&&renderSlotsCooldown(e.remainingMs)}catch{}}let newChatKind="group",newChatSelectedMembers=new Set;function closeNewChatModal(){const e=document.getElementById("newChatOverlay");e&&e.remove()}function openNewChatModal(){newChatKind="group",newChatSelectedMembers=new Set;const e=document.createElement("div");e.className="modal-overlay",e.id="newChatOverlay",e.innerHTML=`
    <div class="modal-card" style="position:relative;">
      <div class="modal-close" id="newChatClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">\u041D\u043E\u0432\u044B\u0439 \u0447\u0430\u0442</h2>
      <div class="new-chat-kind-row">
        <div class="new-chat-kind-option active" data-kind="group">
          <span class="kind-emoji">\u{1F465}</span>
          <span class="kind-label">\u0413\u0440\u0443\u043F\u043F\u0430</span>
        </div>
        <div class="new-chat-kind-option" data-kind="channel">
          <span class="kind-emoji">\u{1F4E2}</span>
          <span class="kind-label">\u041A\u0430\u043D\u0430\u043B</span>
        </div>
      </div>
      <div class="auth-field-label">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435</div>
      <input class="auth-input" id="newChatTitle" placeholder="\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u041D\u0430\u0448\u0430 \u0442\u0443\u0441\u043E\u0432\u043A\u0430" maxlength="60">
      <div class="auth-field-label" style="margin-top:10px;">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)</div>
      <div class="member-picker" id="memberPicker"></div>
      <div class="auth-error" id="newChatError"></div>
      <div class="modal-actions">
        <button class="pill-btn" id="newChatCancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button class="auth-button" id="newChatCreate">\u0421\u043E\u0437\u0434\u0430\u0442\u044C</button>
      </div>
    </div>
  `,document.body.appendChild(e),renderMemberPicker(),document.getElementById("newChatClose").onclick=closeNewChatModal,document.getElementById("newChatCancel").onclick=closeNewChatModal,e.addEventListener("click",t=>{t.target===e&&closeNewChatModal()}),e.querySelectorAll(".new-chat-kind-option").forEach(t=>{t.onclick=()=>{newChatKind=t.dataset.kind,e.querySelectorAll(".new-chat-kind-option").forEach(n=>n.classList.toggle("active",n===t))}}),document.getElementById("newChatCreate").onclick=submitNewChat}function renderMemberPicker(){const e=document.getElementById("memberPicker");if(e){if(users.length===0){e.innerHTML='<div style="padding:12px;font-size:12.5px;color:var(--text-low);">\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0434\u0440\u0443\u0433\u0438\u0445 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439</div>';return}e.innerHTML=users.map(t=>`
    <div class="member-picker-row" data-username="${escapeHtml(t.username)}">
      <div class="avatar" style="width:28px;height:28px;font-size:11px;${avatarStyle(t)}">${avatarInnerHtml(t)}</div>
      <div>
        <div style="font-size:13px;font-weight:600;">${escapeHtml(t.nickname)}</div>
        <div style="font-size:11px;color:var(--text-low);">@${escapeHtml(t.username)}</div>
      </div>
      <input type="checkbox">
    </div>
  `).join(""),e.querySelectorAll(".member-picker-row").forEach(t=>{const n=t.querySelector("input");t.onclick=i=>{i.target!==n&&(n.checked=!n.checked);const s=t.dataset.username;n.checked?newChatSelectedMembers.add(s):newChatSelectedMembers.delete(s)}})}}async function submitNewChat(){const e=document.getElementById("newChatTitle"),t=document.getElementById("newChatError"),n=e.value.trim();if(!n){t.textContent="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435";return}const i=document.getElementById("newChatCreate");i.disabled=!0;try{const s=await apiFetch("/api/chats",{method:"POST",body:JSON.stringify({title:n,kind:newChatKind,members:[...newChatSelectedMembers]})});if(s.chat){const a=chats.findIndex(o=>o.id===s.chat.id);a>=0?chats[a]=s.chat:chats.unshift(s.chat),closeNewChatModal(),selectChat(s.chat.id)}}catch(s){t.textContent=s&&s.message||"\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0447\u0430\u0442"}i.disabled=!1}function closeChatInfoModal(){const e=document.getElementById("chatInfoOverlay");e&&e.remove()}async function openUserProfileModal(e){const t=findUser(e),n=document.createElement("div");n.className="modal-overlay",n.id="userProfileOverlay",n.innerHTML=`
    <div class="modal-card" style="position:relative;">
      <div class="modal-close" id="userProfileClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <div class="modal-avatar-row">
        <div class="modal-avatar" style="${avatarStyle(t)}">${avatarInnerHtml(t)}</div>
        <h2 class="modal-title" style="margin:0;">${escapeHtml(t.nickname)}</h2>
        <div style="color:var(--text-low);font-size:13px;">@${escapeHtml(t.username)}</div>
      </div>
      <div id="userProfileStatus" class="profile-status">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u2026</div>
      <div class="auth-field-label">\u041F\u043E\u0434\u0430\u0440\u043A\u0438</div>
      <div id="userProfileGifts" class="profile-gifts">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>
    </div>
  `,document.body.appendChild(n),document.getElementById("userProfileClose").onclick=closeUserProfileModal,n.addEventListener("click",i=>{i.target===n&&closeUserProfileModal()});try{const i=await apiFetch("/api/users/"+encodeURIComponent(e)+"/profile");renderProfileStatus(i.status);const s=document.getElementById("userProfileGifts");if(!s)return;if(!i.gifts||i.gifts.length===0){s.innerHTML='<div style="padding:14px;font-size:12.5px;color:var(--text-low);text-align:center;">\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0431\u0443\u0440\u043C\u0430\u043B\u0434\u0430\u0439\u0446\u0430</div>';return}s.innerHTML=i.gifts.map(a=>`
      <div class="profile-gift-card" title="${escapeHtml(a.label)}">
        <div class="profile-gift-icon">${a.image?`<img src="${a.image}" alt="">`:escapeHtml(a.emoji)}</div>
        <div class="profile-gift-label">${escapeHtml(a.label)}</div>
        <div class="profile-gift-count">\xD7${a.count}</div>
      </div>
    `).join("")}catch{const s=document.getElementById("userProfileGifts");s&&(s.innerHTML='<div style="padding:14px;font-size:12.5px;color:var(--text-low);text-align:center;">\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u043E\u0434\u0430\u0440\u043A\u0438</div>');const a=document.getElementById("userProfileStatus");a&&(a.innerHTML="")}}function renderProfileStatus(e){const t=document.getElementById("userProfileStatus");if(!t)return;if(!e){t.innerHTML="";return}const n=e.next_level,i=n?Math.min(100,Math.round(e.total_gift_value/n.min*100)):100;t.innerHTML=`
    <div class="status-badge-row">
      <span class="status-badge-emoji">${escapeHtml(e.emoji)}</span>
      <div>
        <div class="status-badge-label">\u0423\u0440. ${e.level} \u2014 ${escapeHtml(e.label)}</div>
        <div class="status-badge-sub">\u041F\u043E\u0434\u0430\u0440\u0435\u043D\u043E \u043D\u0430 ${e.total_gift_value} \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
      </div>
    </div>
    ${n?`
      <div class="status-progress-track">
        <div class="status-progress-fill" style="width:${i}%;"></div>
      </div>
      <div class="status-progress-note">\u0414\u043E \xAB${escapeHtml(n.label)}\xBB (${escapeHtml(n.emoji)}) \u2014 \u0435\u0449\u0451 ${n.remaining} \u0447\u0435\u043A\u0443\u0448\u0435\u043A</div>
    `:`
      <div class="status-progress-note">\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0430\u0442\u0443\u0441 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442 \u2728</div>
    `}
  `}function closeUserProfileModal(){const e=document.getElementById("userProfileOverlay");e&&e.remove()}async function openChatInfoModal(e){const t=findChat(e);if(!t)return;const n=document.createElement("div");n.className="modal-overlay",n.id="chatInfoOverlay",n.innerHTML=`
    <div class="modal-card" style="position:relative;">
      <div class="modal-close" id="chatInfoClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">${escapeHtml(t.title)}</h2>
      <div class="auth-field-label">\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438</div>
      <div class="member-picker" id="chatMembersList" style="margin-bottom:14px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</div>
      ${t.my_role==="owner"||t.my_role==="admin"?`
        <div class="auth-field-label">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432</div>
        <div class="member-picker" id="addMemberPicker"></div>
        <button class="pill-btn" id="addMembersBtn" style="width:100%;margin-top:10px;">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u044B\u0445</button>
      `:""}
      ${t.my_role!=="owner"?'<button class="pill-btn danger" id="leaveChatBtn" style="width:100%;margin-top:14px;">\u041F\u043E\u043A\u0438\u043D\u0443\u0442\u044C \u0447\u0430\u0442</button>':'<div style="font-size:11.5px;color:var(--text-low);margin-top:14px;text-align:center;">\u0412\u044B \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u044D\u0442\u043E\u0433\u043E \u0447\u0430\u0442\u0430</div>'}
    </div>
  `,document.body.appendChild(n),document.getElementById("chatInfoClose").onclick=closeChatInfoModal,n.addEventListener("click",s=>{s.target===n&&closeChatInfoModal()});const i=document.getElementById("leaveChatBtn");i&&(i.onclick=async()=>{i.disabled=!0;try{await apiFetch("/api/chats/"+e+"/leave",{method:"POST"}),chats=chats.filter(s=>s.id!==e),activeChatId===e&&(activeChatId=null,renderConversationHeader()),renderChatList(document.getElementById("searchInput").value),closeChatInfoModal()}catch{i.disabled=!1}});try{const s=await apiFetch("/api/chats/"+e+"/members"),a=document.getElementById("chatMembersList");a&&(a.innerHTML=s.members.map(l=>`
        <div class="member-picker-row" style="cursor:default;">
          <div class="avatar" style="width:28px;height:28px;font-size:11px;${avatarStyle(l)}">${avatarInnerHtml(l)}</div>
          <div>
            <div style="font-size:13px;font-weight:600;">${escapeHtml(l.nickname)}</div>
            <div style="font-size:11px;color:var(--text-low);">@${escapeHtml(l.username)}</div>
          </div>
          ${l.role==="owner"?'<span class="chat-badge channel">\u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446</span>':""}
        </div>
      `).join(""));const o=document.getElementById("addMemberPicker");if(o){const l=new Set(s.members.map(d=>d.username)),c=users.filter(d=>!l.has(d.username)),r=new Set;c.length===0?o.innerHTML='<div style="padding:12px;font-size:12.5px;color:var(--text-low);">\u0412\u0441\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438 \u0443\u0436\u0435 \u0432 \u0447\u0430\u0442\u0435</div>':(o.innerHTML=c.map(d=>`
          <div class="member-picker-row" data-username="${escapeHtml(d.username)}">
            <div class="avatar" style="width:28px;height:28px;font-size:11px;${avatarStyle(d)}">${avatarInnerHtml(d)}</div>
            <div>
              <div style="font-size:13px;font-weight:600;">${escapeHtml(d.nickname)}</div>
              <div style="font-size:11px;color:var(--text-low);">@${escapeHtml(d.username)}</div>
            </div>
            <input type="checkbox">
          </div>
        `).join(""),o.querySelectorAll(".member-picker-row").forEach(d=>{const m=d.querySelector("input");d.onclick=v=>{v.target!==m&&(m.checked=!m.checked);const f=d.dataset.username;m.checked?r.add(f):r.delete(f)}}));const u=document.getElementById("addMembersBtn");u&&(u.onclick=async()=>{if(r.size!==0){u.disabled=!0;try{await apiFetch("/api/chats/"+e+"/members",{method:"POST",body:JSON.stringify({members:[...r]})}),closeChatInfoModal(),openChatInfoModal(e)}catch{u.disabled=!1}}})}}catch{}}const RTC_CONFIG={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]};let call=null,incomingCall=null,ringTimeout=null,callTimerInterval=null;["click","touchstart","keydown"].forEach(e=>document.addEventListener(e,()=>{const t=document.getElementById("callRemoteAudio");t&&call&&!call.soundMuted&&t.play().catch(()=>{})},!0));function sendSignal(e){ws&&ws.readyState===1&&ws.send(JSON.stringify(e))}function createPeer(){const e=new RTCPeerConnection(RTC_CONFIG);return call.remoteStream=new MediaStream,e.onicecandidate=t=>{t.candidate&&sendSignal({type:"call_ice",to:call.peer,candidate:t.candidate})},e.ontrack=t=>{call.remoteStream.addTrack(t.track),attachRemote(),t.track.onended=attachRemote,t.track.onmute=attachRemote,t.track.onunmute=attachRemote},e.onconnectionstatechange=()=>{e.connectionState==="failed"&&(callToast("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0435\u0440\u0432\u0430\u043D\u043E"),endCall(!1))},call.pc=e,e}async function getLocalMedia(e){const t={audio:!0,video:e==="video"?{width:{ideal:1280},height:{ideal:720}}:!1},n=await navigator.mediaDevices.getUserMedia(t);call.localStream=n;const i=n.getAudioTracks()[0];i&&await call.audioSender.replaceTrack(i);const s=n.getVideoTracks()[0];s&&(call.cameraTrack=s,await call.videoSender.replaceTrack(s))}async function startCall(e,t){if(call||incomingCall){callToast("\u0423\u0436\u0435 \u0438\u0434\u0451\u0442 \u0437\u0432\u043E\u043D\u043E\u043A");return}if(!isOnline(e)){callToast("\u0421\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u0432 \u0441\u0435\u0442\u0438");return}call={peer:e,kind:t,role:"caller",micMuted:!1,soundMuted:!1,camOff:!1,sharing:!1,cameraTrack:null};try{createPeer();const n=call.pc.addTransceiver("audio",{direction:"sendrecv"}),i=call.pc.addTransceiver("video",{direction:"sendrecv"});call.audioSender=n.sender,call.videoSender=i.sender,await getLocalMedia(t)}catch{call=null,alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443/\u043A\u0430\u043C\u0435\u0440\u0435");return}try{const n=await call.pc.createOffer();await call.pc.setLocalDescription(n),sendSignal({type:"call_offer",to:e,kind:t,sdp:call.pc.localDescription})}catch{endCall(!1);return}showCallUI("outgoing"),ringTimeout=setTimeout(()=>{call&&call.role==="caller"&&!call.startedAt&&(sendSignal({type:"call_cancel",to:e}),callToast("\u0421\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B"),endCall(!1))},4e4)}async function handleCallSignal(e){const t=e.type;if(t==="call_offer"){if(call||incomingCall){sendSignal({type:"call_busy",to:e.from});return}incomingCall={peer:e.from,kind:e.kind||"audio",sdp:e.sdp,pendingIce:[]},showCallUI("incoming"),ringTimeout=setTimeout(()=>{incomingCall&&declineIncoming()},4e4)}else if(t==="call_answer"){if(call&&call.role==="caller"&&call.pc)try{await call.pc.setRemoteDescription(e.sdp),markCallStarted()}catch{endCall(!1)}}else if(t==="call_ice"){if(!(call&&call.pc?call:incomingCall||null))return;if(call&&call.pc&&call.pc.remoteDescription)try{await call.pc.addIceCandidate(e.candidate)}catch{}else incomingCall&&incomingCall.pendingIce.push(e.candidate)}else t==="call_reject"?call&&(callToast("\u0417\u0432\u043E\u043D\u043E\u043A \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D"),endCall(!1)):t==="call_cancel"?incomingCall&&(incomingCall=null,clearTimeout(ringTimeout),hideCallUI()):t==="call_busy"?call&&(callToast("\u0421\u043E\u0431\u0435\u0441\u0435\u0434\u043D\u0438\u043A \u0437\u0430\u043D\u044F\u0442"),endCall(!1)):t==="call_end"&&(call?(callToast("\u0417\u0432\u043E\u043D\u043E\u043A \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D"),endCall(!1)):incomingCall&&(incomingCall=null,clearTimeout(ringTimeout),hideCallUI()))}async function acceptCall(){if(!incomingCall)return;const e=incomingCall;incomingCall=null,ringTimeout&&(clearTimeout(ringTimeout),ringTimeout=null),call={peer:e.peer,kind:e.kind,role:"callee",micMuted:!1,soundMuted:!1,camOff:!1,sharing:!1,cameraTrack:null};try{createPeer(),await call.pc.setRemoteDescription(e.sdp);const t=call.pc.getTransceivers();let n=t.find(a=>a.receiver&&a.receiver.track&&a.receiver.track.kind==="audio")||t[0],i=t.find(a=>a.receiver&&a.receiver.track&&a.receiver.track.kind==="video")||t[1];if(call.audioSender=n&&n.sender,call.videoSender=i&&i.sender,n)try{n.direction="sendrecv"}catch{}if(i)try{i.direction="sendrecv"}catch{}await getLocalMedia(e.kind);for(const a of e.pendingIce)try{await call.pc.addIceCandidate(a)}catch{}const s=await call.pc.createAnswer();await call.pc.setLocalDescription(s),sendSignal({type:"call_answer",to:call.peer,sdp:call.pc.localDescription}),markCallStarted()}catch{alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0447\u0430\u0442\u044C \u0437\u0432\u043E\u043D\u043E\u043A (\u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0430 \u043A \u043C\u0438\u043A\u0440\u043E\u0444\u043E\u043D\u0443/\u043A\u0430\u043C\u0435\u0440\u0435?)"),sendSignal({type:"call_end",to:e.peer}),endCall(!1)}}function declineIncoming(){incomingCall&&sendSignal({type:"call_reject",to:incomingCall.peer}),incomingCall=null,ringTimeout&&(clearTimeout(ringTimeout),ringTimeout=null),hideCallUI()}function markCallStarted(){!call||call.startedAt||(ringTimeout&&(clearTimeout(ringTimeout),ringTimeout=null),call.startedAt=Date.now(),showCallUI("active"))}function endCall(e){if(ringTimeout&&(clearTimeout(ringTimeout),ringTimeout=null),callTimerInterval&&(clearInterval(callTimerInterval),callTimerInterval=null),call){e&&sendSignal({type:"call_end",to:call.peer});try{call.pc&&call.pc.close()}catch{}call.localStream&&call.localStream.getTracks().forEach(t=>t.stop()),call.screenStream&&call.screenStream.getTracks().forEach(t=>t.stop())}call=null,hideCallUI()}function toggleMic(){!call||!call.localStream||(call.micMuted=!call.micMuted,call.localStream.getAudioTracks().forEach(e=>e.enabled=!call.micMuted),updateCallControls())}function toggleSound(){if(!call)return;call.soundMuted=!call.soundMuted;const e=document.getElementById("callRemoteAudio");e&&(e.muted=call.soundMuted,call.soundMuted||e.play().catch(()=>{})),updateCallControls()}async function toggleCam(){if(!(!call||call.sharing)){try{if(!call.camOff&&call.cameraTrack)await call.videoSender.replaceTrack(null),call.camOff=!0,updateLocalPreview(null);else{if(!call.cameraTrack){const t=(await navigator.mediaDevices.getUserMedia({video:!0})).getVideoTracks()[0];call.cameraTrack=t,call.localStream.addTrack(t)}await call.videoSender.replaceTrack(call.cameraTrack),call.camOff=!1,updateLocalPreview(call.cameraTrack)}}catch{}updateCallControls()}}async function toggleScreenShare(){if(!call)return;if(call.sharing){stopScreenShare();return}let e;try{e=await navigator.mediaDevices.getDisplayMedia({video:!0,audio:!1})}catch{return}call.screenStream=e;const t=e.getVideoTracks()[0];await call.videoSender.replaceTrack(t),call.sharing=!0,updateLocalPreview(t),t.onended=()=>stopScreenShare(),updateCallControls()}async function stopScreenShare(){if(!call)return;call.screenStream&&(call.screenStream.getTracks().forEach(t=>t.stop()),call.screenStream=null);const e=call.camOff?null:call.cameraTrack||null;try{await call.videoSender.replaceTrack(e)}catch{}call.sharing=!1,updateLocalPreview(e),updateCallControls()}function ensureCallOverlay(){let e=document.getElementById("callOverlay");return e||(e=document.createElement("div"),e.id="callOverlay",e.className="call-overlay hidden",document.body.appendChild(e)),e}function hideCallUI(){const e=document.getElementById("callOverlay");e&&(e.classList.add("hidden"),e.innerHTML=""),callTimerInterval&&(clearInterval(callTimerInterval),callTimerInterval=null)}function peerDisplay(e){const t=findUser(e);return t?t.nickname:e}function callAvatarHtml(e){const t=findUser(e);return`<div class="call-avatar" style="${avatarStyle(t)}">${avatarInnerHtml(t)}</div>`}function showCallUI(e){const t=ensureCallOverlay();t.classList.remove("hidden");const n=call?call.peer:incomingCall?incomingCall.peer:"",i=call?call.kind:incomingCall?incomingCall.kind:"audio";if(e==="incoming"){t.innerHTML=`
      <div class="call-card">
        ${callAvatarHtml(n)}
        <div class="call-name">${escapeHtml(peerDisplay(n))}</div>
        <div class="call-status">${i==="video"?"\u0412\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043E\u043A":"\u0410\u0443\u0434\u0438\u043E\u0437\u0432\u043E\u043D\u043E\u043A"} \xB7 \u0432\u0445\u043E\u0434\u044F\u0449\u0438\u0439\u2026</div>
        <div class="call-ring-actions">
          <button class="call-accept" id="callAcceptBtn">\u041F\u0440\u0438\u043D\u044F\u0442\u044C</button>
          <button class="call-decline" id="callDeclineBtn">\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C</button>
        </div>
      </div>`,document.getElementById("callAcceptBtn").onclick=acceptCall,document.getElementById("callDeclineBtn").onclick=declineIncoming;return}if(e==="outgoing"){t.innerHTML=`
      <div class="call-card">
        ${callAvatarHtml(n)}
        <div class="call-name">${escapeHtml(peerDisplay(n))}</div>
        <div class="call-status">${i==="video"?"\u0412\u0438\u0434\u0435\u043E\u0437\u0432\u043E\u043D\u043E\u043A":"\u0410\u0443\u0434\u0438\u043E\u0437\u0432\u043E\u043D\u043E\u043A"} \xB7 \u0437\u0432\u043E\u043D\u0438\u043C\u2026</div>
        <div class="call-ring-actions">
          <button class="call-decline" id="callCancelBtn">\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C</button>
        </div>
      </div>`,document.getElementById("callCancelBtn").onclick=()=>{sendSignal({type:"call_cancel",to:call.peer}),endCall(!1)};return}t.innerHTML=`
    <div class="call-stage">
      <video id="callRemote" autoplay playsinline muted></video>
      <audio id="callRemoteAudio" autoplay></audio>
      <div class="call-remote-fallback" id="callRemoteFallback">
        ${callAvatarHtml(n)}
        <div class="call-name">${escapeHtml(peerDisplay(n))}</div>
      </div>
      <video id="callLocal" class="hidden" autoplay playsinline muted></video>
      <div class="call-topbar">
        <span class="call-peer">${escapeHtml(peerDisplay(n))}</span>
        <span class="call-timer" id="callTimer">00:00</span>
      </div>
      <div class="call-bar">
        <button class="call-ctrl" id="cbMic"><span class="ci">\u{1F399}</span><span class="cl">\u041C\u0438\u043A\u0440\u043E</span></button>
        <button class="call-ctrl" id="cbSound"><span class="ci">\u{1F50A}</span><span class="cl">\u0417\u0432\u0443\u043A</span></button>
        <button class="call-ctrl" id="cbCam"><span class="ci">\u{1F4F7}</span><span class="cl">\u041A\u0430\u043C\u0435\u0440\u0430</span></button>
        <button class="call-ctrl" id="cbScreen"><span class="ci">\u{1F5A5}\uFE0F</span><span class="cl">\u042D\u043A\u0440\u0430\u043D</span></button>
        <button class="call-ctrl hang" id="cbHang"><span class="ci">\u{1F4DE}</span><span class="cl">\u0421\u0431\u0440\u043E\u0441</span></button>
      </div>
    </div>`;const s=document.getElementById("callRemote");s.srcObject=call.remoteStream,s.muted=!0;const a=document.getElementById("callRemoteAudio");a&&(a.srcObject=call.remoteStream,a.muted=call.soundMuted,a.play().catch(()=>{})),document.getElementById("cbMic").onclick=toggleMic,document.getElementById("cbSound").onclick=toggleSound,document.getElementById("cbCam").onclick=toggleCam,document.getElementById("cbScreen").onclick=toggleScreenShare,document.getElementById("cbHang").onclick=()=>endCall(!0),attachRemote(),updateLocalPreview(call.camOff?null:call.cameraTrack),updateCallControls(),callTimerInterval||(callTimerInterval=setInterval(()=>{const o=document.getElementById("callTimer");if(o&&call&&call.startedAt){const l=Math.floor((Date.now()-call.startedAt)/1e3);o.textContent=`${String(Math.floor(l/60)).padStart(2,"0")}:${String(l%60).padStart(2,"0")}`}},500))}function attachRemote(){if(!call)return;const e=document.getElementById("callRemoteAudio");e&&(e.srcObject!==call.remoteStream&&(e.srcObject=call.remoteStream),e.muted=call.soundMuted,e.play().catch(()=>{}));const t=document.getElementById("callRemote"),n=document.getElementById("callRemoteFallback");if(!t||!n)return;const i=call.remoteStream.getVideoTracks().some(s=>s.readyState==="live"&&!s.muted);t.classList.toggle("hidden",!i),n.classList.toggle("hidden",i),i&&t.play().catch(()=>{})}function updateLocalPreview(e){const t=document.getElementById("callLocal");if(t)if(e){const n=new MediaStream([e]);t.srcObject=n,t.classList.remove("hidden")}else t.srcObject=null,t.classList.add("hidden")}function updateCallControls(){if(!call)return;const e=(i,s,a,o,l,c)=>{const r=document.getElementById(i);r&&(r.classList.toggle("off",s),r.querySelector(".ci").textContent=s?o:a,r.querySelector(".cl").textContent=s?c:l)};e("cbMic",call.micMuted,"\u{1F399}","\u{1F507}","\u041C\u0438\u043A\u0440\u043E","\u0412\u044B\u043A\u043B"),e("cbSound",call.soundMuted,"\u{1F50A}","\u{1F508}","\u0417\u0432\u0443\u043A","\u0422\u0438\u0445\u043E");const t=document.getElementById("cbCam");t&&(t.classList.toggle("off",call.camOff),t.classList.toggle("disabled",call.sharing));const n=document.getElementById("cbScreen");n&&(n.classList.toggle("active",call.sharing),n.querySelector(".cl").textContent=call.sharing?"\u0421\u0442\u043E\u043F":"\u042D\u043A\u0440\u0430\u043D")}function callToast(e){let t=document.getElementById("callToast");t||(t=document.createElement("div"),t.id="callToast",t.className="call-toast",document.body.appendChild(t)),t.textContent=e,t.classList.add("show"),clearTimeout(t._timer),t._timer=setTimeout(()=>t.classList.remove("show"),3e3)}
// ---------- Посты (публичная лента) ----------
let postsOverlayOpen=false, postsFeed=[], postsHasMore=false, postsLoading=false, pendingPostMedia=null;

function timeAgo(ts){
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return min + " мин";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + " ч";
  const day = Math.floor(hr / 24);
  if (day < 7) return day + " дн";
  return new Date(ts).toLocaleDateString("ru-RU");
}

function openPostsScreen(){
  postsOverlayOpen = true;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "postsOverlay";
  overlay.style.cssText = "align-items:flex-start;padding:0;";
  overlay.innerHTML = `
    <div class="modal-card" style="width:100%;max-width:560px;height:100dvh;max-height:100dvh;border-radius:0;display:flex;flex-direction:column;padding:0;margin:0 auto;">
      <div style="display:flex;align-items:center;gap:12px;padding:calc(16px + env(safe-area-inset-top)) 18px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <div class="back-btn" id="postsBackBtn" style="display:flex;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <h2 class="modal-title" style="margin:0;flex:1;text-align:left;">Посты</h2>
        <button class="pill-btn" id="newPostBtn" style="display:flex;align-items:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Новый
        </button>
      </div>
      <div id="postsFeedWrap" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;padding-bottom:calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:16px;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("postsBackBtn").onclick = closePostsScreen;
  document.getElementById("newPostBtn").onclick = openNewPostModal;
  document.getElementById("postsFeedWrap").onscroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200) loadMorePosts();
  };
  postsFeed = [];
  postsHasMore = false;
  loadPostsFeed();
}

function closePostsScreen(){
  postsOverlayOpen = false;
  const overlay = document.getElementById("postsOverlay");
  overlay && overlay.remove();
}

async function loadPostsFeed(){
  if (postsLoading) return;
  postsLoading = true;
  try {
    const res = await apiFetch("/api/posts");
    postsFeed = res.posts || [];
    postsHasMore = !!res.has_more;
    renderPostsFeed();
  } catch {
    const wrap = document.getElementById("postsFeedWrap");
    if (wrap) wrap.innerHTML = '<div class="no-users">Не удалось загрузить посты</div>';
  }
  postsLoading = false;
}

async function loadMorePosts(){
  if (postsLoading || !postsHasMore || !postsFeed.length) return;
  postsLoading = true;
  try {
    const before = postsFeed[postsFeed.length - 1].created_at;
    const res = await apiFetch("/api/posts?before=" + before);
    postsFeed = postsFeed.concat(res.posts || []);
    postsHasMore = !!res.has_more;
    renderPostsFeed();
  } catch {}
  postsLoading = false;
}

function postCardHtml(p){
  const author = p.author || { username: "?", nickname: "?" };
  const mediaHtml = p.media_kind === "video"
    ? `<video src="${p.media_url}" controls playsinline style="width:100%;max-height:520px;background:#000;display:block;"></video>`
    : `<img src="${p.media_url}" alt="" style="width:100%;max-height:520px;object-fit:contain;background:#000;display:block;">`;
  return `
    <div class="modal-card" data-post-card="${p.id}" style="width:100%;padding:0;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;">
        <div class="avatar" style="width:34px;height:34px;font-size:12px;${avatarStyle(author)}">${avatarInnerHtml(author)}</div>
        <div style="flex:1;min-width:0;">
          <div class="chat-name">${escapeHtml(author.nickname || author.username)}</div>
          <div class="chat-sub">${timeAgo(p.created_at)}</div>
        </div>
        ${author.username === me.username ? `<div class="pill-btn danger" data-del-post="${p.id}" style="padding:6px 10px;">Удалить</div>` : ""}
      </div>
      ${mediaHtml}
      <div style="padding:10px 14px 4px;display:flex;align-items:center;gap:14px;">
        <button class="react-btn" style="position:static;opacity:1;width:auto;height:auto;border:none;background:none;padding:0;gap:6px;display:flex;align-items:center;color:${p.liked_by_me ? "#ec4899" : "var(--text-mid)"};" data-like-post="${p.id}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="${p.liked_by_me ? "#ec4899" : "none"}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>
          <span data-like-count="${p.id}">${p.like_count}</span>
        </button>
        <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);font-size:13px;cursor:pointer;" data-open-comments="${p.id}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          ${p.comment_count}
        </div>
      </div>
      ${p.caption ? `<div style="padding:2px 14px 14px;font-size:13.5px;line-height:1.4;"><b>${escapeHtml(author.nickname || author.username)}</b> ${escapeHtml(p.caption)}</div>` : `<div style="height:10px;"></div>`}
    </div>
  `;
}

function renderPostsFeed(){
  const wrap = document.getElementById("postsFeedWrap");
  if (!wrap) return;
  if (!postsFeed.length) {
    wrap.innerHTML = '<div class="no-users">Пока нет постов — станьте первым!</div>';
    return;
  }
  wrap.innerHTML = postsFeed.map(postCardHtml).join("");
  wrap.querySelectorAll("[data-like-post]").forEach((btn) => {
    btn.onclick = () => togglePostLike(Number(btn.dataset.likePost));
  });
  wrap.querySelectorAll("[data-del-post]").forEach((btn) => {
    btn.onclick = () => deletePost(Number(btn.dataset.delPost));
  });
  wrap.querySelectorAll("[data-open-comments]").forEach((el) => {
    el.onclick = () => openCommentsModal(Number(el.dataset.openComments));
  });
}

async function togglePostLike(postId){
  const post = postsFeed.find((p) => p.id === postId);
  if (!post) return;
  const prevLiked = post.liked_by_me, prevCount = post.like_count;
  post.liked_by_me = !prevLiked;
  post.like_count = prevCount + (post.liked_by_me ? 1 : -1);
  const likeEl = document.querySelector(`[data-like-count="${postId}"]`);
  const btnEl = document.querySelector(`[data-like-post="${postId}"]`);
  if (likeEl) likeEl.textContent = post.like_count;
  if (btnEl) {
    btnEl.style.color = post.liked_by_me ? "#ec4899" : "var(--text-mid)";
    const svg = btnEl.querySelector("svg");
    if (svg) svg.setAttribute("fill", post.liked_by_me ? "#ec4899" : "none");
  }
  try {
    const res = await apiFetch("/api/posts/" + postId + "/like", { method: "POST" });
    post.liked_by_me = res.liked;
    post.like_count = res.like_count;
    if (likeEl) likeEl.textContent = post.like_count;
  } catch {
    post.liked_by_me = prevLiked;
    post.like_count = prevCount;
    renderPostsFeed();
  }
}

async function deletePost(postId){
  if (!confirm("Удалить этот пост?")) return;
  try {
    await apiFetch("/api/posts/" + postId, { method: "DELETE" });
    postsFeed = postsFeed.filter((p) => p.id !== postId);
    renderPostsFeed();
  } catch (e) {
    alert((e && e.message) || "Не удалось удалить пост");
  }
}

function openCommentsModal(postId){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "commentsOverlay";
  overlay.innerHTML = `
    <div class="modal-card" style="display:flex;flex-direction:column;max-height:78vh;">
      <div class="modal-close" id="commentsClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">Комментарии</h2>
      <div id="commentsList" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;margin-bottom:12px;"><div class="no-users">Загрузка…</div></div>
      <div style="display:flex;gap:8px;">
        <input class="auth-input" id="commentInput" placeholder="Написать комментарий…" style="margin-bottom:0;flex:1;">
        <button class="auth-button" id="commentSend" style="width:auto;padding:0 18px;">→</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("commentsClose").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  const input = document.getElementById("commentInput");
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    send.disabled = true;
    try {
      const res = await apiFetch("/api/posts/" + postId + "/comments", { method: "POST", body: JSON.stringify({ text }) });
      input.value = "";
      const post = postsFeed.find((p) => p.id === postId);
      if (post) {
        post.comment_count++;
        renderPostsFeed();
      }
      appendCommentToList(res.comment, postId);
    } catch (e2) {
      alert((e2 && e2.message) || "Не удалось отправить комментарий");
    }
  };
  document.getElementById("commentSend").onclick = send;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  loadComments(postId);
}

function commentRowHtml(c, postId){
  const author = c.author || { username: "?", nickname: "?" };
  const canDelete = author.username === me.username;
  return `
    <div style="display:flex;gap:10px;" data-comment-row="${c.id}">
      <div class="avatar" style="width:30px;height:30px;font-size:11px;flex-shrink:0;${avatarStyle(author)}">${avatarInnerHtml(author)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;line-height:1.4;"><b>${escapeHtml(author.nickname || author.username)}</b> ${escapeHtml(c.text)}</div>
        <div class="chat-sub" style="margin-top:2px;">${timeAgo(c.created_at)}</div>
      </div>
      ${canDelete ? `<div style="cursor:pointer;color:var(--text-low);flex-shrink:0;" data-del-comment="${c.id}" data-post-id="${postId}">✕</div>` : ""}
    </div>
  `;
}

async function loadComments(postId){
  const list = document.getElementById("commentsList");
  try {
    const res = await apiFetch("/api/posts/" + postId + "/comments");
    if (!document.getElementById("commentsList")) return;
    if (!res.comments.length) {
      list.innerHTML = '<div class="no-users">Комментариев пока нет</div>';
      return;
    }
    list.innerHTML = res.comments.map((c) => commentRowHtml(c, postId)).join("");
    wireCommentDeleteButtons(postId);
  } catch {
    if (list) list.innerHTML = '<div class="no-users">Не удалось загрузить комментарии</div>';
  }
}

function appendCommentToList(comment, postId){
  const list = document.getElementById("commentsList");
  if (!list) return;
  if (list.querySelector(".no-users")) list.innerHTML = "";
  list.insertAdjacentHTML("beforeend", commentRowHtml(comment, postId));
  list.scrollTop = list.scrollHeight;
  wireCommentDeleteButtons(postId);
}

function wireCommentDeleteButtons(postId){
  document.querySelectorAll("[data-del-comment]").forEach((el) => {
    el.onclick = async () => {
      const commentId = el.dataset.delComment;
      try {
        await apiFetch("/api/posts/" + postId + "/comments/" + commentId, { method: "DELETE" });
        const row = document.querySelector(`[data-comment-row="${commentId}"]`);
        row && row.remove();
        const post = postsFeed.find((p) => p.id === postId);
        if (post) {
          post.comment_count = Math.max(0, post.comment_count - 1);
          renderPostsFeed();
        }
      } catch (e) {
        alert((e && e.message) || "Не удалось удалить комментарий");
      }
    };
  });
}

function openNewPostModal(){
  pendingPostMedia = null;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "newPostOverlay";
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-close" id="newPostClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">Новый пост</h2>
      <div id="newPostPreviewWrap" style="margin-bottom:14px;"></div>
      <button class="pill-btn" id="newPostPickMedia" style="width:100%;justify-content:center;display:flex;margin-bottom:12px;">Выбрать фото или видео</button>
      <textarea class="auth-input" id="newPostCaption" placeholder="Подпись к посту (необязательно)" style="resize:vertical;min-height:70px;font-family:inherit;"></textarea>
      <div class="auth-error" id="newPostError"></div>
      <button class="auth-button" id="newPostSubmit" disabled>Опубликовать</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("newPostClose").onclick = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  const fileInput = document.getElementById("postFileInput");
  document.getElementById("newPostPickMedia").onclick = () => { fileInput.value = ""; fileInput.click(); };
  fileInput.onchange = async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const errEl = document.getElementById("newPostError");
    errEl.textContent = "";
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) { errEl.textContent = "Можно выбрать только фото или видео"; return; }
    try {
      if (isImage && file.type !== "image/gif") {
        pendingPostMedia = await compressImage(file);
      } else {
        const dataUrl = await fileToDataUrl(file);
        const approxBytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
        if (approxBytes > MAX_MEDIA_BYTES) { errEl.textContent = "Файл больше 25 МБ"; return; }
        const dims = isVideo ? await videoDimensions(dataUrl) : { w: null, h: null };
        pendingPostMedia = { dataUrl, mime: file.type, kind: isVideo ? "video" : "image", w: dims.w, h: dims.h };
      }
      renderNewPostPreview();
      document.getElementById("newPostSubmit").disabled = false;
    } catch {
      errEl.textContent = "Не удалось обработать файл";
    }
  };

  document.getElementById("newPostSubmit").onclick = submitNewPost;
}

function renderNewPostPreview(){
  const wrap = document.getElementById("newPostPreviewWrap");
  if (!wrap || !pendingPostMedia) return;
  wrap.innerHTML = pendingPostMedia.kind === "video"
    ? `<video src="${pendingPostMedia.dataUrl}" controls style="width:100%;max-height:280px;border-radius:12px;background:#000;"></video>`
    : `<img src="${pendingPostMedia.dataUrl}" alt="" style="width:100%;max-height:280px;object-fit:contain;border-radius:12px;background:#000;">`;
}

async function submitNewPost(){
  const errEl = document.getElementById("newPostError");
  const submitBtn = document.getElementById("newPostSubmit");
  if (!pendingPostMedia) { errEl.textContent = "Выберите фото или видео"; return; }
  submitBtn.disabled = true;
  try {
    const caption = document.getElementById("newPostCaption").value.trim();
    const res = await apiFetch("/api/posts", {
      method: "POST",
      body: JSON.stringify({ media: pendingPostMedia.dataUrl, caption, media_w: pendingPostMedia.w, media_h: pendingPostMedia.h }),
    });
    postsFeed.unshift(res.post);
    renderPostsFeed();
    const overlay = document.getElementById("newPostOverlay");
    overlay && overlay.remove();
  } catch (e) {
    errEl.textContent = (e && e.message) || "Не удалось опубликовать пост";
    submitBtn.disabled = false;
  }
}



// ---------- Хаммам: интерфейс прокачки ----------
let hammamState = null, hammamBusy = false, hammamCollectTicker = null;

function hammamSceneBackground(stageIdx){
  const bgs = [
    "linear-gradient(180deg,#3a2a1a,#1c130c)",   // сарайчик
    "linear-gradient(180deg,#4a2f22,#241610)",   // скромная банька
    "linear-gradient(180deg,#5a3a28,#2a1a12)",   // банька с верандой
    "linear-gradient(180deg,#3d2a4a,#1a1024)",   // изразцы
    "linear-gradient(180deg,#5a3d1a,#2a1a08)",   // ультра хаммам
  ];
  return bgs[Math.min(stageIdx, bgs.length - 1)];
}

// Рисованный домик для сцены хаммама — 5 вариантов по стадии декора
// (0 = дощатый сарайчик … 4 = ультра хаммам). Раньше вместо картинки был
// только градиент фона и эмодзи мышки — визуально почти пустая плашка.
function hammamHouseSvg(stageIdx){
  const idx = Math.max(0, Math.min(4, stageIdx));
  const houses = [
    // 0: Дощатый сарайчик — кривая дощатая хибара, без окна, палка-труба.
    `<svg viewBox="0 0 220 160" class="hammam-house">
      <polygon points="30,90 110,40 190,90" fill="#6b4a2c"/>
      <rect x="38" y="90" width="144" height="55" fill="#5a3d24"/>
      <rect x="38" y="90" width="144" height="55" fill="url(#plankLines)" opacity=".35"/>
      <rect x="95" y="108" width="30" height="37" fill="#2a1a0e"/>
      <rect x="150" y="55" width="10" height="26" fill="#4a3220"/>
      <defs><pattern id="plankLines" width="18" height="8" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="18" y2="8" stroke="#2a1a0e" stroke-width="1.5"/></pattern></defs>
    </svg>`,
    // 1: Скромная банька — ровнее сруб, маленькое окошко, дым из трубы.
    `<svg viewBox="0 0 220 160" class="hammam-house">
      <polygon points="26,85 110,32 194,85" fill="#7a5232"/>
      <rect x="34" y="85" width="152" height="60" fill="#6b4527"/>
      <rect x="34" y="85" width="152" height="60" fill="url(#plankLines2)" opacity=".3"/>
      <rect x="60" y="100" width="26" height="22" fill="#ffd77a" opacity=".8" stroke="#3a2412" stroke-width="2"/>
      <rect x="96" y="105" width="28" height="40" fill="#2a1a0e"/>
      <rect x="150" y="48" width="12" height="30" fill="#553824"/>
      <ellipse cx="156" cy="40" rx="9" ry="6" fill="#ccc" opacity=".55"/>
      <defs><pattern id="plankLines2" width="18" height="8" patternUnits="userSpaceOnUse"><line x1="0" y1="8" x2="18" y2="8" stroke="#3a2412" stroke-width="1.5"/></pattern></defs>
    </svg>`,
    // 2: Уютная банька с верандой — пристройка-веранда со столбиками, два окна.
    `<svg viewBox="0 0 220 160" class="hammam-house">
      <polygon points="34,80 118,28 202,80" fill="#8a5f3a"/>
      <rect x="42" y="80" width="152" height="55" fill="#7a5230"/>
      <rect x="10" y="100" width="40" height="45" fill="#5a3d22"/>
      <line x1="14" y1="145" x2="14" y2="102" stroke="#3a2412" stroke-width="4"/>
      <line x1="46" y1="145" x2="46" y2="102" stroke="#3a2412" stroke-width="4"/>
      <rect x="66" y="95" width="24" height="20" fill="#ffd77a" opacity=".85" stroke="#3a2412" stroke-width="2"/>
      <rect x="146" y="95" width="24" height="20" fill="#ffd77a" opacity=".85" stroke="#3a2412" stroke-width="2"/>
      <rect x="104" y="102" width="28" height="33" fill="#2a1a0e"/>
      <rect x="160" y="42" width="12" height="32" fill="#5a3d22"/>
      <ellipse cx="166" cy="34" rx="10" ry="7" fill="#ccc" opacity=".55"/>
      <ellipse cx="172" cy="24" rx="8" ry="5" fill="#ccc" opacity=".4"/>
    </svg>`,
    // 3: Хаммам с изразцами — купол-луковица, узорная плитка, арочный вход.
    `<svg viewBox="0 0 220 160" class="hammam-house">
      <path d="M110 20 C90 20 78 42 78 56 L142 56 C142 42 130 20 110 20 Z" fill="#6a4fb0"/>
      <circle cx="110" cy="16" r="5" fill="#f7cf6a"/>
      <rect x="50" y="56" width="120" height="79" fill="#4a3a7a"/>
      <rect x="50" y="56" width="120" height="79" fill="url(#tilePattern)" opacity=".5"/>
      <path d="M92 135 L92 100 C92 88 128 88 128 100 L128 135 Z" fill="#1a1230"/>
      <rect x="64" y="72" width="20" height="20" fill="#ffd77a" opacity=".85" transform="rotate(45 74 82)"/>
      <rect x="136" y="72" width="20" height="20" fill="#ffd77a" opacity=".85" transform="rotate(45 146 82)"/>
      <defs><pattern id="tilePattern" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="none"/><path d="M0 10 L10 0 L20 10 L10 20 Z" fill="none" stroke="#f7cf6a" stroke-width="1"/></pattern></defs>
    </svg>`,
    // 4: Ультра хаммам — золотой купол с полумесяцем, колонны, светящиеся окна.
    `<svg viewBox="0 0 220 160" class="hammam-house">
      <path d="M110 14 C86 14 72 40 72 58 L148 58 C148 40 134 14 110 14 Z" fill="url(#goldDome)"/>
      <circle cx="110" cy="8" r="4" fill="#fff3c2"/>
      <path d="M110 8 a5 5 0 1 0 5 -5 a4 4 0 1 1 -5 5" fill="#fff3c2"/>
      <rect x="40" y="58" width="140" height="77" fill="url(#goldWall)"/>
      <rect x="40" y="58" width="140" height="77" fill="url(#tilePattern2)" opacity=".4"/>
      <path d="M90 135 L90 96 C90 82 130 82 130 96 L130 135 Z" fill="#241804"/>
      <rect x="52" y="70" width="10" height="45" fill="#fff3c2" opacity=".3"/>
      <rect x="158" y="70" width="10" height="45" fill="#fff3c2" opacity=".3"/>
      <circle cx="66" cy="82" r="10" fill="#ffe9a6" opacity=".9"/>
      <circle cx="154" cy="82" r="10" fill="#ffe9a6" opacity=".9"/>
      <defs>
        <linearGradient id="goldDome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a6"/><stop offset="1" stop-color="#c98f2e"/></linearGradient>
        <linearGradient id="goldWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5a1e"/><stop offset="1" stop-color="#4a350f"/></linearGradient>
        <pattern id="tilePattern2" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 9 L9 0 L18 9 L9 18 Z" fill="none" stroke="#ffe9a6" stroke-width="1"/></pattern>
      </defs>
    </svg>`,
  ];
  return houses[idx];
}

function hammamSceneHtml(hammamState){
  const { params, decorStage, perHour } = hammamState;
  const decorLevel = params.decor.level;
  const steamLevel = params.steam.level;
  const furnaceLevel = params.furnace.level;
  const venikLevel = params.venik.level;

  const stageIdx = HAMMAM_DECOR_STAGES_CLIENT.findIndex((s) => s.min === decorStage.min);
  const clampedStageIdx = Math.max(0, stageIdx);
  const bg = hammamSceneBackground(clampedStageIdx);
  const houseSvg = hammamHouseSvg(clampedStageIdx);

  // Пар: количество и размер облачков растут с уровнем.
  const steamCount = Math.min(6, 1 + Math.floor(steamLevel / 3));
  const steamPuffs = Array.from({ length: steamCount }).map((_, i) => {
    const left = 20 + ((i * 137) % 60);
    const delay = (i * 0.6).toFixed(1);
    const size = 26 + (i % 3) * 8;
    return `<div class="hammam-steam" style="left:${left}%;width:${size}px;height:${size}px;animation-delay:${delay}s;"></div>`;
  }).join("");

  // Угли/огонь: яркость и число языков пламени растут с уровнем печи.
  const emberCount = Math.min(5, 1 + Math.floor(furnaceLevel / 4));
  const embers = Array.from({ length: emberCount }).map((_, i) => {
    const left = 38 + i * 6;
    const delay = (i * 0.35).toFixed(2);
    return `<div class="hammam-ember" style="left:${left}%;animation-delay:${delay}s;"></div>`;
  }).join("");

  const venikBadge = venikLevel > 0
    ? `<div class="hammam-venik" title="Веник прокачан">🪵</div>`
    : "";

  const sparkle = decorLevel >= 8 ? `<div class="hammam-sparkle">✨</div>` : "";

  return `
    <div class="hammam-scene" style="background:${bg};">
      <div class="hammam-scene-glow"></div>
      <div class="hammam-house-wrap">${houseSvg}</div>
      ${embers}
      <div class="hammam-mascot">🐹</div>
      ${venikBadge}
      ${steamPuffs}
      ${sparkle}
      <div class="hammam-scene-caption">
        <div class="hammam-scene-title">${decorStage.emoji} ${escapeHtml(decorStage.label)}</div>
        <div class="hammam-scene-sub">${perHour} 🍾/час</div>
      </div>
    </div>
  `;
}

const HAMMAM_DECOR_STAGES_CLIENT = [
  { min: 0 }, { min: 2 }, { min: 4 }, { min: 6 }, { min: 8 },
];

function closeHammamModal(){
  const e = document.getElementById("hammamOverlay");
  e && e.remove();
  if (hammamCollectTicker) { clearInterval(hammamCollectTicker); hammamCollectTicker = null; }
}

async function openHammamModal(){
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "hammamOverlay";
  overlay.innerHTML = `
    <div class="modal-card mine-modal-card" style="width:min(420px,94vw);">
      <div class="modal-close" id="hammamClose">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </div>
      <h2 class="modal-title">Хаммам</h2>
      <div id="hammamBody"><div class="twofa-loading">Загрузка…</div></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("hammamClose").onclick = closeHammamModal;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeHammamModal(); });
  await refreshHammamState();
  hammamCollectTicker = setInterval(refreshHammamState, 15000);
}

async function refreshHammamState(){
  try {
    const res = await apiFetch("/api/hammam");
    hammamState = res.hammam;
    renderHammamBody();
  } catch {
    const body = document.getElementById("hammamBody");
    if (body) body.innerHTML = '<div class="no-users">Не удалось загрузить хаммам</div>';
  }
}

function hammamParamRowHtml(key, p){
  const maxed = p.level >= p.maxLevel;
  const canAfford = !maxed && me.balance >= p.nextCost;
  return `
    <div class="owner-row">
      <div class="owner-row-top">
        <div class="mine-launch-emoji">${p.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div class="owner-row-name">${escapeHtml(p.label)} <span class="chat-badge">${p.level}/${p.maxLevel}</span></div>
          <div class="owner-row-sub">${escapeHtml(p.desc)}</div>
        </div>
      </div>
      <div class="owner-row-actions" style="align-items:center;">
        ${maxed
          ? `<span class="wallet-hint">Максимальный уровень</span>`
          : `<button class="pill-btn" data-hammam-upgrade="${key}" ${canAfford ? "" : "disabled"} style="${canAfford ? "" : "opacity:.5;"}">
               Улучшить · ${p.nextCost} 🍾
             </button>`
        }
      </div>
    </div>
  `;
}

function renderHammamBody(){
  const body = document.getElementById("hammamBody");
  if (!body || !hammamState) return;
  const { params, banked, cap } = hammamState;
  const pct = cap > 0 ? Math.min(100, Math.round((banked / cap) * 100)) : 0;

  body.innerHTML = `
    ${hammamSceneHtml(hammamState)}

    <div class="wallet-card" style="flex-direction:column;align-items:stretch;gap:8px;margin:16px 0 18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="wallet-balance">${banked} / ${cap} 🍾</div>
        <button class="auth-button" id="hammamCollectBtn" style="width:auto;padding:9px 18px;font-size:13px;" ${banked <= 0 ? "disabled" : ""}>Собрать</button>
      </div>
      <div class="status-progress-track"><div class="status-progress-fill" style="width:${pct}%;"></div></div>
      <div class="wallet-hint">Копится само со временем — не забывайте забирать, пока предбанник не переполнился</div>
    </div>

    <div class="settings-section-label">Прокачка</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${Object.entries(params).map(([key, p]) => hammamParamRowHtml(key, p)).join("")}
    </div>
  `;

  const collectBtn = document.getElementById("hammamCollectBtn");
  if (collectBtn) collectBtn.onclick = collectHammamIncome;
  body.querySelectorAll("[data-hammam-upgrade]").forEach((btn) => {
    btn.onclick = () => upgradeHammamParam(btn.dataset.hammamUpgrade);
  });
}

async function collectHammamIncome(){
  if (hammamBusy) return;
  hammamBusy = true;
  try {
    const res = await apiFetch("/api/hammam/collect", { method: "POST" });
    hammamState = res.hammam;
    if (res.user) { me = res.user; localStorage.setItem("nova_me", JSON.stringify(me)); renderBalance(); }
    renderHammamBody();
  } catch (e) {
    alert((e && e.message) || "Не удалось собрать доход");
  }
  hammamBusy = false;
}

async function upgradeHammamParam(key){
  if (hammamBusy) return;
  hammamBusy = true;
  try {
    const res = await apiFetch("/api/hammam/upgrade/" + encodeURIComponent(key), { method: "POST" });
    hammamState = res.hammam;
    if (res.user) { me = res.user; localStorage.setItem("nova_me", JSON.stringify(me)); renderBalance(); }
    renderHammamBody();
  } catch (e) {
    alert((e && e.message) || "Не удалось улучшить");
  }
  hammamBusy = false;
}

document.getElementById("hammamBtn") && (document.getElementById("hammamBtn").onclick = openHammamModal);
document.getElementById("hammamBtnMobile") && (document.getElementById("hammamBtnMobile").onclick = openHammamModal);
document.getElementById("postsBtn") && (document.getElementById("postsBtn").onclick = openPostsScreen);
document.getElementById("postsBtnMobile") && (document.getElementById("postsBtnMobile").onclick = openPostsScreen);


// ---------- Мобильное UX: блокировка скролла фона под открытой модалкой ----------
// Не завязываемся на конкретные функции открытия/закрытия (их много) —
// просто следим за появлением/исчезновением .modal-overlay в DOM.
(function(){
  const sync = () => {
    document.body.classList.toggle("modal-open", !!document.querySelector(".modal-overlay"));
  };
  new MutationObserver(sync).observe(document.body, { childList: true });
  sync();
})();


(async function(){if(token){if(me){enterApp();return}try{me=(await apiFetch("/api/me")).user,localStorage.setItem("nova_me",JSON.stringify(me)),enterApp()}catch{}}})();

// ---------- Telegram-style edge-swipe-back для мобильного экрана переписки ----------
// Свайп вправо, начатый у левого края экрана переписки, закрывает чат
// и возвращает к списку — как в Telegram.
(function(){
  const EDGE = 24;       // зона у левого края, в которой начинается жест (px)
  const THRESHOLD = 70;  // минимальный сдвиг вправо, чтобы засчитать закрытие (px)

  let startX = 0, startY = 0, tracking = false, active = false;
  const conv = document.getElementById("conversation");
  if (!conv) return;

  conv.addEventListener("touchstart", (e) => {
    if (!document.getElementById("appScreen").classList.contains("chat-open")) return;
    const t = e.touches[0];
    if (t.clientX > EDGE) { tracking = false; return; }
    startX = t.clientX; startY = t.clientY;
    tracking = true; active = false;
    conv.style.transition = "none";
  }, { passive: true });

  conv.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (!active) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; } // вертикальный скролл — не наш жест
      active = true;
    }
    if (dx > 0) {
      conv.style.transform = `translateX(${dx}px)`;
    }
  }, { passive: true });

  function reset() {
    conv.style.transition = "";
    conv.style.transform = "";
  }

  conv.addEventListener("touchend", (e) => {
    if (!tracking) return;
    tracking = false;
    if (!active) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    if (dx > THRESHOLD) {
      conv.style.transition = "transform .18s ease";
      conv.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (typeof closeConversationMobile === "function") closeConversationMobile();
        reset();
      }, 160);
    } else {
      reset();
    }
    active = false;
  });

  conv.addEventListener("touchcancel", () => { tracking = false; active = false; reset(); });
})();

// ---------- Друн ФМ: модалка с YouTube-плеером ----------
const RADIO_YT_ID = "eZJx14UhktY";

function openRadioModal(){
  if (document.getElementById("radioOverlay")) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "radioOverlay";
  overlay.innerHTML = `
    <div class="modal-card" style="max-width:480px;">
      <div class="modal-close" id="radioClose">✕</div>
      <h2 class="modal-title">📻 Друн ФМ</h2>
      <div style="position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;">
        <iframe
          id="radioIframe"
          src="https://www.youtube.com/embed/${RADIO_YT_ID}?autoplay=1&rel=0"
          title="Друн ФМ"
          style="position:absolute;inset:0;width:100%;height:100%;border:0;"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => {
    const ifr = document.getElementById("radioIframe");
    if (ifr) ifr.src = ""; // остановить звук при закрытии
    overlay.remove();
  };
  document.getElementById("radioClose").onclick = close;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

document.getElementById("radioBtn") && (document.getElementById("radioBtn").onclick = openRadioModal);
document.getElementById("radioBtnMobile") && (document.getElementById("radioBtnMobile").onclick = openRadioModal);
document.getElementById("radioChatItem") && (document.getElementById("radioChatItem").onclick = openRadioModal);
