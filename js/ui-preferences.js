(function(){
  var sizes={small:'290px',medium:'420px',large:'560px',xlarge:'720px'};
  var labels={pt:{label:'Tamanho',sortLabel:'Ordenar',small:'Pequeno',medium:'Médio',large:'Grande',xlarge:'Extra grande',recent:'Mais recentes',name:'Nome A-Z',length:'Maior conteúdo'},en:{label:'Size',sortLabel:'Sort',small:'Small',medium:'Medium',large:'Large',xlarge:'Extra large',recent:'Most recent',name:'Name A-Z',length:'Longest content'}};
  var saved=localStorage.getItem('sqlScriptCardSize')||'medium';
  var sort=localStorage.getItem('sqlScriptSort')||'recent';

  function text(key){return(labels[window.S&&S.lang]||labels.pt)[key]}
  function applySize(size){
    saved=sizes[size]?size:'medium';
    localStorage.setItem('sqlScriptCardSize',saved);
    document.getElementById('mainContent').style.setProperty('--script-card-min',sizes[saved]);
  }
  function applySort(value){
    sort=value==='name'||value==='length'?value:'recent';
    localStorage.setItem('sqlScriptSort',sort);
    if(window.render)render();
  }
  var originalGetFiltered=window.getFiltered;
  window.getFiltered=function(){
    var list=originalGetFiltered();
    return list.sort(function(a,b){
      if(sort==='name')return a.name.localeCompare(b.name);
      if(sort==='length')return (b.content||'').length-(a.content||'').length;
      return new Date(b.updatedAt)-new Date(a.updatedAt);
    });
  };
  function formatPreviews(grid){
    if(!window.renderHL)return;
    grid.querySelectorAll('.card').forEach(function(card){
      var preview=card.querySelector('div[style*="JetBrains Mono"]');
      if(preview&&!preview.querySelector('i')){
        preview.classList.add('script-preview');
        preview.innerHTML=renderHL(preview.textContent);
      }
    });
  }
  function addControl(){
    var main=document.getElementById('mainContent');
    var grid=main&&main.firstElementChild;
    if(!main||!grid||grid.classList.contains('empty-state'))return;
    grid.classList.add('script-grid');
    var control=document.getElementById('scriptSizeControl');
    if(!control){
      control=document.createElement('div');
      control.id='scriptSizeControl';
      control.className='script-size-control';
      control.innerHTML='<div class="script-sort-group"><label for="scriptSort">'+text('sortLabel')+'</label><select class="inp" id="scriptSort"><option value="recent">'+text('recent')+'</option><option value="name">'+text('name')+'</option><option value="length">'+text('length')+'</option></select></div><label for="scriptSize">'+text('label')+'</label><select class="inp" id="scriptSize"><option value="small">'+text('small')+'</option><option value="medium">'+text('medium')+'</option><option value="large">'+text('large')+'</option><option value="xlarge">'+text('xlarge')+'</option></select>';
      main.insertBefore(control,grid);
      control.querySelector('#scriptSize').addEventListener('change',function(){applySize(this.value)});
      control.querySelector('#scriptSort').addEventListener('change',function(){applySort(this.value)});
    }
    var select=control.querySelector('#scriptSize');
    select.value=saved;
    var sortSelect=control.querySelector('#scriptSort');
    sortSelect.value=sort;
    control.querySelector('label[for="scriptSize"]').textContent=text('label');
    control.querySelector('label[for="scriptSort"]').textContent=text('sortLabel');
    Array.prototype.forEach.call(select.options,function(option){option.textContent=text(option.value)});
    Array.prototype.forEach.call(sortSelect.options,function(option){option.textContent=text(option.value)});
    applySize(saved);
  }

  var originalRenderMain=window.renderMain;
  window.renderMain=function(){originalRenderMain();addControl()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addControl);else addControl();
})();