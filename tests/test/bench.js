(async function(){
  var out=[];
  function post(text){try{fetch('/__result',{method:'POST',body:text})}catch(e){}}
  function ms(t0){return Math.round(performance.now()-t0)}
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
  var SQL="SELECT c.CustomerId, c.Name, SUM(o.Total) AS Total\nFROM dbo.Customers c WITH (NOLOCK)\nINNER JOIN dbo.Orders o ON o.CustomerId = c.CustomerId\nWHERE o.CreatedAt >= DATEADD(DAY,-30,GETDATE())\nGROUP BY c.CustomerId, c.Name\nORDER BY Total DESC;\n";
  try{
    await Core.whenReady;await sleep(500);
    for(var n of [1000,5000,10000]){
      S.data.scripts=[];S.data.folders=[];await Core.saveRaw();Core.rebuildShadow();
      var f=uid();S.data.folders.push({id:f,name:'Bench',parentId:null,createdAt:now()});
      for(var i=0;i<n;i++){
        var content=SQL.repeat(1+(i%40));   /* ~0,3 KB a 12 KB, media ~6 KB */
        S.data.scripts.push({id:uid(),name:'Script '+i,content:content,categoryId:S.data.categories[i%S.data.categories.length].id,folderId:f,createdAt:now(),updatedAt:now(),tags:['bench','t'+(i%7)],versions:i%5===0?[{content:content,savedAt:now()},{content:content,savedAt:now()}]:[],favorite:false,pinned:false});
      }
      var bytes=JSON.stringify(S.data).length;
      var t0=performance.now();await save();var firstSave=ms(t0);
      t0=performance.now();Core.track();var trackOnly=ms(t0);
      t0=performance.now();await Core.saveRaw();var dbWrite=ms(t0);
      var s=S.data.scripts[Math.floor(n/2)];
      t0=performance.now();s.favorite=!s.favorite;await save();var smallEdit=ms(t0);
      t0=performance.now();render();var renderMs=ms(t0);
      t0=performance.now();onSearch('Script 4');var searchMs=ms(t0);onSearch('');
      t0=performance.now();var loaded=await dbLoad();var dbRead=ms(t0);
      out.push('N='+n+' tamanho='+(bytes/1048576).toFixed(1)+'MB | 1o save='+firstSave+'ms | edicao pequena (favoritar)='+smallEdit+'ms [track='+trackOnly+'ms, gravar IndexedDB='+dbWrite+'ms] | render='+renderMs+'ms | busca='+searchMs+'ms | ler IndexedDB='+dbRead+'ms ('+loaded.scripts.length+' scripts)');
      post('LIVE\n'+out.join('\n'));
    }
  }catch(e){out.push('EXCEPTION '+(e&&e.stack||e))}
  post('RESULT\n'+out.join('\n'));
})();
