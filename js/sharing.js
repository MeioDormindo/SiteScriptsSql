/* Listas compartilhadas: assinar listas de outras pessoas (codigo na nuvem ou repositorio GitHub/URL),
   exibir em "Compartilhados" somente leitura com verificacao periodica, e publicar uma pasta propria. */
(function(){
  var MAX_TEXT=8*1024*1024,MAX_TOTAL=5*1024*1024,MAX_SCRIPT=1024*1024,MAX_SCRIPTS=5000;
  var CODE_RE=/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
  var STATE_KEY='sqlsm-substate';
  var datasets={};
  var state=loadState();
  var SVG_CLOUD='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>';
  var SVG_GIT='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-10.5 6"/></svg>';
  var SVG_PLUS='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
  var SVG_SHARE='M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13';
  var SVG_DOWNLOAD='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3';

  function loadState(){try{var v=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');return v&&typeof v==='object'?v:{}}catch(e){return{}}}
  function saveState(){try{localStorage.setItem(STATE_KEY,JSON.stringify(state))}catch(e){}}
  function st(id){return state[id]||(state[id]={})}
  function subs(){return S.data.subscriptions||[]}
  function findSub(id){return subs().find(function(s){return s.id===id})||null}
  function activeSub(){var id=S.filter.subscriptionId;return id?findSub(id):null}
  function cloudOn(){return!!(window.Cloud&&Cloud.available())}
  function msgErr(key,vars){var e=new Error(key);e.i18n=key;e.vars=vars||{};return e}
  function errText(e){
    if(!e)return'';
    if(e.i18n){var s=t(e.i18n);Object.keys(e.vars).forEach(function(k){s=s.replace('{'+k+'}',e.vars[k])});return s}
    if(e.status===404)return t('shNotFound');
    if(e instanceof TypeError)return t('authErrNetwork');
    return e.message||String(e);
  }
  function tr(key,vars){var s=t(key);Object.keys(vars||{}).forEach(function(k){s=s.split('{'+k+'}').join(vars[k])});return s}
  function normalizeCode(v){var c=String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length>8&&c.indexOf('SQL')===0)c=c.slice(3);return CODE_RE.test(c)?c:null}
  function formatCode(c){return'SQL-'+c.slice(0,4)+'-'+c.slice(4)}
  function shareLink(code){var base=window.CLOUD_CONFIG&&CLOUD_CONFIG.siteUrl||(location.origin+location.pathname);return base+'?sub='+code}
  function copyText(text){
    if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(text).then(function(){showToast(t('copied'),'success')});
    var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');showToast(t('copied'),'success')}catch(e){}ta.remove();return Promise.resolve();
  }
  function download(name,text){var b=new Blob([text],{type:'application/json'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},1000)}

  /* ===== Snapshot de terceiros: tudo e reconstruido do zero, com ids novos (prefixo da assinatura) ===== */
  function cleanSnapshot(raw,subId){
    if(!raw||typeof raw!=='object'||!Array.isArray(raw.scripts))throw msgErr('shInvalid');
    var n=0,map={category:{},folder:{}};
    function nid(){return subId+'_'+(n++)}
    var ds={name:Core.cleanText(raw.name,120),scripts:[],folders:[],categories:[]};
    (Array.isArray(raw.categories)?raw.categories:[]).forEach(function(c){
      if(!c||typeof c!=='object'||ds.categories.length>=500)return;
      var e=Core.sanitizeEntity('category',Object.assign({},c,{id:nid()}));
      if(e){if(c.id!=null&&!map.category[String(c.id)])map.category[String(c.id)]=e.id;ds.categories.push(e)}
    });
    var rawFolders=(Array.isArray(raw.folders)?raw.folders:[]).filter(function(f){return f&&typeof f==='object'}).slice(0,2000);
    var ids=rawFolders.map(function(f){var k=f.id==null?null:String(f.id);if(k!==null&&map.folder[k])return null;var id=nid();if(k!==null)map.folder[k]=id;return id});
    rawFolders.forEach(function(f,i){
      if(!ids[i])return;
      var e=Core.sanitizeEntity('folder',Object.assign({},f,{id:ids[i],parentId:f.parentId!=null&&map.folder[String(f.parentId)]||null}));
      if(e)ds.folders.push(e);
    });
    Core.breakFolderCycles(ds.folders);
    var total=0;
    raw.scripts.forEach(function(s){
      if(ds.scripts.length>=MAX_SCRIPTS||!s||typeof s!=='object'||s.locked===true||typeof s.content!=='string')return;
      if(s.content.length>MAX_SCRIPT)return;
      total+=s.content.length;if(total>MAX_TOTAL)return;
      var e=Core.sanitizeEntity('script',{id:nid(),name:s.name,content:s.content,categoryId:s.categoryId!=null&&map.category[String(s.categoryId)]||null,folderId:s.folderId!=null&&map.folder[String(s.folderId)]||null,createdAt:s.createdAt,updatedAt:s.updatedAt,tags:s.tags});
      if(e){e.versions=[];ds.scripts.push(e)}
    });
    return ds;
  }
  function validDataset(ds){return!!(ds&&Array.isArray(ds.scripts)&&Array.isArray(ds.folders)&&Array.isArray(ds.categories))}
  function subIdOf(id){var m=/^(s[0-9a-f]{10})_\d+$/.exec(id||'');return m&&datasets[m[1]]?m[1]:null}
  function sharedScript(id){var sid=subIdOf(id);return sid?datasets[sid].scripts.find(function(s){return s.id===id})||null:null}

  /* ===== GitHub / URL ===== */
  function rawUrl(owner,repo,branch,path){
    function enc(p){return p.split('/').filter(Boolean).map(encodeURIComponent).join('/')}
    return'https://raw.githubusercontent.com/'+encodeURIComponent(owner)+'/'+encodeURIComponent(repo)+'/'+enc(branch)+'/'+enc(path);
  }
  function defaults(owner,repo,branch,path){
    var NAME=/^[A-Za-z0-9_.-]+$/;if(!NAME.test(owner)||!NAME.test(repo))return[];
    var branches=branch?[branch]:['main','master'],paths=path?[path]:['sql_scripts.json','Backup/sql_scripts.json'],out=[];
    branches.forEach(function(b){paths.forEach(function(p){out.push(rawUrl(owner,repo,b,p))})});
    return out.slice(0,4);
  }
  /* Aceita usuario/repo, usuario/repo/caminho, links github.com (blob/tree), raw.githubusercontent.com ou qualquer URL https de um JSON. */
  function githubCandidates(input,branch,path){
    input=String(input||'').trim();branch=String(branch||'').trim().replace(/^\/+|\/+$/g,'');path=String(path||'').trim().replace(/^\/+/,'');
    if(!input)return[];
    if(/^https?:\/\//i.test(input)){
      var u;try{u=new URL(input)}catch(e){return[]}
      u.hash='';
      if(u.hostname==='raw.githubusercontent.com')return[u.href];
      if(u.hostname==='github.com'||u.hostname==='www.github.com'){
        var parts=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);if(parts.length<2)return[];
        var owner=parts[0],repo=parts[1].replace(/\.git$/,'');
        if(parts[2]==='blob'&&parts.length>=5)return[rawUrl(owner,repo,parts[3],parts.slice(4).join('/'))];
        if(parts[2]==='tree'&&parts.length>=4){var dir=parts.slice(4).join('/');return defaults(owner,repo,branch||parts[3],path||(dir?dir+'/sql_scripts.json':''))}
        return defaults(owner,repo,branch,path);
      }
      return u.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(u.hostname)?[u.href]:[];
    }
    var p=input.replace(/\.git$/,'').split('/').filter(Boolean);
    if(p.length<2)return[];
    return defaults(p[0],p[1],branch,path||p.slice(2).join('/'));
  }
  function nameFromUrl(ref){
    try{var u=new URL(ref);if(u.hostname==='raw.githubusercontent.com'){var p=u.pathname.split('/').filter(Boolean);return decodeURIComponent(p[0])+'/'+decodeURIComponent(p[1])}return u.hostname+u.pathname}catch(e){return ref}
  }
  function fetchText(url){
    return fetch(url,{cache:'no-cache'}).then(function(r){
      if(!r.ok){var e=new Error('HTTP '+r.status);e.status=r.status;throw e}
      if(Number(r.headers.get('content-length')||0)>MAX_TEXT)throw msgErr('shTooBig',{n:5});
      return r.text();
    }).then(function(txt){if(txt.length>MAX_TEXT)throw msgErr('shTooBig',{n:5});return txt});
  }
  function parseList(txt){var raw;try{raw=JSON.parse(txt)}catch(e){throw msgErr('shInvalid')}if(!raw||!Array.isArray(raw.scripts))throw msgErr('shInvalid');return raw}

  /* ===== Assinaturas ===== */
  function subIdFor(type,ref){return Core.sha256(type+':'+ref).then(function(h){return's'+h.slice(0,10)})}
  async function addSubscription(type,ref,raw,extra){
    var id=await subIdFor(type,ref);
    if(findSub(id))throw msgErr('shAlready');
    var ds=cleanSnapshot(raw,id);
    var sub={id:id,type:type,ref:ref,name:Core.cleanText(extra.name||raw.name,120)||(type==='code'?formatCode(ref):nameFromUrl(ref)),createdAt:now()};
    S.data.subscriptions.push(sub);
    datasets[id]=ds;await Core.dbPut('snap:'+id,ds);
    var s=st(id);s.hash=extra.hash||null;s.version=extra.version||null;s.lastChecked=now();s.lastChangedAt=now();s.status='ok';s.failCount=0;s.lastError=null;s.hasUpdate=false;s.count=ds.scripts.length;saveState();
    await save();
    ensureJob(sub,false);
    return sub;
  }
  async function subscribeUrl(input,branch,path){
    var cands=githubCandidates(input,branch,path);
    if(!cands.length)throw msgErr('shGhNotFound');
    var lastErr=null;
    for(var i=0;i<cands.length;i++){
      try{var txt=await fetchText(cands[i]);var raw=parseList(txt);return await addSubscription('url',cands[i],raw,{hash:await Core.sha256(txt)})}
      catch(e){if(e&&e.i18n==='shAlready')throw e;if(!lastErr||e.i18n)lastErr=e}
    }
    if(lastErr&&lastErr.status===404)throw msgErr(cands.length>1?'shGhNotFound':'shNotFound');
    throw lastErr||msgErr('shGhNotFound');
  }
  async function subscribeCode(input){
    var code=normalizeCode(input);if(!code)throw msgErr('shCodeInvalid');
    if(!cloudOn())throw msgErr('cloudOff');
    if(findSub(await subIdFor('code',code)))throw msgErr('shAlready');
    var row=await Cloud.getSharedList(code,null);
    if(!row||!row.snapshot)throw msgErr('shNotFound');
    return addSubscription('code',code,row.snapshot,{name:row.name,version:row.version});
  }
  function notifyUpdated(sub){showToast(tr('shUpdated',{name:sub.name}),'info')}
  async function checkSub(id){
    var sub=findSub(id);if(!sub)return;
    var s=st(id),changed=false;
    try{
      if(sub.type==='url'){
        var txt=await fetchText(sub.ref),hash=await Core.sha256(txt);
        if(hash!==s.hash||!datasets[id]){
          var ds=cleanSnapshot(parseList(txt),id);changed=!!s.hash&&hash!==s.hash;
          datasets[id]=ds;await Core.dbPut('snap:'+id,ds);s.hash=hash;s.count=ds.scripts.length;s.lastChangedAt=now();
        }
      }else{
        if(!cloudOn())throw msgErr('cloudOff');
        var row=await Cloud.getSharedList(sub.ref,datasets[id]?s.version:null);
        if(!row){s.status='gone';s.lastChecked=now();saveState();refresh();return}
        if(row.snapshot){
          var ds2=cleanSnapshot(row.snapshot,id);changed=s.version!=null&&row.version!==s.version;
          datasets[id]=ds2;await Core.dbPut('snap:'+id,ds2);s.version=row.version;s.count=ds2.scripts.length;s.lastChangedAt=row.updated_at||now();
        }
        var nm=Core.cleanText(row.name,120);if(nm&&nm!==sub.name){sub.name=nm;save()}
      }
      if(changed){s.hasUpdate=S.filter.subscriptionId!==id;notifyUpdated(sub)}
      s.status='ok';s.failCount=0;s.lastError=null;s.lastChecked=now();saveState();refresh();
    }catch(e){
      s.status='error';s.failCount=(s.failCount||0)+1;s.lastError=errText(e);s.lastChecked=now();saveState();refresh();
      throw e;
    }
  }
  function refresh(){if(Core.ready)render()}
  function ensureJob(sub,soon){
    if(Core.hasJob('sub:'+sub.id))return;
    Core.addJob('sub:'+sub.id,{run:function(){return checkSub(sub.id)},every:Core.pollMs,delay:soon?1500:Core.pollMs()||0});
  }
  function dropSubLocal(id){
    Core.removeJob('sub:'+id);delete datasets[id];delete state[id];saveState();
    Core.dbDel('snap:'+id).catch(function(){});
  }
  /* Mantem jobs e snapshots coerentes com a lista de assinaturas (que tambem pode mudar pela nuvem). */
  function reconcile(){
    var ids={};
    subs().forEach(function(sub){ids[sub.id]=1;ensureJob(sub,true);if(!datasets[sub.id])Core.runJob('sub:'+sub.id).catch(function(){})});
    Object.keys(datasets).concat(Object.keys(state)).forEach(function(id){if(!ids[id])dropSubLocal(id)});
    if(S.filter.subscriptionId&&!ids[S.filter.subscriptionId])S.filter.subscriptionId=null;
  }
  function checkNow(id){
    showToast(t('shChecking'),'info');
    Core.runJob('sub:'+id).then(function(){var s=st(id);if(s.status==='ok')showToast(t('shUpToDate'),'success');else showToast(tr('shError',{msg:s.lastError||''}),'error')});
  }
  function checkAll(){subs().forEach(function(sub){Core.runJob('sub:'+sub.id).catch(function(){})})}
  function removeSub(id){
    var sub=findSub(id);if(!sub)return;
    FP.askConfirm(esc(tr('shRemoveConfirm',{name:sub.name})),esc(t('shRemove')),true).then(function(ok){
      if(!ok)return;
      S.data.subscriptions=subs().filter(function(s){return s.id!==id});
      dropSubLocal(id);if(S.filter.subscriptionId===id)S.filter.subscriptionId=null;
      save().then(render);
    });
  }
  function openSubscription(id){
    S.filter.subscriptionId=id;S.filter.folderId=null;S.filter.categoryId=null;
    if(window.FP)FP.resetPage();
    var s=st(id);if(s.hasUpdate){s.hasUpdate=false;saveState()}
    render();
    if(window.innerWidth<=768&&document.getElementById('sidebar').classList.contains('open'))toggleSidebar();
  }

  /* ===== Copiar para os meus scripts ===== */
  function ownNameExists(lower){return S.data.scripts.some(function(s){return String(s.name).toLowerCase()===lower})}
  function ownCategoryFor(ds,catId){
    var c=catId&&ds.categories.find(function(x){return x.id===catId});if(!c)return null;
    var mine=S.data.categories.find(function(x){return String(x.name).toLowerCase()===c.name.toLowerCase()});return mine?mine.id:null;
  }
  function copyToMine(id){
    var sid=subIdOf(id),s=sharedScript(id);if(!s)return;var ds=datasets[sid];
    closeModal();
    setTimeout(function(){
      openNewScript();
      var name=document.getElementById('sName'),cont=document.getElementById('sCont'),cat=document.getElementById('sCat'),tags=document.getElementById('featureTags');
      if(!name||!cont)return;
      name.value=Core.uniqueName(s.name,ownNameExists);cont.value=s.content;
      var cid=ownCategoryFor(ds,s.categoryId);if(cat&&cid)cat.value=cid;
      if(tags)tags.value=(s.tags||[]).join(', ');
      if(typeof updateInfo==='function')updateInfo();
    },80);
  }
  function copyAll(sid){
    var ds=datasets[sid],sub=findSub(sid);if(!ds||!sub)return;
    var rootName=Core.uniqueName(sub.name,function(lower){return S.data.folders.some(function(f){return!f.parentId&&String(f.name).toLowerCase()===lower})});
    var rootId=uid(),fmap={},cmap={},left=ds.folders.slice(),guard=0,nowIso=now();
    S.data.folders.push({id:rootId,name:rootName,parentId:null,createdAt:nowIso});
    while(left.length&&guard++<5000){
      var f=left.shift();
      if(f.parentId&&!fmap[f.parentId]&&left.some(function(x){return x.id===f.parentId})){left.push(f);continue}
      fmap[f.id]=uid();S.data.folders.push({id:fmap[f.id],name:f.name,parentId:f.parentId&&fmap[f.parentId]||rootId,createdAt:nowIso});
    }
    ds.categories.forEach(function(c){
      var mine=S.data.categories.find(function(x){return String(x.name).toLowerCase()===c.name.toLowerCase()});
      if(mine)cmap[c.id]=mine.id;else{cmap[c.id]=uid();S.data.categories.push({id:cmap[c.id],name:c.name,color:c.color,createdAt:nowIso})}
    });
    ds.scripts.forEach(function(s){
      S.data.scripts.push({id:uid(),name:Core.uniqueName(s.name,ownNameExists),content:s.content,categoryId:s.categoryId&&cmap[s.categoryId]||null,folderId:s.folderId&&fmap[s.folderId]||rootId,createdAt:nowIso,updatedAt:nowIso,tags:(s.tags||[]).slice(),versions:[],favorite:false,pinned:false});
    });
    save().then(function(){render();showToast(tr('shCopiedAll',{n:ds.scripts.length,folder:rootName}),'success')});
  }

  /* ===== Diálogo de assinatura ===== */
  function openSubscribeDialog(pre){
    pre=pre||{};
    var hasCloud=cloudOn(),tab=pre.code||hasCloud?'code':'url';
    var hd='<span style="font-weight:700;font-size:15px">'+esc(t('shSubscribe'))+'</span><button class="icon-btn" onclick="closeModal()">×</button>';
    var bd='<form id="shForm" class="auth-form" autocomplete="off">'+
      '<div class="seg-tabs"><button type="button" class="seg-tab" data-tab="code">'+SVG_CLOUD+' '+esc(t('shByCode'))+'</button><button type="button" class="seg-tab" data-tab="url">'+SVG_GIT+' '+esc(t('shByGithub'))+'</button></div>'+
      '<div data-panel="code">'+(hasCloud?'<label class="label" for="shCode">'+esc(t('shByCode'))+'</label><input class="inp" id="shCode" placeholder="'+esc(t('shCodePh'))+'" value="'+esc(pre.code||'')+'" style="font-family:\'JetBrains Mono\',monospace;text-transform:uppercase">':'<div class="auth-note">'+esc(t('shCodeNeedsCloud'))+'</div>')+'</div>'+
      '<div data-panel="url"><label class="label" for="shRepo">'+esc(t('shRepo'))+'</label><input class="inp" id="shRepo" placeholder="'+esc(t('shRepoPh'))+'">'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><div style="flex:1;min-width:140px"><label class="label" for="shBranch">'+esc(t('shBranch'))+'</label><input class="inp" id="shBranch" placeholder="main"></div><div style="flex:2;min-width:180px"><label class="label" for="shPath">'+esc(t('shPath'))+'</label><input class="inp" id="shPath" placeholder="sql_scripts.json"></div></div>'+
      '<div class="auth-note">'+esc(t('shGithubHelp'))+'</div></div>'+
      '<div class="auth-err" id="shErr"></div></form>';
    var ft='<div style="flex:1"></div><button class="btn" type="button" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-accent" type="submit" form="shForm" id="shSubmit">'+esc(t('shSubscribe'))+'</button>';
    openModal(hd,bd,ft,false);
    var form=document.getElementById('shForm');if(!form)return;
    function show(name){tab=name;form.querySelectorAll('[data-panel]').forEach(function(p){p.hidden=p.getAttribute('data-panel')!==name});form.querySelectorAll('.seg-tab').forEach(function(b){b.classList.toggle('is-active',b.getAttribute('data-tab')===name)});var f=form.querySelector('[data-panel="'+name+'"] input');if(f)setTimeout(function(){f.focus()},30)}
    form.querySelectorAll('.seg-tab').forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-tab'))})});
    show(tab);
    form.addEventListener('submit',async function(ev){
      ev.preventDefault();
      var btn=document.getElementById('shSubmit'),err=document.getElementById('shErr');err.textContent='';
      if(tab==='code'&&!hasCloud){err.textContent=t('shCodeNeedsCloud');return}
      btn.disabled=true;
      try{
        var sub=tab==='code'?await subscribeCode(document.getElementById('shCode').value):await subscribeUrl(document.getElementById('shRepo').value,document.getElementById('shBranch').value,document.getElementById('shPath').value);
        closeModal();showToast(tr('shAdded',{name:sub.name}),'success');openSubscription(sub.id);
      }catch(e){err.textContent=errText(e);console.warn(e)}
      finally{btn.disabled=false}
    });
  }

  /* ===== Publicar pasta (lista na nuvem) e exportar JSON para GitHub ===== */
  function subtreeIds(fid){var ids={};(function coll(id){ids[id]=1;S.data.folders.forEach(function(f){if(f.parentId===id&&!ids[f.id])coll(f.id)})})(fid);return ids}
  function buildSnapshot(folderId){
    var root=Core.findEntity('folder',folderId);if(!root)return null;
    var ids=subtreeIds(folderId),catIds={},scripts=[],locked=0;
    var folders=S.data.folders.filter(function(f){return ids[f.id]}).map(function(f){return{id:f.id,name:f.name,parentId:f.id===folderId?null:(f.parentId||null),createdAt:f.createdAt||null}});
    S.data.scripts.forEach(function(s){
      if(!s.folderId||!ids[s.folderId])return;if(s.locked){locked++;return}
      var cat=s.categoryId&&Core.findEntity('category',s.categoryId)?s.categoryId:null;if(cat)catIds[cat]=1;
      scripts.push({id:s.id,name:s.name,content:s.content||'',categoryId:cat,folderId:s.folderId,createdAt:s.createdAt||null,updatedAt:s.updatedAt||null,tags:Array.isArray(s.tags)?s.tags.slice():[]});
    });
    var categories=S.data.categories.filter(function(c){return catIds[c.id]}).map(function(c){return{id:c.id,name:c.name,color:c.color,createdAt:c.createdAt||null}});
    function byId(a,b){return a.id<b.id?-1:a.id>b.id?1:0}
    folders.sort(byId);scripts.sort(byId);categories.sort(byId);
    return{snapshot:{version:'1.0',format:'sqlsm-list',name:root.name,scripts:scripts,folders:folders,categories:categories},locked:locked};
  }
  function snapshotHash(snap){return Core.sha256(JSON.stringify(snap))}
  function pubKey(id){return'sqlsm-pub:'+id}
  function exportForGithub(folderId){
    var b=buildSnapshot(folderId);if(!b)return;
    download('sql_scripts.json',JSON.stringify(Object.assign({},b.snapshot,{exportedAt:now()}),null,2));
    openModal('<span style="font-weight:700;font-size:15px">'+esc(t('pubExportGh'))+'</span><button class="icon-btn" onclick="closeModal()">×</button>',
      '<div class="auth-form"><p class="auth-note" style="font-size:13px">'+esc(t('pubExportGhHelp'))+'</p>'+(b.locked?'<p class="auth-note">'+esc(tr('pubLockedOut',{n:b.locked}))+'</p>':'')+'</div>',
      '<div style="flex:1"></div><button class="btn btn-accent" onclick="closeModal()">OK</button>',false);
  }
  function publishFolder(folderId){
    if(!cloudOn()){showToast(t('cloudOff'),'error');return}
    if(!Cloud.isSignedIn()){showToast(t('pubNeedLogin'),'info');Cloud.openAccount('signin');return}
    var root=Core.findEntity('folder',folderId),b=buildSnapshot(folderId);if(!root||!b)return;
    var hd='<span style="font-weight:700;font-size:15px">'+esc(t('pubTitle'))+'</span><button class="icon-btn" onclick="closeModal()">×</button>';
    var bd='<form id="pubForm" class="auth-form"><label class="label" for="pubName">'+esc(t('pubName'))+'</label><input class="inp" id="pubName" maxlength="120" value="'+esc(root.name)+'"><p class="auth-note">'+esc(tr('pubInfo',{n:b.snapshot.scripts.length,locked:b.locked}))+'</p><div class="auth-err" id="pubErr"></div></form>';
    var ft='<div style="flex:1"></div><button class="btn" type="button" onclick="closeModal()">'+esc(t('cancel'))+'</button><button class="btn btn-accent" type="submit" form="pubForm" id="pubSubmit">'+esc(t('pubBtn'))+'</button>';
    openModal(hd,bd,ft,false);
    document.getElementById('pubForm').addEventListener('submit',async function(ev){
      ev.preventDefault();
      var btn=document.getElementById('pubSubmit'),err=document.getElementById('pubErr'),name=Core.cleanText(document.getElementById('pubName').value,120);
      if(!name){err.textContent=t('pubName')+'!';return}
      btn.disabled=true;err.textContent='';
      try{
        var fresh=buildSnapshot(folderId).snapshot;
        var row=await Cloud.publishList({name:name,source_folder_id:folderId,snapshot:fresh});
        try{localStorage.setItem(pubKey(row.id),await snapshotHash(fresh))}catch(e){}
        render();showPublished(row);
      }catch(e){err.textContent=Cloud.errorText(e)}
      finally{btn.disabled=false}
    });
  }
  function showPublished(row){
    var code=formatCode(row.code);
    openModal('<span style="font-weight:700;font-size:15px">'+esc(t('pubTitle'))+'</span><button class="icon-btn" onclick="closeModal()">×</button>',
      '<div class="auth-form" style="align-items:center;text-align:center"><div class="auth-note">'+esc(t('pubDoneText'))+'</div><div class="share-code">'+esc(code)+'</div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="pubCopyCode">'+esc(t('pubCopyCode'))+'</button><button class="btn btn-sm" id="pubCopyLink">'+esc(t('pubCopyLink'))+'</button></div><div class="auth-note">'+esc(t('pubManualHint'))+'</div></div>',
      '<div style="flex:1"></div><button class="btn btn-accent" onclick="closeModal()">OK</button>',false);
    document.getElementById('pubCopyCode').onclick=function(){copyText(code)};
    document.getElementById('pubCopyLink').onclick=function(){copyText(shareLink(row.code))};
  }
  function publishedFolderIds(){var ids={};((window.Cloud&&Cloud.myListsCache)||[]).forEach(function(l){if(l.source_folder_id)ids[l.source_folder_id]=1});return ids}

  /* Card "Compartilhados" nas Configuracoes: intervalo de verificacao e listas publicadas. */
  function injectSettingsCard(){
    var wrap=document.querySelector('#mBody > div');if(!wrap||!document.getElementById('setUrl')||document.getElementById('sharedSettingsCard'))return;
    var poll=S.data.settings.pollMinutes;
    var opts=[5,15,30,60,0].map(function(m){return'<option value="'+m+'"'+(m===poll?' selected':'')+'>'+esc(m?tr('shMinutes',{n:m}):t('shPollManual'))+'</option>'}).join('');
    var card=document.createElement('div');card.id='sharedSettingsCard';card.className='set-card';
    card.innerHTML='<div class="set-title">'+SVG_CLOUD+esc(t('shSection'))+'</div>'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><label for="shPollSel" style="font-size:13px;color:var(--tx1)">'+esc(t('shPoll'))+'</label><select class="inp" id="shPollSel" style="width:auto;min-width:130px;padding-top:6px;padding-bottom:6px">'+opts+'</select><button class="btn btn-sm" id="shCheckAll">'+esc(t('shCheckAll'))+'</button><button class="btn btn-sm" id="shAddSub">'+SVG_PLUS+esc(t('shSubscribe'))+'</button></div>'+
      (cloudOn()&&Cloud.isSignedIn()?'<div class="set-sub">'+esc(t('pubMine'))+'</div><div id="myListsBox" class="auth-note">…</div>':'');
    wrap.appendChild(card);
    card.querySelector('#shPollSel').addEventListener('change',function(){S.data.settings.pollMinutes=Number(this.value);save();Core.reschedule()});
    card.querySelector('#shCheckAll').addEventListener('click',function(){checkAll();showToast(t('shChecking'),'info')});
    card.querySelector('#shAddSub').addEventListener('click',function(){openSubscribeDialog()});
    if(card.querySelector('#myListsBox'))loadMyLists();
  }
  async function loadMyLists(){
    var box=document.getElementById('myListsBox');if(!box)return;
    var lists;try{lists=await Cloud.myLists()}catch(e){box.textContent=Cloud.errorText(e);return}
    box=document.getElementById('myListsBox');if(!box)return;
    if(!lists.length){box.textContent=t('pubNone');return}
    box.className='pub-list';box.innerHTML='';
    lists.forEach(function(l){
      var folder=l.source_folder_id&&Core.findEntity('folder',l.source_folder_id);
      var row=document.createElement('div');row.className='pub-row';
      row.innerHTML='<div class="pub-info"><b>'+esc(l.name)+'</b><span>'+esc(formatCode(l.code))+' · v'+Number(l.version)+' · '+Number(l.script_count)+' '+esc(t('scripts'))+(folder?'':' · '+esc(t('pubFolderGone')))+'</span></div>'+
        '<div class="pub-actions"><button class="btn btn-sm" data-act="copy">'+esc(t('pubCopyCode'))+'</button>'+(folder?'<button class="btn btn-sm" data-act="update" disabled>'+esc(t('pubUpToDate'))+'</button>':'')+'<button class="btn btn-sm btn-danger" data-act="del">'+esc(t('pubUnpublish'))+'</button></div>';
      row.querySelector('[data-act="copy"]').onclick=function(){copyText(formatCode(l.code))};
      row.querySelector('[data-act="del"]').onclick=function(){
        FP.askConfirm(esc(tr('pubUnpublishConfirm',{name:l.name})),esc(t('pubUnpublish')),true).then(async function(ok){
          if(!ok)return;
          try{await Cloud.deleteList(l.id);try{localStorage.removeItem(pubKey(l.id))}catch(e){}showToast(t('pubUnpublished'),'success');render();loadMyLists()}catch(e){showToast(Cloud.errorText(e),'error')}
        });
      };
      var upd=row.querySelector('[data-act="update"]');
      if(upd){
        var snap=buildSnapshot(l.source_folder_id).snapshot;
        snapshotHash(snap).then(function(h){
          var known=null;try{known=localStorage.getItem(pubKey(l.id))}catch(e){}
          if(known!==h){upd.disabled=false;upd.textContent=t('pubUpdateNow');upd.classList.add('btn-accent')}
          upd.onclick=async function(){
            upd.disabled=true;
            try{var fresh=buildSnapshot(l.source_folder_id).snapshot;var r=await Cloud.updateList(l.id,{snapshot:fresh});try{localStorage.setItem(pubKey(l.id),await snapshotHash(fresh))}catch(e){}showToast(tr('pubUpdated',{v:r.version}),'success');loadMyLists()}
            catch(e){upd.disabled=false;showToast(Cloud.errorText(e),'error')}
          };
        });
      }
      box.appendChild(row);
    });
  }

  /* ===== Integracao com o render existente ===== */
  function sectionHtml(){
    var h='<div class="sidebar-section"><span>'+esc(t('shSection'))+'</span><button class="icon-btn" data-sub-add="1" title="'+esc(t('shSubscribe'))+'">'+SVG_PLUS+'</button></div>',list=subs();
    if(!list.length)h+='<div class="sub-empty">'+esc(t('shNone'))+'</div>';
    list.forEach(function(sub){
      var s=st(sub.id),ds=datasets[sub.id],act=S.filter.subscriptionId===sub.id;
      var flag=s.hasUpdate?'<span class="sub-dot" title="'+esc(tr('shUpdated',{name:sub.name}))+'"></span>':(s.status==='gone'||s.status==='error')?'<span class="sub-warn" title="'+esc(s.status==='gone'?t('shGone'):tr('shError',{msg:s.lastError||''}))+'">!</span>':'';
      h+='<div class="sidebar-item'+(act?' active':'')+'" data-sub-id="'+esc(sub.id)+'" title="'+esc(sub.type==='code'?formatCode(sub.ref):sub.ref)+'">'+(sub.type==='code'?SVG_CLOUD:SVG_GIT)+'<span class="sub-name">'+esc(sub.name)+'</span>'+flag+'<span class="cnt">'+(ds?ds.scripts.length:(s.count||0))+'</span></div>';
    });
    return'<div class="shared-section">'+h+'</div>';
  }
  var prevSidebar=window.renderSidebar;
  window.renderSidebar=function(){
    Core.withOwnData(prevSidebar);
    var sc=document.getElementById('sidebarContent');if(!sc)return;
    if(activeSub())sc.querySelectorAll('.sidebar-item.active').forEach(function(el){el.classList.remove('active')});
    var pub=publishedFolderIds();
    if(Object.keys(pub).length)sc.querySelectorAll('[data-ctx-folder]').forEach(function(el){
      if(!pub[el.getAttribute('data-ctx-folder')])return;
      var cnt=el.querySelector('.cnt'),badge=document.createElement('span');badge.className='pub-badge';badge.title=t('pubBadge');badge.innerHTML='<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="'+SVG_SHARE+'"/></svg>';
      el.insertBefore(badge,cnt||null);
    });
    sc.insertAdjacentHTML('beforeend',sectionHtml());
  };
  function sidebarClick(ev){
    var add=ev.target.closest('[data-sub-add]');if(add){ev.stopPropagation();openSubscribeDialog();return}
    var item=ev.target.closest('[data-sub-id]');if(item)openSubscription(item.getAttribute('data-sub-id'));
  }
  function sidebarCtx(ev){
    var item=ev.target.closest('[data-sub-id]');if(!item)return;
    ev.preventDefault();ev.stopPropagation();var id=item.getAttribute('data-sub-id');
    menu(ev,[[t('shCheckNow'),'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15','',function(){checkNow(id)}],[t('shCopyAll'),'M8 4h12v16H8zM4 8v12h12','',function(){copyAll(id)}],[t('shRemove'),'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2','danger',function(){removeSub(id)}]]);
  }
  function menu(e,items){
    hideCtx();var container=document.getElementById('ctxContainer'),m=document.createElement('div');m.className='ctx-menu';
    m.addEventListener('click',function(ev){ev.stopPropagation()});
    items.forEach(function(it){m.appendChild(ctxItem(it[0],it[1],it[2],it[3]))});
    container.appendChild(m);
    var x=e.clientX,y=e.clientY;
    requestAnimationFrame(function(){x=Math.max(4,Math.min(x,window.innerWidth-m.offsetWidth-8));y=Math.max(4,Math.min(y,window.innerHeight-m.offsetHeight-8));m.style.left=x+'px';m.style.top=y+'px'});
    clearTimeout(menu.timer);menu.timer=setTimeout(hideCtx,5000);
  }
  function ctxItem(label,path,cls,fn){
    var item=document.createElement('div');item.className='ctx-item'+(cls?' '+cls:'');
    item.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+path+'"/></svg>';
    item.appendChild(document.createTextNode(label));
    item.addEventListener('click',function(ev){ev.stopPropagation();hideCtx();fn()});
    return item;
  }
  var prevCtx=window.showCtx;
  window.showCtx=function(e,type,id){
    prevCtx(e,type,id);
    if(type!=='folder')return;
    var m=document.querySelector('#ctxContainer .ctx-menu');if(!m)return;
    m.appendChild(ctxItem(t('pubShare'),SVG_SHARE,'',function(){publishFolder(id)}));
    m.appendChild(ctxItem(t('pubExportGh'),SVG_DOWNLOAD,'',function(){exportForGithub(id)}));
  };
  var prevSetFilter=window.setFilter;
  window.setFilter=function(fid,cid){S.filter.subscriptionId=null;return prevSetFilter(fid,cid)};

  var prevMain=window.renderMain;
  /* Com uma lista compartilhada aberta, o render normal (filtros, busca, paginacao, cards) roda sobre o snapshot dela. */
  window.renderMain=function(){
    var sub=activeSub();
    if(!sub)return prevMain();
    Core.withDataset(datasets[sub.id]||{scripts:[],folders:[],categories:[]},prevMain);
    if(Core.lensDepth===0)decorateShared(sub);
  };
  function decorateShared(sub){
    var main=document.getElementById('mainContent');if(!main)return;
    main.querySelectorAll('.script-card-actions').forEach(function(el){el.remove()});
    var s=st(sub.id),ds=datasets[sub.id];
    var warn=s.status==='gone'?t('shGone'):s.status==='error'?tr('shError',{msg:s.lastError||''}):'';
    var banner=document.createElement('div');banner.className='shared-banner';
    banner.innerHTML=(sub.type==='code'?SVG_CLOUD:SVG_GIT)+'<b>'+esc(sub.name)+'</b><span class="shared-meta">'+esc(t('shReadOnly'))+(sub.type==='code'&&s.version?' · v'+Number(s.version):'')+' · '+esc(tr('shChecked',{date:s.lastChecked?fmtDate(s.lastChecked):t('never')}))+'</span>'+(warn?'<span class="shared-warn">'+esc(warn)+'</span>':'')+
      '<span class="shared-actions"><button class="btn btn-sm" data-sh="check">'+esc(t('shCheckNow'))+'</button>'+(ds&&ds.scripts.length?'<button class="btn btn-sm" data-sh="copyall">'+esc(t('shCopyAll'))+'</button>':'')+'</span>';
    banner.querySelector('[data-sh="check"]').onclick=function(){checkNow(sub.id)};
    var ca=banner.querySelector('[data-sh="copyall"]');if(ca)ca.onclick=function(){copyAll(sub.id)};
    var tools=main.querySelector('.script-tools'),empty=main.querySelector('.empty-state');
    if(tools)tools.insertBefore(banner,tools.firstChild);
    else{if(empty)empty.innerHTML='<div style="font-size:15px;font-weight:600;color:var(--tx1)">'+esc(t(!ds?'shLoading':ds.scripts.length?'emptyState':'shEmpty'))+'</div>';main.insertBefore(banner,main.firstChild)}
    var lc=document.getElementById('quickLockedCount');if(lc){var n=S.data.scripts.filter(function(x){return x.locked}).length;lc.textContent=n?'('+n+')':''}
  }

  var prevView=window.openViewScript;
  window.openViewScript=function(id){
    var sid=subIdOf(id);if(!sid)return prevView(id);
    Core.withDataset(datasets[sid],function(){prevView(id)});
    var foot=document.getElementById('mFoot');if(!foot)return;
    foot.innerHTML='<span class="shared-meta">'+esc(t('shReadOnly'))+'</span><div style="flex:1"></div><button class="btn" data-v="close">'+esc(t('shClose'))+'</button><button class="btn" data-v="copy">'+esc(t('copy'))+'</button><button class="btn btn-accent" data-v="mine">'+esc(t('shCopyToMine'))+'</button>';
    foot.querySelector('[data-v="close"]').onclick=function(){closeModal()};
    foot.querySelector('[data-v="copy"]').onclick=function(){copyContent(id)};
    foot.querySelector('[data-v="mine"]').onclick=function(){copyToMine(id)};
  };
  var prevCopy=window.copyContent;
  window.copyContent=function(id){var sid=subIdOf(id);if(!sid)return prevCopy(id);return Core.withDataset(datasets[sid],function(){return prevCopy(id)})};
  var prevHL=window.toggleHL;
  window.toggleHL=function(id){var sid=subIdOf(id);if(!sid)return prevHL(id);return Core.withDataset(datasets[sid],function(){return prevHL(id)})};

  var prevSettings=window.openSettings;
  window.openSettings=function(){prevSettings();injectSettingsCard();setTimeout(injectSettingsCard,0)};

  window.Sharing={openSubscribeDialog:openSubscribeDialog,checkAll:checkAll,reconcile:reconcile,normalizeCode:normalizeCode,formatCode:formatCode,githubCandidates:githubCandidates,cleanSnapshot:cleanSnapshot,buildSnapshot:buildSnapshot};

  /* ===== Inicializacao ===== */
  var sc=document.getElementById('sidebarContent');
  if(sc){sc.addEventListener('click',sidebarClick);sc.addEventListener('contextmenu',sidebarCtx)}
  Core.on('remoteApplied',function(){reconcile();render()});
  Core.on('reset',function(){Object.keys(datasets).forEach(function(id){Core.dbDel('snap:'+id).catch(function(){})});Object.keys(datasets).forEach(function(id){Core.removeJob('sub:'+id)});datasets={};state={};saveState()});
  Core.whenReady.then(async function(ok){
    if(!ok)return;
    for(var i=0;i<subs().length;i++){
      var id=subs()[i].id;
      try{var ds=await Core.dbGet('snap:'+id);if(validDataset(ds))datasets[id]=ds}catch(e){}
    }
    reconcile();render();setTimeout(Core.tick,2500);
    var params=new URLSearchParams(location.search),code=params.get('sub');
    if(code){
      params.delete('sub');var q=params.toString();
      try{history.replaceState(null,'',location.pathname+(q?'?'+q:'')+location.hash)}catch(e){}
      setTimeout(function(){openSubscribeDialog({code:normalizeCode(code)?formatCode(normalizeCode(code)):code})},400);
    }
  });
})();
