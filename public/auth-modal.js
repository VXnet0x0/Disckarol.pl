(function(){
  function createModal(){
    if (document.querySelector('.auth-modal')) return;
    const modal = document.createElement('div'); modal.className='auth-modal';
    modal.innerHTML = `
      <div class="box" role="dialog" aria-modal="true">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3>Login / Register</h3><button id="closeAuth" aria-label="close">✕</button></div>
        <div id="authTabs">
          <div id="loginForm">
            <label>Username or Email<input id="authId" placeholder="username or email" /></label>
            <label>Password<input id="authPass" type="password" placeholder="password" /></label>
            <div class="row" style="margin-top:8px"><button id="doLogin">Login</button><button id="doToggleRegister">Register</button></div>
            <div class="small">Or sign in with: <a href="/auth/github"><i class="fa-brands fa-github"></i> GitHub</a></div>
          </div>
          <div id="regForm" style="display:none">
            <label>Username<input id="regUser" placeholder="username" /></label>
            <label>Email<input id="regEmail" type="email" placeholder="email@example.com" /></label>
            <label>Password<input id="regPass" type="password" placeholder="password (min 6)" /></label>
            <div class="row" style="margin-top:8px"><button id="doRegister">Create account</button><button id="doToggleLogin">Back to Login</button></div>
            <div class="small">You can also sign in with: <a href="/auth/github"><i class="fa-brands fa-github"></i> GitHub</a></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('closeAuth').onclick = closeModal;
    document.getElementById('doToggleRegister').onclick = ()=>{ document.getElementById('loginForm').style.display='none'; document.getElementById('regForm').style.display='block'; };
    document.getElementById('doToggleLogin').onclick = ()=>{ document.getElementById('regForm').style.display='none'; document.getElementById('loginForm').style.display='block'; };

    document.getElementById('doLogin').onclick = async () => {
      const id = (document.getElementById('authId')||{}).value||'';
      const pass = (document.getElementById('authPass')||{}).value||'';
      if (!id || !pass) return alert('Id and password required');
      try {
        // determine if id looks like email
        const isEmail = id.includes('@');
        const body = isEmail ? { email: id, password: pass } : { username: id, password: pass };
        const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        const j = await r.json(); if (j.ok) { closeModal(); if (window.me) window.me(); else location.reload(); } else alert(j.error||'login failed');
      } catch (e) { console.error(e); alert('login error'); }
    };

    document.getElementById('doRegister').onclick = async () => {
      const username = (document.getElementById('regUser')||{}).value||'';
      const email = (document.getElementById('regEmail')||{}).value||'';
      const pass = (document.getElementById('regPass')||{}).value||'';
      if (!username || !email || !pass) return alert('username, email and password required');
      try {
        const r = await fetch('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, email, password: pass }) });
        const j = await r.json(); if (j.ok) { alert('Account created'); closeModal(); if (window.me) window.me(); else location.reload(); } else alert(j.error || 'register failed');
      } catch (e) { console.error(e); alert('register error'); }
    };

    // try to render Google button if available
    (async function(){ try{ const cfg = await (await fetch('/api/config')).json(); if (cfg.GOOGLE_CLIENT_ID) { const s = document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true; document.head.appendChild(s);
        window.handleCredentialResponse = async (resp) => {
          try { const r = await fetch('/api/auth/google', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ credential: resp.credential }) }); const j = await r.json(); if (j.ok) { alert('Google logged in'); closeModal(); if (window.me) window.me(); else location.reload(); } else alert(j.error||'google login failed'); } catch(e){ console.error('google post', e); }
        };
        s.onload = function(){ const el = document.querySelector('#authTabs'); const gb = document.createElement('div'); gb.id = 'gbtn'; gb.style.marginTop='8px'; el.appendChild(gb); google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: handleCredentialResponse }); google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'outline', size: 'large' }); } }
      }catch(e){}
    })();

    document.addEventListener('keydown', onKeyDown);
  }
  function onKeyDown(e){ if (e.key === 'Escape') closeModal(); }
  function closeModal(){ const m = document.querySelector('.auth-modal'); if (m) { m.remove(); document.removeEventListener('keydown', onKeyDown); } }

  // attach opening to any anchor with href="#auth" and element with id 'auth' (nav)
  function attachOpeners(){ document.querySelectorAll('a[href="#auth"]').forEach(a=>a.onclick=(e)=>{ e.preventDefault(); createModal(); }); const authEl = document.getElementById('auth'); if (authEl) authEl.addEventListener('click', (e)=>{ // if clicked outside inputs
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')) return; createModal(); }); }
  attachOpeners();
  // expose for pages to open programmatically
  window.openAuthModal = createModal;
})();