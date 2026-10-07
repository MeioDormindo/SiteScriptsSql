/* Nucleo de sincronizacao: rastreia mudancas a cada save(), registra exclusoes (tombstones),
   sanitiza dados importados, troca temporariamente o conjunto de dados exibido (lente) e agenda tarefas periodicas.
   Funciona sem o SDK da nuvem; cloud.js e sharing.js se apoiam nele. */
(function(){
  var KINDS=['script','folder','category','subscription'];
  var ID_RE=/^[A-Za-z0-9_-]{1,64}$/;
  var COLOR_RE=/^#[0-9a-fA-F]{3,8}$/;
  var B64_RE=/^[A-Za-z0-9+\/=]+$/;
  var DEFAULT_COLOR='#8888a0';
  var TOMB_MAX_AGE=90*24*3600*1000;
  var shadow={};
  var listeners={};
  var Core={ready:false,lensDepth:0,KINDS:KINDS,ID_RE:ID_RE};
  window.Core=Core;

  Core.on=function(ev,fn){(listeners[ev]=listeners[ev]||[]).push(fn)};
  function emit(ev,arg){(listeners[ev]||[]).slice().forEach(function(fn){try{fn(arg)}catch(e){console.error(e)}})}
  Core.emit=emit;

  /* ===== Utilidades ===== */
  function ts(v){var n=Date.parse(v);return isNaN(n)?0:n}
  Core.ts=ts;
  Core.clock=function(){var off=(S.data&&S.data.sync&&S.data.sync.clockOffsetMs)||0;return new Date(Date.now()+off).toISOString()};
  function later(t,prev){return new Date(Math.max(ts(t),ts(prev)+1)).toISOString()}
  Core.later=later;
  function validId(v){return typeof v==='string'&&ID_RE.test(v)}
  Core.validId=validId;
  function validDate(v){return typeof v==='string'&&v.length<=40&&!isNaN(Date.parse(v))?v:null}
  function cleanText(v,max){var s=typeof v==='string'?v:(v==null?'':String(v));return s.replace(/[\u0000-\u001F\u007F]+/g,' ').trim().slice(0,max)}
  Core.cleanText=cleanText;
  function cleanTags(v){
    if(!Array.isArray(v))return[];var out=[];
    v.forEach(function(tag){var s=String(tag==null?'':tag).toLowerCase().replace(/[<>"'`&\u0000-\u001F]/g,'').trim().slice(0,40);if(s&&out.indexOf(s)<0&&out.length<30)out.push(s)});
    return out;
  }
  Core.cleanTags=cleanTags;
  function validSecure(s){return!!(s&&typeof s==='object'&&typeof s.salt==='string'&&typeof s.iv==='string'&&typeof s.data==='string'&&s.salt.length<=64&&s.iv.length<=64&&s.data.length<=1500000&&B64_RE.test(s.salt)&&B64_RE.test(s.iv)&&B64_RE.test(s.data))}
  Core.uniqueName=function(name,exists){var cand=name,n=2;while(exists(cand.toLowerCase()))cand=name+' ('+(n++)+')';return cand};
  Core.sha256=function(text){
    return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(function(buf){return Array.prototype.map.call(new Uint8Array(buf),function(b){return('0'+b.toString(16)).slice(-2)}).join('')});
  };

  /* ===== Entidades ===== */
  function listOf(kind){
    var d=S.data;
    if(kind==='script')return d.scripts||[];
    if(kind==='folder')return d.folders||[];
    if(kind==='category')return d.categories||[];
    if(kind==='subscription')return d.subscriptions||(d.subscriptions=[]);
    return[];
  }
  Core.listOf=listOf;
  Core.findEntity=function(kind,id){return listOf(kind).find(function(e){return e&&e.id===id})||null};
  function keyOf(kind,id){return kind+':'+id}
  Core.keyOf=keyOf;

  /* Formato enviado para a nuvem e usado como impressao digital: so campos conhecidos, com padroes normalizados.
     Scripts protegidos nunca levam o conteudo em texto puro; o historico (versions) fica so no aparelho. */
  function serialize(kind,e){
    if(kind==='script'){
      var locked=!!e.locked&&validSecure(e.secure);
      return{id:e.id,name:String(e.name||''),content:locked?'':String(e.content||''),categoryId:e.categoryId||null,folderId:e.folderId||null,createdAt:e.createdAt||null,updatedAt:e.updatedAt||null,tags:Array.isArray(e.tags)?e.tags.slice():[],favorite:!!e.favorite,pinned:!!e.pinned,locked:locked,secure:locked?{salt:e.secure.salt,iv:e.secure.iv,data:e.secure.data}:null};
    }
    if(kind==='folder')return{id:e.id,name:String(e.name||''),parentId:e.parentId||null,createdAt:e.createdAt||null};
    if(kind==='category')return{id:e.id,name:String(e.name||''),color:e.color||DEFAULT_COLOR,createdAt:e.createdAt||null};
    if(kind==='subscription')return{id:e.id,type:e.type,ref:e.ref,name:String(e.name||''),createdAt:e.createdAt||null};
    return null;
  }
  Core.serialize=serialize;
  function fp(kind,e){return JSON.stringify(serialize(kind,e))}

  /* Valida uma entidade vinda de fora (importacao, nuvem, lista compartilhada). Retorna null se invalida. */
  function sanitizeEntity(kind,raw,opts){
    opts=opts||{};
    if(!raw||typeof raw!=='object'||!validId(raw.id))return null;
    var nowIso=now();
    if(kind==='script'){
      var name=cleanText(raw.name,200);if(!name)return null;
      var s={id:raw.id,name:name,content:typeof raw.content==='string'?raw.content:'',categoryId:validId(raw.categoryId)?raw.categoryId:null,folderId:validId(raw.folderId)?raw.folderId:null,createdAt:validDate(raw.createdAt)||nowIso,updatedAt:validDate(raw.updatedAt)||validDate(raw.createdAt)||nowIso,tags:cleanTags(raw.tags),favorite:raw.favorite===true,pinned:raw.pinned===true};
      if(raw.locked===true&&validSecure(raw.secure)){s.locked=true;s.secure={salt:raw.secure.salt,iv:raw.secure.iv,data:raw.secure.data};s.content=''}
      if(opts.versions){s.versions=Array.isArray(raw.versions)?raw.versions.filter(function(v){return v&&typeof v.content==='string'}).slice(-20).map(function(v){return{content:v.content,savedAt:validDate(v.savedAt)||nowIso}}):[];if(s.locked)s.versions=[]}
      if(validDate(raw.modifiedAt))s.modifiedAt=raw.modifiedAt;
      return s;
    }
    if(kind==='folder'){var fn=cleanText(raw.name,120);if(!fn)return null;var f={id:raw.id,name:fn,parentId:validId(raw.parentId)&&raw.parentId!==raw.id?raw.parentId:null,createdAt:validDate(raw.createdAt)||nowIso};if(validDate(raw.modifiedAt))f.modifiedAt=raw.modifiedAt;return f}
    if(kind==='category'){var cn=cleanText(raw.name,80);if(!cn)return null;var c={id:raw.id,name:cn,color:typeof raw.color==='string'&&COLOR_RE.test(raw.color)?raw.color:DEFAULT_COLOR,createdAt:validDate(raw.createdAt)||nowIso};if(validDate(raw.modifiedAt))c.modifiedAt=raw.modifiedAt;return c}
    if(kind==='subscription'){
      if(raw.type!=='code'&&raw.type!=='url')return null;
      var ref=typeof raw.ref==='string'?raw.ref.trim():'';
      if(raw.type==='code'&&!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(ref))return null;
      if(raw.type==='url'&&(!/^https?:\/\//i.test(ref)||ref.length>500))return null;
      return{id:raw.id,type:raw.type,ref:ref,name:cleanText(raw.name,120)||ref,createdAt:validDate(raw.createdAt)||nowIso};
    }
    return null;
  }
  Core.sanitizeEntity=sanitizeEntity;

  /* Quebra ciclos na hierarquia de pastas (getFolderPath entraria em loop infinito). */
  function breakFolderCycles(folders){
    var byId={};folders.forEach(function(f){byId[f.id]=f});
    folders.forEach(function(f){
      var seen={},c=f;
      while(c&&c.parentId){if(seen[c.id]){f.parentId=null;break}seen[c.id]=1;c=byId[c.parentId]}
    });
  }
  Core.breakFolderCycles=breakFolderCycles;

  /* Sanitiza um JSON importado (Importar Banco, URL remota antiga) antes do mergeData original.
     Ids invalidos ganham novos ids e as referencias sao remapeadas; cores, nomes e tags sao validados. */
  function sanitizeImport(inc){
    if(!inc||typeof inc!=='object')return{scripts:[],folders:[],categories:[]};
    var maps={category:{},folder:{},script:{}},seen={category:{},folder:{},script:{}};
    function fixId(v,kind){
      var k=String(v);
      if(validId(v)&&!seen[kind][v]){seen[kind][v]=1;return v}
      if(maps[kind][k]&&!seen[kind][maps[kind][k]]){seen[kind][maps[kind][k]]=1;return maps[kind][k]}
      var n=uid();maps[kind][k]=n;seen[kind][n]=1;return n;
    }
    function mapRef(v,kind){if(v==null||v==='')return null;var k=String(v);if(maps[kind][k])return maps[kind][k];return validId(v)?v:null}
    var out={scripts:[],folders:[],categories:[]};
    (Array.isArray(inc.categories)?inc.categories:[]).forEach(function(c){if(!c||typeof c!=='object')return;var e=sanitizeEntity('category',Object.assign({},c,{id:fixId(c.id,'category')}));if(e)out.categories.push(e)});
    var rawFolders=(Array.isArray(inc.folders)?inc.folders:[]).filter(function(f){return f&&typeof f==='object'});
    var ids=rawFolders.map(function(f){return fixId(f.id,'folder')});
    rawFolders.forEach(function(f,i){var e=sanitizeEntity('folder',Object.assign({},f,{id:ids[i],parentId:mapRef(f.parentId,'folder')}));if(e)out.folders.push(e)});
    breakFolderCycles(out.folders);
    (Array.isArray(inc.scripts)?inc.scripts:[]).forEach(function(s){if(!s||typeof s!=='object')return;var e=sanitizeEntity('script',Object.assign({},s,{id:fixId(s.id,'script'),categoryId:mapRef(s.categoryId,'category'),folderId:mapRef(s.folderId,'folder')}),{versions:true});if(e)out.scripts.push(e)});
    return out;
  }
  Core.sanitizeImport=sanitizeImport;

  /* ===== Tombstones ===== */
  function tombs(){return S.data.tombstones||(S.data.tombstones=[])}
  function findTomb(key){return tombs().find(function(x){return x.key===key})||null}
  function addTomb(key,at){var x=findTomb(key);if(x)x.at=later(at,x.at);else tombs().push({key:key,at:at})}
  function dropTomb(key){var list=tombs();for(var i=list.length-1;i>=0;i--)if(list[i].key===key)list.splice(i,1)}
  Core.findTomb=findTomb;Core.addTomb=addTomb;Core.dropTomb=dropTomb;
  function pruneTombs(){
    var dirty=(S.data.sync&&S.data.sync.dirty)||{},limit=Date.now()-TOMB_MAX_AGE;
    S.data.tombstones=tombs().filter(function(x){return x&&typeof x.key==='string'&&(dirty[x.key]||ts(x.at)>limit)}).slice(-5000);
  }

  /* ===== Rastreamento de mudancas ===== */
  function rebuildShadow(){
    shadow={};
    KINDS.forEach(function(kind){listOf(kind).forEach(function(e){if(e&&e.id!=null)shadow[keyOf(kind,e.id)]=fp(kind,e)})});
  }
  Core.rebuildShadow=rebuildShadow;
  Core.setShadow=function(kind,e){shadow[keyOf(kind,e.id)]=fp(kind,e)};
  Core.dropShadow=function(key){delete shadow[key]};

  /* Compara o estado atual com a sombra: quem mudou ganha modifiedAt e entra na fila; quem sumiu vira tombstone.
     Cobre todos os pontos do app que alteram dados sem precisar mexer em cada um. */
  function track(){
    var t=Core.clock(),seen={},sync=S.data.sync||(S.data.sync={dirty:{}}),dirty=sync.dirty||(sync.dirty={}),bound=!!sync.userId;
    KINDS.forEach(function(kind){listOf(kind).forEach(function(e){
      if(!e||e.id==null)return;
      var key=keyOf(kind,e.id);if(seen[key])return;seen[key]=1;
      var f=fp(kind,e),prev=shadow[key];
      if(prev===f)return;
      if(prev===undefined){var tomb=findTomb(key);e.modifiedAt=tomb?later(t,tomb.at):t;if(tomb)dropTomb(key)}
      else e.modifiedAt=later(t,e.modifiedAt);
      shadow[key]=f;if(bound)dirty[key]=1;
    })});
    Object.keys(shadow).forEach(function(key){if(!seen[key]){addTomb(key,t);delete shadow[key];if(bound)dirty[key]=1}});
  }
  Core.track=track;
  Core.saveRaw=function(){return dbSave(S.data)};
  Core.persist=function(){if(Core.ready){try{track()}catch(e){console.error(e)}}return dbSave(S.data)};
  Core.dirtyCount=function(){return Object.keys((S.data.sync&&S.data.sync.dirty)||{}).length};

  var prevSave=window.save;
  window.save=function(){
    if(Core.lensDepth>0){console.warn('save() ignorado: lista compartilhada montada');return Promise.resolve()}
    if(Core.ready){try{track()}catch(e){console.error(e)}}
    return prevSave().then(function(){emit('saved')});
  };

  /* O mergeData original casa scripts por nome: um script importado com o mesmo id de outro (renomeado) entraria duplicado.
     Ids repetidos quebrariam a sincronizacao por id, entao o segundo ganha um id novo. */
  var prevMerge=window.mergeData;
  window.mergeData=function(local,inc){
    var r=prevMerge(local,sanitizeImport(inc));
    ['scripts','folders','categories'].forEach(function(k){var seen={};(r[k]||[]).forEach(function(e){if(seen[e.id])e.id=uid();seen[e.id]=1})});
    breakFolderCycles(r.folders||[]);
    return r;
  };

  /* ===== Reset local ===== */
  Core.resetLocal=function(opts){
    var poll=S.data.settings&&S.data.settings.pollMinutes;
    S.data={scripts:[],folders:[],categories:DEF_CATS.map(function(c){return{id:uid(),name:c.name,color:c.color,createdAt:now()}}),settings:{remoteUrl:'',autoSync:false,lastSync:null,language:S.lang,theme:S.theme,pollMinutes:typeof poll==='number'?poll:15},tombstones:[],sync:{dirty:{}},subscriptions:[]};
    S.filter={folderId:null,categoryId:null,search:''};
    ['sqlScriptCardSize','sqlScriptSort','sqlScriptFeatures','sqlScriptDraft','sqlsm-substate','sqlsm-mylists'].forEach(function(k){try{localStorage.removeItem(k)}catch(e){}});
    try{Object.keys(localStorage).forEach(function(k){if(k.indexOf('sqlsm-pub:')===0)localStorage.removeItem(k)})}catch(e){}
    S.fileHandle=null;S.fileName=null;
    rebuildShadow();
    emit('reset',opts||{});
    return dbSave(S.data);
  };
  window.resetApplication=function(){
    var msg=t('resetConfirm');if(window.Cloud&&Cloud.isSignedIn&&Cloud.isSignedIn())msg+='<br><br>'+esc(t('accResetSignOut'));
    showConfirm(msg,async function(){await Core.resetLocal();closeModal();render();showToast(t('appReset'),'success')});
  };
  window.resetar=window.resetApplication;

  /* ===== Chaves extras no IndexedDB (snapshots de listas, backup antes da 1a sincronizacao) ===== */
  function store(mode,fn){return openDB().then(function(db){return new Promise(function(r,j){var tx=db.transaction('d',mode);var req=fn(tx.objectStore('d'));tx.oncomplete=function(){r(req&&req.result)};tx.onerror=function(){j(tx.error)}})})}
  Core.dbGet=function(key){return store('readonly',function(st){return st.get(key)}).then(function(v){return v===undefined?null:v})};
  Core.dbPut=function(key,val){return store('readwrite',function(st){return st.put(val,key)})};
  Core.dbDel=function(key){return store('readwrite',function(st){return st.delete(key)})};

  /* ===== Lente: exibe outro conjunto de dados reaproveitando o render normal ===== */
  var own=null;
  Core.withDataset=function(ds,fn){
    if(Core.lensDepth>0){Core.lensDepth++;try{return fn()}finally{Core.lensDepth--}}
    own={scripts:S.data.scripts,folders:S.data.folders,categories:S.data.categories};
    S.data.scripts=ds.scripts;S.data.folders=ds.folders;S.data.categories=ds.categories;Core.lensDepth=1;
    try{return fn()}finally{S.data.scripts=own.scripts;S.data.folders=own.folders;S.data.categories=own.categories;Core.lensDepth=0;own=null}
  };
  Core.withOwnData=function(fn){
    if(Core.lensDepth===0||!own)return fn();
    var cur={scripts:S.data.scripts,folders:S.data.folders,categories:S.data.categories},depth=Core.lensDepth,saved=own;
    S.data.scripts=saved.scripts;S.data.folders=saved.folders;S.data.categories=saved.categories;Core.lensDepth=0;own=null;
    try{return fn()}finally{S.data.scripts=cur.scripts;S.data.folders=cur.folders;S.data.categories=cur.categories;Core.lensDepth=depth;own=saved}
  };
  Core.ownScripts=function(){return own?own.scripts:S.data.scripts};

  /* ===== Agendador unico ===== */
  var jobs={};
  Core.pollMs=function(){var m=S.data.settings&&S.data.settings.pollMinutes;return typeof m==='number'&&m>0?m*60000:0};
  function jitter(id){var h=0;for(var i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))|0;return Math.abs(h)%60000}
  function schedule(job,failed){
    var every=job.every();
    if(failed)job.nextAt=Date.now()+Math.min((every||900000)*Math.pow(2,Math.min(job.failCount,6)),6*3600*1000);
    else job.nextAt=every?Date.now()+every+jitter(job.id):0;
  }
  function runJob(job){
    if(job.running)return job.promise;
    job.running=true;
    job.promise=Promise.resolve().then(job.run).then(function(){job.failCount=0;schedule(job,false)},function(e){job.failCount++;schedule(job,true);console.warn('Tarefa '+job.id+' falhou:',e)}).then(function(){job.running=false});
    return job.promise;
  }
  Core.addJob=function(id,opts){if(jobs[id])return;jobs[id]={id:id,run:opts.run,every:opts.every||Core.pollMs,nextAt:Date.now()+(opts.delay==null?2000:opts.delay),failCount:0,running:false}};
  Core.removeJob=function(id){delete jobs[id]};
  Core.hasJob=function(id){return!!jobs[id]};
  Core.runJob=function(id){return jobs[id]?runJob(jobs[id]):Promise.resolve()};
  Core.reschedule=function(){Object.keys(jobs).forEach(function(id){var j=jobs[id];if(!j.running)schedule(j,false)})};
  function tick(){
    if(!Core.ready||document.hidden||navigator.onLine===false)return;
    var n=Date.now();
    Object.keys(jobs).forEach(function(id){var j=jobs[id];if(!j.running&&j.nextAt&&n>=j.nextAt)runJob(j)});
  }
  Core.tick=tick;
  setInterval(tick,30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)tick()});
  window.addEventListener('online',function(){Object.keys(jobs).forEach(function(id){jobs[id].nextAt=Date.now()});tick()});

  /* ===== Inicializacao (depois que o app.js carregou o IndexedDB) ===== */
  function normalizeData(){
    var d=S.data;
    if(!Array.isArray(d.tombstones))d.tombstones=[];
    if(!d.sync||typeof d.sync!=='object')d.sync={};
    if(!d.sync.dirty||typeof d.sync.dirty!=='object')d.sync.dirty={};
    if(!Array.isArray(d.subscriptions))d.subscriptions=[];
    if(!d.settings)d.settings={remoteUrl:'',autoSync:false,lastSync:null};
    if(typeof d.settings.pollMinutes!=='number')d.settings.pollMinutes=15;
  }
  function fixIds(){
    var maps={folder:{},category:{}};
    ['category','folder','script','subscription'].forEach(function(kind){
      var seen={};
      listOf(kind).forEach(function(e){if(!e)return;if(!validId(e.id)||seen[e.id]){var n=uid();if(maps[kind])maps[kind][String(e.id)]=n;e.id=n}seen[e.id]=1});
    });
    if(Object.keys(maps.folder).length||Object.keys(maps.category).length){
      S.data.folders.forEach(function(f){if(maps.folder[f.parentId])f.parentId=maps.folder[f.parentId]});
      S.data.scripts.forEach(function(s){if(maps.folder[s.folderId])s.folderId=maps.folder[s.folderId];if(maps.category[s.categoryId])s.categoryId=maps.category[s.categoryId]});
    }
    breakFolderCycles(S.data.folders);
  }
  Core.whenReady=(window.appReady||Promise.resolve()).then(function(){
    normalizeData();fixIds();pruneTombs();rebuildShadow();Core.ready=true;
    return dbSave(S.data);
  }).then(function(){emit('ready');return true}).catch(function(e){console.error('sync-core: falha ao iniciar',e);return false});
})();
