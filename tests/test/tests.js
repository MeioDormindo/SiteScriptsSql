(async function(){
  var out=[],pass=0,fail=0;
  var A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222';
  function ok(c,msg){if(c){pass++;out.push('PASS '+msg)}else{fail++;out.push('FAIL '+msg)}live()}
  function live(){var p=document.getElementById('testLive');if(!p){p=document.createElement('pre');p.id='testLive';document.body.appendChild(p)}p.textContent='LIVE pass='+pass+' fail='+fail+'\n'+out.join('\n');post(p.textContent)}
  function post(text){try{fetch('/__result',{method:'POST',body:text})}catch(e){}}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  async function until(fn,ms){var t=Date.now();while(Date.now()-t<(ms||5000)){try{if(fn())return true}catch(e){}await sleep(40)}return false}
  async function clickChoice(key){
    var sel='#mFoot [data-choice="'+key+'"]:not([data-clicked])';
    if(!await until(function(){return document.getElementById('modalOvl').classList.contains('active')&&document.querySelector(sel)},8000))return false;
    var b=document.querySelector(sel);b.setAttribute('data-clicked','1');b.click();return true;
  }
  function report(){var pre=document.createElement('pre');pre.id='testResults';pre.textContent='RESULT pass='+pass+' fail='+fail+'\n'+out.join('\n');document.body.appendChild(pre);document.title='DONE';setTimeout(function(){post(pre.textContent)},300)}
  window.onerror=function(m,s,l){out.push('ONERROR '+m+' @'+s+':'+l)};
  window.addEventListener('unhandledrejection',function(e){out.push('UNHANDLED '+(e.reason&&e.reason.stack||e.reason))});
  var alerted=false;window.alert=function(){alerted=true};window.confirm=function(){return true};
  var origErr=console.error;console.error=function(){out.push('CONSOLE.ERROR '+Array.prototype.map.call(arguments,function(a){return a&&a.stack||String(a)}).join(' '));origErr.apply(console,arguments)};
  try{
    if(/[?&]sub=/.test(location.search)){
      await Core.whenReady;
      ok(await until(function(){var el=document.getElementById('shCode');return el&&el.value==='SQL-7K3P-9XAB'},6000),'?sub= link opens prefilled dialog');
      ok(!/sub=/.test(location.search),'?sub= removed from the URL');
      report();return;
    }
    await Core.whenReady;await sleep(300);
    ok(Core.ready,'core ready');
    ok(Array.isArray(S.data.tombstones)&&S.data.sync&&Array.isArray(S.data.subscriptions)&&S.data.settings.pollMinutes===15,'normalized fields');

    /* ===== P0: rastreamento ===== */
    var fid=uid(),f1=uid(),f2=uid(),sid=uid();
    S.data.folders.push({id:fid,name:'Raiz',parentId:null,createdAt:now()},{id:f1,name:'A',parentId:fid,createdAt:now()},{id:f2,name:'B',parentId:f1,createdAt:now()});
    S.data.scripts.push({id:sid,name:'Teste 1',content:'SELECT 1',categoryId:null,folderId:f2,createdAt:now(),updatedAt:'2026-01-01T00:00:00.000Z'});
    await save();
    var s=S.data.scripts.find(function(x){return x.id===sid});
    ok(!!s.modifiedAt,'new script stamped');
    var m1=s.modifiedAt,u1=s.updatedAt;await sleep(5);
    toggleScriptFlag(sid,'favorite');await sleep(80);
    s=S.data.scripts.find(function(x){return x.id===sid});
    ok(s.favorite===true&&s.modifiedAt>m1&&s.updatedAt===u1,'favorite bumps modifiedAt, keeps updatedAt');
    var ids=new Set();(function coll(i){ids.add(i);getChildren(i).forEach(function(c){coll(c.id)})})(fid);
    S.data.scripts.forEach(function(x){if(ids.has(x.folderId))x.folderId=null});
    S.data.folders=S.data.folders.filter(function(x){return!ids.has(x.id)});await save();
    ok(S.data.tombstones.filter(function(tb){return tb.key.indexOf('folder:')===0}).length===3,'3 folder tombstones');
    ok(S.data.scripts.find(function(x){return x.id===sid}).folderId===null,'script folder cleared');
    var exp=buildExport();ok(!('tombstones' in exp)&&!('sync' in exp)&&!('subscriptions' in exp),'export without metadata');

    /* ===== P0: sanitizacao ===== */
    var bad={categories:[{id:"x');alert(1);('",name:'<b>Cat</b>',color:'red" onmouseover="alert(1)'}],folders:[{id:'f1',name:'F1',parentId:'f2'},{id:'f2',name:'F2',parentId:'f1'}],scripts:[{id:'s1',name:'<img src=x onerror=alert(1)>',content:'SELECT 2',categoryId:"x');alert(1);('",folderId:'f1',tags:['"><svg onload=alert(1)>','Prod']}]};
    var si=Core.sanitizeImport(bad);
    ok(Core.validId(si.categories[0].id)&&si.categories[0].color==='#8888a0','bad category id/color fixed');
    ok(si.scripts[0].categoryId===si.categories[0].id,'category ref remapped');
    ok(si.folders.some(function(f){return!f.parentId}),'folder cycle broken');
    ok(si.scripts[0].tags.every(function(t){return!/[<>"]/.test(t)}),'tags sanitized '+JSON.stringify(si.scripts[0].tags));
    await processImport(JSON.stringify(bad),null);await sleep(150);render();await sleep(80);
    ok(!alerted,'no alert after malicious import');
    ok(!document.querySelector('#mainContent img[src="x"]')&&!document.querySelector('[onmouseover]'),'no injected elements');
    var imp=S.data.scripts.find(function(x){return x.name.indexOf('<img')===0});
    ok(!!imp,'malicious-named script imported as text');
    openEditScript(imp.id);await sleep(120);
    ok(!document.querySelector('#mBody svg[onload]'),'tags field escaped');
    closeModal();await sleep(80);
    var cat=S.data.categories.find(function(c){return c.name==='<b>Cat</b>'});
    deleteCat(cat.id);await sleep(50);
    ok(!document.querySelector('#confirmBox b'),'delete confirm escapes name');
    closeConfirm();

    /* ===== P1: GitHub ===== */
    var c=Sharing.githubCandidates('MeioDormindo/SiteScriptsSql');
    ok(c.length===4&&c[0]==='https://raw.githubusercontent.com/MeioDormindo/SiteScriptsSql/main/sql_scripts.json'&&/\/main\/Backup\/sql_scripts\.json$/.test(c[1]),'candidates owner/repo');
    ok(Sharing.githubCandidates('https://github.com/o/r/blob/dev/x/y.json')[0]==='https://raw.githubusercontent.com/o/r/dev/x/y.json','blob url');
    ok(Sharing.githubCandidates('https://github.com/o/r/tree/dev/sub')[0]==='https://raw.githubusercontent.com/o/r/dev/sub/sql_scripts.json','tree url');
    ok(Sharing.githubCandidates('o/r',' feature ','a/b.json')[0]==='https://raw.githubusercontent.com/o/r/feature/a/b.json','branch+path');
    ok(Sharing.githubCandidates('nope').length===0&&Sharing.githubCandidates('ftp://x/y').length===0,'invalid inputs');
    ok(Sharing.normalizeCode('sql-7k3p-9xab')==='7K3P9XAB'&&Sharing.normalizeCode('SQL7K3P9XAB')==='7K3P9XAB'&&Sharing.normalizeCode('7k3p 9xab')==='7K3P9XAB','code normalize');
    ok(Sharing.normalizeCode('SQL-0O1I-LLLL')===null,'ambiguous code rejected');
    Sharing.openSubscribeDialog();await sleep(80);
    document.querySelector('[data-tab="url"]').click();
    document.getElementById('shRepo').value='MeioDormindo/SiteScriptsSql';
    document.getElementById('shSubmit').click();
    var okSub=await until(function(){return S.data.subscriptions.length===1&&S.filter.subscriptionId},25000);
    ok(okSub,'subscribed to GitHub repo'+(okSub?'':' err='+((document.getElementById('shErr')||{}).textContent)));
    var ownCount=S.data.scripts.length;
    if(okSub){
      var sub=S.data.subscriptions[0];
      ok(/\/Backup\/sql_scripts\.json$/.test(sub.ref),'resolved '+sub.ref);
      await sleep(250);
      var cards=document.querySelectorAll('#mainContent .card');
      ok(cards.length>0,'shared cards rendered ('+cards.length+')');
      ok(!document.querySelector('#mainContent .script-card-actions'),'no star/pin on shared cards');
      ok(!!document.querySelector('#mainContent .shared-banner'),'banner shown');
      ok(S.data.scripts.length===ownCount&&Core.lensDepth===0,'lens released');
      ok(document.querySelector('#sidebarContent .sidebar-item .cnt').textContent===String(ownCount),'own count intact');
      ok(!!document.querySelector('#sidebarContent [data-sub-id].active'),'shared item active');
      onSearch('backup');await sleep(150);
      ok(window._featureTotalScripts>0&&window._featureTotalScripts<27&&!!document.querySelector('#mainContent .shared-banner'),'search works inside shared list ('+window._featureTotalScripts+')');
      onSearch('');await sleep(100);
      cards[0].click();await sleep(150);
      ok(!!document.querySelector('#mFoot [data-v="mine"]')&&!document.querySelector('#mFoot .btn-danger'),'view footer is read-only');
      document.querySelector('#mFoot [data-v="mine"]').click();await sleep(400);
      var nm=document.getElementById('sName');ok(nm&&nm.value.length>0,'copy-to-mine prefilled: '+(nm&&nm.value));
      document.querySelector('#mFoot .btn-accent').click();await sleep(500);
      ok(S.data.scripts.length===ownCount+1,'copied into own scripts');
      closeModal();await sleep(80);
      var before=S.data.scripts.length,foldersBefore=S.data.folders.length;
      document.querySelector('#mainContent [data-sh="copyall"]').click();await sleep(400);
      ok(S.data.scripts.length>before+5&&S.data.folders.length>foldersBefore,'copy entire list ('+(S.data.scripts.length-before)+' scripts)');
      var names={};var dup=S.data.scripts.some(function(x){var k=x.name.toLowerCase();if(names[k])return true;names[k]=1});
      ok(!dup,'no duplicate names after copy');
      setFilter(null,null);await sleep(80);
      ok(!S.filter.subscriptionId,'setFilter leaves shared view');
    }

    /* ===== P2/P3: nuvem (Supabase simulado) ===== */
    ok(Cloud.available()&&!Cloud.isSignedIn(),'cloud available, signed out');
    ok(document.getElementById('accountBtn').style.display!=='none','account button visible');
    try{Cloud.openAccount('signin')}catch(e){out.push('openAccount threw '+e.stack)}await sleep(80);
    if(!document.getElementById('authEmail'))out.push('DEBUG modal active='+document.getElementById('modalOvl').className+' head='+document.getElementById('mHead').textContent+' body='+document.getElementById('mBody').innerHTML.slice(0,300));
    document.getElementById('authEmail').value='a@test.dev';document.getElementById('authPass').value='errada';
    document.getElementById('authSubmit').click();await sleep(150);
    ok(document.getElementById('authErr').textContent===t('authErrInvalid'),'wrong password message');
    document.getElementById('authPass').value='senha-forte-1';document.getElementById('authSubmit').click();
    var bound=await until(function(){return S.data.sync.userId===A&&Cloud.status()==='synced'},15000);
    ok(bound,'bound and synced to A (status='+Cloud.status()+')');
    var srv=__server.rows.filter(function(r){return r.user_id===A});
    var localCount=S.data.scripts.length+S.data.folders.length+S.data.categories.length+S.data.subscriptions.length;
    ok(srv.length===localCount,'server rows == local entities ('+srv.length+' vs '+localCount+')');
    ok(srv.every(function(r){return!r.data||!('versions' in r.data)}),'versions never uploaded');
    var lid=uid();
    S.data.scripts.push({id:lid,name:'Secreto',content:'',categoryId:null,folderId:null,createdAt:now(),updatedAt:now(),locked:true,secure:{salt:'c2FsdA==',iv:'aXY=',data:'ZGF0YQ=='},versions:[{content:'texto puro antigo',savedAt:now()}]});
    await save();await Cloud.syncNow();
    var lr=__server.rows.find(function(r){return r.id===lid});
    ok(lr&&lr.data.content===''&&lr.data.locked&&lr.data.secure&&!('versions' in lr.data)&&JSON.stringify(lr).indexOf('texto puro')<0,'locked script uploaded as ciphertext only');
    var target=__server.rows.find(function(r){return r.kind==='script'&&r.id===sid});
    target.data=Object.assign({},target.data,{name:'Editado remoto',content:'SELECT 999'});target.modified_at=new Date(Date.now()+60000).toISOString();target.updated_at=new Date(Date.now()+60000).toISOString();
    await Cloud.syncNow();
    ok(S.data.scripts.find(function(x){return x.id===sid}).name==='Editado remoto','remote edit pulled');
    target.deleted=true;target.data=null;target.modified_at=new Date(Date.now()+120000).toISOString();target.updated_at=new Date(Date.now()+120000).toISOString();
    await Cloud.syncNow();
    ok(!S.data.scripts.find(function(x){return x.id===sid}),'remote delete applied');
    S.data.scripts=S.data.scripts.filter(function(x){return x.id!==lid});await save();await Cloud.syncNow();
    ok(__server.rows.find(function(r){return r.id===lid}).deleted===true,'local delete pushed as tombstone');
    ok(!S.data.tombstones.find(function(tb){return tb.key==='script:'+lid}),'tombstone dropped after push');
    var cs=S.data.scripts.find(function(x){return!x.locked});var csRow=__server.rows.find(function(r){return r.id===cs.id});
    csRow.data=Object.assign({},csRow.data,{content:'SELECT remoto vence'});csRow.modified_at=new Date(Date.now()+180000).toISOString();csRow.updated_at=new Date(Date.now()+180000).toISOString();
    var oldContent=cs.content;cs.content='SELECT local perde';S.data.sync.dirty['script:'+cs.id]=1;cs.modifiedAt=new Date(Date.now()-1000).toISOString();
    await Cloud.syncNow();
    var cs2=S.data.scripts.find(function(x){return x.id===cs.id});
    ok(cs2.content==='SELECT remoto vence'&&cs2.versions.some(function(v){return v.content==='SELECT local perde'}),'conflict: remote wins, local kept in history');

    /* ===== P4: listas por codigo ===== */
    var pf=uid();S.data.folders.push({id:pf,name:'Publicar',parentId:null,createdAt:now()});
    S.data.scripts.push({id:uid(),name:'Pub 1',content:'SELECT pub',folderId:pf,categoryId:null,createdAt:now(),updatedAt:now()});
    S.data.scripts.push({id:uid(),name:'Pub trancado',content:'',folderId:pf,locked:true,secure:{salt:'c2FsdA==',iv:'aXY=',data:'ZGF0YQ=='},createdAt:now(),updatedAt:now()});
    await save();
    var snap=Sharing.buildSnapshot(pf);
    ok(snap.snapshot.scripts.length===1&&snap.locked===1,'snapshot excludes locked');
    var row=await Cloud.publishList({name:'Minha lista',source_folder_id:pf,snapshot:snap.snapshot});
    ok(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(row.code),'published code '+row.code);
    render();await sleep(80);
    ok(!!document.querySelector('[data-ctx-folder="'+pf+'"] .pub-badge'),'published folder badge');
    Sharing.openSubscribeDialog({code:Sharing.formatCode(row.code)});await sleep(80);
    document.getElementById('shSubmit').click();
    ok(await until(function(){return S.data.subscriptions.some(function(x){return x.type==='code'})},5000),'subscribed by code');
    var l=__server.lists[0];
    await Cloud.updateList(l.id,{snapshot:Object.assign({},snap.snapshot,{scripts:snap.snapshot.scripts.concat([{id:'zz',name:'Novo',content:'SELECT novo',categoryId:null,folderId:pf,createdAt:now(),updatedAt:now(),tags:[]}])})});
    ok(__server.lists[0].version===2,'owner update bumps version');
    var csub=S.data.subscriptions.find(function(x){return x.type==='code'});
    await Core.runJob('sub:'+csub.id);
    var stt=JSON.parse(localStorage.getItem('sqlsm-substate'))[csub.id];
    ok(stt.version===2&&stt.count===2,'subscriber picked up version 2');
    await Cloud.deleteList(l.id);await Core.runJob('sub:'+csub.id);
    ok(JSON.parse(localStorage.getItem('sqlsm-substate'))[csub.id].status==='gone','unpublished list marked gone');
    await Cloud.syncNow();
    ok(__server.rows.some(function(r){return r.kind==='subscription'&&r.user_id===A}),'subscriptions synced to account');

    /* ===== Troca obrigatoria de senha ===== */
    __server.auth._emit('PASSWORD_RECOVERY',__server.session);await sleep(150);
    function modalOn(){return document.getElementById('modalOvl').classList.contains('active')}
    ok(modalOn()&&!!document.getElementById('pwResetForm'),'forced reset modal shown');
    closeModal();await sleep(50);
    ok(modalOn()&&!!document.getElementById('pwResetForm'),'closeModal blocked');
    try{openSettings()}catch(e){}await sleep(50);
    ok(!!document.getElementById('pwResetForm')&&!document.getElementById('setUrl'),'other modals blocked');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await sleep(50);
    ok(modalOn()&&!!document.getElementById('pwResetForm'),'Escape blocked');
    document.getElementById('pwNew').value='senha-forte-1';document.getElementById('pwNew2').value='senha-forte-1';document.getElementById('pwResetBtn').click();await sleep(150);
    ok(document.getElementById('pwResetErr').textContent===t('authErrSamePw'),'same password rejected');
    document.getElementById('pwNew').value='nova-senha-123';document.getElementById('pwNew2').value='nova-senha-123';document.getElementById('pwResetBtn').click();await sleep(200);
    ok(!modalOn()&&__server.calls.indexOf('updateUser')>=0&&__server.calls.indexOf('signOut:others')>=0&&!localStorage.getItem('sqlsm-pw-reset'),'password updated, other sessions ended');

    /* ===== Outra conta neste aparelho: combinar ===== */
    await Cloud.client.auth.signOut({scope:'local'});await until(function(){return!Cloud.isSignedIn()},3000);
    var t0=new Date(Date.now()-86400000).toISOString();
    DEF_CATS.forEach(function(dc,i){__server.rows.push({user_id:B,kind:'category',id:'bcat'+i,data:{id:'bcat'+i,name:dc.name,color:dc.color,createdAt:t0},deleted:false,modified_at:t0,updated_at:t0})});
    __server.rows.push({user_id:B,kind:'script',id:'bscript1',data:{id:'bscript1',name:'Remoto B',content:'SELECT b',categoryId:'bcat0',folderId:null,createdAt:t0,updatedAt:t0,tags:[],favorite:false,pinned:false,locked:false,secure:null},deleted:false,modified_at:t0,updated_at:t0});
    var localScripts=S.data.scripts.length;
    Cloud.client.auth.signInWithPassword({email:'b@test.dev',password:'senha-forte-2'});
    ok(await clickChoice('merge'),'other-account prompt shown');
    ok(await clickChoice('merge'),'first-sync prompt shown');
    var boundB=await until(function(){return S.data.sync.userId===B&&Cloud.status()==='synced'},15000);
    ok(boundB,'bound to B (status='+Cloud.status()+')');
    out.push('DEBUG userId='+S.data.sync.userId+' localScripts='+localScripts+' now='+S.data.scripts.length+' remotoB='+S.data.scripts.some(function(x){return x.name==='Remoto B'})+' dirty='+Core.dirtyCount()+' Brows='+__server.rows.filter(function(r){return r.user_id===B}).length+' calls='+__server.calls.slice(-25).join(','));
    ok(S.data.scripts.some(function(x){return x.name==='Remoto B'})&&S.data.scripts.length===localScripts+1,'merged: local + remote scripts ('+S.data.scripts.length+')');
    var catNames=S.data.categories.map(function(x){return x.name.toLowerCase()});
    ok(catNames.filter(function(n){return n==='select'}).length===1,'default categories not duplicated ('+S.data.categories.length+')');
    ok(__server.rows.filter(function(r){return r.user_id===B&&r.kind==='script'&&!r.deleted}).length===S.data.scripts.length,'B server has all scripts');
    var premerge=await Core.dbGet('premerge');ok(premerge&&premerge.data.scripts.length===localScripts,'pre-merge backup stored');

    /* ===== Excluir conta ===== */
    Cloud.openAccount();await sleep(100);
    document.querySelector('#accountViewBody [data-a="delete"]').click();await sleep(100);
    document.getElementById('pwField').value='senha-forte-2';document.getElementById('pwOk').click();
    ok(await until(function(){return!Cloud.isSignedIn()&&!__server.rows.some(function(r){return r.user_id===B})},5000),'account deleted, server rows gone');
    ok(S.data.scripts.length===localScripts+1,'local data kept after account deletion');

    /* ===== Configuracoes ===== */
    openSettings();await sleep(150);
    ok(!!document.getElementById('accountCard')&&!!document.getElementById('sharedSettingsCard'),'settings cards injected');
    var sel=document.getElementById('shPollSel');sel.value='30';sel.dispatchEvent(new Event('change'));await sleep(80);
    ok(S.data.settings.pollMinutes===30,'poll interval saved');
    closeModal();await sleep(80);

    /* ===== Remover assinatura pelo menu de contexto ===== */
    var gsub=S.data.subscriptions.find(function(x){return x.type==='url'});
    var item=document.querySelector('#sidebarContent [data-sub-id="'+gsub.id+'"]');
    item.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:40,clientY:40}));await sleep(80);
    var items=document.querySelectorAll('#ctxContainer .ctx-item');items[items.length-1].click();await sleep(80);
    document.getElementById('acOk').click();await sleep(200);
    ok(!S.data.subscriptions.some(function(x){return x.id===gsub.id})&&!document.querySelector('#sidebarContent [data-sub-id="'+gsub.id+'"]'),'subscription removed via context menu');

    /* ===== Segundo aparelho "virgem" adota a nuvem ===== */
    await Core.resetLocal();await sleep(100);
    Cloud.client.auth.signInWithPassword({email:'a@test.dev',password:'senha-forte-1'});
    ok(await until(function(){return S.data.sync.userId===A&&Cloud.status()==='synced'},15000),'fresh device adopts cloud without prompt');
    var aCats=__server.rows.filter(function(r){return r.user_id===A&&r.kind==='category'&&!r.deleted}).length;
    var aScripts=__server.rows.filter(function(r){return r.user_id===A&&r.kind==='script'&&!r.deleted}).length;
    ok(S.data.categories.length===aCats,'categories not doubled on 2nd device ('+S.data.categories.length+' vs '+aCats+')');
    ok(S.data.scripts.length===aScripts,'scripts adopted ('+S.data.scripts.length+' vs '+aScripts+')');
    ok(S.data.subscriptions.length>=1,'subscriptions came from the account');

    /* ===== Sair apagando os dados do aparelho ===== */
    Cloud.openAccount();await sleep(100);
    document.querySelector('#accountViewBody [data-a="signout"]').click();await sleep(100);
    document.getElementById('wipeLocal').checked=true;document.getElementById('signOutBtn').click();
    ok(await until(function(){return!Cloud.isSignedIn()&&S.data.scripts.length===0},6000),'sign out with wipe clears local data');
    ok(__server.rows.filter(function(r){return r.user_id===A&&r.kind==='script'&&!r.deleted}).length===aScripts,'cloud data untouched by local wipe');

    /* ===== Reset ===== */
    await Core.resetLocal();await sleep(100);render();
    ok(S.data.scripts.length===0&&S.data.tombstones.length===0&&S.data.subscriptions.length===0,'reset clears data without tombstones');
    ok(!document.querySelector('#sidebarContent [data-sub-id]'),'reset clears shared lists');
  }catch(e){out.push('EXCEPTION '+(e&&e.stack||e))}
  report();
})();
