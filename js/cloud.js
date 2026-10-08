/* Conta na nuvem (Supabase): cadastro, login, recuperacao de senha com troca obrigatoria,
   sincronizacao dos dados proprios entre aparelhos e acesso as listas publicadas.
   A senha nunca passa por este codigo depois do envio: o Supabase Auth guarda apenas o hash (bcrypt). */
(function(){
  var cfg=window.CLOUD_CONFIG||{};
  var MIN_PW=Number(cfg.minPassword)||8;
  var RESET_FLAG='sqlsm-pw-reset',AUTH_KEY='sqlsm-auth',LISTS_KEY='sqlsm-mylists';
  var SVG_USER='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  var SVG_CLOUD='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>';
  var client=null,session=null,status='off',lastError=null;
  var forced=false,internal=false,choiceResolve=null;
  var cycle=null,again=false,syncTimer=null,backoff=0,lastRun=0;
  var Cloud={myListsCache:loadCache()};
  window.Cloud=Cloud;

  function parseHash(h){var out={};(h||'').replace(/^#/,'').split('&').forEach(function(p){var i=p.indexOf('=');if(i>0){try{out[decodeURIComponent(p.slice(0,i))]=decodeURIComponent(p.slice(i+1).replace(/\+/g,' '))}catch(e){}}});return out}
  var hashInfo=parseHash(location.hash);
  var recoveryInUrl=hashInfo.type==='recovery',signupInUrl=hashInfo.type==='signup';
  var urlError=hashInfo.error_code||hashInfo.error||null;

  if(cfg.url&&cfg.anonKey&&window.supabase&&typeof supabase.createClient==='function'){
    try{client=supabase.createClient(cfg.url,cfg.anonKey,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_KEY}})}
    catch(e){console.error('Falha ao iniciar o Supabase',e);client=null}
  }
  Cloud.client=client;
  Cloud.available=function(){return!!client};
  Cloud.isSignedIn=function(){return!!session};
  Cloud.user=function(){return session&&session.user||null};
  Cloud.status=function(){return status};
  /* O usuario e fixado no inicio de cada ciclo: se a sessao mudar no meio (sair/entrar com outra conta),
     o ciclo aborta em vez de gravar os dados de uma conta na outra. */
  var cycleUid=null;
  function uid_(){alive();return cycleUid}
  function alive(){if(!session||session.user.id!==cycleUid){var e=new Error('session_changed');e.aborted=true;throw e}}
  function tr(key,vars){var s=t(key);Object.keys(vars||{}).forEach(function(k){s=s.split('{'+k+'}').join(vars[k])});return s}
  function redirectUrl(){return/^https?:$/.test(location.protocol)?location.origin+location.pathname:(cfg.siteUrl||'')}
  function loadCache(){try{var v=JSON.parse(localStorage.getItem(LISTS_KEY)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
  function saveCache(){try{localStorage.setItem(LISTS_KEY,JSON.stringify(Cloud.myListsCache))}catch(e){}}
  function cleanUrl(){if(/access_token|error_code|error=|type=/.test(location.hash)){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}}

  /* ===== Mensagens de erro ===== */
  var ERRORS={invalid_credentials:'authErrInvalid',email_not_confirmed:'authErrNotConfirmed',weak_password:'authErrWeak',over_email_send_rate_limit:'authErrRate',over_request_rate_limit:'authErrRate',same_password:'authErrSamePw',email_address_invalid:'authErrEmail',validation_failed:'authErrEmail',user_already_exists:'authErrExists',email_exists:'authErrExists',signup_disabled:'authErrSignupOff',otp_expired:'authErrLink',list_limit:'pubLimit',quota_exceeded:'syncQuota',invalid_snapshot:'shInvalid',item_too_large:'syncQuota'};
  Cloud.errorText=function(e){
    if(!e)return'';
    var code=e.code||'',msg=e.message||String(e);
    if(ERRORS[code])return t(ERRORS[code]);
    if(ERRORS[msg])return t(ERRORS[msg]);
    if(/invalid login credentials/i.test(msg))return t('authErrInvalid');
    if(/email not confirmed/i.test(msg))return t('authErrNotConfirmed');
    if(e.name==='AuthRetryableFetchError'||e instanceof TypeError||/failed to fetch|networkerror|load failed/i.test(msg))return t('authErrNetwork');
    return tr('authErrGeneric',{msg:msg});
  };

  /* ===== Bloqueio de modais durante a troca obrigatoria de senha e escolhas pendentes ===== */
  var prevOpen=window.openModal,prevClose=window.closeModal;
  /* Uma escolha pendente fechada por Esc, clique fora ou outro modal vira "decidir depois" (defer). */
  function dropChoice(){if(choiceResolve&&!internal){var r=choiceResolve;choiceResolve=null;r('defer')}}
  window.openModal=function(){if(forced&&!internal)return;dropChoice();return prevOpen.apply(this,arguments)};
  window.closeModal=function(){if(forced&&!internal)return;dropChoice();return prevClose.apply(this,arguments)};
  function openOwn(hd,bd,ft){internal=true;try{prevOpen(hd,bd,ft,false)}finally{internal=false}}
  function closeOwn(){internal=true;try{prevClose()}finally{internal=false}}
  window.addEventListener('keydown',function(e){if(forced&&(e.ctrlKey||e.metaKey)&&/^[nk]$/i.test(e.key)){e.preventDefault();e.stopImmediatePropagation()}},true);

  /* Modal com escolhas. */
  function choose(title,text,options){
    return new Promise(function(resolve){
      var ft='<div style="flex:1"></div>'+options.map(function(o){return'<button class="btn'+(o[2]?' btn-accent':'')+'" data-choice="'+o[0]+'">'+esc(o[1])+'</button>'}).join('');
      openOwn('<span style="font-weight:700;font-size:15px">'+esc(title)+'</span>','<div class="auth-form"><p style="font-size:13px;line-height:1.6;color:var(--tx1)">'+esc(text)+'</p></div>',ft);
      choiceResolve=resolve;
      document.querySelectorAll('#mFoot [data-choice]').forEach(function(b){b.addEventListener('click',function(){var r=choiceResolve;choiceResolve=null;closeOwn();if(r)r(b.getAttribute('data-choice'))})});
    });
  }

  /* ===== Cabecalho e cards ===== */
  function statusText(){
    if(status==='synced')return t('syncSynced');
    if(status==='pending')return tr('syncPending',{n:Core.dirtyCount()});
    if(status==='syncing')return t('syncRunning');
    if(status==='offline')return t('syncOffline');
    if(status==='error')return tr('syncErrorStatus',{msg:Cloud.errorText(lastError)});
    return'';
  }
  function setStatus(s,err){status=s;lastError=err||null;renderHeader();refreshPanels();Core.emit('cloudStatus',s)}
  Cloud.statusText=statusText;
  function renderHeader(){
    var btn=document.getElementById('accountBtn');if(!btn)return;
    if(!client){btn.style.display='none';return}
    btn.style.display='';
    if(!session){btn.innerHTML=SVG_USER+'<span class="hide-m">'+esc(t('accSignIn'))+'</span>';btn.title=t('accSignIn');return}
    var email=session.user.email||'';
    btn.innerHTML='<span class="acct-avatar">'+esc((email.charAt(0)||'?').toUpperCase())+'</span><span class="sync-dot" data-state="'+status+'"></span>';
    btn.title=tr('accSignedInAs',{email:email})+(statusText()?' — '+statusText():'');
  }
  Cloud.renderHeader=renderHeader;
  var prevRender=window.render;
  window.render=function(){prevRender();renderHeader()};

  function panelHtml(){
    if(!session)return'<p class="auth-note">'+esc(t('accLocalOnly'))+'</p><div class="btn-row"><button class="btn btn-sm btn-accent" data-a="signin">'+esc(t('accSignIn'))+'</button><button class="btn btn-sm" data-a="signup">'+esc(t('accSignUp'))+'</button></div>';
    var sync=S.data.sync||{};
    return'<div class="acct-line"><span class="acct-avatar">'+esc((session.user.email||'?').charAt(0).toUpperCase())+'</span><div><b>'+esc(session.user.email||'')+'</b><div class="auth-note"><span class="sync-dot" data-state="'+status+'"></span> '+esc(statusText()||t('syncSynced'))+' · '+esc(t('lastSync'))+': '+esc(sync.lastSyncAt?fmtDate(sync.lastSyncAt):t('never'))+'</div></div></div>'+
      '<p class="auth-note">'+esc(t('accPrivacy'))+'</p>'+
      '<div class="btn-row"><button class="btn btn-sm btn-accent" data-a="sync">'+esc(t('syncNow'))+'</button><button class="btn btn-sm" data-a="signout">'+esc(t('accSignOut'))+'</button><button class="btn btn-sm" data-a="backup" hidden>'+esc(t('syncPreBackup'))+'</button><button class="btn btn-sm btn-danger" data-a="delete">'+esc(t('accDelete'))+'</button></div>';
  }
  function wirePanel(root){
    root.querySelectorAll('[data-a]').forEach(function(b){b.addEventListener('click',function(){
      var a=b.getAttribute('data-a');
      if(a==='signin'||a==='signup')Cloud.openAccount(a);
      else if(a==='sync')Cloud.syncNow(true);
      else if(a==='signout')confirmSignOut();
      else if(a==='delete')deleteAccount();
      else if(a==='backup')downloadPremerge();
    })});
    var bk=root.querySelector('[data-a="backup"]');
    if(bk)Core.dbGet('premerge').then(function(p){if(p&&Date.now()-Core.ts(p.at)<30*24*3600*1000)bk.hidden=false}).catch(function(){});
  }
  function refreshPanels(){
    ['accountCardBody','accountViewBody'].forEach(function(id){var el=document.getElementById(id);if(el){el.innerHTML=panelHtml();wirePanel(el)}});
  }
  function injectAccountCard(){
    var wrap=document.querySelector('#mBody > div');
    if(!client||!wrap||!document.getElementById('setUrl')||document.getElementById('accountCard'))return;
    var card=document.createElement('div');card.id='accountCard';card.className='set-card';
    card.innerHTML='<div class="set-title">'+SVG_CLOUD+esc(t('accTitle'))+'</div><div id="accountCardBody"></div>';
    wrap.insertBefore(card,wrap.firstChild);refreshPanels();
  }
  var prevSettings=window.openSettings;
  window.openSettings=function(){prevSettings();injectAccountCard();setTimeout(injectAccountCard,0)};

  /* ===== Telas de conta ===== */
  function field(id,label,type,auto,value){return'<label class="label" for="'+id+'">'+esc(label)+'</label><input class="inp" id="'+id+'" type="'+type+'" autocomplete="'+auto+'"'+(value?' value="'+esc(value)+'"':'')+(type==='email'?' required':'')+'>'}
  function link(view,label){return'<button type="button" class="auth-link" data-view="'+view+'">'+esc(label)+'</button>'}
  Cloud.openAccount=function(view,opts){
    if(!client){showToast(t('cloudOff'),'error');return}
    opts=opts||{};
    if(session)view='account';else if(!view||view==='account')view='signin';
    var title={signin:t('accSignIn'),signup:t('accSignUp'),forgot:t('accForgot'),account:t('accTitle'),message:opts.title||t('accTitle')}[view];
    var hd='<span style="font-weight:700;font-size:15px">'+esc(title)+'</span><button class="icon-btn" onclick="closeModal()">×</button>';
    var bd='',ft='';
    var email=opts.email||'';
    if(view==='signin'){
      bd='<form id="authForm" class="auth-form">'+field('authEmail',t('accEmail'),'email','email',email)+field('authPass',t('accPassword'),'password','current-password')+'<div class="auth-err" id="authErr"></div><div class="auth-links">'+link('forgot',t('accForgot'))+link('signup',t('accNoAccount'))+'</div></form>';
      ft='<div style="flex:1"></div><button class="btn" type="button" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-accent" type="submit" form="authForm" id="authSubmit">'+esc(t('accSignIn'))+'</button>';
    }else if(view==='signup'){
      bd='<form id="authForm" class="auth-form">'+field('authEmail',t('accEmail'),'email','email',email)+field('authPass',t('accPassword'),'password','new-password')+field('authPass2',t('confirmPassword'),'password','new-password')+'<p class="auth-note">'+esc(tr('accPwMin',{n:MIN_PW}))+'</p><div class="auth-err" id="authErr"></div><div class="auth-links">'+link('signin',t('accHaveAccount'))+'</div></form>';
      ft='<div style="flex:1"></div><button class="btn" type="button" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-accent" type="submit" form="authForm" id="authSubmit">'+esc(t('accSignUp'))+'</button>';
    }else if(view==='forgot'){
      bd='<form id="authForm" class="auth-form"><p class="auth-note">'+esc(t('accForgotText'))+'</p>'+field('authEmail',t('accEmail'),'email','email',email)+(/^https?:$/.test(location.protocol)?'':'<p class="auth-note">'+esc(t('authErrFile'))+'</p>')+'<div class="auth-err" id="authErr"></div><div class="auth-links">'+link('signin',t('accBack'))+'</div></form>';
      ft='<div style="flex:1"></div><button class="btn" type="button" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-accent" type="submit" form="authForm" id="authSubmit">'+esc(t('accSendReset'))+'</button>';
    }else if(view==='message'){
      bd='<div class="auth-form"><p style="font-size:13px;line-height:1.6;color:var(--tx1)">'+esc(opts.text||'')+'</p>'+(opts.resend?'<button type="button" class="auth-link" id="authResend">'+esc(t('accResend'))+'</button>':'')+'<div class="auth-links">'+link('signin',t('accBack'))+'</div></div>';
      ft='<div style="flex:1"></div><button class="btn btn-accent" onclick="closeModal()">OK</button>';
    }else{
      bd='<div class="auth-form" id="accountViewBody"></div>';
      ft='<div style="flex:1"></div><button class="btn" onclick="closeModal()">'+esc(t('shClose'))+'</button>';
    }
    openModal(hd,bd,ft,false);
    var body=document.getElementById('mBody');if(!body)return;
    body.querySelectorAll('[data-view]').forEach(function(b){b.addEventListener('click',function(){var em=document.getElementById('authEmail');Cloud.openAccount(b.getAttribute('data-view'),{email:em?em.value.trim():email})})});
    if(view==='account'){refreshPanels();return}
    if(view==='message'){var rs=document.getElementById('authResend');if(rs)rs.addEventListener('click',function(){resendConfirmation(opts.resend)});return}
    document.getElementById('authForm').addEventListener('submit',function(ev){ev.preventDefault();submitAuth(view)});
  };
  window.openAccount=function(){Cloud.openAccount()};

  async function submitAuth(view){
    var btn=document.getElementById('authSubmit'),err=document.getElementById('authErr');
    var email=(document.getElementById('authEmail')||{}).value||'',pw=(document.getElementById('authPass')||{}).value||'';
    email=email.trim();err.textContent='';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent=t('authErrEmail');return}
    if(view==='signup'){
      if(pw.length<MIN_PW){err.textContent=tr('accPwMin',{n:MIN_PW});return}
      if(pw!==((document.getElementById('authPass2')||{}).value||'')){err.textContent=t('passwordMismatch');return}
    }
    if(view==='signin'&&!pw){err.textContent=t('enterPassword');return}
    btn.disabled=true;
    try{
      var r;
      if(view==='signin'){
        r=await client.auth.signInWithPassword({email:email,password:pw});
        if(r.error){
          if(r.error.code==='email_not_confirmed'){Cloud.openAccount('message',{title:t('accSignIn'),text:t('authErrNotConfirmed'),resend:email});return}
          throw r.error;
        }
        closeModal();showToast(tr('accSignedInAs',{email:email}),'success');
      }else if(view==='signup'){
        r=await client.auth.signUp({email:email,password:pw,options:{emailRedirectTo:redirectUrl()}});
        if(r.error)throw r.error;
        if(r.data&&r.data.session){closeModal();showToast(tr('accSignedInAs',{email:email}),'success')}
        else Cloud.openAccount('message',{title:t('accSignUp'),text:tr('accSignUpSent',{email:email}),resend:email});
      }else if(view==='forgot'){
        r=await client.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl()});
        if(r.error)throw r.error;
        Cloud.openAccount('message',{title:t('accForgot'),text:t('accResetSent')});
      }
    }catch(e){if(err)err.textContent=Cloud.errorText(e)}
    finally{if(btn&&document.body.contains(btn))btn.disabled=false}
  }
  async function resendConfirmation(email){
    var r=await client.auth.resend({type:'signup',email:email,options:{emailRedirectTo:redirectUrl()}});
    if(r.error)showToast(Cloud.errorText(r.error),'error');else showToast(t('accResendDone'),'success');
  }

  /* ===== Troca obrigatoria de senha (link de recuperacao) ===== */
  function markReset(sess){
    if(!sess)return;
    try{localStorage.setItem(RESET_FLAG,sess.user.id)}catch(e){}
    openForcedReset();
  }
  function checkPendingReset(){
    var flag=null;try{flag=localStorage.getItem(RESET_FLAG)}catch(e){}
    if(!flag)return;
    if(session&&session.user.id===flag)openForcedReset();
    else try{localStorage.removeItem(RESET_FLAG)}catch(e){}
  }
  function openForcedReset(){
    if(forced)return;
    if(choiceResolve){var r=choiceResolve;choiceResolve=null;r('defer')}
    forced=true;
    var bd='<form id="pwResetForm" class="auth-form"><p style="font-size:13px;line-height:1.6;color:var(--tx1)">'+esc(t('accNewPwText'))+'</p>'+field('pwNew',t('accNewPw'),'password','new-password')+field('pwNew2',t('confirmPassword'),'password','new-password')+'<p class="auth-note">'+esc(tr('accPwMin',{n:MIN_PW}))+'</p><div class="auth-err" id="pwResetErr"></div></form>';
    openOwn('<span style="font-weight:700;font-size:15px">'+esc(t('accNewPwTitle'))+'</span>',bd,'<div style="flex:1"></div><button class="btn btn-accent" type="submit" form="pwResetForm" id="pwResetBtn">'+esc(t('save'))+'</button>');
    document.getElementById('pwResetForm').addEventListener('submit',async function(ev){
      ev.preventDefault();
      var pw=document.getElementById('pwNew').value,pw2=document.getElementById('pwNew2').value,err=document.getElementById('pwResetErr'),btn=document.getElementById('pwResetBtn');
      err.textContent='';
      if(pw.length<MIN_PW){err.textContent=tr('accPwMin',{n:MIN_PW});return}
      if(pw!==pw2){err.textContent=t('passwordMismatch');return}
      btn.disabled=true;
      try{
        var r=await client.auth.updateUser({password:pw});
        if(r.error)throw r.error;
        try{localStorage.removeItem(RESET_FLAG)}catch(e){}
        forced=false;closeOwn();showToast(t('accPwUpdated'),'success');
        client.auth.signOut({scope:'others'}).catch(function(){});
        requestSync(500);render();
      }catch(e){err.textContent=Cloud.errorText(e);btn.disabled=false}
    });
  }

  /* ===== Sair e excluir conta ===== */
  async function signOutLocal(){
    var r=null;try{r=await client.auth.signOut({scope:'local'})}catch(e){r={error:e}}
    if(r&&r.error){try{localStorage.removeItem(AUTH_KEY)}catch(e){}}
    session=null;Cloud.myListsCache=[];saveCache();setStatus('off');
  }
  function confirmSignOut(){
    var bd='<div class="auth-form"><p style="font-size:13px;color:var(--tx1)">'+esc(t('accSignOutConfirm'))+'</p><label class="auth-check"><input type="checkbox" id="wipeLocal"> '+esc(t('accWipeLocal'))+'</label></div>';
    openModal('<span style="font-weight:700;font-size:15px">'+esc(t('accSignOut'))+'</span><button class="icon-btn" onclick="closeModal()">×</button>',bd,'<div style="flex:1"></div><button class="btn" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-danger" id="signOutBtn">'+esc(t('accSignOut'))+'</button>',false);
    document.getElementById('signOutBtn').addEventListener('click',async function(){
      var wipe=document.getElementById('wipeLocal').checked;
      this.disabled=true;
      await signOutLocal();
      if(wipe)await Core.resetLocal({keepSession:true});
      closeModal();render();showToast(t('accSignedOut'),'success');
    });
  }
  async function deleteAccount(){
    if(!session)return;
    var email=session.user.email,pw;
    try{pw=await FP.promptPassword(esc(t('accDeleteConfirm')),false)}catch(e){return}
    var r=await client.auth.signInWithPassword({email:email,password:pw});
    if(r.error){showToast(Cloud.errorText(r.error),'error');return}
    var d=await client.rpc('delete_my_account');
    if(d.error){showToast(Cloud.errorText(d.error),'error');return}
    await signOutLocal();
    S.data.sync={dirty:{}};await Core.saveRaw();
    closeModal();render();showToast(t('accDeleted'),'success');
  }
  function downloadPremerge(){
    Core.dbGet('premerge').then(function(p){
      if(!p)return;
      var json=JSON.stringify({version:'1.0',scripts:p.data.scripts||[],folders:p.data.folders||[],categories:p.data.categories||[],exportedAt:p.at},null,2);
      var b=new Blob([json],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');
      a.href=u;a.download='sql-script-manager-antes-da-sincronizacao.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000);
    });
  }

  /* ===== Sincronizacao (ultimo a gravar vence, por entidade) ===== */
  function canSync(){return!!(client&&session&&!forced&&Core.ready&&navigator.onLine!==false)}
  function requestSync(delay){clearTimeout(syncTimer);syncTimer=setTimeout(function(){runSync(false)},delay||0)}
  Cloud.requestSync=requestSync;
  Cloud.syncNow=function(manual){return runSync(!!manual)};
  async function runSync(manual){
    if(client&&session&&!Core.ready){Core.whenReady.then(function(ok){if(ok)requestSync(500)});return}
    if(!canSync()){if(session&&navigator.onLine===false)setStatus('offline');return}
    if(cycle){again=true;return cycle}
    if(document.getElementById('sCont')){requestSync(30000);return}
    cycleUid=session.user.id;
    cycle=(async function(){
      setStatus('syncing');
      try{
        var bound=S.data.sync&&S.data.sync.userId===uid_();
        if(!bound){if(!await bindAccount()){setStatus(session?'pending':'off');return}}
        else await pull();
        await push();
        alive();
        S.data.sync.lastSyncAt=now();S.data.sync.email=session.user.email;
        await Core.saveRaw();
        backoff=0;lastRun=Date.now();
        setStatus(Core.dirtyCount()?'pending':'synced');
        if(manual)showToast(t('syncOk'),'success');
      }catch(e){
        if(e&&e.aborted){setStatus(session?'pending':'off');if(session)requestSync(500);return}
        console.error('Sincronizacao falhou',e);
        backoff=Math.min(backoff?backoff*2:60000,1800000);
        setStatus(navigator.onLine===false?'offline':'error',e);
        if(manual)showToast(t('errSync')+': '+Cloud.errorText(e),'error');
        requestSync(backoff);
      }
    })();
    try{await cycle}finally{cycle=null;if(again){again=false;requestSync(1000)}}
  }

  async function fetchRows(columns,since){
    var all=[],from=0,PAGE=1000;
    for(;;){
      var q=client.from('sync_items').select(columns).eq('user_id',uid_()).order('updated_at',{ascending:true}).order('kind',{ascending:true}).order('id',{ascending:true}).range(from,from+PAGE-1);
      if(since)q=q.gte('updated_at',since);
      var r=await q;alive();if(r.error)throw r.error;
      all=all.concat(r.data||[]);
      if(!r.data||r.data.length<PAGE)break;
      from+=PAGE;
    }
    return all;
  }
  async function fetchData(rows){
    var out={},byKind={};
    rows.forEach(function(r){(byKind[r.kind]=byKind[r.kind]||[]).push(r.id)});
    for(var kind in byKind){
      var ids=byKind[kind];
      for(var i=0;i<ids.length;i+=100){
        var r=await client.from('sync_items').select('kind,id,data,deleted,modified_at,updated_at').eq('user_id',uid_()).eq('kind',kind).in('id',ids.slice(i,i+100));
        alive();if(r.error)throw r.error;
        (r.data||[]).forEach(function(x){out[Core.keyOf(x.kind,x.id)]=x});
      }
    }
    return out;
  }
  function localTime(kind,id){
    var e=Core.findEntity(kind,id);if(e)return Core.ts(e.modifiedAt||e.updatedAt||e.createdAt);
    var tomb=Core.findTomb(Core.keyOf(kind,id));return tomb?Core.ts(tomb.at):-1;
  }
  function maxTime(a,b){return!a||Core.ts(b)>Core.ts(a)?b:a}

  async function pull(){
    var sync=S.data.sync,since=sync.cursor?new Date(Core.ts(sync.cursor)-120000).toISOString():null;
    var meta=await fetchRows('kind,id,deleted,modified_at,updated_at',since),winners=[],cursor=sync.cursor||null;
    meta.forEach(function(row){
      if(Core.KINDS.indexOf(row.kind)<0)return;
      cursor=maxTime(cursor,row.updated_at);
      var key=Core.keyOf(row.kind,row.id),lt=localTime(row.kind,row.id),rt=Core.ts(row.modified_at);
      if(lt<0){if(!row.deleted)winners.push(row);return}
      if(rt>lt)winners.push(row);else if(rt<lt)sync.dirty[key]=1;
    });
    if(winners.length){
      var full=await fetchData(winners.filter(function(r){return!r.deleted}));
      applyRows(winners.map(function(r){return r.deleted?r:full[Core.keyOf(r.kind,r.id)]||null}).filter(Boolean));
      await Core.persist();render();Core.emit('remoteApplied');
    }
    sync.cursor=cursor;
  }

  function norm(v){return String(v||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function dedupeNames(){
    var byName={};
    S.data.scripts.slice().sort(function(a,b){return a.id<b.id?-1:a.id>b.id?1:0}).forEach(function(s){
      var k=String(s.name).toLowerCase();
      if(!byName[k]){byName[k]=1;return}
      s.name=Core.uniqueName(s.name,function(lower){return!!byName[lower]});byName[s.name.toLowerCase()]=1;
    });
  }
  /* Aplica linhas vindas da nuvem direto em S.data, sem marcar como alteracao local. */
  function applyRows(rows){
    var sync=S.data.sync,conflicts=[],delFolders={},delCats={};
    rows.forEach(function(row){
      var kind=row.kind,key=Core.keyOf(kind,row.id),list=Core.listOf(kind);
      if(Core.KINDS.indexOf(kind)<0)return;
      var idx=list.findIndex(function(e){return e&&e.id===row.id});
      if(row.deleted){
        if(idx>=0)list.splice(idx,1);
        if(kind==='folder')delFolders[row.id]=1;if(kind==='category')delCats[row.id]=1;
        Core.dropTomb(key);Core.dropShadow(key);delete sync.dirty[key];return;
      }
      var data=Core.sanitizeEntity(kind,row.data&&typeof row.data==='object'?Object.assign({},row.data,{id:row.id}):null);
      if(!data)return;
      data.modifiedAt=row.modified_at;
      if(kind==='script'){
        var local=idx>=0?list[idx]:null;
        data.versions=local&&Array.isArray(local.versions)?local.versions:[];
        if(data.locked)data.versions=[];
        else if(local&&sync.dirty[key]&&!local.locked&&local.content&&String(local.content)!==data.content){data.versions=data.versions.concat([{content:local.content,savedAt:now()}]).slice(-20);conflicts.push(local.name)}
      }
      if(idx>=0)list[idx]=data;else list.push(data);
      Core.dropTomb(key);delete sync.dirty[key];Core.setShadow(kind,data);
    });
    S.data.scripts.forEach(function(s){var ch=false;if(s.folderId&&delFolders[s.folderId]){s.folderId=null;ch=true}if(s.categoryId&&delCats[s.categoryId]){s.categoryId=null;ch=true}if(ch)Core.setShadow('script',s)});
    S.data.folders.forEach(function(f){if(f.parentId&&delFolders[f.parentId]){f.parentId=null;Core.setShadow('folder',f)}});
    Core.breakFolderCycles(S.data.folders);
    dedupeNames();
    if(S.filter.folderId&&delFolders[S.filter.folderId])S.filter.folderId=null;
    if(S.filter.categoryId&&delCats[S.filter.categoryId])S.filter.categoryId=null;
    conflicts.forEach(function(n){showToast(tr('syncConflict',{name:n}),'info')});
  }

  async function push(){
    var sync=S.data.sync,keys=Object.keys(sync.dirty||{});if(!keys.length)return;
    var rows=[],meta={},tooBig=[];
    keys.forEach(function(key){
      var p=key.indexOf(':'),kind=key.slice(0,p),id=key.slice(p+1);
      if(Core.KINDS.indexOf(kind)<0||!Core.validId(id)){delete sync.dirty[key];return}
      var e=Core.findEntity(kind,id),tomb=Core.findTomb(key);
      if(e){
        var data=Core.serialize(kind,e),size=JSON.stringify(data).length;
        if(size>1000000){sync.skipped=sync.skipped||{};if(!sync.skipped[key]){sync.skipped[key]=1;tooBig.push(e.name||id)}return}
        rows.push({user_id:uid_(),kind:kind,id:id,data:data,deleted:false,modified_at:e.modifiedAt||e.updatedAt||e.createdAt||Core.clock()});
        meta[key]={mod:e.modifiedAt,size:size};
      }else if(tomb){rows.push({user_id:uid_(),kind:kind,id:id,data:null,deleted:true,modified_at:tomb.at});meta[key]={tomb:tomb.at,size:120}}
      else delete sync.dirty[key];
    });
    tooBig.forEach(function(n){showToast(tr('syncTooLarge',{name:n}),'error')});
    var chunks=[],cur=[],bytes=0;
    rows.forEach(function(r){var sz=meta[Core.keyOf(r.kind,r.id)].size;if(cur.length&&(cur.length>=200||bytes+sz>900000)){chunks.push(cur);cur=[];bytes=0}cur.push(r);bytes+=sz});
    if(cur.length)chunks.push(cur);
    var rejected=[];
    for(var i=0;i<chunks.length;i++){
      var t0=Date.now();
      var r=await client.from('sync_items').upsert(chunks[i],{onConflict:'user_id,kind,id'}).select('kind,id,modified_at,updated_at');
      alive();if(r.error)throw r.error;
      var t1=Date.now(),got={};
      (r.data||[]).forEach(function(x){got[Core.keyOf(x.kind,x.id)]=x});
      chunks[i].forEach(function(row){
        var key=Core.keyOf(row.kind,row.id),ret=got[key],m=meta[key];
        if(!ret){rejected.push(row);delete sync.dirty[key];return}
        if(row.deleted){var tb=Core.findTomb(key);if(tb&&tb.at===m.tomb)Core.dropTomb(key);if(!Core.findEntity(row.kind,row.id))delete sync.dirty[key];return}
        var e=Core.findEntity(row.kind,row.id);
        if(!e)return;
        if(e.modifiedAt===m.mod){e.modifiedAt=ret.modified_at;delete sync.dirty[key]}
      });
      var last=r.data&&r.data[r.data.length-1];
      if(last)sync.clockOffsetMs=Core.ts(last.updated_at)-Math.round((t0+t1)/2);
    }
    if(rejected.length){
      /* O servidor tem uma versao mais nova que nao veio no pull: busca e aplica a dele. */
      var full=await fetchData(rejected);
      applyRows(Object.keys(full).map(function(k){return full[k]}));
      await Core.persist();render();Core.emit('remoteApplied');
    }
  }

  /* ===== Primeiro login neste aparelho ===== */
  function isPristine(){
    var def=DEF_CATS.map(function(c){return c.name.toLowerCase()});
    return!S.data.scripts.length&&!S.data.folders.length&&!(S.data.subscriptions||[]).length&&S.data.categories.every(function(c){return def.indexOf(String(c.name).toLowerCase())>=0});
  }
  function toEntities(all){
    var out={script:[],folder:[],category:[],subscription:[]},times={},deleted={};
    all.forEach(function(r){
      if(!out[r.kind])return;var key=Core.keyOf(r.kind,r.id);
      if(r.deleted){deleted[key]=Core.ts(r.modified_at);return}
      var d=Core.sanitizeEntity(r.kind,r.data&&typeof r.data==='object'?Object.assign({},r.data,{id:r.id}):null);if(!d)return;
      d.modifiedAt=r.modified_at;times[key]=Core.ts(r.modified_at);
      if(r.kind==='script')d.versions=[];
      out[r.kind].push(d);
    });
    return{lists:out,times:times,deleted:deleted};
  }
  function commit(lists,dirty,tombstones){
    S.data.scripts=lists.script;S.data.folders=lists.folder;S.data.categories=lists.category;S.data.subscriptions=lists.subscription;
    S.data.tombstones=tombstones||[];
    Core.breakFolderCycles(S.data.folders);
    Core.rebuildShadow();
    S.data.sync.dirty=dirty||{};
    S.filter.folderId=null;S.filter.categoryId=null;S.filter.subscriptionId=null;
  }
  function adoptCloud(remote){
    remote.lists.script.forEach(function(s){var local=Core.findEntity('script',s.id);if(local&&!s.locked&&Array.isArray(local.versions))s.versions=local.versions});
    commit(remote.lists,{},[]);
  }
  /* Combina os dados locais com os da conta: mesmo id = ultimo a gravar vence; categorias e pastas
     com o mesmo nome viram uma so (referencias remapeadas); scripts de mesmo nome e mesmo conteudo se fundem,
     de conteudo diferente ficam os dois (o local ganha sufixo). */
  function mergeWithCloud(remote){
    var res={script:remote.lists.script.slice(),folder:remote.lists.folder.slice(),category:remote.lists.category.slice(),subscription:remote.lists.subscription.slice()};
    var times=remote.times,deleted=remote.deleted,dirty={},stamp=Core.clock(),idMap={category:{},folder:{}};
    function find(kind,id){return res[kind].find(function(e){return e.id===id})||null}
    function own(e){return Core.ts(e.modifiedAt||e.updatedAt||e.createdAt)}
    function goneRemotely(kind,e){var d=deleted[Core.keyOf(kind,e.id)];return d!=null&&d>=own(e)}
    function put(kind,e){e.modifiedAt=stamp;var i=res[kind].findIndex(function(x){return x.id===e.id});if(i>=0)res[kind][i]=e;else res[kind].push(e);dirty[Core.keyOf(kind,e.id)]=1}
    function wins(kind,e){return own(e)>(times[Core.keyOf(kind,e.id)]||0)}
    S.data.categories.forEach(function(c){
      if(find('category',c.id)){if(wins('category',c))put('category',Object.assign({},c));return}
      if(goneRemotely('category',c))return;
      var m=res.category.find(function(x){return norm(x.name)===norm(c.name)});
      if(m){idMap.category[c.id]=m.id;return}
      put('category',Object.assign({},c));
    });
    var pending=S.data.folders.slice(),guard=0;
    while(pending.length&&guard++<20000){
      var f=pending.shift();
      if(f.parentId&&pending.some(function(x){return x.id===f.parentId})){pending.push(f);continue}
      var parent=f.parentId?(idMap.folder[f.parentId]||f.parentId):null,copy=Object.assign({},f,{parentId:parent});
      if(find('folder',f.id)){if(wins('folder',f)||parent!==(f.parentId||null))put('folder',copy);continue}
      if(goneRemotely('folder',f))continue;
      var m=res.folder.find(function(x){return norm(x.name)===norm(f.name)&&(x.parentId||null)===(parent||null)});
      if(m){idMap.folder[f.id]=m.id;continue}
      put('folder',copy);
    }
    S.data.scripts.forEach(function(s){
      var copy=Object.assign({},s,{categoryId:s.categoryId?(idMap.category[s.categoryId]||s.categoryId):null,folderId:s.folderId?(idMap.folder[s.folderId]||s.folderId):null});
      var remapped=copy.categoryId!==(s.categoryId||null)||copy.folderId!==(s.folderId||null);
      var r=find('script',s.id);
      if(r){if(wins('script',s)||remapped)put('script',copy);else if(!r.locked&&Array.isArray(s.versions))r.versions=s.versions;return}
      if(goneRemotely('script',s))return;
      var same=res.script.find(function(x){return String(x.name).toLowerCase()===String(s.name).toLowerCase()});
      if(same){
        var eq=same.locked&&s.locked?!!(same.secure&&s.secure&&same.secure.data===s.secure.data):(!same.locked&&!s.locked&&norm(same.content)===norm(s.content));
        if(eq){
          var tags=Core.cleanTags((same.tags||[]).concat(s.tags||[])),fav=same.favorite||!!s.favorite,pin=same.pinned||!!s.pinned;
          if(tags.length!==(same.tags||[]).length||fav!==same.favorite||pin!==same.pinned){same.tags=tags;same.favorite=fav;same.pinned=pin;put('script',same)}
          if(!same.locked&&Array.isArray(s.versions)&&s.versions.length&&!same.versions.length)same.versions=s.versions;
          return;
        }
        copy.name=Core.uniqueName(copy.name,function(lower){return res.script.some(function(x){return String(x.name).toLowerCase()===lower})});
      }
      put('script',copy);
    });
    (S.data.subscriptions||[]).forEach(function(sub){if(!find('subscription',sub.id)&&!goneRemotely('subscription',sub))put('subscription',Object.assign({},sub))});
    if(remote.lists.category.length){
      var def=DEF_CATS.map(function(c){return c.name.toLowerCase()});
      res.category=res.category.filter(function(c){
        var key=Core.keyOf('category',c.id);
        if(!dirty[key]||times[key]||def.indexOf(String(c.name).toLowerCase())<0)return true;
        if(res.script.some(function(s){return s.categoryId===c.id}))return true;
        delete dirty[key];return false;
      });
    }
    var keepTombs=[];
    (S.data.tombstones||[]).forEach(function(tb){
      var p=tb.key.indexOf(':'),kind=tb.key.slice(0,p),id=tb.key.slice(p+1);
      if(!res[kind])return;
      var i=res[kind].findIndex(function(x){return x.id===id});
      if(i>=0&&Core.ts(tb.at)>(times[tb.key]||0)){res[kind].splice(i,1);dirty[tb.key]=1;keepTombs.push(tb)}
    });
    commit(res,dirty,keepTombs);
  }
  async function bindAccount(){
    var user=session.user,sync=S.data.sync||(S.data.sync={dirty:{}});
    if(sync.userId&&sync.userId!==user.id){
      var ch=await choose(t('syncFirstTitle'),tr('syncOtherAccount',{email:sync.email||'?'}),[['merge',t('syncMerge'),true],['replace',t('syncReplaceLocal')],['cancel',t('accSignOut')]]);
      alive();if(ch==='defer')return false;
      if(ch==='cancel'){await signOutLocal();return false}
      if(ch==='replace')await Core.resetLocal({keepSession:true});
      S.data.sync={dirty:{}};
      if(ch!=='replace')S.data.tombstones=[];
    }
    var all=await fetchRows('kind,id,data,deleted,modified_at,updated_at',null);
    alive();
    var cursor=null;all.forEach(function(r){cursor=maxTime(cursor,r.updated_at)});
    var remote=toEntities(all),liveCount=Object.keys(remote.times).length;
    try{await Core.dbPut('premerge',{at:now(),email:user.email,data:JSON.parse(JSON.stringify({scripts:S.data.scripts,folders:S.data.folders,categories:S.data.categories,subscriptions:S.data.subscriptions||[]}))})}catch(e){}
    alive();
    if(!liveCount){
      var dirty={};Core.KINDS.forEach(function(kind){Core.listOf(kind).forEach(function(e){dirty[Core.keyOf(kind,e.id)]=1})});
      S.data.tombstones=[];S.data.sync.dirty=dirty;
    }else{
      var choice=isPristine()?'cloud':await choose(t('syncFirstTitle'),tr('syncFirstText',{local:S.data.scripts.length,cloud:remote.lists.script.length}),[['merge',t('syncMerge'),true],['cloud',t('syncUseCloud')],['cancel',t('accSignOut')]]);
      alive();if(choice==='defer')return false;
      if(choice==='cancel'){await signOutLocal();return false}
      if(choice==='cloud')adoptCloud(remote);else mergeWithCloud(remote);
    }
    S.data.sync.userId=user.id;S.data.sync.email=user.email;S.data.sync.cursor=cursor;
    await Core.saveRaw();render();Core.emit('remoteApplied');
    return true;
  }

  /* ===== Listas publicadas ===== */
  function cacheLists(rows){Cloud.myListsCache=(rows||[]).map(function(l){return{id:l.id,code:l.code,name:l.name,source_folder_id:l.source_folder_id,version:l.version,script_count:l.script_count}});saveCache()}
  var LIST_COLS='id,code,name,source_folder_id,version,updated_at,script_count';
  Cloud.getSharedList=async function(code,knownVersion){
    if(!client)throw new Error('cloudOff');
    var r=await client.rpc('get_shared_list',{p_code:code,p_known_version:knownVersion==null?null:knownVersion});
    if(r.error)throw r.error;
    var row=Array.isArray(r.data)?r.data[0]:r.data;
    return row||null;
  };
  Cloud.myLists=async function(){
    var r=await client.from('shared_lists').select(LIST_COLS).order('created_at',{ascending:true});
    if(r.error)throw r.error;cacheLists(r.data);return r.data||[];
  };
  Cloud.publishList=async function(p){
    var r=await client.from('shared_lists').insert({name:p.name,source_folder_id:p.source_folder_id,snapshot:p.snapshot}).select(LIST_COLS).single();
    if(r.error)throw r.error;
    Cloud.myListsCache=Cloud.myListsCache.concat([r.data]);saveCache();return r.data;
  };
  Cloud.updateList=async function(id,p){
    var r=await client.from('shared_lists').update(p).eq('id',id).select(LIST_COLS).single();
    if(r.error)throw r.error;return r.data;
  };
  Cloud.deleteList=async function(id){
    var r=await client.from('shared_lists').delete().eq('id',id);
    if(r.error)throw r.error;
    Cloud.myListsCache=Cloud.myListsCache.filter(function(l){return l.id!==id});saveCache();
  };

  /* ===== Eventos ===== */
  function onAuth(event,sess){
    session=sess||null;
    if(event==='PASSWORD_RECOVERY'){markReset(sess);render();return}
    if(event==='SIGNED_OUT'){session=null;Cloud.myListsCache=[];saveCache();setStatus('off');render();return}
    if(event==='INITIAL_SESSION'||event==='SIGNED_IN'){
      if(session){
        if(recoveryInUrl){recoveryInUrl=false;markReset(session)}else checkPendingReset();
        if(signupInUrl){signupInUrl=false;showToast(t('accEmailConfirmed'),'success')}
        if(status==='off')setStatus(Core.dirtyCount()?'pending':'synced');
        requestSync(event==='SIGNED_IN'?300:2000);
        Cloud.myLists().then(render).catch(function(){});
      }else{
        if(urlError){urlError=null;showToast(t('authErrLink'),'error')}
        try{localStorage.removeItem(RESET_FLAG)}catch(e){}
        setStatus('off');
      }
      cleanUrl();render();
    }
  }
  if(client){
    client.auth.onAuthStateChange(function(event,sess){setTimeout(function(){onAuth(event,sess)},0)});
    Core.on('saved',function(){if(session)requestSync(3000)});
    Core.on('reset',function(opts){if(opts&&opts.keepSession)return;if(session)signOutLocal()});
    document.addEventListener('visibilitychange',function(){
      if(!session)return;
      if(document.hidden){if(Core.dirtyCount())runSync(false)}
      else if(Date.now()-lastRun>60000)requestSync(500);
    });
    window.addEventListener('online',function(){if(session)requestSync(500)});
    window.addEventListener('offline',function(){if(session)setStatus('offline')});
    Core.whenReady.then(function(ok){if(!ok)return;Core.addJob('cloud-sync',{run:function(){return session?runSync(false):null},every:function(){return Core.pollMs()||900000},delay:Core.pollMs()||900000});renderHeader()});
  }
  renderHeader();
})();
