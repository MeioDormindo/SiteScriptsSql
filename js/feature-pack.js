(function(){
  var prefKey='sqlScriptFeatures';
  var pref=JSON.parse(localStorage.getItem(prefKey)||'{}');
  pref.view=pref.view==='list'||pref.view==='table'?pref.view:'cards';
  var originalRender=window.renderMain;
  var originalFilter=window.getFiltered;
  var originalOpenNew=window.openNewScript;
  var originalOpenEdit=window.openEditScript;
  var originalSave=window.saveScript;
  var originalView=window.openViewScript;
  var originalSettings=window.openSettings;

  TR.es=Object.assign({},TR.pt,{allScripts:'Todos los scripts',folders:'Carpetas',categories:'Categorías',newScript:'Nuevo script',importDB:'Importar base',backupDB:'Copia',settings:'Configuración',search:'Buscar scripts...',noFolder:'Sin carpeta',save:'Guardar',cancel:'Cancelar',delete:'Eliminar',edit:'Editar',view:'Ver',copy:'Copiar',copied:'¡Copiado!',emptyState:'No se encontraron scripts',emptySub:'Crea un script o importa una base de datos',importTxt:'Importar .txt',settingsTitle:'Configuración',favorite:'Favorito',scriptSaved:'Script guardado',scriptDeleted:'Script eliminado',folderSaved:'Carpeta guardada',folderDeleted:'Carpeta eliminada',catSaved:'Categoría guardada',catDeleted:'Categoría eliminada',dark:'Oscuro',light:'Claro',scripts:'scripts',chars:'caracteres',lines:'líneas'});

  function savePref(){localStorage.setItem(prefKey,JSON.stringify(pref))}
  function script(id){return S.data.scripts.find(function(item){return item.id===id})}
  function tagsOf(item){return Array.isArray(item.tags)?item.tags:[]}
  function normalize(value){return(value||'').toLowerCase().replace(/\s+/g,' ').trim()}
  function t(key){return(typeof window.t==='function'?window.t(key):key)}
  function featureText(pt,en){return S.lang==='en'?en:pt}
  function getAdvancedFilter(){
    var value=(S.filter.search||'').trim();var result={text:[],tags:[],favorite:false,pinned:false};
    value.split(/\s+/).filter(Boolean).forEach(function(part){
      var pair=part.split(':');var key=pair[0].toLowerCase();var val=pair.slice(1).join(':');
      if(key==='tag'&&val)result.tags.push(val.toLowerCase());
      else if(key==='folder'&&val)result.folder=val.toLowerCase();
      else if(key==='category'&&val)result.category=val.toLowerCase();
      else if(key==='fav'||key==='favorite')result.favorite=true;
      else if(key==='pinned'||key==='fixado')result.pinned=true;
      else result.text.push(part);
    });
    return result;
  }
  window.getFiltered=function(){
    var filter=getAdvancedFilter();
    var rawSearch=S.filter.search;S.filter.search=filter.text.join(' ');var list=originalFilter();S.filter.search=rawSearch;
    return list.filter(function(item){
      var hay=[item.name,item.content,getFolderPath(item.folderId)||'',(S.data.categories.find(function(c){return c.id===item.categoryId})||{}).name||'',tagsOf(item).join(' ')].join(' ').toLowerCase();
      if(filter.text.length&&!filter.text.every(function(term){return hay.indexOf(term.toLowerCase())>=0}))return false;
      if(filter.tags.length&&!filter.tags.every(function(tag){return tagsOf(item).some(function(itemTag){return itemTag.toLowerCase()===tag})}))return false;
      if(filter.folder&&(!getFolderPath(item.folderId)||getFolderPath(item.folderId).toLowerCase().indexOf(filter.folder)<0))return false;
      if(filter.category&&(!S.data.categories.find(function(c){return c.id===item.categoryId&&c.name.toLowerCase().indexOf(filter.category)>=0})))return false;
      if(filter.favorite&&!item.favorite)return false;
      if(filter.pinned&&!item.pinned)return false;
      return true;
    });
    return list.sort(function(a,b){return(b.pinned?1:0)-(a.pinned?1:0)||(b.favorite?1:0)-(a.favorite?1:0)});
  };
  function toggleFlag(id,key){var item=script(id);if(!item)return;item[key]=!item[key];save().then(render)}
  window.toggleScriptFlag=toggleFlag;
  function normalizeRecords(){
    S.data.scripts.forEach(function(item){if(!Array.isArray(item.tags))item.tags=[];if(!Array.isArray(item.versions))item.versions=[];if(typeof item.favorite!=='boolean')item.favorite=false;if(typeof item.pinned!=='boolean')item.pinned=false});
  }
  function addFeatureTools(main,grid){
    var tools=document.createElement('div');tools.className='script-tools';
    tools.innerHTML='<label>'+featureText('Filtro','Filter')+'</label><select class="inp" id="featureFilter"><option value="">'+featureText('Todos','All')+'</option><option value="favorite">'+featureText('Favoritos','Favorites')+'</option><option value="pinned">'+featureText('Fixados','Pinned')+'</option></select><div class="script-tool-spacer"></div><label>'+featureText('Visualização','View')+'</label><select class="inp" id="featureView"><option value="cards">'+featureText('Cards','Cards')+'</option><option value="list">'+featureText('Lista','List')+'</option><option value="table">'+featureText('Tabela','Table')+'</option></select>';
    main.insertBefore(tools,grid);var view=tools.querySelector('#featureView');view.value=pref.view;var filter=tools.querySelector('#featureFilter');filter.value=(S.filter.search==='favorite'||S.filter.search==='pinned')?S.filter.search:'';
    view.addEventListener('change',function(){pref.view=this.value;savePref();render()});
    filter.addEventListener('change',function(){onSearch(this.value);render()});
  }
  function enhanceCards(grid){
    grid.classList.add(pref.view==='cards'?'script-grid':'script-'+pref.view);
    grid.querySelectorAll('.card').forEach(function(card){
      var match=(card.getAttribute('onclick')||'').match(/openViewScript\('([^']+)'\)/);if(!match)return;
      var item=script(match[1]);if(!item)return;
      var actions=document.createElement('div');actions.className='script-card-actions';
      actions.innerHTML='<button class="icon-btn '+(item.favorite?'is-active':'')+'" title="'+featureText('Favorito','Favorite')+'">★</button><button class="icon-btn '+(item.pinned?'is-active':'')+'" title="'+featureText('Fixar no topo','Pin to top')+'">⌃</button>';
      actions.children[0].addEventListener('click',function(event){event.stopPropagation();toggleFlag(item.id,'favorite')});
      actions.children[1].addEventListener('click',function(event){event.stopPropagation();toggleFlag(item.id,'pinned')});
      card.appendChild(actions);
      var preview=card.querySelector('div[style*="JetBrains Mono"]');if(preview&&!preview.querySelector('i')){preview.classList.add('script-preview');preview.innerHTML=renderHL(preview.textContent)}
      var tagLine=document.createElement('div');tagLine.className='script-tags';tagLine.textContent=tagsOf(item).map(function(tag){return'#'+tag}).join(' ');if(tagLine.textContent)card.appendChild(tagLine);
    });
  }
  window.renderMain=function(){
    originalRender();normalizeRecords();var main=document.getElementById('mainContent');var grid=main&&(main.querySelector('.script-grid')||main.firstElementChild);
    if(!grid||grid.classList.contains('empty-state'))return;
    addFeatureTools(main,grid);enhanceCards(grid);
  };
  function addTagInput(item){
    var body=document.getElementById('mBody');if(!body||body.querySelector('#featureTags'))return;
    var field=document.createElement('div');field.style.cssText='margin-bottom:12px';field.innerHTML='<label class="label">'+featureText('Tags','Tags')+'</label><input class="inp" id="featureTags" placeholder="produção, manutenção, relatório" value="'+tagsOf(item).join(', ')+'">';body.insertBefore(field,body.firstChild);
  }
  window.openNewScript=function(){originalOpenNew();addTagInput({tags:[]})};
  window.openEditScript=function(id){originalOpenEdit(id);addTagInput(script(id)||{tags:[]})};
  window.saveScript=async function(id){
    var field=document.getElementById('featureTags');var tags=field?field.value.split(',').map(function(tag){return tag.trim().toLowerCase()}).filter(Boolean).filter(function(tag,index,list){return list.indexOf(tag)===index}):null;
    var item=id&&script(id);var previous=item&&item.content;var nextContent=document.getElementById('sCont')&&document.getElementById('sCont').value;
    if(item&&tags)item.tags=tags;
    if(nextContent){
      var duplicate=S.data.scripts.find(function(other){return other.id!==item.id&&normalize(other.content)===normalize(nextContent)});
      if(duplicate&&!confirm(featureText('Este conteúdo já existe em "'+duplicate.name+'". Deseja salvar mesmo assim?','This content already exists in "'+duplicate.name+'". Save anyway?')))return;
    }
    await originalSave(id);var created=id?script(id):S.data.scripts.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt)})[0];
    if(created){if(tags)created.tags=tags;if(previous!==undefined&&previous!==created.content){created.versions=Array.isArray(created.versions)?created.versions:[];created.versions.push({content:previous,savedAt:now()});created.versions=created.versions.slice(-20)}await save()}
  };
  function restoreVersion(id,index){
    var item=script(id);if(!item||!item.versions[index])return;
    var current=item.content;item.versions.push({content:current,savedAt:now()});item.content=item.versions[index].content;item.updatedAt=now();save().then(function(){closeModal();render();showToast(featureText('Versão restaurada','Version restored'),'success')});
  }
  window.showScriptHistory=function(id){
    var item=script(id);if(!item)return;var versions=item.versions||[];
    var rows=versions.slice().reverse().map(function(version,position){var index=versions.length-1-position;return'<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bdr)"><div style="flex:1"><div style="font-size:12px;color:var(--tx1)">'+fmtDate(version.savedAt)+'</div><div style="font-size:11px;color:var(--tx3)">'+version.content.length+' '+t('chars')+'</div></div><button class="btn btn-sm" onclick="restoreScriptVersion(\''+id+'\','+index+')">'+featureText('Restaurar','Restore')+'</button></div>'}).join('');
    openModal('<span style="font-weight:700;font-size:15px">'+featureText('Histórico de versões','Version history')+'</span><button class="icon-btn" onclick="closeModal()">×</button>',rows||'<div class="empty-state">'+featureText('Nenhuma versão anterior','No previous version')+'</div>','<div style="flex:1"></div><button class="btn" onclick="closeModal()">'+t('cancel')+'</button>',false);
  };
  window.restoreScriptVersion=restoreVersion;
  window.openViewScript=function(id){
    originalView(id);var foot=document.getElementById('mFoot');if(!foot||foot.querySelector('[data-history]'))return;
    var button=document.createElement('button');button.className='btn btn-sm';button.setAttribute('data-history','true');button.textContent=featureText('Histórico','History');button.onclick=function(){showScriptHistory(id)};foot.insertBefore(button,foot.firstChild);
  };
  window.resetApplication=function(){
    showConfirm(featureText('Isso apagará todos os scripts, pastas, categorias personalizadas, favoritos e preferências. O arquivo JSON de backup não será apagado. Continuar?','This will delete all scripts, folders, custom categories, favorites and preferences. The backup JSON file will not be deleted. Continue?'),async function(){
      S.data={scripts:[],folders:[],categories:DEF_CATS.map(function(category){return{id:uid(),name:category.name,color:category.color,createdAt:now()}}),settings:{remoteUrl:'',autoSync:false,lastSync:null,language:S.lang,theme:S.theme}};
      S.filter={folderId:null,categoryId:null,search:''};
      localStorage.removeItem('sqlScriptCardSize');localStorage.removeItem('sqlScriptSort');localStorage.removeItem(prefKey);
      S.fileHandle=null;S.fileName=null;await save();closeModal();render();showToast(featureText('Aplicativo resetado','Application reset'),'success');
    });
  };
  window.resetar=window.resetApplication;
  function addResetButton(){
    var foot=document.getElementById('mFoot');if(!foot||foot.querySelector('[data-reset]'))return;
    var button=document.createElement('button');button.className='btn btn-danger btn-sm';button.setAttribute('data-reset','true');button.textContent=featureText('Resetar aplicativo','Reset application');button.onclick=resetApplication;foot.insertBefore(button,foot.firstChild);
  }
  window.openSettings=function(){
    originalSettings();addResetButton();setTimeout(addResetButton,0);
  };
  window.toggleLang=function(){var languages=['pt','en','es'];var index=languages.indexOf(S.lang);setLang(languages[(index+1)%languages.length]);S.data.settings.language=S.lang;save();render()};
  window.addEventListener('keydown',function(event){
    var editing=/input|textarea|select/i.test(event.target.tagName);if(event.ctrlKey||event.metaKey){if(event.key.toLowerCase()==='n'&&!editing){event.preventDefault();openNewScript()}if(event.key.toLowerCase()==='s'&&editing){event.preventDefault();var saveButton=document.querySelector('#mFoot .btn-accent');if(saveButton)saveButton.click()}}else if(event.key==='f'&&!editing){var item=S.data.scripts.find(function(s){return s.id===S.filter.activeScript});if(item)toggleFlag(item.id,'favorite')}
  });
  normalizeRecords();
})();