(async function(){
  var out=[],pass=0,fail=0;
  function ok(c,m){if(c){pass++;out.push('PASS '+m)}else{fail++;out.push('FAIL '+m)}}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  var errs=[];window.addEventListener('error',function(e){errs.push(e.message)});var ce=console.error;console.error=function(){errs.push(Array.prototype.join.call(arguments,' '));ce.apply(console,arguments)};
  await Core.whenReady;await sleep(1500);
  ok(typeof window.supabase==='object'&&typeof supabase.createClient==='function','real SDK loaded from CDN (SRI ok)');
  ok(!Cloud.available(),'cloud off while config is empty');
  ok(document.getElementById('accountBtn').style.display==='none','account button hidden');
  ok(!!document.querySelector('#sidebarContent .shared-section'),'shared section present');
  openSettings();await sleep(150);
  ok(!document.getElementById('accountCard')&&!!document.getElementById('sharedSettingsCard'),'settings: no account card, shared card present');
  closeModal();await sleep(50);
  Sharing.openSubscribeDialog();await sleep(80);
  ok(document.querySelector('[data-tab="url"]').classList.contains('is-active')&&/nuvem|cloud/i.test(document.querySelector('[data-panel="code"]').textContent),'subscribe dialog defaults to GitHub tab, code tab explains cloud is needed');
  closeModal();
  ok(errs.length===0,'no console errors '+JSON.stringify(errs));
  var text='RESULT pass='+pass+' fail='+fail+'\n'+out.join('\n');
  fetch('/__result',{method:'POST',body:text});
})();
