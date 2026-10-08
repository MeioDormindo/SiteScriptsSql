/* Layout "Novo (beta)" estilo IDE e troca de layout.
   Comum aos dois layouts: window.Layout, card "Layout" nas Configuracoes, tema guardado para a pre-pintura e Alt+N.
   So no layout novo (html[data-layout="ide"]): barra de atividades, barra de status, painel de previa acoplado,
   navegacao por teclado na lista e no explorador, menus "⋯", paleta de comandos e ajuda de atalhos.
   A previa acoplada reaproveita o proprio modal de visualizacao (#modalOvl.is-docked), entao copiar, historico,
   desbloquear script protegido e o rodape das listas compartilhadas continuam funcionando sem codigo novo. */
(function(){
  var doc=document,html=doc.documentElement;
  var IDE=html.getAttribute('data-layout')==='ide',TRIAL=html.hasAttribute('data-layout-trial');
  var K={layout:'sqlsm-layout',theme:'sqlsm-theme',keys:'sqlsm-keys-single',expl:'sqlsm-ide-explorer',prev:'sqlsm-ide-preview',recent:'sqlsm-palette-recent'};
  var MAC=/Mac|iPhone|iPad/i.test(navigator.platform||navigator.userAgent||'');
  var SHARED_ID=/^s[0-9a-f]{10}_\d+$/;
  function $(id){return doc.getElementById(id)}
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}
  function tx(key,vars){var s=t(key);Object.keys(vars||{}).forEach(function(k){s=s.split('{'+k+'}').join(vars[k])});return s}
  function attr(el,name,val){if(!el)return;if(val===null||val===undefined){if(el.hasAttribute(name))el.removeAttribute(name)}else if(el.getAttribute(name)!==String(val))el.setAttribute(name,String(val))}
  function svg(d,size){size=size||18;return'<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+d+'</svg>'}
  function nameOf(l){return t(l==='ide'?'layoutIde':'layoutClassic')}
  function focusEl(el){return window.A11y?A11y.focusEl(el):(el&&el.focus(),true)}
  function visible(el){return!!(el&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length))}
  function typing(el){return!!(el&&(/^(input|textarea|select)$/i.test(el.tagName)||el.isContentEditable))}
  function forcedReset(){return!!$('pwResetForm')}
  function paletteOpen(){var p=$('idePalette');return!!(p&&!p.hidden)}
  function dialogOpen(){var o=$('modalOvl'),c=$('confirmOvl');return!!(c&&c.classList.contains('active'))||!!(o&&o.classList.contains('active')&&!o.classList.contains('is-docked'))||paletteOpen()}
  var I={
    folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    palette:'<path d="m5 7 5 5-5 5M12 17h7"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    pin:'<path d="M12 16v5M8.5 3h7l-1 6 3.5 3v2H6v-2l3.5-3z"/>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cloud:'<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.6-2.4 2.2-2.4 3.7M12 17.2h.01"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    sync:'<path d="M21 4v6h-6M3 20v-6h6"/><path d="M5.5 9a7.5 7.5 0 0 1 12.7-2.6L21 10M3 14l2.8 3.6A7.5 7.5 0 0 0 18.5 15"/>',
    download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    view:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    layout:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M3 9h6"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    tag:'<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
  };

  /* ===================== Comum aos dois layouts ===================== */
  var Layout=window.Layout={
    current:IDE?'ide':'classic',
    trial:TRIAL,
    saved:function(){return lsGet(K.layout)==='ide'?'ide':'classic'},
    singleKeys:function(){return lsGet(K.keys)!=='0'},
    reload:function(){location.reload()},
    /* Salva a escolha (Classico = sem chave), tira o ?layout= do endereco e recarrega quando os dados ja estao salvos. */
    apply:function(name){
      lsSet(K.layout,name==='ide'?'ide':null);
      try{var u=new URL(location.href);if(u.searchParams.has('layout')){u.searchParams.delete('layout');history.replaceState(null,'',u.pathname+u.search+u.hash)}}catch(e){}
      Promise.resolve(window.Core&&Core.whenReady).then(function(){setTimeout(function(){Layout.reload()},50)});
    }
  };
  /* O tema salvo vai para o localStorage para o script do <head> pintar a pagina ja com ele (sem piscar escuro). */
  function mirrorTheme(){var th=window.S&&S.data&&S.data.settings&&S.data.settings.theme;if(th==='dark'||th==='light')lsSet(K.theme,th)}
  if(window.Core){Core.on('saved',mirrorTheme);Core.whenReady.then(mirrorTheme)}

  /* Alt+N: novo script (Ctrl+N e reservado pelos navegadores). */
  window.addEventListener('keydown',function(e){
    if(!e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.code!=='KeyN'||e.isComposing)return;
    if(dialogOpen()||forcedReset())return;
    e.preventDefault();e.stopPropagation();openNewScript();
  });

  function injectLayoutCard(){
    var wrap=doc.querySelector('#mBody > div');if(!wrap||!$('setUrl')||$('layoutCard'))return;
    var saved=Layout.saved(),card=doc.createElement('div');card.id='layoutCard';card.className='set-card';
    function radio(v){return'<label class="auth-check"><input type="radio" name="layoutPick" value="'+v+'"'+(Layout.current===v?' checked':'')+'> '+esc(nameOf(v))+'</label>'}
    card.innerHTML='<div class="set-title" id="layoutCardTitle">'+svg(I.layout,14).replace('currentColor','var(--acc)')+esc(t('layoutTitle'))+'</div>'+
      '<div role="radiogroup" aria-labelledby="layoutCardTitle" aria-describedby="layoutCardDesc" style="display:flex;flex-direction:column;gap:6px">'+radio('classic')+radio('ide')+'</div>'+
      '<p class="auth-note" id="layoutCardDesc">'+esc(t('layoutDesc'))+'</p>'+
      (TRIAL?'<p class="auth-note">'+esc(tx('layoutTrial',{name:nameOf(Layout.current),saved:nameOf(saved)}))+'</p>':'')+
      (IDE?'<label class="auth-check"><input type="checkbox" id="layoutSingleKeys"'+(Layout.singleKeys()?' checked':'')+'> '+esc(t('singleKeys'))+'</label>':'')+
      '<div class="btn-row"><button type="button" class="btn btn-sm btn-accent" id="layoutApply">'+esc(t('layoutApply'))+'</button>'+
      (Layout.current!==saved?'<button type="button" class="btn btn-sm" id="layoutKeep">'+esc(t('layoutKeep'))+'</button>':'')+'</div>';
    wrap.appendChild(card);
    var apply=card.querySelector('#layoutApply');
    function picked(){var r=card.querySelector('input[name="layoutPick"]:checked');return r?r.value:Layout.current}
    function sync(){var p=picked();apply.disabled=p===Layout.current&&p===saved}
    card.querySelectorAll('input[name="layoutPick"]').forEach(function(r){r.addEventListener('change',sync)});
    apply.addEventListener('click',function(){Layout.apply(picked())});
    var keep=card.querySelector('#layoutKeep');if(keep)keep.addEventListener('click',function(){Layout.apply(Layout.current)});
    var sk=card.querySelector('#layoutSingleKeys');if(sk)sk.addEventListener('change',function(){lsSet(K.keys,sk.checked?null:'0')});
    sync();
  }
  var prevSettings=window.openSettings;
  window.openSettings=function(){var r=prevSettings.apply(this,arguments);injectLayoutCard();setTimeout(injectLayoutCard,0);return r};

  if(!IDE)return;

  /* ===================== Layout novo (IDE) ===================== */
  var appEl=$('app'),body=$('appBody'),header=$('appHeader'),main=$('mainContent'),sc=$('sidebarContent'),sidebar=$('sidebar');
  var ovl=$('modalOvl'),box=$('modalBox'),mHead=$('mHead'),mBody=$('mBody');
  if(!appEl||!body||!header||!main||!sc||!ovl||!box||!mHead)return;
  var mqWide=window.matchMedia('(min-width:1100px)'),mqMobile=window.matchMedia('(max-width:768px)');
  var selectedId=null,lastDockedId=null,loadFailed=false;
  function explorerOn(){return lsGet(K.expl)!=='off'}
  function previewOn(){return lsGet(K.prev)!=='off'}
  function canDock(){return mqWide.matches&&previewOn()}
  function dockedOpen(){return ovl.classList.contains('active')&&ovl.classList.contains('is-docked')}
  function loaded(){return window._dbFormat!==undefined||loadFailed}
  function applyPanels(){html.setAttribute('data-ide-explorer',explorerOn()?'on':'off');html.setAttribute('data-ide-preview',previewOn()?'on':'off')}
  var renderTimer=null;
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(function(){if(window.S&&S.data)render()},40)}
  function rove(list,cur){list.forEach(function(el){el.tabIndex=el===cur?0:-1})}
  function ownScripts(){return window.Core&&Core.ownScripts?Core.ownScripts():S.data.scripts}

  /* ----- Estrutura ----- */
  applyPanels();
  var searchWrap=$('searchWrap');
  if(searchWrap&&!searchWrap.querySelector('.ide-search-kbd'))searchWrap.insertAdjacentHTML('beforeend','<kbd class="ide-kbd ide-search-kbd" aria-hidden="true">/</kbd>');
  var cmdBtn=doc.createElement('button');cmdBtn.type='button';cmdBtn.id='ideCmdBtn';cmdBtn.className='btn btn-sm btn-ghost';
  cmdBtn.setAttribute('aria-keyshortcuts',MAC?'Meta+K':'Control+K');
  cmdBtn.innerHTML=svg(I.palette,15)+'<span class="ide-cmd-label"></span><kbd class="ide-kbd" aria-hidden="true">'+(MAC?'⌘ K':'Ctrl K')+'</kbd>';
  if(searchWrap)searchWrap.insertAdjacentElement('afterend',cmdBtn);
  cmdBtn.addEventListener('click',function(){openPalette()});

  var ACTS=[['explorer',I.folder],['palette',I.palette],['favorite',I.star],['pinned',I.pin],['locked',I.lock],['shared',I.cloud],null,['preview',I.panel],['help',I.help]];
  var act=doc.createElement('div');act.id='ideActivity';act.setAttribute('role','toolbar');act.setAttribute('aria-orientation','vertical');
  act.innerHTML=ACTS.map(function(a){
    if(!a)return'<div class="ide-act-sep" role="presentation"></div>';
    return'<button type="button" class="ide-act" data-act="'+a[0]+'" tabindex="-1">'+svg(a[1],20)+(a[0]==='locked'?'<span class="ide-act-badge" aria-hidden="true"></span>':'')+'</button>';
  }).join('');
  appEl.insertBefore(act,body);
  var actBtns=Array.prototype.slice.call(act.querySelectorAll('.ide-act'));
  actBtns[0].tabIndex=0;
  function actBtn(id){return act.querySelector('[data-act="'+id+'"]')}
  attr(actBtn('explorer'),'aria-controls','sidebar');

  var slot=doc.createElement('div');slot.id='idePreviewSlot';
  slot.innerHTML=svg(I.file,40)+'<div class="ide-pv-title"></div><div class="ide-pv-hint"></div>';
  body.appendChild(slot);

  var status=doc.createElement('footer');status.id='ideStatus';
  status.innerHTML='<button type="button" class="ide-st" id="ideStSync"><span class="sync-dot" data-state="off" aria-hidden="true"></span><span class="ide-st-text"></span></button>'+
    '<span class="ide-st ide-st-ctx" id="ideStCtx"><span></span></span><span class="ide-st ide-st-count" id="ideStCount"></span><span class="ide-st-spacer"></span>'+
    '<button type="button" class="ide-st" id="ideStView">'+svg(I.view,14)+'<span></span></button>'+
    '<button type="button" class="ide-st" id="ideStLayout">'+svg(I.layout,14)+'<span></span></button>'+
    '<button type="button" class="ide-st" id="ideStHelp" aria-keyshortcuts="?">'+svg(I.help,14)+'<span></span></button>';
  appEl.appendChild(status);

  function labelShell(){
    var mod=MAC?'⌘':'Ctrl';
    attr(act,'aria-label',t('ideActivity'));
    var labels={explorer:[t('ideExplorer')],palette:[t('idePalette'),mod+'+K'],favorite:[t('favoritesFilter')],pinned:[t('pinnedFilter')],locked:[t('protectedFilter')],shared:[t('shSection')],preview:[t('idePreviewPanel')],help:[t('ideShortcuts'),'?']};
    actBtns.forEach(function(b){var l=labels[b.dataset.act];attr(b,'aria-label',l[0]);attr(b,'title',l[1]?l[0]+' ('+l[1]+')':l[0])});
    cmdBtn.querySelector('.ide-cmd-label').textContent=t('ideCommands');attr(cmdBtn,'title',t('idePalette')+' ('+mod+'+K)');attr(cmdBtn,'aria-label',t('ideCommands'));
    slot.querySelector('.ide-pv-title').textContent=t('pvEmpty');slot.querySelector('.ide-pv-hint').textContent=t('pvEmptyHint');
    attr(status,'aria-label',t('ideStatusBar'));
    [['importTxtBtn','importTxt'],['importDbBtn','importDB'],['backupBtn','backupDB'],['syncBtn','a11ySyncRemote'],['themeBtn','cmdTheme'],['settingsBtn','settings']].forEach(function(p){attr($(p[0]),'title',t(p[1]))});
    attr($('newScriptBtn'),'title',t('newScript')+' (Alt+N)');attr($('newScriptBtn'),'aria-keyshortcuts','Alt+N');
    var si=$('searchInput');if(si){si.placeholder=t('ideFilterPh');attr(si,'aria-keyshortcuts','/')}
    if(pal)labelPalette();
  }

  /* ----- Barra de status ----- */
  function syncInfo(){
    var C=window.Cloud;
    if(!C||!C.available||!C.available())return{state:'off',text:t('stLocal'),act:null};
    if(!C.isSignedIn())return{state:'off',text:t('stSignIn'),act:'signin'};
    var s=C.status(),text=C.statusText?C.statusText():'';
    if(s==='error')return{state:s,text:t('stSyncError'),title:text,act:'sync'};
    if(s==='pending'||s==='offline')return{state:s,text:text||t('syncPending'),act:'sync'};
    if(s==='syncing')return{state:s,text:text||t('syncRunning'),act:'account'};
    if(s==='synced')return{state:s,text:text||t('syncSynced'),act:'account'};
    var u=C.user&&C.user();return{state:'off',text:u&&u.email||t('accTitle'),act:'account'};
  }
  function contextText(){
    var f=S.filter,parts=[];
    if(f.subscriptionId){var sub=(S.data.subscriptions||[]).find(function(s){return s.id===f.subscriptionId});parts.push(tx('stList',{name:sub?sub.name:''})+' · '+t('shReadOnly'))}
    else if(f.folderId==='__none__')parts.push(t('noFolder'));
    else if(f.folderId)parts.push(tx('stFolder',{name:(getFolderPath(f.folderId)||'').split(' / ').join(' › ')}));
    else if(f.categoryId==='__none__')parts.push(t('noCatLabel'));
    else if(f.categoryId){var c=S.data.categories.find(function(x){return x.id===f.categoryId});parts.push(tx('stCategory',{name:c?c.name:''}))}
    else parts.push(t('allScripts'));
    if(f.search)parts.push(tx('stSearch',{q:f.search}));
    if(f.quickFavorite)parts.push(t('favoritesFilter'));if(f.quickPinned)parts.push(t('pinnedFilter'));if(f.quickLocked)parts.push(t('protectedFilter'));
    return parts.join(' · ');
  }
  function countText(){var n=window._featureTotalScripts||0;return S.filter.subscriptionId?tx('stCountList',{n:n}):tx('stCount',{n:n,total:ownScripts().length})}
  function currentView(){var fv=$('featureView');if(fv)return fv.value;try{return JSON.parse(localStorage.getItem('sqlScriptFeatures')||'{}').view||'list'}catch(e){return'list'}}
  function viewName(v){return t(v==='cards'?'blocksView':v==='table'?'tableView':'rowsView')}
  function setView(v){var fv=$('featureView');if(!fv)return;fv.value=v;fv.dispatchEvent(new Event('change'))}
  var lastState=null;
  function updateStatus(){
    var info=syncInfo(),sb=$('ideStSync');
    sb.querySelector('.sync-dot').setAttribute('data-state',info.state);
    sb.querySelector('.ide-st-text').textContent=info.text;
    attr(sb,'title',info.title||info.text);attr(sb,'aria-label',tx('a11ySyncStatus',{s:info.text}));
    attr(sb,'aria-disabled',info.act?null:'true');sb.setAttribute('data-act',info.act||'');
    if(lastState!==null&&info.state!==lastState&&(info.state==='error'||info.state==='offline')&&window.A11y)A11y.announce(info.text);
    lastState=info.state;
    var ctxEl=$('ideStCtx').firstChild,ready=loaded()&&window.S&&S.data;
    ctxEl.textContent=ready?contextText():'';attr($('ideStCtx'),'title',ctxEl.textContent||null);
    $('ideStCount').textContent=ready?countText():t('stLoading');
    var v=$('ideStView'),hasView=!!$('featureView');
    v.querySelector('span').textContent=viewName(currentView());attr(v,'aria-label',t('viewMode')+': '+viewName(currentView()));attr(v,'aria-disabled',hasView?null:'true');attr(v,'title',t('viewMode'));
    var l=$('ideStLayout');l.querySelector('span').textContent=tx('stLayout',{name:t('layoutIde')})+(TRIAL?' · '+t('stTrial'):'');attr(l,'title',t('cmdLayoutClassic'));
    $('ideStHelp').querySelector('span').textContent=t('ideShortcuts');
  }
  function backToClassic(){
    if(!window.FP){Layout.apply('classic');return}
    FP.askConfirm(esc(t('layoutBackConfirm')),esc(t('layoutBack')),false).then(function(ok){if(ok)Layout.apply('classic')});
  }
  status.addEventListener('click',function(e){
    var b=e.target.closest('button');if(!b||b.getAttribute('aria-disabled')==='true')return;
    if(b.id==='ideStSync'){var a=b.getAttribute('data-act');if(a==='signin')Cloud.openAccount('signin');else if(a==='sync')Cloud.syncNow(true);else if(a==='account')Cloud.openAccount()}
    else if(b.id==='ideStView'){var order=['list','cards','table'],cur=order.indexOf(currentView());setView(order[(cur+1)%order.length])}
    else if(b.id==='ideStLayout')backToClassic();
    else if(b.id==='ideStHelp')openHelp();
  });

  /* ----- Barra de atividades ----- */
  function explorerVisible(){return mqMobile.matches?sidebar.classList.contains('open'):explorerOn()}
  function syncActivity(){
    if(!window.S||!S.filter)return;
    attr(actBtn('explorer'),'aria-expanded',explorerVisible());
    attr(actBtn('favorite'),'aria-pressed',!!S.filter.quickFavorite);
    attr(actBtn('pinned'),'aria-pressed',!!S.filter.quickPinned);
    attr(actBtn('locked'),'aria-pressed',!!S.filter.quickLocked);
    attr(actBtn('shared'),'aria-pressed',!!S.filter.subscriptionId);
    attr(actBtn('preview'),'aria-pressed',previewOn());
    var n=ownScripts().filter(function(s){return s.locked}).length;actBtn('locked').querySelector('.ide-act-badge').textContent=n?String(n):'';
  }
  function toggleExplorer(){
    if(mqMobile.matches){toggleSidebar();syncActivity();return}
    var on=!explorerOn();lsSet(K.expl,on?null:'off');applyPanels();
    if(!on&&sidebar.contains(doc.activeElement))focusEl(actBtn('explorer'));
    syncActivity();scheduleRender();
  }
  function togglePreviewPanel(){
    lsSet(K.prev,previewOn()?'off':null);applyPanels();syncDock();syncActivity();scheduleRender();
  }
  function focusExplorer(){
    if(!explorerVisible())toggleExplorer();
    setTimeout(function(){var it=sc.querySelector('.sidebar-item[tabindex="0"]')||sc.querySelector('.sidebar-item');if(it)focusEl(it)},mqMobile.matches?80:0);
  }
  function focusShared(){
    var it=sc.querySelector('[data-sub-id]');
    if(!it){if(window.Sharing)Sharing.openSubscribeDialog();return}
    if(!explorerVisible())toggleExplorer();
    setTimeout(function(){var el=sc.querySelector('.sidebar-item.active[data-sub-id]')||sc.querySelector('[data-sub-id]');if(el){rove(Array.prototype.slice.call(sc.querySelectorAll('.sidebar-item')),el);focusEl(el)}},mqMobile.matches?80:0);
  }
  function focusList(){var o=main.querySelector('[data-a11y-open][tabindex="0"]')||main.querySelector('[data-a11y-open]');focusEl(o||main)}
  function focusSearch(){var si=$('searchInput');if(si){focusEl(si);si.select()}}
  function runAct(id){
    if(id==='explorer')toggleExplorer();
    else if(id==='palette')openPalette();
    else if(id==='favorite'||id==='pinned'||id==='locked')toggleQuickFilter(id);
    else if(id==='shared')focusShared();
    else if(id==='preview')togglePreviewPanel();
    else if(id==='help')openHelp();
  }
  act.addEventListener('click',function(e){var b=e.target.closest('.ide-act');if(!b)return;rove(actBtns,b);runAct(b.dataset.act)});
  act.addEventListener('keydown',function(e){
    var i=actBtns.indexOf(doc.activeElement),n=null;if(i<0)return;
    if(e.key==='ArrowDown'||e.key==='ArrowRight')n=(i+1)%actBtns.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')n=(i-1+actBtns.length)%actBtns.length;
    else if(e.key==='Home')n=0;else if(e.key==='End')n=actBtns.length-1;else return;
    e.preventDefault();e.stopPropagation();rove(actBtns,actBtns[n]);focusEl(actBtns[n]);
  });

  /* ----- Lista: selecao, teclado, vazio e carregando ----- */
  function listOpens(){return Array.prototype.slice.call(main.querySelectorAll('[data-a11y-open]'))}
  function cardOf(el){return el&&el.closest&&el.closest('#mainContent .card')}
  function idOf(el){var c=cardOf(el);return c?c.getAttribute('data-a11y-id'):null}
  function select(id,focusRow){
    selectedId=id;var opens=[],target=null;
    main.querySelectorAll('.card').forEach(function(c){
      var on=!!id&&c.getAttribute('data-a11y-id')===id;attr(c,'aria-current',on?'true':null);
      var o=c.querySelector('[data-a11y-open]');if(o){opens.push(o);if(on)target=o}
    });
    if(!target)return;
    rove(opens,target);
    if(focusRow){var a=doc.activeElement;if(!a||a===doc.body||main.contains(a))focusEl(target)}
  }
  function showSkeleton(){
    if(main.querySelector('.ide-skel'))return;
    var rows='';for(var i=0;i<8;i++)rows+='<div class="ide-skel-row"><div class="ide-skel-bar" style="width:'+(26+(i*37)%40)+'%"></div><div class="ide-skel-bar" style="width:'+(48+(i*23)%38)+'%;opacity:.6"></div></div>';
    main.innerHTML='<div class="ide-skel" role="status" aria-label="'+esc(t('stLoading'))+'">'+rows+'</div>';
  }
  function filtersActive(){var f=S.filter;return!!(f.search||(f.folderId!==null&&f.folderId!==undefined)||(f.categoryId!==null&&f.categoryId!==undefined)||f.quickFavorite||f.quickPinned||f.quickLocked||f.subscriptionId)}
  function clearFilters(){
    var si=$('searchInput');if(si)si.value='';
    S.filter.search='';S.filter.quickFavorite=false;S.filter.quickPinned=false;S.filter.quickLocked=false;
    S.filter.folderId=null;S.filter.categoryId=null;S.filter.subscriptionId=null;
    if(window.FP)FP.resetPage();render();
  }
  function emptyExtras(){
    var empty=main.querySelector(':scope>.empty-state');
    if(!empty||S.filter.subscriptionId||empty.hasAttribute('data-ide'))return;
    empty.setAttribute('data-ide','1');
    var kids=empty.children,btns=kids[3];
    if(filtersActive()&&ownScripts().length){
      if(kids[1])kids[1].textContent=t('emptyFiltered');
      if(kids[2])kids[2].textContent=contextText();
      if(btns){
        btns.querySelectorAll('.btn-accent').forEach(function(b){b.classList.remove('btn-accent')});
        var b=doc.createElement('button');b.type='button';b.className='btn btn-accent';b.innerHTML=svg(I.filter,14)+esc(t('cmdClearFilters'));
        b.addEventListener('click',clearFilters);btns.insertBefore(b,btns.firstChild);
      }
    }
    var hint=doc.createElement('div');hint.className='ide-empty-hint';hint.textContent=tx('emptyHint',{mod:MAC?'⌘':'Ctrl'});empty.appendChild(hint);
  }
  function decorateMain(){
    if(!loaded()){showSkeleton();updateStatus();return}
    var opens=[],cur=null,a=doc.activeElement;
    main.querySelectorAll('.card').forEach(function(card){
      var id=card.getAttribute('data-a11y-id'),on=!!selectedId&&id===selectedId;attr(card,'aria-current',on?'true':null);
      var acts=card.querySelector('.script-card-actions');if(acts)acts.querySelectorAll('button').forEach(function(b){b.tabIndex=-1});
      var o=card.querySelector('[data-a11y-open]');
      if(o){attr(o,'aria-keyshortcuts','Enter E C F P Delete');opens.push(o);if(on&&!cur)cur=o}
    });
    var focused=opens.indexOf(a)>=0?a:null;
    if(opens.length)rove(opens,focused||cur||opens[0]);
    emptyExtras();updateStatus();syncActivity();
  }
  var mainDepth=0,prevMain=window.renderMain;
  window.renderMain=function(){mainDepth++;try{return prevMain.apply(this,arguments)}finally{mainDepth--;if(!mainDepth){try{decorateMain()}catch(e){console.error(e)}}}};

  function neighbor(opens,i,key){
    var grid=main.querySelector('.script-grid'),cols=1;
    if(grid&&opens.length){var top=cardOf(opens[0]).offsetTop;cols=0;for(var j=0;j<opens.length;j++){if(cardOf(opens[j]).offsetTop===top)cols++;else break}cols=Math.max(1,cols)}
    var d=key==='ArrowDown'?cols:key==='ArrowUp'?-cols:grid&&key==='ArrowRight'?1:grid&&key==='ArrowLeft'?-1:0;
    if(!d)return null;
    var n=i+d;return n<0||n>=opens.length?i:n;
  }
  var followTimer=null;
  function moveTo(o,follow){
    if(!o)return;rove(listOpens(),o);focusEl(o);
    try{(cardOf(o)||o).scrollIntoView({block:'nearest'})}catch(e){}
    if(follow&&dockedOpen()){
      clearTimeout(followTimer);
      followTimer=setTimeout(function(){var id=idOf(o);if(id&&o.isConnected&&id!==selectedId&&dockedOpen()&&doc.activeElement===o)openViewScript(id)},150);
    }
  }
  function page(dir){
    var p=$('scriptPagination'),label=dir>0?'›':'‹',b=p&&Array.prototype.slice.call(p.querySelectorAll('button')).find(function(x){return x.textContent.trim()===label});
    if(!b)return;b.click();
    var l=listOpens();moveTo(dir>0?l[0]:l[l.length-1],false);
  }
  /* Teclas de uma letra (ativas so com foco na linha ou na previa). */
  function act_(key,id){
    var k=key.length===1?key.toLowerCase():key;
    if(['e','c','f','p','Delete'].indexOf(k)<0||!id)return false;
    if(SHARED_ID.test(id)&&k!=='c'){showToast(tx('pvReadOnly',{btn:t('shCopyToMine')}),'info');return true}
    if(k==='e')openEditScript(id);
    else if(k==='c')copyContent(id);
    else if(k==='f')toggleScriptFlag(id,'favorite');
    else if(k==='p')toggleScriptFlag(id,'pinned');
    else deleteScript(id);
    return true;
  }
  main.addEventListener('keydown',function(e){
    var o=e.target;if(!o.hasAttribute||!o.hasAttribute('data-a11y-open'))return;
    if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
    var opens=listOpens(),i=opens.indexOf(o),k=e.key,handled=true;
    if(k==='ArrowDown'||k==='ArrowUp'||k==='ArrowLeft'||k==='ArrowRight'){var n=neighbor(opens,i,k);if(n===null)handled=false;else moveTo(opens[n],true)}
    else if(k==='Home')moveTo(opens[0],true);
    else if(k==='End')moveTo(opens[opens.length-1],true);
    else if(k==='PageDown'||k==='PageUp')page(k==='PageDown'?1:-1);
    else if(Layout.singleKeys()&&!e.shiftKey&&act_(k,idOf(o))){}
    else handled=false;
    if(handled){e.preventDefault();e.stopPropagation()}
  });

  /* ----- Explorador ----- */
  function itemName(it){var spans=it.querySelectorAll('span:not(.cnt)');for(var i=0;i<spans.length;i++){var s=spans[i].textContent.trim();if(s)return s}return it.textContent.trim()}
  function decorateSidebar(){
    var items=Array.prototype.slice.call(sc.querySelectorAll('.sidebar-item'));
    items.forEach(function(it){
      if(!it.matches('[data-ctx-folder],[data-ctx-type],[data-sub-id]')||it.querySelector('.ide-more'))return;
      var b=doc.createElement('button');b.type='button';b.className='ide-more';b.tabIndex=-1;b.setAttribute('aria-hidden','true');b.textContent='⋯';
      b.title=tx('a11yMoreActions',{name:itemName(it)});
      b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();if(window.A11y)A11y.openMenuFor(it,b)});
      it.appendChild(b);
    });
    var a=doc.activeElement,cur=items.indexOf(a)>=0?a:sc.querySelector('.sidebar-item.active')||items[0];
    if(items.length)rove(items,cur);
    syncActivity();
  }
  var sideDepth=0,prevSide=window.renderSidebar;
  window.renderSidebar=function(){sideDepth++;try{return prevSide.apply(this,arguments)}finally{sideDepth--;if(!sideDepth){try{decorateSidebar()}catch(e){console.error(e)}}}};
  sc.addEventListener('keydown',function(e){
    var it=e.target;if(!it.classList||!it.classList.contains('sidebar-item')||e.ctrlKey||e.metaKey||e.altKey)return;
    var all=Array.prototype.slice.call(sc.querySelectorAll('.sidebar-item')),items=all.filter(visible),i=items.indexOf(it),n=null;
    var folder=it.getAttribute('data-ctx-folder'),cat=it.getAttribute('data-ctx-type')==='cat'?it.getAttribute('data-ctx-id'):null;
    if(e.key==='ArrowDown')n=Math.min(i+1,items.length-1);else if(e.key==='ArrowUp')n=Math.max(i-1,0);
    else if(e.key==='Home')n=0;else if(e.key==='End')n=items.length-1;
    else if(e.key==='F2'&&(folder||cat)){e.preventDefault();e.stopPropagation();if(folder)openFolderModal(folder);else openCatModal(cat);return}
    else if(e.key==='Delete'&&Layout.singleKeys()&&(folder||cat)){e.preventDefault();e.stopPropagation();if(folder)deleteFolder(folder);else deleteCat(cat);return}
    else return;
    e.preventDefault();e.stopPropagation();
    if(items[n]){rove(all,items[n]);focusEl(items[n]);try{items[n].scrollIntoView({block:'nearest'})}catch(x){}}
  });

  /* ----- Previa acoplada ----- */
  var viewNext=false,dockNext=false;
  var prevView=window.openViewScript;
  window.openViewScript=function(id){
    viewNext=true;dockNext=canDock();
    try{return prevView.apply(this,arguments)}
    finally{
      viewNext=false;dockNext=false;
      var f=mHead.firstElementChild;
      if(ovl.classList.contains('active')&&f&&f.__ideView){if(ovl.classList.contains('is-docked'))lastDockedId=id;select(id,true);addTagsChip(id)}
    }
  };
  var prevOpen=window.openModal;
  window.openModal=function(){
    var view=viewNext,dock=dockNext;viewNext=false;dockNext=false;
    var before=mHead.firstElementChild,r=prevOpen.apply(this,arguments),f=mHead.firstElementChild;
    if(f!==before){
      if(f&&view){f.__ideView=1;if(dock)f.__ideDock=1}
      ovl.classList.toggle('is-docked',!!(f&&view&&dock));
    }
    return r;
  };
  /* Conteudo que nao veio do openViewScript (dialogos proprios da nuvem, por exemplo) nunca fica acoplado. */
  new MutationObserver(function(){var f=mHead.firstElementChild;if(ovl.classList.contains('is-docked')&&!(f&&f.__ideDock))ovl.classList.remove('is-docked')}).observe(mHead,{childList:true});
  function syncDock(){
    var f=mHead.firstElementChild;if(!ovl.classList.contains('active')||!f||!f.__ideView)return;
    var want=canDock();f.__ideDock=want?1:0;
    if(want!==ovl.classList.contains('is-docked')){ovl.classList.toggle('is-docked',want);if(want)lastDockedId=selectedId}
  }
  if(mqWide.addEventListener)mqWide.addEventListener('change',syncDock);else if(mqWide.addListener)mqWide.addListener(syncDock);
  function addTagsChip(id){
    var s=S.data.scripts.find(function(x){return x.id===id});if(!s||!Array.isArray(s.tags)||!s.tags.length)return;
    var meta=mBody&&mBody.querySelector('.view-meta');if(!meta||meta.querySelector('.ide-tags-chip'))return;
    var c=doc.createElement('div');c.className='view-meta-item ide-tags-chip';c.innerHTML=svg(I.tag,11);c.appendChild(doc.createTextNode(s.tags.map(function(x){return'#'+x}).join(' ')));meta.appendChild(c);
  }
  /* Editar, historico, ajuda, configuracoes ou um dialogo da nuvem abrem por cima da previa; ao fechar, a previa volta.
     Se quem fechou foi a propria previa (X, Esc, excluir), ela fica fechada. */
  var wasActive=ovl.classList.contains('active'),wasDocked=ovl.classList.contains('is-docked'),restoreTimer=null;
  new MutationObserver(function(){
    var active=ovl.classList.contains('active'),docked=ovl.classList.contains('is-docked');
    if(wasActive&&!active){
      var closedDocked=wasDocked;clearTimeout(restoreTimer);
      restoreTimer=setTimeout(function(){
        if(ovl.classList.contains('active'))return;
        if(closedDocked||!lastDockedId||!canDock()){if(closedDocked){lastDockedId=null;select(null)}return}
        if($('confirmOvl').classList.contains('active'))return;
        var id=lastDockedId;openViewScript(id);
        if(!dockedOpen()){lastDockedId=null;select(null)}
      },150);
    }
    wasActive=active;wasDocked=docked;
    attr(slot,'aria-hidden',active&&docked?'true':null);
  }).observe(ovl,{attributes:true,attributeFilter:['class']});
  box.addEventListener('keydown',function(e){
    if(!ovl.classList.contains('is-docked')||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.isComposing||typing(e.target)||!Layout.singleKeys())return;
    if(act_(e.key,selectedId||lastDockedId)){e.preventDefault();e.stopPropagation()}
  });

  /* ----- Atalhos globais ----- */
  function regions(){
    var r=[],si=$('searchInput');if(si&&visible(si))r.push(si);
    var a=act.querySelector('.ide-act[tabindex="0"]');if(a&&visible(a))r.push(a);
    var s=sc.querySelector('.sidebar-item[tabindex="0"]')||sc.querySelector('.sidebar-item');if(s&&visible(s))r.push(s);
    r.push(main.querySelector('[data-a11y-open][tabindex="0"]')||main.querySelector('[data-a11y-open]')||main);
    if(dockedOpen())r.push(box);
    var st=$('ideStSync');if(visible(st))r.push(st);
    return r;
  }
  function cycleRegions(dir){
    var r=regions(),a=doc.activeElement,cur=-1;
    for(var i=0;i<r.length;i++){var zone=r[i]===box?box:r[i].closest('#appHeader,#ideActivity,#sidebarContent,#mainContent,#ideStatus')||r[i];if(zone.contains(a)){cur=i;break}}
    focusEl(r[cur<0?0:(cur+dir+r.length)%r.length]);
  }
  doc.addEventListener('keydown',function(e){
    if(e.defaultPrevented)return;
    var k=e.key,mod=e.ctrlKey||e.metaKey;
    if(mod&&!e.altKey&&((!e.shiftKey&&(k==='k'||k==='K'))||(e.shiftKey&&(k==='p'||k==='P')))){
      if(paletteOpen()){e.preventDefault();e.stopPropagation();closePalette(true);return}
      if(dialogOpen()||forcedReset())return;
      e.preventDefault();e.stopPropagation();openPalette();return;
    }
    if(k==='F6'&&!mod&&!e.altKey){if(dialogOpen())return;e.preventDefault();e.stopPropagation();cycleRegions(e.shiftKey?-1:1);return}
    if(mod||e.altKey||e.isComposing||typing(e.target)||dialogOpen()||!Layout.singleKeys())return;
    if(k==='/'){e.preventDefault();e.stopPropagation();focusSearch()}
    else if(k==='?'){e.preventDefault();e.stopPropagation();openHelp()}
  },true);

  /* ----- Paleta de comandos ----- */
  var pal=null,palInput,palList,palLive,palHint,palItems=[],palActive=-1,palOpener=null,palOpenerKey=null,palLiveTimer=null,palCache=null;
  function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()}
  function score(q,text){
    if(!q||!text)return-1;var s=norm(text);
    if(s.indexOf(q)===0)return 1000-s.length;
    var i=s.indexOf(q);
    if(i>0)return(/[\s\/\-_.:(\[›·]/.test(s.charAt(i-1))?800:600)-i;
    var qq=q.replace(/\s+/g,'');if(qq.length<2)return-1;
    var pos=0,sc_=300,last=-2;
    for(var k=0;k<qq.length;k++){var f=s.indexOf(qq.charAt(k),pos);if(f<0)return-1;if(f===last+1)sc_+=5;if(f===0||/[\s\/\-_.]/.test(s.charAt(f-1)))sc_+=10;sc_-=Math.min(f-pos,10);last=f;pos=f+1}
    return Math.max(1,sc_);
  }
  function mark(label,q){
    label=String(label||'');if(!q)return esc(label);
    var n=norm(label);if(n.length!==label.length)return esc(label);
    var i=n.indexOf(q);
    if(i>=0)return esc(label.slice(0,i))+'<mark>'+esc(label.slice(i,i+q.length))+'</mark>'+esc(label.slice(i+q.length));
    var qq=q.replace(/\s+/g,''),out='',qi=0;
    for(var k=0;k<label.length;k++){if(qi<qq.length&&n.charAt(k)===qq.charAt(qi)){out+='<mark>'+esc(label.charAt(k))+'</mark>';qi++}else out+=esc(label.charAt(k))}
    return qi===qq.length?out:esc(label);
  }
  function recentKeys(){try{var v=JSON.parse(lsGet(K.recent)||'[]');return Array.isArray(v)?v.filter(function(x){return typeof x==='string'}):[]}catch(e){return[]}}
  function remember(it){if(!it.rk)return;var l=recentKeys().filter(function(x){return x!==it.rk});l.unshift(it.rk);lsSet(K.recent,JSON.stringify(l.slice(0,12)))}
  function cache(){
    if(palCache)return palCache;
    var paths={},cats={};
    S.data.folders.forEach(function(f){paths[f.id]=getFolderPath(f.id)||''});
    S.data.categories.forEach(function(c){cats[c.id]=c});
    return palCache={paths:paths,cats:cats};
  }
  function dot(color){return'<span class="dot" style="width:8px;height:8px;background:'+(/^#[0-9a-f]{3,8}$/i.test(color||'')?color:'var(--tx3)')+'"></span>'}
  function scriptItem(s,sc_,hlq){
    var c=cache(),path=s.folderId&&c.paths[s.folderId]||'',cat=s.categoryId&&c.cats[s.categoryId];
    return{kind:'script',id:s.id,rk:'s:'+s.id,label:s.name,sub:[path,cat?cat.name:''].filter(Boolean).join(' · '),icon:svg(s.locked?I.lock:I.file,15),score:sc_,q:hlq};
  }
  function searchScripts(q){
    var c=cache(),rec={},out=[];recentKeys().forEach(function(k){rec[k]=1});
    S.data.scripts.forEach(function(s){
      var main_=score(q,s.name),cat=s.categoryId&&c.cats[s.categoryId];
      var sec=Math.max(score(q,(s.tags||[]).join(' ')),score(q,s.folderId&&c.paths[s.folderId]||''),score(q,cat?cat.name:''));
      var best=Math.max(main_,sec>0?sec*0.5:-1);if(best<=0)return;
      if(rec['s:'+s.id])best+=100;if(s.pinned||s.favorite)best+=50;
      out.push(scriptItem(s,best,main_>0?q:''));
    });
    return out.sort(function(a,b){return b.score-a.score}).slice(0,8);
  }
  function places(){
    var c=cache(),out=[{rk:'p:all',label:t('allScripts'),icon:svg(I.file,15),run:function(){clearPlace();render()}},{rk:'p:nofolder',label:t('noFolder'),icon:svg(I.folder,15),run:function(){setPlace('__none__',null)}},{rk:'p:nocat',label:t('noCatLabel'),icon:dot(''),run:function(){setPlace(null,'__none__')}}];
    S.data.folders.forEach(function(f){out.push({rk:'p:f:'+f.id,label:(c.paths[f.id]||f.name).split(' / ').join(' › '),sub:t('folder'),icon:svg(I.folder,15),run:function(){setPlace(f.id,null)}})});
    S.data.categories.forEach(function(cat){out.push({rk:'p:c:'+cat.id,label:cat.name,sub:t('category'),icon:dot(cat.color),run:function(){setPlace(null,cat.id)}})});
    (S.data.subscriptions||[]).forEach(function(sub){out.push({rk:'p:s:'+sub.id,label:sub.name,sub:t('shSection'),icon:svg(I.cloud,15),run:function(){var el=sc.querySelector('[data-sub-id="'+(window.CSS&&CSS.escape?CSS.escape(sub.id):sub.id)+'"]');if(el)el.click()}})});
    return out;
  }
  function clearPlace(){S.filter.folderId=null;S.filter.categoryId=null;S.filter.subscriptionId=null;if(window.FP)FP.resetPage()}
  function setPlace(fid,cid){clearPlace();S.filter.folderId=fid;S.filter.categoryId=cid;render()}
  function commands(){
    var C=window.Cloud,cloud=!!(C&&C.available&&C.available()),signed=cloud&&C.isSignedIn(),hasView=!!$('featureView'),subs=(S.data.subscriptions||[]).length>0;
    var list=[
      {id:'new',label:t('newScript'),kw:'new script create',kbd:'Alt+N',icon:I.plus,run:function(){openNewScript()}},
      {id:'importTxt',label:t('importTxt'),kw:'import txt file',icon:I.file,run:function(){importTxtScript()}},
      {id:'importDb',label:t('importDB'),kw:'import database json',icon:I.download,run:function(){importDatabase()}},
      {id:'backup',label:t('backupDB'),kw:'backup export save json',icon:I.upload,run:function(){exportDatabase()}},
      {id:'settings',label:t('settings'),kw:'settings preferences options',icon:I.gear,run:function(){openSettings()}},
      {id:'theme',label:t('cmdTheme'),kw:'theme dark light',icon:I.moon,run:function(){toggleTheme()}},
      {id:'subscribe',label:t('shSubscribe'),kw:'subscribe shared list github code',icon:I.cloud,when:!!window.Sharing,run:function(){Sharing.openSubscribeDialog()}},
      {id:'checkAll',label:t('shCheckAll'),kw:'check shared lists updates',icon:I.sync,when:subs&&!!window.Sharing,run:function(){Sharing.checkAll();showToast(t('shChecking'),'info')}},
      {id:'syncNow',label:t('syncNow'),kw:'sync cloud now',icon:I.sync,when:signed,run:function(){Cloud.syncNow(true)}},
      {id:'account',label:signed?t('accTitle'):t('accSignIn'),kw:'account login sign in cloud',icon:I.user,when:cloud,run:function(){Cloud.openAccount()}},
      {id:'syncRemote',label:t('a11ySyncRemote'),kw:'remote url sync',icon:I.sync,when:!!S.data.settings.remoteUrl,run:function(){syncRemote()}},
      {id:'viewList',label:tx('cmdView',{name:t('rowsView')}),kw:'view list rows',icon:I.view,when:hasView,run:function(){setView('list')}},
      {id:'viewCards',label:tx('cmdView',{name:t('blocksView')}),kw:'view cards blocks grid',icon:I.view,when:hasView,run:function(){setView('cards')}},
      {id:'viewTable',label:tx('cmdView',{name:t('tableView')}),kw:'view table',icon:I.view,when:hasView,run:function(){setView('table')}},
      {id:'fFav',label:tx('cmdFilter',{name:t('favoritesFilter')}),kw:'filter favorites star',icon:I.star,run:function(){toggleQuickFilter('favorite')}},
      {id:'fPin',label:tx('cmdFilter',{name:t('pinnedFilter')}),kw:'filter pinned',icon:I.pin,run:function(){toggleQuickFilter('pinned')}},
      {id:'fLock',label:tx('cmdFilter',{name:t('protectedFilter')}),kw:'filter protected locked password',icon:I.lock,run:function(){toggleQuickFilter('locked')}},
      {id:'clear',label:t('cmdClearFilters'),kw:'clear reset filters',icon:I.filter,when:filtersActive(),run:clearFilters},
      {id:'goSearch',label:t('cmdFocusSearch'),kw:'focus search find',kbd:'/',icon:I.search,run:focusSearch},
      {id:'goExplorer',label:t('cmdFocusExplorer'),kw:'focus explorer sidebar folders',icon:I.folder,run:focusExplorer},
      {id:'goList',label:t('cmdFocusList'),kw:'focus list scripts',icon:I.target,run:focusList},
      {id:'goPreview',label:t('cmdFocusPreview'),kw:'focus preview panel',icon:I.panel,when:dockedOpen(),run:function(){focusEl(box)}},
      {id:'tExplorer',label:t('cmdToggleExplorer'),kw:'toggle explorer sidebar',icon:I.folder,run:toggleExplorer},
      {id:'tPreview',label:t('cmdTogglePreview'),kw:'toggle preview panel',icon:I.panel,run:togglePreviewPanel},
      {id:'help',label:t('ideShortcuts'),kw:'help keyboard shortcuts',kbd:'?',icon:I.help,run:openHelp},
      {id:'classic',label:t('cmdLayoutClassic'),kw:'layout classic old',icon:I.layout,run:backToClassic}
    ];
    return list.filter(function(c){return c.when===undefined||c.when}).map(function(c){return{kind:'command',id:c.id,rk:'c:'+c.id,label:c.label,kw:c.kw,kbd:c.kbd,icon:svg(c.icon,15),run:c.run}});
  }
  function buildGroups(raw){
    var cmdOnly=raw.charAt(0)==='>',q=norm(cmdOnly?raw.slice(1):raw).trim(),groups=[];
    var cmds=commands();
    if(!q){
      if(!cmdOnly){
        var byKey={},recent=[],sc_=0,cc=0;
        cmds.forEach(function(c){byKey[c.rk]=c});
        var pl=places();pl.forEach(function(p){byKey[p.rk]=Object.assign({kind:'place'},p)});
        S.data.scripts.forEach(function(s){byKey['s:'+s.id]=s});
        recentKeys().forEach(function(k){
          var v=byKey[k];if(!v)return;
          if(k.indexOf('s:')===0){if(sc_<6){recent.push(scriptItem(v,0,''));sc_++}}
          else if(cc<4){recent.push(v);cc++}
        });
        if(recent.length)groups.push({label:t('palRecent'),items:recent});
        var used={};recent.forEach(function(r){used[r.rk]=1});
        cmds=cmds.filter(function(c){return!used[c.rk]});
      }
      groups.push({label:t('palCommands'),items:cmds});
      return{groups:groups,q:'',raw:raw};
    }
    if(!cmdOnly){
      groups.push({label:t('palScripts'),items:searchScripts(q)});
      groups.push({label:t('palPlaces'),items:places().map(function(p){var s=score(q,p.label);return s>0?Object.assign({kind:'place',score:s,q:q},p):null}).filter(Boolean).sort(function(a,b){return b.score-a.score}).slice(0,5)});
    }
    groups.push({label:t('palCommands'),items:cmds.map(function(c){var s=Math.max(score(q,c.label),score(q,c.kw)*0.8);return s>0?Object.assign({score:s,q:score(q,c.label)>0?q:''},c):null}).filter(Boolean).sort(function(a,b){return b.score-a.score}).slice(0,cmdOnly?20:6)});
    return{groups:groups,q:q,raw:raw,cmdOnly:cmdOnly};
  }
  function refreshPalette(){
    var r=buildGroups(palInput.value),h='',n=0;palItems=[];
    r.groups.forEach(function(g,gi){
      if(!g.items.length)return;
      h+='<div role="group" aria-labelledby="palg'+gi+'"><div class="ide-pal-gl" id="palg'+gi+'" role="presentation">'+esc(g.label)+'</div>';
      g.items.forEach(function(it){h+=optionHtml(it,n,it.q||'');palItems.push(it);n++});
      h+='</div>';
    });
    var found=n;
    if(r.q&&!found)h='<div class="ide-pal-empty" role="presentation">'+esc(tx('palNone',{q:r.raw.trim()}))+'</div>'+h;
    if(r.q&&!r.cmdOnly){
      var f={kind:'filter',label:tx('palFilterList',{q:r.raw.trim()}),icon:svg(I.search,15),run:function(){var si=$('searchInput');if(si)si.value=r.raw.trim();onSearch(r.raw.trim())}};
      h+=optionHtml(f,n,'');palItems.push(f);n++;
    }
    palList.innerHTML=h;
    setActive(palItems.length?0:-1,false);
    clearTimeout(palLiveTimer);palLiveTimer=setTimeout(function(){palLive.textContent=tx('palCount',{n:found})},300);
  }
  function optionHtml(it,i,q){
    return'<div role="option" id="palo'+i+'" class="ide-pal-opt" data-i="'+i+'" aria-selected="false"><span class="ide-pal-ico" aria-hidden="true">'+(it.icon||'')+'</span><span class="ide-pal-lbl">'+mark(it.label,q)+'</span><span class="ide-pal-sub">'+esc(it.sub||'')+'</span>'+(it.kbd?'<kbd class="ide-kbd" aria-hidden="true">'+esc(it.kbd)+'</kbd>':'')+'</div>';
  }
  function setActive(i,scroll){
    var opts=palList.querySelectorAll('[role="option"]');
    if(palActive>=0&&opts[palActive])opts[palActive].setAttribute('aria-selected','false');
    palActive=i;
    if(i>=0&&opts[i]){opts[i].setAttribute('aria-selected','true');palInput.setAttribute('aria-activedescendant',opts[i].id);if(scroll!==false)opts[i].scrollIntoView({block:'nearest'})}
    else palInput.removeAttribute('aria-activedescendant');
  }
  function moveActive(d,wrap){
    var n=palItems.length;if(!n)return;
    var i=palActive+d;
    if(wrap)i=(i%n+n)%n;else i=Math.max(0,Math.min(n-1,i));
    setActive(i,true);
  }
  function runActive(mode){
    var it=palItems[palActive];if(!it)return;
    remember(it);closePalette(true);
    if(it.kind==='script'){
      if(mode==='edit'){act_('e',it.id);return}
      if(mode==='copy'){copyContent(it.id);return}
      openViewScript(it.id);return;
    }
    it.run();
  }
  function labelPalette(){
    $('idePalTitle').textContent=t('idePalette');
    palInput.placeholder=t('palPh');attr(palInput,'aria-label',t('idePalette'));
    attr(palList,'aria-label',t('idePalette'));
    palHint.textContent=tx('palHint',{mod:MAC?'⌘':'Ctrl'});
  }
  function buildPalette(){
    pal=doc.createElement('div');pal.id='idePalette';pal.hidden=true;
    pal.innerHTML='<div class="ide-pal" role="dialog" aria-modal="true" aria-labelledby="idePalTitle"><h2 id="idePalTitle" class="sr-only"></h2>'+
      '<div class="ide-pal-in">'+svg(I.search,16)+'<input id="idePalInput" type="text" role="combobox" aria-expanded="true" aria-controls="idePalList" aria-autocomplete="list" autocomplete="off" spellcheck="false"></div>'+
      '<div id="idePalList" role="listbox"></div><div class="ide-pal-hint" id="idePalHint" aria-hidden="true"></div><div class="sr-only" id="idePalLive" role="status" aria-live="polite"></div></div>';
    doc.body.appendChild(pal);
    palInput=$('idePalInput');palList=$('idePalList');palLive=$('idePalLive');palHint=$('idePalHint');
    labelPalette();
    palInput.addEventListener('input',refreshPalette);
    pal.addEventListener('mousedown',function(e){if(e.target===pal){e.preventDefault();closePalette(true)}});
    palList.addEventListener('mousedown',function(e){e.preventDefault()});
    palList.addEventListener('click',function(e){var o=e.target.closest('[role="option"]');if(!o)return;setActive(Number(o.getAttribute('data-i')),false);runActive('open')});
    pal.addEventListener('keydown',function(e){
      var k=e.key;
      if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();moveActive(k==='ArrowDown'?1:-1,true)}
      else if(k==='PageDown'||k==='PageUp'){e.preventDefault();moveActive(k==='PageDown'?5:-5,false)}
      else if(k==='Enter'&&!e.isComposing){e.preventDefault();runActive(e.ctrlKey||e.metaKey?'edit':e.shiftKey?'copy':'open')}
      else if(k==='Tab'){e.preventDefault()}
      else if(k==='Escape'){e.preventDefault();closePalette(true)}
      e.stopPropagation();
    });
  }
  function openPalette(q){
    if(forcedReset())return;
    if(!pal)buildPalette();
    if(!pal.hidden){focusEl(palInput);return}
    if(dialogOpen())return;
    hideCtx();palCache=null;
    var a=doc.activeElement;palOpener=a&&a!==doc.body?a:null;palOpenerKey=window.A11y?A11y.keyOf(palOpener):null;
    pal.hidden=false;if(window.A11y)A11y.syncInert();
    palInput.value=q||'';refreshPalette();focusEl(palInput);
  }
  function closePalette(restore){
    if(!pal||pal.hidden)return;
    pal.hidden=true;palLive.textContent='';if(window.A11y)A11y.syncInert();
    if(restore){var el=palOpener&&palOpener.isConnected?palOpener:(window.A11y&&palOpenerKey?A11y.find(palOpenerKey):null);if(el)focusEl(el)}
    palOpener=null;palOpenerKey=null;
  }
  if(window.A11y)A11y.addLayer(function(){if(paletteOpen()){closePalette(true);return true}return false});

  /* ----- Ajuda de atalhos ----- */
  function openHelp(){
    var mod=MAC?'⌘':'Ctrl';
    function k(){return Array.prototype.map.call(arguments,function(x){return'<kbd class="ide-kbd">'+esc(x)+'</kbd>'}).join('')}
    var groups=[
      [t('kbGeneral'),[[k(mod,'K'),t('idePalette')],[k('Alt','N'),t('newScript')],[k('/'),t('kbSearch')],[k('?'),t('ideShortcuts')],[k('F6'),t('kbRegions')],[k('Esc'),t('kbClose')]]],
      [t('kbList'),[[k('↑','↓'),t('kbMove')],[k('Home','End'),t('kbFirstLast')],[k('PgUp','PgDn'),t('kbPages')],[k('Enter'),t('kbOpen')],[k('E'),t('edit')],[k('C'),t('copy')],[k('F'),t('favorite')],[k('P'),t('pinToTop')],[k('Delete'),t('kbDelete')]]],
      [t('ideExplorer'),[[k('↑','↓'),t('kbMove')],[k('Enter'),t('kbFilter')],[k('Shift','F10'),t('kbMenu')],[k('F2'),t('kbRename')],[k('Delete'),t('kbDelete')]]],
      [t('kbPreview'),[[k('F6'),t('cmdFocusPreview')],[k('E','C','F','P'),t('kbPreviewActs')],[k('Esc'),t('kbClose')]]],
      [t('kbEditor'),[[k(mod,'S'),t('save')],[k('Esc'),t('cancel')]]]
    ];
    var bd=(Layout.singleKeys()?'':'<p class="auth-note">'+esc(t('kbSingleOff'))+'</p>')+groups.map(function(g){
      return'<table class="ide-kb"><caption>'+esc(g[0])+'</caption><tbody>'+g[1].map(function(r){return'<tr><th scope="row">'+r[0]+'</th><td>'+esc(r[1])+'</td></tr>'}).join('')+'</tbody></table>';
    }).join('');
    openModal('<span style="font-weight:700;font-size:15px">'+esc(t('ideShortcuts'))+'</span><button class="icon-btn" onclick="closeModal()" aria-label="'+esc(t('shClose'))+'">'+svg('<path d="M18 6 6 18M6 6l12 12"/>',18)+'</button>',bd,'<div style="flex:1"></div><button class="btn btn-accent" onclick="closeModal()">OK</button>',false);
  }

  /* ----- Cabecalho, idioma, nuvem ----- */
  var prevTop=window.updateTop;
  window.updateTop=function(){var r=prevTop.apply(this,arguments);labelShell();updateStatus();return r};
  if(window.Core){
    Core.on('cloudStatus',updateStatus);
    Core.on('remoteApplied',function(){palCache=null});
    Core.on('reset',function(){lsSet(K.recent,null);selectedId=null;lastDockedId=null});
  }
  window.addEventListener('online',updateStatus);window.addEventListener('offline',updateStatus);
  if(mqMobile.addEventListener)mqMobile.addEventListener('change',syncActivity);
  Promise.resolve(window.appReady).catch(function(){loadFailed=true;if(window.S&&S.data)render()});

  window.IdeLayout={openPalette:openPalette,closePalette:closePalette,openHelp:openHelp,select:function(id){select(id,false)},selected:function(){return selectedId},docked:dockedOpen,canDock:canDock,toggleExplorer:toggleExplorer,togglePreviewPanel:togglePreviewPanel};

  /* O primeiro render pode ter acontecido antes deste arquivo carregar. */
  labelShell();decorateSidebar();decorateMain();
})();
