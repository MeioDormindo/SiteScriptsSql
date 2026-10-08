(async function(){
  var phase=sessionStorage.getItem('phase')||'1';
  var out=JSON.parse(sessionStorage.getItem('out')||'[]'),pass=Number(sessionStorage.getItem('pass')||0),fail=Number(sessionStorage.getItem('fail')||0);
  function ok(c,m){if(c){pass++;out.push('PASS ['+phase+'] '+m)}else{fail++;out.push('FAIL ['+phase+'] '+m)}}
  function post(text){try{fetch('/__result',{method:'POST',body:text})}catch(e){}}
  function keep(next){sessionStorage.setItem('out',JSON.stringify(out));sessionStorage.setItem('pass',pass);sessionStorage.setItem('fail',fail);sessionStorage.setItem('phase',next);post('LIVE\n'+out.join('\n'));setTimeout(function(){location.reload()},300)}
  function raw(){return openDB().then(function(db){return new Promise(function(r){var tx=db.transaction('d','readonly'),st=tx.objectStore('d'),res={};st.get('main').onsuccess=function(e){res.main=e.target.result};st.getAllKeys().onsuccess=function(e){res.keys=e.target.result};tx.oncomplete=function(){r(res)}})})}
  function canon(d){function by(a,b){return a.id<b.id?-1:1}return JSON.stringify({s:d.scripts.slice().sort(by).map(function(s){return[s.id,s.name,s.content,s.categoryId,s.folderId,(s.tags||[]).join(','),(s.versions||[]).length,!!s.favorite]}),f:d.folders.slice().sort(by).map(function(f){return[f.id,f.name,f.parentId]}),c:d.categories.map(function(c){return[c.id,c.name,c.color]})})}
  try{
    await Core.whenReady;
    if(phase==='1'){
      var legacy={scripts:[{id:'s-a',name:'Alpha',content:'SELECT 1',categoryId:'c-z',folderId:'f-1',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-02T00:00:00.000Z',tags:['x'],versions:[{content:'old',savedAt:'2026-01-01T00:00:00.000Z'}]},{id:'s-b',name:'Beta',content:'SELECT 2',categoryId:'c-a',folderId:null,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-03T00:00:00.000Z'},{id:'s-c',name:'Gamma',content:'SELECT 3',categoryId:null,folderId:'f-1',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-04T00:00:00.000Z'}],folders:[{id:'f-1',name:'Pasta',parentId:null,createdAt:'2026-01-01T00:00:00.000Z'}],categories:[{id:'c-z',name:'Zeta (primeira)',color:'#ff0000',createdAt:'2026-01-01T00:00:00.000Z'},{id:'c-a',name:'Alfa (segunda)',color:'#00ff00',createdAt:'2026-01-01T00:00:00.000Z'},{id:'c-m',name:'Mi (terceira)',color:'#0000ff',createdAt:'2026-01-01T00:00:00.000Z'}],settings:{remoteUrl:'',autoSync:false,lastSync:null,language:'pt',theme:'dark'}};
      var db=await openDB();
      await new Promise(function(r){var tx=db.transaction('d','readwrite'),st=tx.objectStore('d');st.delete(IDBKeyRange.bound('e:','e:\uffff'));st.put(legacy,'main');tx.oncomplete=r});
      ok(true,'legacy (format 1) cache written');
      keep('2');return;
    }
    if(phase==='2'){
      var r=await raw();
      ok(window._dbFormat===2&&r.main&&r.main.format===2&&!r.main.scripts,'legacy cache converted to format 2');
      var expB={};['s-a','s-b','s-c'].forEach(function(id){expB['b:'+dbBucket(id)]=1});
      ok(r.keys.filter(function(k){return k.indexOf('b:')===0}).sort().join()===Object.keys(expB).sort().join()&&r.main.folders.length===1&&r.main.categories.length===3,'scripts in buckets ('+Object.keys(expB).length+'), folders/categories in main');
      ok(S.data.scripts.length===3&&S.data.categories.map(function(c){return c.id}).join(',')==='c-z,c-a,c-m','data intact, category order kept');
      ok((S.data.scripts.find(function(s){return s.id==='s-a'}).versions||[]).length===1,'local version history kept');
      var puts=0,dels=0,P=IDBObjectStore.prototype,op=P.put,od=P.delete;
      P.put=function(v,k){puts++;return op.apply(this,arguments)};P.delete=function(k){dels++;return od.apply(this,arguments)};
      S.data.scripts.find(function(s){return s.id==='s-b'}).favorite=true;await save();
      ok(puts===2&&dels===0,'small edit writes 1 entity + main ('+puts+' puts)');
      puts=0;dels=0;
      S.data.scripts.find(function(s){return s.id==='s-a'}).content='SELECT 1 -- editado';
      S.data.scripts=S.data.scripts.filter(function(s){return s.id!=='s-c'});
      S.data.scripts.push({id:'s-d',name:'Delta',content:'SELECT 4',categoryId:'c-m',folderId:'f-1',createdAt:now(),updatedAt:now()});
      await save();
      var touched={};['s-a','s-c','s-d'].forEach(function(id){touched[dbBucket(id)]=1});
      var nonEmpty=Object.keys(touched).filter(function(b){return S.data.scripts.some(function(s){return String(dbBucket(s.id))===b})}).length;
      ok(puts===nonEmpty+1&&dels===Object.keys(touched).length-nonEmpty,'edit+delete+create rewrites only affected buckets ('+puts+' puts/'+dels+' deletes)');
      puts=0;
      await save();
      ok(puts===1,'save without changes writes only main ('+puts+')');
      P.put=op;P.delete=od;
      ok(S.data.tombstones.some(function(t){return t.key==='script:s-c'}),'delete still produces a tombstone for sync');
      sessionStorage.setItem('expected',canon(S.data));
      keep('3');return;
    }
    if(phase==='3'){
      ok(canon(S.data)===sessionStorage.getItem('expected'),'reload restores exactly what was saved');
      ok(!S.data.scripts.some(function(s){return s.id==='s-c'})&&S.data.scripts.some(function(s){return s.id==='s-d'}),'deleted record gone, new record present');
      ok(S.data.scripts.find(function(s){return s.id==='s-a'}).content==='SELECT 1 -- editado','edited content persisted');
      sessionStorage.clear();
    }
  }catch(e){out.push('EXCEPTION ['+phase+'] '+(e&&e.stack||e))}
  post('RESULT pass='+pass+' fail='+fail+'\n'+out.join('\n'));
})();
