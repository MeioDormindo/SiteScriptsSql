/* Respostas fixas para o contador de visitas e a API do GitHub usados pelo donate.js (testes deterministas, sem gastar limite da API). */
(function(){
  var f=window.fetch;
  function json(body){return Promise.resolve(new Response(body,{status:200,headers:{'Content-Type':'application/json'}}))}
  window.fetch=function(u){
    var s=String(u&&u.url||u);
    if(/abacus\.jasoncameron\.dev/.test(s))return json('{"value":1234}');
    if(/api\.github\.com\/repos\/MeioDormindo\/SiteScriptsSql\/commits/.test(s))return json('[{"commit":{"committer":{"date":"2026-10-08T12:00:00Z"}}}]');
    return f.apply(this,arguments);
  };
})();
