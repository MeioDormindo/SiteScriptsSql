(async function(){
  var out=[],pass=0,fail=0;
  function post(text){try{fetch('/__result',{method:'POST',body:text})}catch(e){}}
  function ok(c,m){if(c){pass++;out.push('PASS '+m)}else{fail++;out.push('FAIL '+m)}post('LIVE pass='+pass+' fail='+fail+'\n'+out.join('\n'))}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  async function until(fn,ms){var t=Date.now();while(Date.now()-t<(ms||8000)){try{if(fn())return true}catch(e){}await sleep(100)}return false}
  window.confirm=function(){return true};
  var q=new URLSearchParams(location.search),email=q.get('e'),pw=q.get('p');
  try{history.replaceState(null,'',location.pathname)}catch(e){}
  try{
    await Core.whenReady;await sleep(800);
    ok(Cloud.available()&&!Cloud.isSignedIn(),'real Supabase client ready, signed out');
    var fid=uid(),sid=uid(),lid=uid();
    S.data.folders.push({id:fid,name:'E2E pasta',parentId:null,createdAt:now()});
    S.data.scripts.push({id:sid,name:'E2E script',content:'SELECT 42',categoryId:null,folderId:fid,createdAt:now(),updatedAt:now()});
    S.data.scripts.push({id:lid,name:'E2E trancado',content:'',categoryId:null,folderId:fid,locked:true,secure:{salt:'c2FsdA==',iv:'aXY=',data:'ZGF0YQ=='},createdAt:now(),updatedAt:now(),versions:[{content:'segredo antigo',savedAt:now()}]});
    await save();

    Cloud.openAccount('signin');await sleep(150);
    document.getElementById('authEmail').value=email;document.getElementById('authPass').value='senha-errada-123';
    document.getElementById('authSubmit').click();
    ok(await until(function(){return document.getElementById('authErr').textContent===t('authErrInvalid')},10000),'wrong password rejected by real Auth');
    document.getElementById('authPass').value=pw;document.getElementById('authSubmit').click();
    ok(await until(function(){return S.data.sync.userId&&Cloud.status()==='synced'},30000),'first sync with real Supabase (status='+Cloud.status()+')');
    var me=S.data.sync.userId;
    var localCount=S.data.scripts.length+S.data.folders.length+S.data.categories.length+S.data.subscriptions.length;
    var r=await Cloud.client.from('sync_items').select('kind,id,deleted,data,modified_at');
    ok(!r.error&&r.data.length===localCount,'server rows == local entities ('+(r.data&&r.data.length)+' vs '+localCount+')'+(r.error?' '+r.error.message:''));
    var lr=r.data.find(function(x){return x.id===lid});
    ok(lr&&lr.data.content===''&&lr.data.locked===true&&lr.data.secure&&!('versions' in lr.data)&&JSON.stringify(lr).indexOf('segredo')<0,'locked script stored as ciphertext only');
    var row=r.data.find(function(x){return x.id===sid});
    var stale=await Cloud.client.from('sync_items').upsert([{user_id:me,kind:'script',id:sid,data:Object.assign({},row.data,{name:'velho'}),deleted:false,modified_at:'2020-01-01T00:00:00Z'}],{onConflict:'user_id,kind,id'}).select('id');
    ok(!stale.error&&stale.data.length===0,'stale write ignored by LWW trigger'+(stale.error?' '+stale.error.message:''));
    var fut=new Date(Date.now()+3*86400000).toISOString();
    var ft=await Cloud.client.from('sync_items').upsert([{user_id:me,kind:'script',id:sid,data:Object.assign({},row.data,{name:'E2E futuro'}),deleted:false,modified_at:fut}],{onConflict:'user_id,kind,id'}).select('modified_at');
    ok(!ft.error&&ft.data.length===1&&Date.parse(ft.data[0].modified_at)<Date.now()+600000,'future timestamp clamped by server'+(ft.error?' '+ft.error.message:''));
    await Cloud.syncNow();
    ok(S.data.scripts.find(function(x){return x.id===sid}).name==='E2E futuro','server-side change pulled');
    S.data.scripts=S.data.scripts.filter(function(x){return x.id!==lid});await save();await Cloud.syncNow();
    var d=await Cloud.client.from('sync_items').select('deleted,data').eq('kind','script').eq('id',lid).single();
    ok(!d.error&&d.data.deleted===true&&d.data.data===null,'local delete stored as tombstone');
    var other=await Cloud.client.from('sync_items').select('id').eq('user_id','00000000-0000-0000-0000-000000000000');
    ok(!other.error&&other.data.length===0,'RLS: cannot read other users');
    var hack=await Cloud.client.from('sync_items').insert({user_id:'00000000-0000-0000-0000-000000000000',kind:'script',id:'hack',data:{},modified_at:now()});
    ok(!!hack.error,'RLS: cannot write as another user ('+(hack.error&&hack.error.code)+')');
    var del=await Cloud.client.from('sync_items').delete().eq('id',sid).select('id');
    ok(!!del.error||del.data.length===0,'no hard deletes allowed');

    var snap=Sharing.buildSnapshot(fid);
    var pub=await Cloud.publishList({name:'Lista E2E',source_folder_id:fid,snapshot:snap.snapshot});
    ok(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(pub.code)&&pub.version===1&&pub.script_count===1,'published, code '+pub.code);
    var anon=supabase.createClient(CLOUD_CONFIG.url,CLOUD_CONFIG.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'sqlsm-e2e-anon'}});
    var g=await anon.rpc('get_shared_list',{p_code:pub.code,p_known_version:null});
    ok(!g.error&&g.data.length===1&&g.data[0].snapshot.scripts.length===1,'anonymous lookup by exact code');
    var g2=await anon.rpc('get_shared_list',{p_code:pub.code,p_known_version:1});
    ok(!g2.error&&g2.data[0].snapshot===null,'unchanged version returns no snapshot');
    var g3=await anon.from('shared_lists').select('*');
    ok(!!g3.error,'anonymous cannot list shared_lists');
    Sharing.openSubscribeDialog({code:Sharing.formatCode(pub.code)});await sleep(150);
    document.getElementById('shSubmit').click();
    ok(await until(function(){return S.data.subscriptions.some(function(x){return x.type==='code'})},15000),'subscribed by code through the UI');
    var upd=await Cloud.updateList(pub.id,{snapshot:Object.assign({},snap.snapshot,{name:'Lista E2E v2'})});
    ok(upd.version===2,'republish with changes -> version 2');
    var upd2=await Cloud.updateList(pub.id,{snapshot:Object.assign({},snap.snapshot,{name:'Lista E2E v2'})});
    ok(upd2.version===2,'identical republish keeps version');
    var csub=S.data.subscriptions.find(function(x){return x.type==='code'});
    await Core.runJob('sub:'+csub.id);
    ok(JSON.parse(localStorage.getItem('sqlsm-substate'))[csub.id].version===2,'subscriber received version 2');
    await Cloud.deleteList(pub.id);await Core.runJob('sub:'+csub.id);
    ok(JSON.parse(localStorage.getItem('sqlsm-substate'))[csub.id].status==='gone','unpublished list reported as gone');
    await Cloud.syncNow();
    var subs=await Cloud.client.from('sync_items').select('id').eq('kind','subscription');
    ok(!subs.error&&subs.data.length===1,'subscription synced to the account');

    Cloud.openAccount();await sleep(200);
    document.querySelector('#accountViewBody [data-a="delete"]').click();await sleep(200);
    document.getElementById('pwField').value=pw;document.getElementById('pwOk').click();
    ok(await until(function(){return!Cloud.isSignedIn()},20000),'account deleted through the UI');
    var again=await anon.auth.signInWithPassword({email:email,password:pw});
    ok(!!again.error,'deleted user can no longer sign in');
    ok(S.data.scripts.some(function(x){return x.id===sid}),'local data kept after account deletion');
  }catch(e){out.push('EXCEPTION '+(e&&e.stack||e))}
  post('RESULT pass='+pass+' fail='+fail+'\n'+out.join('\n'));
})();
