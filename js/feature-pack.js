(function(){
  window._featurePagingActive=true;
  var prefKey='sqlScriptFeatures';
  var pref=JSON.parse(localStorage.getItem(prefKey)||'{}');
  pref.view=pref.view==='table'?'table':'list';
  pref.pageSize=5;
  pref.page=1;
  pref.page=Number(pref.page)>0?Number(pref.page):1;
  var originalRender=window.renderMain;
  var originalFilter=window.getFiltered;
  var originalOpenNew=window.openNewScript;
  var originalOpenEdit=window.openEditScript;
  var originalSave=window.saveScript;
  var originalView=window.openViewScript;
  var originalToggleHL=window.toggleHL;
  var originalCloseModal=window.closeModal;
  var originalCloseConfirm=window.closeConfirm;
  var originalSettings=window.openSettings;
  var originalSaveSettings=window.saveSettings;
  var originalProcessImport=window.processImport;

  function savePref(){localStorage.setItem(prefKey,JSON.stringify(pref))}
  function script(id){return S.data.scripts.find(function(item){return item.id===id})}
  function tagsOf(item){return Array.isArray(item.tags)?item.tags:[]}
  function normalize(value){return(value||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function t(key){return(typeof window.t==='function'?window.t(key):key)}
  function hasCrypto(){return!!(window.crypto&&window.crypto.subtle)}
  function bufToB64(buf){var bytes=new Uint8Array(buf);var bin='';for(var i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin)}
  function b64ToBuf(b64){var bin=atob(b64);var bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes.buffer}
  function deriveKey(password,saltBuf){
    return crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'PBKDF2'},false,['deriveKey']).then(function(keyMaterial){
      return crypto.subtle.deriveKey({name:'PBKDF2',salt:saltBuf,iterations:150000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    });
  }
  function encryptText(password,text){
    var salt=crypto.getRandomValues(new Uint8Array(16));var iv=crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(password,salt).then(function(key){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(text))})
      .then(function(cipher){return{salt:bufToB64(salt),iv:bufToB64(iv),data:bufToB64(cipher)}});
  }
  function decryptText(password,enc){
    var salt=b64ToBuf(enc.salt),iv=new Uint8Array(b64ToBuf(enc.iv)),data=b64ToBuf(enc.data);
    return deriveKey(password,salt).then(function(key){return crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,data)})
      .then(function(plain){return new TextDecoder().decode(plain)});
  }
  var pendingDialogCancel=null;
  window.closeConfirm=function(){
    if(pendingDialogCancel){var fn=pendingDialogCancel;pendingDialogCancel=null;fn();return}
    originalCloseConfirm();
  };
  function promptPassword(message,needConfirm){
    return new Promise(function(resolve,reject){
      var box=document.getElementById('confirmBox');
      box.innerHTML='<div style="font-size:14px;line-height:1.5;margin-bottom:14px;color:var(--tx1)">'+message+'</div>'+
        '<input type="password" class="inp" id="pwField" style="margin-bottom:'+(needConfirm?'8px':'14px')+'" autocomplete="new-password">'+
        (needConfirm?'<input type="password" class="inp" id="pwField2" placeholder="'+t('confirmPassword')+'" style="margin-bottom:14px">':'')+
        '<div id="pwErr" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none"></div>'+
        '<div style="display:flex;gap:8px;justify-content:center"><button class="btn" id="pwCancel">'+t('cancel')+'</button><button class="btn btn-accent" id="pwOk">'+t('confirmAction')+'</button></div>';
      var ovl=document.getElementById('confirmOvl');ovl.classList.add('active');
      var pw=document.getElementById('pwField');setTimeout(function(){pw.focus()},50);
      function backdropCancel(event){if(event.target===ovl){cleanup();reject(new Error('cancelled'))}}
      function cleanup(){pendingDialogCancel=null;ovl.classList.remove('active');ovl.removeEventListener('click',backdropCancel);box.innerHTML=''}
      function fail(msg){var err=document.getElementById('pwErr');if(err){err.textContent=msg;err.style.display='block'}}
      pendingDialogCancel=function(){cleanup();reject(new Error('cancelled'))};
      ovl.addEventListener('click',backdropCancel);
      document.getElementById('pwCancel').onclick=function(){cleanup();reject(new Error('cancelled'))};
      document.getElementById('pwOk').onclick=function(){
        var value=pw.value;
        if(!value){fail(t('enterPassword'));return}
        if(needConfirm&&value!==document.getElementById('pwField2').value){fail(t('passwordMismatch'));return}
        cleanup();resolve(value);
      };
      pw.addEventListener('keydown',function(event){if(event.key==='Enter')document.getElementById('pwOk').click()});
    });
  }
  function addLockControl(item,currentPassword){
    var body=document.getElementById('mBody');if(!body||body.querySelector('#featureLockBox'))return;
    var wasLocked=!!(item&&item.locked);
    var box=document.createElement('div');box.id='featureLockBox';box.dataset.wasLocked=wasLocked?'1':'0';
    box.style.cssText='margin-bottom:12px;padding:10px;border:1px solid var(--bdr);border-radius:8px;background:var(--bg1)';
    if(wasLocked){
      box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px"><span style="font-size:12px;font-weight:600;color:var(--acc)">🔒 '+t('passwordProtected')+'</span><button type="button" class="btn btn-sm btn-danger" id="featureUnlock">'+t('removeProtection')+'</button></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><input type="password" class="inp" id="featurePass" placeholder="'+t('newPasswordOptional')+'" style="flex:1;min-width:140px"><input type="password" class="inp" id="featurePass2" placeholder="'+t('confirmNewPassword')+'" style="flex:1;min-width:140px"></div>';
    }else{
      box.innerHTML='<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:6px"><input type="checkbox" id="featureLock" style="width:auto"> 🔒 '+t('protectPassword')+'</label>'+
        '<div id="featureLockFields" style="display:none;gap:8px;flex-wrap:wrap"><input type="password" class="inp" id="featurePass" placeholder="'+t('passwordLabel')+'" style="flex:1;min-width:140px"><input type="password" class="inp" id="featurePass2" placeholder="'+t('confirmPassword')+'" style="flex:1;min-width:140px"></div>';
    }
    body.insertBefore(box,body.firstChild);
    var chk=box.querySelector('#featureLock');if(chk)chk.addEventListener('change',function(){box.querySelector('#featureLockFields').style.display=this.checked?'flex':'none'});
    var unlockBtn=box.querySelector('#featureUnlock');if(unlockBtn)unlockBtn.addEventListener('click',function(){box.dataset.removeLock='1';box.style.opacity='.5';unlockBtn.disabled=true;unlockBtn.textContent=t('removedOnSave')});
    if(currentPassword)box._currentPassword=currentPassword;
  }
  function askConfirm(message,okLabel,danger){
    return new Promise(function(resolve){
      var box=document.getElementById('confirmBox');
      box.innerHTML='<div style="font-size:14px;line-height:1.5;margin-bottom:18px;color:var(--tx1)">'+message+'</div><div style="display:flex;gap:8px;justify-content:center"><button class="btn" id="acCancel">'+t('cancel')+'</button><button class="btn '+(danger?'btn-danger':'btn-accent')+'" id="acOk">'+okLabel+'</button></div>';
      var ovl=document.getElementById('confirmOvl');ovl.classList.add('active');
      function backdrop(event){if(event.target===ovl){cleanup();resolve(false)}}
      function cleanup(){pendingDialogCancel=null;ovl.classList.remove('active');ovl.removeEventListener('click',backdrop);box.innerHTML=''}
      pendingDialogCancel=function(){cleanup();resolve(false)};
      ovl.addEventListener('click',backdrop);
      document.getElementById('acCancel').onclick=function(){cleanup();resolve(false)};
      document.getElementById('acOk').onclick=function(){cleanup();resolve(true)};
    });
  }
  var draftKey='sqlScriptDraft',draftTimer=null,draftBaseline=null,draftLocked=false,savingNow=false;
  function currentEditSnapshot(){
    var nameEl=document.getElementById('sName'),contentEl=document.getElementById('sCont');
    if(!nameEl||!contentEl)return null;
    return{name:nameEl.value,categoryId:(document.getElementById('sCat')||{}).value||'',folderId:(document.getElementById('sFld')||{}).value||'',content:contentEl.value};
  }
  function snapshotsDiffer(a,b){return!a||!b||a.name!==b.name||a.content!==b.content||a.categoryId!==b.categoryId||a.folderId!==b.folderId}
  function clearDraft(){localStorage.removeItem(draftKey)}
  function loadDraft(slot){try{var raw=localStorage.getItem(draftKey);if(!raw)return null;var draft=JSON.parse(raw);return draft&&draft.slot===slot?draft:null}catch(e){return null}}
  function saveDraft(slot){
    var chk=document.getElementById('featureLock');if(draftLocked||(chk&&chk.checked))return;
    var snap=currentEditSnapshot();if(!snap)return;
    localStorage.setItem(draftKey,JSON.stringify({slot:slot,name:snap.name,categoryId:snap.categoryId,folderId:snap.folderId,content:snap.content,savedAt:now()}));
  }
  function scheduleDraftSave(slot){clearTimeout(draftTimer);draftTimer=setTimeout(function(){saveDraft(slot)},800)}
  function bindDraftAutosave(slot){
    var el1=document.getElementById('sName'),el2=document.getElementById('sCont');
    if(el1)el1.addEventListener('input',function(){scheduleDraftSave(slot)});
    if(el2)el2.addEventListener('input',function(){scheduleDraftSave(slot)});
    ['sCat','sFld'].forEach(function(elId){var el=document.getElementById(elId);if(el)el.addEventListener('change',function(){scheduleDraftSave(slot)})});
  }
  function maybeOfferDraft(slot){
    var draft=loadDraft(slot);if(!draft)return;
    if(!snapshotsDiffer(draft,draftBaseline)){clearDraft();return}
    askConfirm(t('draftFoundConfirm').replace('{date}',fmtDate(draft.savedAt)),t('restore'),false).then(function(ok){
      if(!ok){clearDraft();return}
      document.getElementById('sName').value=draft.name;
      if(document.getElementById('sCat'))document.getElementById('sCat').value=draft.categoryId||'';
      if(document.getElementById('sFld'))document.getElementById('sFld').value=draft.folderId||'';
      document.getElementById('sCont').value=draft.content;updateInfo();
      showToast(t('draftRestored'),'success');
    });
  }
  function addHistoryButton(id){
    var foot=document.getElementById('mFoot');if(!foot||foot.querySelector('[data-history]'))return;
    var button=document.createElement('button');button.className='btn btn-sm';button.setAttribute('data-history','true');button.textContent=t('historyLabel');button.onclick=function(){showScriptHistory(id)};foot.insertBefore(button,foot.firstChild);
  }
  function calculatePageSize(){
    var main=document.getElementById('mainContent');
    var available=window.innerHeight-52-40-58-42;
    if(pref.view==='cards'){
      var width=(main?main.clientWidth:window.innerWidth)-40;
      var cardMin=parseInt(getComputedStyle(main||document.body).getPropertyValue('--script-card-min'))||420;
      var columns=Math.max(1,Math.floor((width+10)/(cardMin+10)));
      var rows=Math.max(1,Math.floor(available/200));
      return Math.max(1,Math.min(60,columns*rows));
    }
    var rowHeight=pref.view==='table'?60:108;
    return Math.max(1,Math.min(30,Math.floor(available/rowHeight)));
  }
  function updateQuickFilters(){
    ['favorite','pinned','locked'].forEach(function(type){var button=document.getElementById('quick'+type.charAt(0).toUpperCase()+type.slice(1));if(button)button.classList.toggle('is-active',!!S.filter['quick'+type.charAt(0).toUpperCase()+type.slice(1)])});
    var countEl=document.getElementById('quickLockedCount');if(countEl){var n=S.data.scripts.filter(function(s){return s.locked}).length;countEl.textContent=n?'('+n+')':''}
  }
  window.toggleQuickFilter=function(type){var key='quick'+type.charAt(0).toUpperCase()+type.slice(1);S.filter[key]=!S.filter[key];pref.page=1;render()};
  function getAdvancedFilter(){
    var value=(S.filter.search||'').trim();var result={text:[],tags:[],favorite:false,pinned:false,locked:false};
    value.split(/\s+/).filter(Boolean).forEach(function(part){
      var pair=part.split(':');var key=pair[0].toLowerCase();var val=pair.slice(1).join(':');
      if(key==='tag'&&val)result.tags.push(val.toLowerCase());
      else if(key==='folder'&&val)result.folder=val.toLowerCase();
      else if(key==='category'&&val)result.category=val.toLowerCase();
      else if(key==='fav'||key==='favorite')result.favorite=true;
      else if(key==='pinned'||key==='fixado')result.pinned=true;
      else if(key==='locked'||key==='protegido')result.locked=true;
      else result.text.push(part);
    });
    return result;
  }
  window.getFiltered=function(){
    if(!window._fittingPage)pref.pageSize=calculatePageSize();
    var filter=getAdvancedFilter();
    if(S.filter.quickFavorite)filter.favorite=true;if(S.filter.quickPinned)filter.pinned=true;if(S.filter.quickLocked)filter.locked=true;
    var rawSearch=S.filter.search;S.filter.search=filter.text.join(' ');var list=originalFilter();S.filter.search=rawSearch;
    list=list.filter(function(item){
      var hay=[item.name,item.content,getFolderPath(item.folderId)||'',(S.data.categories.find(function(c){return c.id===item.categoryId})||{}).name||'',tagsOf(item).join(' ')].join(' ').toLowerCase();
      if(filter.text.length&&!filter.text.every(function(term){return hay.indexOf(term.toLowerCase())>=0}))return false;
      if(filter.tags.length&&!filter.tags.every(function(tag){return tagsOf(item).some(function(itemTag){return itemTag.toLowerCase()===tag})}))return false;
      if(filter.folder&&(!getFolderPath(item.folderId)||getFolderPath(item.folderId).toLowerCase().indexOf(filter.folder)<0))return false;
      if(filter.category&&(!S.data.categories.find(function(c){return c.id===item.categoryId&&c.name.toLowerCase().indexOf(filter.category)>=0})))return false;
      if(filter.favorite&&!item.favorite)return false;
      if(filter.pinned&&!item.pinned)return false;
      if(filter.locked&&!item.locked)return false;
      return true;
    });
    list.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0)||(b.favorite?1:0)-(a.favorite?1:0)});
    window._featureTotalScripts=list.length;
    var totalPages=Math.max(1,Math.ceil(list.length/pref.pageSize));pref.page=Math.min(Math.max(pref.page,1),totalPages);
    var start=(pref.page-1)*pref.pageSize;return list.slice(start,start+pref.pageSize);
  };
  function toggleFlag(id,key){var item=script(id);if(!item)return;item[key]=!item[key];save().then(render)}
  window.toggleScriptFlag=toggleFlag;
  function normalizeRecords(){
    S.data.scripts.forEach(function(item){if(!Array.isArray(item.tags))item.tags=[];if(!Array.isArray(item.versions))item.versions=[];if(typeof item.favorite!=='boolean')item.favorite=false;if(typeof item.pinned!=='boolean')item.pinned=false});
  }
  function addFeatureTools(main,grid){
    var tools=document.createElement('div');tools.className='script-tools';
    tools.innerHTML='<div class="script-tool-spacer"></div><label>'+t('viewMode')+'</label><select class="inp" id="featureView"><option value="list">'+t('rowsView')+'</option><option value="cards">'+t('blocksView')+'</option><option value="table">'+t('tableView')+'</option></select>';
    main.insertBefore(tools,grid);var view=tools.querySelector('#featureView');view.value=pref.view;
    view.addEventListener('change',function(){pref.view=this.value;savePref();render()});
  }
  function updatePagination(main,grid){
    var cards=Array.prototype.slice.call(grid.querySelectorAll('.card'));var totalPages=Math.max(1,Math.ceil((window._featureTotalScripts||cards.length)/pref.pageSize));pref.page=Math.min(pref.page,totalPages);
    cards.forEach(function(card){card.style.display=''});
    var old=document.getElementById('scriptPagination');if(old)old.remove();if(totalPages<=1)return;
    var nav=document.createElement('div');nav.id='scriptPagination';nav.className='script-pagination';
    function add(label,page,active){var button=document.createElement('button');button.className='btn btn-sm'+(active?' is-current':'');button.textContent=label;button.disabled=active;button.onclick=function(){pref.page=page;savePref();render()};nav.appendChild(button)}
    if(pref.page>1)add('‹',pref.page-1,false);for(var page=1;page<=totalPages;page++){if(totalPages>7&&page>2&&page<totalPages-1&&Math.abs(page-pref.page)>1){if(!nav.querySelector('[data-gap]')){var gap=document.createElement('span');gap.dataset.gap='true';gap.textContent='...';nav.appendChild(gap)}continue}add(String(page),page,page===pref.page)}if(pref.page<totalPages)add('›',pref.page+1,false);main.appendChild(nav);
  }
  function enhanceCards(grid){
    grid.classList.add(pref.view==='cards'?'script-grid':'script-'+pref.view);
    grid.querySelectorAll('.card').forEach(function(card){
      var match=(card.getAttribute('onclick')||'').match(/openViewScript\('([^']+)'\)/);if(!match)return;
      var item=script(match[1]);if(!item)return;
      if(pref.view==='table'){
        var contentDivs=Array.prototype.filter.call(card.children,function(el){return el.tagName==='DIV'&&!el.classList.contains('card-bar')});
        if(contentDivs.length===3)card.insertBefore(document.createElement('div'),contentDivs[1]);
      }
      var actions=document.createElement('div');actions.className='script-card-actions';
      actions.innerHTML='<button class="icon-btn '+(item.favorite?'is-active':'')+'" title="'+t('favorite')+'">★</button><button class="icon-btn '+(item.pinned?'is-active':'')+'" title="'+t('pinToTop')+'">⌃</button>';
      actions.children[0].addEventListener('click',function(event){event.stopPropagation();toggleFlag(item.id,'favorite')});
      actions.children[1].addEventListener('click',function(event){event.stopPropagation();toggleFlag(item.id,'pinned')});
      card.appendChild(actions);
      var preview=card.querySelector('div[style*="JetBrains Mono"]');
      if(item.locked){
        if(preview){preview.classList.add('script-preview');preview.innerHTML='<span style="color:var(--tx3)">🔒 '+t('passwordProtected')+'</span>'}
        var nameEl=card.querySelector('div[title]');if(nameEl)nameEl.insertAdjacentHTML('afterbegin','🔒 ');
      }else if(preview&&!preview.querySelector('i')){preview.classList.add('script-preview');preview.innerHTML=renderHL(preview.textContent)}
      var tagLine=document.createElement('div');tagLine.className='script-tags';tagLine.textContent=tagsOf(item).map(function(tag){return'#'+tag}).join(' ');if(tagLine.textContent)card.appendChild(tagLine);
    });
  }
  var fitAttempts=0;
  function fitPageToViewport(main,grid){
    var cards=grid.querySelectorAll('.card');if(!cards.length){fitAttempts=0;return}
    var first=cards[0];var cardH=first.offsetHeight;if(!cardH){fitAttempts=0;return}
    var styles=getComputedStyle(grid);var rowGap=parseFloat(styles.rowGap)||10;
    var columns=1;
    if(pref.view==='cards'){
      var firstTop=first.offsetTop;columns=0;
      for(var i=0;i<cards.length;i++){if(cards[i].offsetTop===firstTop)columns++;else break}
      columns=Math.max(1,columns);
    }
    var rows=Math.max(1,Math.floor((grid.clientHeight+rowGap)/(cardH+rowGap)));
    var ideal=Math.max(1,Math.min(80,columns*rows));
    if(ideal!==pref.pageSize&&fitAttempts<3){
      pref.pageSize=ideal;fitAttempts++;
      window._fittingPage=true;render();window._fittingPage=false;
    }else{fitAttempts=0}
  }
  window.renderMain=function(){
    originalRender();normalizeRecords();var main=document.getElementById('mainContent');var grid=main&&(main.querySelector('.script-grid')||main.firstElementChild);
    if(!grid||grid.classList.contains('empty-state')){updateQuickFilters();return}
    addFeatureTools(main,grid);enhanceCards(grid);
    updatePagination(main,grid);updateQuickFilters();
    fitPageToViewport(main,grid);
  };
  function addTagInput(item){
    var body=document.getElementById('mBody');if(!body||body.querySelector('#featureTags'))return;
    var field=document.createElement('div');field.style.cssText='margin-bottom:12px';field.innerHTML='<label class="label">'+t('tagsLabel')+'</label><input class="inp" id="featureTags" placeholder="'+t('tagsPlaceholder')+'" value="'+tagsOf(item).join(', ')+'">';body.insertBefore(field,body.firstChild);
  }
  window.openNewScript=function(){
    originalOpenNew();addTagInput({tags:[]});addLockControl(null);
    draftLocked=false;draftBaseline=currentEditSnapshot();bindDraftAutosave('new');maybeOfferDraft('new');
  };
  window.openEditScript=function(id){
    var item=script(id);
    if(item&&item.locked){
      if(!hasCrypto()){showToast(t('noCryptoEdit'),'error');return}
      promptPassword(t('enterPasswordEdit').replace('{name}',esc(item.name)),false).then(function(password){
        return decryptText(password,item.secure).then(function(plain){
          originalOpenEdit(id);document.getElementById('sCont').value=plain;updateInfo();
          addTagInput(item);addLockControl(item,password);
          draftLocked=true;draftBaseline=currentEditSnapshot();
        });
      }).catch(function(err){if(err&&err.message!=='cancelled')showToast(t('wrongPassword'),'error')});
      return;
    }
    originalOpenEdit(id);addTagInput(item||{tags:[]});addLockControl(item);
    draftLocked=false;draftBaseline=currentEditSnapshot();bindDraftAutosave(id);maybeOfferDraft(id);
  };
  window.saveScript=async function(id){
    var field=document.getElementById('featureTags');var tags=field?field.value.split(',').map(function(tag){return tag.trim().toLowerCase()}).filter(Boolean).filter(function(tag,index,list){return list.indexOf(tag)===index}):null;
    var item=id&&script(id);var previous=item&&item.content;var nextContent=document.getElementById('sCont')&&document.getElementById('sCont').value;
    if(item&&tags)item.tags=tags;
    if(nextContent){
      var duplicate=S.data.scripts.find(function(other){return other.id!==item.id&&normalize(other.content)===normalize(nextContent)});
      if(duplicate&&!confirm(t('dupContentConfirm').replace('{name}',duplicate.name)))return;
    }
    var lockBox=document.getElementById('featureLockBox');var pendingLock=null;
    if(lockBox){
      var wasLocked=lockBox.dataset.wasLocked==='1';var removeLock=lockBox.dataset.removeLock==='1';
      if(wasLocked&&removeLock)pendingLock={remove:true};
      else if(wasLocked&&!removeLock){
        var newPass=(document.getElementById('featurePass')||{}).value||'';
        if(newPass){
          if(newPass!==((document.getElementById('featurePass2')||{}).value||'')){showToast(t('passwordMismatch'),'error');return}
          pendingLock={password:newPass};
        }else if(lockBox._currentPassword)pendingLock={password:lockBox._currentPassword,keep:true};
      }else if(!wasLocked){
        var chk=document.getElementById('featureLock');
        if(chk&&chk.checked){
          var p1=(document.getElementById('featurePass')||{}).value||'';var p2=(document.getElementById('featurePass2')||{}).value||'';
          if(!p1){showToast(t('enterPasswordProtect'),'error');return}
          if(p1!==p2){showToast(t('passwordMismatch'),'error');return}
          pendingLock={password:p1,firstLock:true};
        }
      }
    }
    if(pendingLock&&pendingLock.password&&!hasCrypto()){showToast(t('noCrypto'),'error');return}
    var encBlob=null,contentField=document.getElementById('sCont'),realValue=contentField?contentField.value:undefined;
    if(pendingLock&&pendingLock.password){
      try{encBlob=await encryptText(pendingLock.password,nextContent||'')}catch(e){showToast(t('encryptFail'),'error');return}
      if(contentField)contentField.value='';
    }
    savingNow=true;clearTimeout(draftTimer);
    try{await originalSave(id)}finally{savingNow=false}
    if(contentField&&encBlob!==null)contentField.value=realValue;
    clearDraft();
    var created=id?script(id):S.data.scripts.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)})[0];
    if(created){
      if(tags)created.tags=tags;
      if(pendingLock&&pendingLock.remove){created.locked=false;delete created.secure}
      else if(encBlob){created.locked=true;created.secure=encBlob;if(pendingLock.firstLock)created.versions=[]}
      if(!created.locked&&!(pendingLock&&pendingLock.remove)&&previous!==undefined&&previous!==created.content){created.versions=Array.isArray(created.versions)?created.versions:[];created.versions.push({content:previous,savedAt:now()});created.versions=created.versions.slice(-20)}
      await save();
    }
  };
  function restoreVersion(id,index){
    var item=script(id);if(!item||!item.versions[index])return;
    var current=item.content;item.versions.push({content:current,savedAt:now()});item.content=item.versions[index].content;item.updatedAt=now();save().then(function(){closeModal();render();showToast(t('versionRestored'),'success')});
  }
  window.showScriptHistory=function(id){
    var item=script(id);if(!item)return;var versions=item.versions||[];
    var rows=versions.slice().reverse().map(function(version,position){var index=versions.length-1-position;return'<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bdr)"><div style="flex:1"><div style="font-size:12px;color:var(--tx1)">'+fmtDate(version.savedAt)+'</div><div style="font-size:11px;color:var(--tx3)">'+version.content.length+' '+t('chars')+'</div></div><button class="btn btn-sm" onclick="restoreScriptVersion(\''+id+'\','+index+')">'+t('restore')+'</button></div>'}).join('');
    openModal('<span style="font-weight:700;font-size:15px">'+t('versionHistory')+'</span><button class="icon-btn" onclick="closeModal()">×</button>',rows||'<div class="empty-state">'+t('noVersions')+'</div>','<div style="flex:1"></div><button class="btn" onclick="closeModal()">'+t('cancel')+'</button>',false);
  };
  window.restoreScriptVersion=restoreVersion;
  var unlockedId=null,unlockedText=null;
  window.openViewScript=function(id){
    var item=script(id);
    unlockedId=null;unlockedText=null;
    originalView(id);addHistoryButton(id);
    if(!item||!item.locked)return;
    var codeView=document.getElementById('codeView');if(!codeView)return;
    codeView.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--tx2)"><div style="font-size:32px">🔒</div><div>'+t('protectedContent')+'</div><button class="btn btn-sm btn-accent" id="featureUnlockView">'+t('unlock')+'</button></div>';
    var hl=document.getElementById('hlToggle');if(hl)hl.style.display='none';
    document.getElementById('featureUnlockView').onclick=function(){
      if(!hasCrypto()){showToast(t('noCrypto'),'error');return}
      promptPassword(t('enterPasswordView'),false).then(function(password){
        return decryptText(password,item.secure).then(function(plain){unlockedId=id;unlockedText=plain;codeView.innerHTML=renderHL(plain);if(hl)hl.style.display=''});
      }).catch(function(err){if(err&&err.message!=='cancelled')showToast(t('wrongPassword'),'error')});
    };
  };
  window.toggleHL=function(id){
    if(id===unlockedId&&unlockedText!==null){
      var el=document.getElementById('codeView');if(!el)return;
      _viewHL=!_viewHL;var btn=document.getElementById('hlToggle');
      if(_viewHL){el.innerHTML=renderHL(unlockedText);if(btn)btn.style.color='var(--acc)'}
      else{el.textContent=unlockedText;if(btn)btn.style.color='var(--tx3)'}
      return;
    }
    originalToggleHL(id);
  };
  window.closeModal=function(){
    unlockedId=null;unlockedText=null;
    if(savingNow){clearTimeout(draftTimer);draftBaseline=null;originalCloseModal();return}
    var snap=currentEditSnapshot();
    if(snap&&snapshotsDiffer(snap,draftBaseline)){
      askConfirm(t('unsavedChangesConfirm'),t('discard'),true).then(function(ok){
        if(ok){clearTimeout(draftTimer);clearDraft();draftBaseline=null;originalCloseModal()}
      });
      return;
    }
    clearTimeout(draftTimer);draftBaseline=null;originalCloseModal();
  };
  var originalCopy=window.copyContent;
  window.copyContent=function(id){
    var item=script(id);
    if(item&&item.locked){
      if(!hasCrypto()){showToast(t('noCrypto'),'error');return}
      promptPassword(t('enterPasswordCopy'),false).then(function(password){
        return decryptText(password,item.secure).then(function(plain){
          navigator.clipboard.writeText(plain).then(function(){showToast(t('copied'),'success')}).catch(function(){showToast(t('copyFail'),'error')});
        });
      }).catch(function(err){if(err&&err.message!=='cancelled')showToast(t('wrongPassword'),'error')});
      return;
    }
    originalCopy(id);
  };
  window.resetApplication=function(){
    showConfirm(t('resetConfirm'),async function(){
      S.data={scripts:[],folders:[],categories:DEF_CATS.map(function(category){return{id:uid(),name:category.name,color:category.color,createdAt:now()}}),settings:{remoteUrl:'',autoSync:false,lastSync:null,language:S.lang,theme:S.theme}};
      S.filter={folderId:null,categoryId:null,search:''};
      localStorage.removeItem('sqlScriptCardSize');localStorage.removeItem('sqlScriptSort');localStorage.removeItem(prefKey);localStorage.removeItem(draftKey);
      S.fileHandle=null;S.fileName=null;await save();closeModal();render();showToast(t('appReset'),'success');
    });
  };
  window.resetar=window.resetApplication;
  function addResetButton(){
    var foot=document.getElementById('mFoot');if(!foot||foot.querySelector('[data-reset]'))return;
    var button=document.createElement('button');button.className='btn btn-danger btn-sm';button.setAttribute('data-reset','true');button.textContent=t('resetApp');button.onclick=resetApplication;foot.insertBefore(button,foot.firstChild);
  }
  function addLanguageSelect(){
    var body=document.getElementById('mBody');if(!body||body.querySelector('#featureLanguage'))return;
    var ptButton=Array.prototype.slice.call(body.querySelectorAll('button')).find(function(button){return button.textContent.trim()==='PT'});var group=ptButton&&ptButton.parentElement;if(!group)return;
    var languageButtons=document.createElement('span');languageButtons.id='featureLanguage';languageButtons.style.cssText='display:inline-flex;gap:6px;flex-wrap:wrap';
    languageOptions.filter(function(language){return language[0]!=='pt'&&language[0]!=='en'}).forEach(function(language){var button=document.createElement('button');button.className='btn btn-sm '+(S.lang===language[0]?'btn-accent':'');button.textContent=language[0].toUpperCase();button.title=language[1];button.onclick=function(){setLang(language[0]);openSettings()};languageButtons.appendChild(button)});
    group.appendChild(languageButtons);
  }
  window.openSettings=function(){
    originalSettings();addResetButton();addLanguageSelect();setTimeout(function(){addResetButton();addLanguageSelect()},0);
  };
  var originalSetLang=window.setLang;
  window.setLang=function(l){
    originalSetLang(l);
    if(S.data&&S.data.settings){S.data.settings.language=l;save()}
    if(document.getElementById('mainContent'))render();
  };
  window.toggleLang=function(){var languages=languageOptions.map(function(language){return language[0]});var index=languages.indexOf(S.lang);setLang(languages[(index+1)%languages.length])};
  var originalExport=window.exportDatabase;
  window.exportDatabase=async function(){
    var lockedCount=S.data.scripts.filter(function(s){return s.locked}).length;
    if(lockedCount)showToast(t('exportLockedWarning').replace('{n}',lockedCount),'info');
    await originalExport();
  };
  window.processImport=async function(txt,handle){
    try{
      var imported=JSON.parse(txt);if(Array.isArray(imported.scripts)){imported.scripts=imported.scripts.filter(function(item){return item&&typeof item.name==='string'&&typeof item.content==='string'}).map(function(item){return Object.assign({},item,{name:item.name.trim(),tags:Array.isArray(item.tags)?item.tags:[],versions:Array.isArray(item.versions)?item.versions:[],favorite:item.favorite===true,pinned:item.pinned===true})})}delete imported.settings;
      await originalProcessImport(JSON.stringify(imported),handle);
    }catch(error){await originalProcessImport(txt,handle)}
  };
  document.addEventListener('keydown',function(event){
    if(event.key!=='Escape')return;
    var snap=currentEditSnapshot();
    if(snap&&draftBaseline&&snapshotsDiffer(snap,draftBaseline)){event.stopImmediatePropagation();event.preventDefault();closeModal()}
  },true);
  var settingsObserver=new MutationObserver(function(){if(document.getElementById('setUrl')){addResetButton();addLanguageSelect()}});
  settingsObserver.observe(document.getElementById('modalOvl'),{childList:true,subtree:true});
  window.addEventListener('keydown',function(event){
    var editing=/input|textarea|select/i.test(event.target.tagName);if(event.ctrlKey||event.metaKey){if(event.key.toLowerCase()==='n'&&!editing){event.preventDefault();openNewScript()}if(event.key.toLowerCase()==='s'&&editing){event.preventDefault();var saveButton=document.querySelector('#mFoot .btn-accent');if(saveButton)saveButton.click()}}else if(event.key==='f'&&!editing){var item=S.data.scripts.find(function(s){return s.id===S.filter.activeScript});if(item)toggleFlag(item.id,'favorite')}
  });
  normalizeRecords();
  window.addEventListener('resize',function(){clearTimeout(window._layoutResizeTimer);window._layoutResizeTimer=setTimeout(function(){pref.page=1;render()},120)});
  setTimeout(function(){if(typeof S!=='undefined'&&S.data)render()},0);
})();