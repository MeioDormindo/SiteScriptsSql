/* Acessibilidade nos dois layouts (WCAG 2.2 AA), sem mudar a aparencia do layout Classico:
   so atributos (role, aria-*, tabindex, for, inert), regioes de aviso fora da tela e comportamento de teclado.
   - Itens da barra lateral, cards e menus funcionam com Enter/Espaco/setas; Shift+F10 abre o menu de contexto.
   - Modais: foco vai para dentro, Tab circula, o fundo fica inert e o foco volta para quem abriu.
   - Esc fecha so a camada de cima (antes fechava modal, confirmacao e menu de uma vez).
   - Depois de cada render o foco volta para o mesmo item (favoritar reordena a lista, por exemplo). */
(function(){
  var doc=document;
  function $(id){return doc.getElementById(id)}
  var app=$('app'),ovl=$('modalOvl'),box=$('modalBox'),mHead=$('mHead'),cOvl=$('confirmOvl'),cBox=$('confirmBox'),ctx=$('ctxContainer'),sc=$('sidebarContent'),main=$('mainContent');
  if(!app||!ovl||!box||!cOvl||!cBox||!ctx||!sc||!main)return;
  var FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';
  var A11y=window.A11y={};

  function tx(key,vars){var s=t(key);Object.keys(vars||{}).forEach(function(k){s=s.split('{'+k+'}').join(vars[k])});return s}
  function attr(el,name,val){
    if(!el)return;
    if(val===null||val===undefined){if(el.hasAttribute(name))el.removeAttribute(name);return}
    val=String(val);if(el.getAttribute(name)!==val)el.setAttribute(name,val);
  }
  function setInert(el,on){if(el&&!!el.inert!==!!on)el.inert=!!on}
  function visible(el){return!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)}
  function focusables(root){return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE),function(el){return visible(el)&&!el.closest('[inert],[hidden]')})}
  function focusEl(el){if(!el||!el.isConnected)return false;try{el.focus({preventScroll:true})}catch(e){try{el.focus()}catch(e2){}}return doc.activeElement===el}
  function lost(){var a=doc.activeElement;return!a||a===doc.body||a===doc.documentElement||!a.isConnected}
  function hideSvgs(root){root.querySelectorAll('svg:not([aria-hidden])').forEach(function(s){s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false')})}
  function typing(el){return!!(el&&(/^(input|textarea|select)$/i.test(el.tagName)||el.isContentEditable))}
  A11y.attr=attr;A11y.focusEl=focusEl;A11y.focusables=focusables;A11y.typing=typing;

  /* ===== Regioes de aviso para leitores de tela ===== */
  function region(id,role){var r=$(id);if(!r){r=doc.createElement('div');r.id=id;r.className='sr-only';r.setAttribute('role',role);if(role==='status')r.setAttribute('aria-live','polite');doc.body.appendChild(r)}return r}
  region('a11yStatus','status');region('a11yAlert','alert');
  var annTimers={};
  A11y.announce=function(msg,assertive){
    if(!msg)return;var r=region(assertive?'a11yAlert':'a11yStatus',assertive?'alert':'status');
    clearTimeout(annTimers[r.id]);r.textContent='';
    annTimers[r.id]=setTimeout(function(){r.textContent=String(msg)},60);
  };

  /* ===== Chaves de foco: reencontrar o "mesmo" elemento depois que o HTML foi recriado ===== */
  function cardIdOf(card){var id=card.getAttribute('data-a11y-id');if(id)return id;var m=(card.getAttribute('onclick')||'').match(/openViewScript\('([^']+)'\)/);return m?m[1]:null}
  function sideSig(it){var a=it.getAttribute('data-ctx-folder');if(a)return'f:'+a;a=it.getAttribute('data-ctx-id');if(a)return'c:'+a;a=it.getAttribute('data-sub-id');if(a)return's:'+a;return'o:'+(it.getAttribute('onclick')||'')}
  function indexIn(root,sel,el){return Array.prototype.indexOf.call(root.querySelectorAll(sel),el)}
  function keyOf(el){
    if(!el||el===doc.body||!el.closest)return null;
    var card=el.closest('#mainContent .card');
    if(card){var part='open',acts=el.closest('.script-card-actions');if(acts)part='act:'+Array.prototype.indexOf.call(acts.children,el);return{z:'card',id:cardIdOf(card),part:part,i:indexIn(main,'[data-a11y-open]',card.querySelector('[data-a11y-open]'))}}
    var pag=el.closest('#scriptPagination');if(pag)return{z:'pag',label:el.getAttribute('aria-label')||el.textContent,i:indexIn(pag,'button',el)};
    var it=el.closest('#sidebarContent .sidebar-item');if(it)return{z:'side',sig:sideSig(it),i:indexIn(sc,'.sidebar-item',it)};
    if(el.id&&el!==main)return{z:'id',id:el.id};
    var zone=el.closest('#mainContent')?main:el.closest('#sidebarContent')?sc:null;
    if(zone)return{z:'idx',zone:zone.id,i:indexIn(zone,FOCUSABLE,el)};
    return{z:'el',el:el};
  }
  function find(k){
    if(!k)return null;
    if(k.z==='el')return k.el&&k.el.isConnected?k.el:null;
    if(k.z==='id')return $(k.id);
    if(k.z==='card'){
      var cards=main.querySelectorAll('.card');
      for(var i=0;i<cards.length;i++){if(cardIdOf(cards[i])!==k.id)continue;
        if(k.part.indexOf('act:')===0){var acts=cards[i].querySelector('.script-card-actions'),b=acts&&acts.children[Number(k.part.slice(4))];if(b)return b}
        return cards[i].querySelector('[data-a11y-open]');
      }
      return null;
    }
    if(k.z==='pag'){var p=$('scriptPagination');if(!p)return null;var bs=p.querySelectorAll('button');for(var j=0;j<bs.length;j++)if((bs[j].getAttribute('aria-label')||bs[j].textContent)===k.label&&!bs[j].disabled)return bs[j];return null}
    if(k.z==='side'){var items=sc.querySelectorAll('.sidebar-item');for(var n=0;n<items.length;n++)if(sideSig(items[n])===k.sig)return items[n];return null}
    if(k.z==='idx'){var z=$(k.zone),f=z&&z.querySelectorAll(FOCUSABLE);return f&&f[k.i]||null}
    return null;
  }
  function fallback(k){
    if(!k)return null;
    if(k.z==='card'||k.z==='pag'){var opens=main.querySelectorAll('[data-a11y-open]');if(opens.length)return opens[Math.max(0,Math.min(k.z==='card'?k.i:0,opens.length-1))];return main}
    if(k.z==='side'){var items=sc.querySelectorAll('.sidebar-item');return items[Math.max(0,Math.min(k.i,items.length-1))]||null}
    if(k.z==='idx'){var z=$(k.zone),f=z&&z.querySelectorAll(FOCUSABLE);return f&&f.length?f[Math.min(k.i,f.length-1)]:z===main?main:null}
    return null;
  }
  function restore(k){var el=find(k)||fallback(k);return el&&focusEl(el)?el:null}
  A11y.keyOf=keyOf;A11y.find=function(k){return find(k)||fallback(k)};A11y.restore=restore;

  /* Embrulha um render: guarda o foco antes, decora uma vez no fim (renders aninhados do ajuste de pagina contam como um) e devolve o foco. */
  function guardRender(name,zone,decorate){
    var prev=window[name],depth=0;if(typeof prev!=='function')return;
    window[name]=function(){
      var k=null;
      if(depth===0){var a=doc.activeElement;if(a&&a!==doc.body&&zone.contains(a))k=keyOf(a)}
      depth++;
      try{return prev.apply(this,arguments)}
      finally{depth--;if(depth===0){try{decorate()}catch(e){console.error(e)}if(k&&lost())restore(k)}}
    };
  }

  /* ===== Cabecalho ===== */
  function syncQuick(){
    [['quickFavorite','favoritesFilter'],['quickPinned','pinnedFilter'],['quickLocked','protectedFilter']].forEach(function(p){
      var b=$(p[0]);if(!b)return;var label=t(p[1]);
      if(p[0]==='quickLocked'){var c=(($('quickLockedCount')||{}).textContent||'').trim();if(c)label+=' '+c}
      attr(b,'aria-label',label);attr(b,'aria-pressed',b.classList.contains('is-active'));
    });
  }
  function accountLabel(){var b=$('accountBtn');if(b)attr(b,'aria-label',b.getAttribute('title')||null)}
  function decorateHeader(){
    doc.querySelectorAll('[data-ta]').forEach(function(el){attr(el,'aria-label',t(el.getAttribute('data-ta')))});
    var sb=$('sidebar'),mb=$('menuBtn');if(mb)attr(mb,'aria-expanded',!!(sb&&sb.classList.contains('open')));
    attr($('themeBtn'),'aria-pressed',window.S&&S.theme==='dark');
    attr($('searchInput'),'aria-label',t('a11ySearch'));
    syncQuick();accountLabel();
    hideSvgs($('appHeader')||app);
  }

  /* ===== Barra lateral ===== */
  function decorateSidebar(){
    attr(sc,'role','navigation');attr(sc,'aria-label',t('a11yFilters'));
    sc.querySelectorAll('.sidebar-section>span:first-child').forEach(function(s){attr(s,'role','heading');attr(s,'aria-level','2')});
    sc.querySelectorAll('.sidebar-section .icon-btn').forEach(function(b){attr(b,'type','button');attr(b,'aria-label',b.getAttribute('title'))});
    sc.querySelectorAll('.sidebar-item').forEach(function(it){
      attr(it,'role','button');if(!it.hasAttribute('tabindex'))it.setAttribute('tabindex','0');
      attr(it,'aria-current',it.classList.contains('active')?'true':null);
      if(it.matches('[data-ctx-folder],[data-ctx-type],[data-sub-id]'))attr(it,'aria-keyshortcuts','Shift+F10');
    });
    sc.querySelectorAll('.sub-dot,.sub-warn,.pub-badge').forEach(function(el){attr(el,'role','img');attr(el,'aria-label',el.getAttribute('title'))});
    hideSvgs(sc);
  }

  /* ===== Lista de scripts ===== */
  function decorateMain(){
    var grid=main.querySelector('.script-list,.script-table,.script-grid');
    if(grid){attr(grid,'role','list');attr(grid,'aria-label',t('a11yScriptList'))}
    main.querySelectorAll('.card').forEach(function(card){
      attr(card,'role','listitem');
      var id=cardIdOf(card);if(id)attr(card,'data-a11y-id',id);
      var name=card.querySelector('div[title]');
      if(name){attr(name,'role','button');if(!name.hasAttribute('tabindex'))name.setAttribute('tabindex','0');attr(name,'data-a11y-open','')}
      var acts=card.querySelector('.script-card-actions');
      if(acts)acts.querySelectorAll('button').forEach(function(b){attr(b,'type','button');attr(b,'aria-label',b.getAttribute('title'));attr(b,'aria-pressed',b.classList.contains('is-active'))});
    });
    var tools=main.querySelector('.script-tools');
    if(tools){var lab=tools.querySelector('label:not([for])');if(lab&&$('featureView'))lab.setAttribute('for','featureView')}
    var pag=$('scriptPagination');
    if(pag){
      attr(pag,'role','navigation');attr(pag,'aria-label',t('a11yPagination'));
      pag.querySelectorAll('button').forEach(function(b){
        var l=b.textContent.trim();attr(b,'type','button');
        if(l==='‹')attr(b,'aria-label',t('a11yPrevPage'));
        else if(l==='›')attr(b,'aria-label',t('a11yNextPage'));
        else{attr(b,'aria-label',tx('a11yPage',{n:l}));attr(b,'aria-current',b.classList.contains('is-current')?'page':null)}
      });
      pag.querySelectorAll('[data-gap]').forEach(function(g){attr(g,'aria-hidden','true')});
    }
    main.querySelectorAll('.shared-banner button,.empty-state button').forEach(function(b){attr(b,'type','button')});
    hideSvgs(main);syncQuick();
  }

  /* ===== Modais e confirmacoes ===== */
  var M={mode:'closed',opener:null,key:null},C={open:false,opener:null,key:null};
  function paletteOpen(){var p=$('idePalette');return!!(p&&!p.hidden)}
  function syncInert(){
    var mOpen=ovl.classList.contains('active'),docked=ovl.classList.contains('is-docked'),cOpen=cOvl.classList.contains('active'),pal=paletteOpen();
    setInert(app,cOpen||(mOpen&&!docked)||pal);
    setInert(ovl,!mOpen||cOpen||pal);
    setInert(cOvl,!cOpen);
    attr(ovl,'aria-hidden',mOpen?null:'true');attr(cOvl,'aria-hidden',cOpen?null:'true');
  }
  A11y.syncInert=syncInert;
  function labelIconButtons(root){
    root.querySelectorAll('.icon-btn,button').forEach(function(b){
      if(b.hasAttribute('aria-label'))return;
      var text=b.textContent.trim();
      if(b.getAttribute('title')&&(!text||text.length<=2))attr(b,'aria-label',b.getAttribute('title'));
      else if(/closeModal\(\)/.test(b.getAttribute('onclick')||'')&&(!text||text==='×'))attr(b,'aria-label',t('shClose'));
    });
  }
  var FIELD_LABELS={sCont:'a11yContent',cHex:'a11yColorHex',setUrl:'remoteUrl'};
  function labelFields(root){
    root.querySelectorAll('label.label:not([for])').forEach(function(l){var n=l.nextElementSibling,f=n&&(n.matches('input,select,textarea')?n:n.querySelector('input,select,textarea'));if(f&&f.id)l.setAttribute('for',f.id)});
    root.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(function(f){
      if(f.hasAttribute('aria-label')||f.hasAttribute('aria-labelledby'))return;
      if(FIELD_LABELS[f.id]){f.setAttribute('aria-label',t(FIELD_LABELS[f.id]));return}
      if(f.labels&&f.labels.length)return;
      var p=f.getAttribute('placeholder')||f.getAttribute('title');if(p)f.setAttribute('aria-label',p);
    });
  }
  function modalTitle(){var el=mHead.querySelector('span[style*="font-weight:700"]');if(el)el.id='mTitle';return el}
  function applyModalSemantics(){
    var title=modalTitle();attr(box,'tabindex','-1');
    if(M.mode==='region'){
      attr(box,'role','region');attr(box,'aria-modal',null);attr(box,'aria-labelledby',null);
      attr(box,'aria-label',tx('pvRegion',{name:title?title.textContent.trim():''}));
    }else{
      attr(box,'role','dialog');attr(box,'aria-modal','true');
      if(title){attr(box,'aria-labelledby','mTitle');attr(box,'aria-label',null)}
      else{attr(box,'aria-labelledby',null);attr(box,'aria-label',(mHead.textContent||'').trim().slice(0,80)||null)}
    }
  }
  function decorateModal(){
    applyModalSemantics();
    labelIconButtons(mHead);labelIconButtons($('mFoot'));
    var cv=$('codeView');if(cv){attr(cv,'tabindex','0');attr(cv,'role','region');attr(cv,'aria-label',t('a11yContent'))}
    var hl=$('hlToggle');if(hl){attr(hl,'aria-label',hl.getAttribute('title'));attr(hl,'aria-pressed',!!window._viewHL)}
    var body=$('mBody');labelFields(body);
    body.querySelectorAll('.auth-err,#shErr,#pubErr').forEach(function(e){attr(e,'role','alert')});
    body.querySelectorAll('.seg-tab').forEach(function(b){attr(b,'aria-pressed',b.classList.contains('is-active'))});
    body.querySelectorAll('button[onclick*="setTheme("],button[onclick*="setLang("],#featureLanguage button').forEach(function(b){attr(b,'aria-pressed',b.classList.contains('btn-accent'))});
    hideSvgs(box);
  }
  function decorateConfirm(){
    var msg=cBox.firstElementChild;if(msg&&!msg.id&&msg.tagName==='DIV')msg.id='confirmMsg';
    var hasInput=!!cBox.querySelector('input');
    attr(cBox,'role',hasInput?'dialog':'alertdialog');attr(cBox,'aria-modal','true');attr(cBox,'tabindex','-1');
    attr(cBox,'aria-labelledby',msg&&msg.id?msg.id:null);
    var pw=$('pwField');if(pw){attr(pw,'aria-labelledby',msg&&msg.id?msg.id:null);attr(pw,'aria-describedby','pwErr')}
    var pw2=$('pwField2');if(pw2)attr(pw2,'aria-label',pw2.getAttribute('placeholder'));
    var err=$('pwErr');if(err)attr(err,'role','alert');
    hideSvgs(cBox);
  }
  function focusIntoDialog(){setTimeout(function(){if(M.mode!=='dialog'||cOvl.classList.contains('active'))return;if(!box.contains(doc.activeElement))focusEl(box)},120)}
  function backTo(opener,key){var el=opener&&opener.isConnected&&!opener.closest('[inert]')?opener:find(key)||fallback(key);if(el)focusEl(el)}
  function onModalClass(){
    var active=ovl.classList.contains('active'),mode=!active?'closed':ovl.classList.contains('is-docked')?'region':'dialog',was=M.mode;
    if(mode===was){syncInert();return}
    var inside=box.contains(doc.activeElement);
    /* Ao virar dialogo a partir da previa acoplada (E, Historico...), o foco pode ter sumido junto com o conteudo antigo:
       nesse caso continua valendo quem abriu a previa. */
    if(was==='closed'||(was==='region'&&mode==='dialog')){
      var a=doc.activeElement;
      if(a&&a!==doc.body&&a.isConnected&&!box.contains(a)){M.opener=a;M.key=keyOf(a)}
      else if(was==='closed'){M.opener=null;M.key=null}
    }
    M.mode=mode;decorateModal();syncInert();
    if(mode==='dialog'&&!inside)focusIntoDialog();
    if(mode==='closed'&&(lost()||inside))backTo(M.opener,M.key);
  }
  function onConfirmClass(){
    var open=cOvl.classList.contains('active');
    if(open===C.open){syncInert();return}
    C.open=open;
    if(open){
      var a=doc.activeElement;C.opener=a&&a!==doc.body&&!cBox.contains(a)?a:null;C.key=keyOf(C.opener);
      decorateConfirm();syncInert();
      setTimeout(function(){if(cOvl.classList.contains('active')&&!cBox.contains(doc.activeElement))focusEl(cBox)},70);
    }else{
      var gone=lost()||cBox.contains(doc.activeElement);syncInert();
      if(gone){if(C.opener&&C.opener.isConnected&&!C.opener.closest('[inert]'))focusEl(C.opener);else if(M.mode==='dialog')focusEl(box);else backTo(C.opener,C.key)}
    }
  }

  /* ===== Menus de contexto ===== */
  var menuOpener=null,menuFocusAt=0,dropNativeUntil=0;
  function ctxOpen(){return!!ctx.querySelector('.ctx-menu')}
  function dispatchMenu(item,x,y){
    item.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,view:window,button:2,clientX:x,clientY:y}));
  }
  /* Abre o mesmo menu do clique direito, ja com foco no primeiro item (teclado ou botao "⋯"). */
  A11y.openMenuFor=function(item,anchor){
    var r=(anchor||item).getBoundingClientRect();
    menuOpener=item;menuFocusAt=Date.now();
    dispatchMenu(item,Math.round(anchor?r.left:r.left+16),Math.round(anchor?r.bottom+2:r.bottom-2));
  };
  function closeMenu(){var op=menuOpener;menuOpener=null;hideCtx();if(op&&op.isConnected&&!op.closest('[inert]'))focusEl(op)}
  new MutationObserver(function(){
    var m=ctx.querySelector('.ctx-menu');
    if(!m){if(menuOpener&&lost()&&menuOpener.isConnected&&!menuOpener.closest('[inert]'))focusEl(menuOpener);menuOpener=null;return}
    attr(m,'role','menu');
    m.querySelectorAll('.ctx-item').forEach(function(it){attr(it,'role','menuitem');attr(it,'tabindex','-1')});
    hideSvgs(m);
    if(menuFocusAt&&Date.now()-menuFocusAt<1500){menuFocusAt=0;clearTimeout(window._ctxTimer);var f=m.querySelector('.ctx-item');if(f)focusEl(f)}
  }).observe(ctx,{childList:true,subtree:true});
  ctx.addEventListener('keydown',function(e){
    var m=ctx.querySelector('.ctx-menu');if(!m)return;
    var items=Array.prototype.slice.call(m.querySelectorAll('.ctx-item')),i=items.indexOf(doc.activeElement),n=null;
    if(e.key==='ArrowDown')n=i+1;else if(e.key==='ArrowUp')n=i<0?items.length-1:i-1;else if(e.key==='Home')n=0;else if(e.key==='End')n=items.length-1;
    else if((e.key==='Enter'||e.key===' ')&&i>=0){e.preventDefault();e.stopPropagation();items[i].click();return}
    else if(e.key==='Tab'){e.preventDefault();e.stopPropagation();closeMenu();return}
    else return;
    e.preventDefault();e.stopPropagation();
    if(items.length)focusEl(items[(n+items.length)%items.length]);
  });
  /* Os menus se fecham sozinhos em 5 s; com o foco dentro deles (teclado), nao. Cliques e Esc continuam fechando. */
  var prevHide=window.hideCtx;
  window.hideCtx=function(){if(!window.event&&ctx.contains(doc.activeElement))return;return prevHide.apply(this,arguments)};

  /* ===== Teclado ===== */
  var layers=[];
  A11y.addLayer=function(fn){layers.push(fn)};
  function handleEsc(e){
    for(var i=0;i<layers.length;i++){try{if(layers[i](e))return true}catch(err){console.error(err)}}
    if(ctxOpen()){closeMenu();return true}
    if(cOvl.classList.contains('active')){closeConfirm();return true}
    if(ovl.classList.contains('active')){closeModal();return true}
    var sb=$('sidebar');if(sb&&sb.classList.contains('open')){toggleSidebar();focusEl($('menuBtn'));return true}
    return false;
  }
  function trapTab(e){
    if(paletteOpen())return;
    var root=cOvl.classList.contains('active')?cBox:M.mode==='dialog'?box:null;if(!root)return;
    var f=focusables(root),a=doc.activeElement;
    if(!f.length){e.preventDefault();focusEl(root);return}
    if(!root.contains(a)){e.preventDefault();focusEl(e.shiftKey?f[f.length-1]:f[0]);return}
    if(e.shiftKey&&(a===f[0]||a===root)){e.preventDefault();focusEl(f[f.length-1])}
    else if(!e.shiftKey&&a===f[f.length-1]){e.preventDefault();focusEl(f[0])}
  }
  window.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&!e.isComposing){if(handleEsc(e)){e.preventDefault();e.stopImmediatePropagation()}return}
    if(e.key==='Tab'&&!e.ctrlKey&&!e.altKey&&!e.metaKey)trapTab(e);
  },true);
  function isMenuKey(e){return(e.key==='F10'&&e.shiftKey)||e.key==='ContextMenu'}
  sc.addEventListener('keydown',function(e){
    var it=e.target;if(!it.classList||!it.classList.contains('sidebar-item'))return;
    if((e.key==='Enter'||e.key===' ')&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();it.click();return}
    if(isMenuKey(e)&&it.matches('[data-ctx-folder],[data-ctx-type],[data-sub-id]')){e.preventDefault();e.stopPropagation();dropNativeUntil=Date.now()+600;A11y.openMenuFor(it)}
  });
  /* Shift+F10 tambem dispara o contextmenu nativo: o que chegar logo depois do nosso e descartado. */
  sc.addEventListener('contextmenu',function(e){if(e.isTrusted&&Date.now()<dropNativeUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
  main.addEventListener('keydown',function(e){
    var el=e.target;if(!el.hasAttribute||!el.hasAttribute('data-a11y-open'))return;
    if((e.key==='Enter'||e.key===' ')&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();var card=el.closest('.card');if(card)card.click()}
  });
  box.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.seg-tab'))setTimeout(decorateModal,0)});

  /* ===== Funcoes embrulhadas ===== */
  guardRender('renderMain',main,decorateMain);
  guardRender('renderSidebar',sc,decorateSidebar);
  var prevTop=window.updateTop;
  window.updateTop=function(){var r=prevTop.apply(this,arguments);decorateHeader();return r};
  var prevToast=window.showToast;
  window.showToast=function(msg,type){var r=prevToast.apply(this,arguments);A11y.announce(msg,type==='error');return r};
  var prevHL=window.toggleHL;
  window.toggleHL=function(){var r=prevHL.apply(this,arguments);attr($('hlToggle'),'aria-pressed',!!window._viewHL);return r};
  var prevSearch=window.onSearch,searchTimer=null;
  window.onSearch=function(v){
    var r=prevSearch.apply(this,arguments);clearTimeout(searchTimer);
    searchTimer=setTimeout(function(){if(String(v||'').trim())A11y.announce(tx('a11yResults',{n:window._featureTotalScripts||0}))},600);
    return r;
  };
  var prevToggleSb=window.toggleSidebar;
  window.toggleSidebar=function(){
    var r=prevToggleSb.apply(this,arguments),sb=$('sidebar'),open=!!(sb&&sb.classList.contains('open'));
    attr($('menuBtn'),'aria-expanded',open);
    if(window.innerWidth<=768&&sb){
      if(open)setTimeout(function(){var f=sc.querySelector('.sidebar-item[tabindex="0"]')||sc.querySelector('.sidebar-item');if(f)focusEl(f)},60);
      else if(sb.contains(doc.activeElement)||lost())focusEl($('menuBtn'));
    }
    return r;
  };

  /* ===== Observadores (so gravam atributos, nunca classes ou filhos: nao entram em loop) ===== */
  new MutationObserver(onModalClass).observe(ovl,{attributes:true,attributeFilter:['class']});
  new MutationObserver(onConfirmClass).observe(cOvl,{attributes:true,attributeFilter:['class']});
  new MutationObserver(function(recs){
    for(var i=0;i<recs.length;i++){var tg=recs[i].target;if(!(tg.id==='codeView'||(tg.closest&&tg.closest('#codeView')))){decorateModal();return}}
  }).observe(box,{childList:true,subtree:true});
  new MutationObserver(decorateConfirm).observe(cBox,{childList:true});
  var acct=$('accountBtn');if(acct)new MutationObserver(accountLabel).observe(acct,{attributes:true,attributeFilter:['title']});

  A11y.decorateMain=decorateMain;A11y.decorateSidebar=decorateSidebar;A11y.decorateHeader=decorateHeader;
  /* O primeiro render pode ter acontecido antes deste arquivo carregar. */
  decorateHeader();decorateSidebar();decorateMain();decorateConfirm();
  M.mode=ovl.classList.contains('active')?(ovl.classList.contains('is-docked')?'region':'dialog'):'closed';C.open=cOvl.classList.contains('active');
  decorateModal();syncInert();
})();
