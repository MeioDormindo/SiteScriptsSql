/* Doacao via Pix, contador de visitas e data da ultima atualizacao (rodape da barra lateral). */
(function(){
  /* Payload "Pix Copia e Cola" (BR Code) da chave aleatoria, o mesmo do projeto CLT_VS_PJ.
     O QR Code em img/pix-qr.svg foi gerado a partir deste texto: se a chave mudar, gere os dois de novo. */
  var PIX_PAYLOAD='00020126580014br.gov.bcb.pix01362108ccd9-3137-493e-a1a0-65da48ea840c5204000053039865802BR5913Siryus Canuto6009SAO PAULO62070503***6304378B';
  var PIX_NAME='Siryus Canuto';
  var COUNTER_URL='https://abacus.jasoncameron.dev/{op}/meiodormindo-sitescriptssql/visits';
  var COMMITS_URL='https://api.github.com/repos/MeioDormindo/SiteScriptsSql/commits?per_page=1';
  var LOCALES={pt:'pt-BR',en:'en-US',es:'es-ES',fr:'fr-FR',de:'de-DE',it:'it-IT',zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',ru:'ru-RU'};
  var stats={visits:null,updatedAt:null};

  var texts={
    pt:{donateTitle:'Curtiu? Me paga um café',donateText:'O site é gratuito e sem anúncios. Se os scripts te ajudaram, uma doação via Pix ajuda a manter o projeto — em qualquer valor, e totalmente opcional.',pixCode:'Pix copia e cola',pixCopy:'Copiar código Pix',pixCopied:'Código Pix copiado',visitsLabel:'Visitas',lastUpdateLabel:'Última atualização'},
    en:{donateTitle:'Enjoying it? Buy me a coffee',donateText:'This site is free and ad-free. If these scripts helped you, a Pix donation helps keep the project going — any amount, entirely optional.',pixCode:'Pix copy and paste',pixCopy:'Copy Pix code',pixCopied:'Pix code copied',visitsLabel:'Visits',lastUpdateLabel:'Last update'},
    es:{donateTitle:'¿Te gustó? Invítame un café',donateText:'El sitio es gratuito y sin anuncios. Si los scripts te ayudaron, una donación por Pix ayuda a mantener el proyecto — cualquier valor, totalmente opcional.',pixCode:'Pix copiar y pegar',pixCopy:'Copiar código Pix',pixCopied:'Código Pix copiado',visitsLabel:'Visitas',lastUpdateLabel:'Última actualización'},
    fr:{donateTitle:'Ça vous plaît ? Offrez-moi un café',donateText:'Le site est gratuit et sans publicité. Si ces scripts vous ont aidé, un don par Pix aide à maintenir le projet — quel que soit le montant, entièrement facultatif.',pixCode:'Pix copier-coller',pixCopy:'Copier le code Pix',pixCopied:'Code Pix copié',visitsLabel:'Visites',lastUpdateLabel:'Dernière mise à jour'},
    de:{donateTitle:'Gefällt es dir? Spendier mir einen Kaffee',donateText:'Die Seite ist kostenlos und werbefrei. Wenn dir die Skripte geholfen haben, unterstützt eine Pix-Spende das Projekt — jeder Betrag, völlig freiwillig.',pixCode:'Pix Copy & Paste',pixCopy:'Pix-Code kopieren',pixCopied:'Pix-Code kopiert',visitsLabel:'Besuche',lastUpdateLabel:'Letzte Aktualisierung'},
    it:{donateTitle:'Ti è utile? Offrimi un caffè',donateText:'Il sito è gratuito e senza pubblicità. Se gli script ti sono stati utili, una donazione via Pix aiuta a mantenere il progetto — qualsiasi importo, del tutto facoltativa.',pixCode:'Pix copia e incolla',pixCopy:'Copia codice Pix',pixCopied:'Codice Pix copiato',visitsLabel:'Visite',lastUpdateLabel:'Ultimo aggiornamento'},
    zh:{donateTitle:'觉得有用？请我喝杯咖啡',donateText:'本网站免费且无广告。如果这些脚本对你有帮助，通过 Pix 捐赠可以支持项目的维护——金额不限，完全自愿。',pixCode:'Pix 复制粘贴码',pixCopy:'复制 Pix 代码',pixCopied:'Pix 代码已复制',visitsLabel:'访问量',lastUpdateLabel:'最后更新'},
    ja:{donateTitle:'気に入りましたか？コーヒーをおごってください',donateText:'このサイトは無料で広告もありません。スクリプトが役に立った場合、Pix での寄付がプロジェクトの維持に役立ちます。金額は自由で、完全に任意です。',pixCode:'Pix コピー＆ペースト',pixCopy:'Pix コードをコピー',pixCopied:'Pix コードをコピーしました',visitsLabel:'訪問数',lastUpdateLabel:'最終更新'},
    ko:{donateTitle:'마음에 드셨나요? 커피 한 잔 사주세요',donateText:'이 사이트는 무료이며 광고가 없습니다. 스크립트가 도움이 되었다면 Pix 후원이 프로젝트 유지에 도움이 됩니다. 금액은 자유이며 전적으로 선택 사항입니다.',pixCode:'Pix 복사 및 붙여넣기',pixCopy:'Pix 코드 복사',pixCopied:'Pix 코드가 복사되었습니다',visitsLabel:'방문 수',lastUpdateLabel:'마지막 업데이트'},
    ru:{donateTitle:'Понравилось? Угостите меня кофе',donateText:'Сайт бесплатный и без рекламы. Если скрипты вам помогли, пожертвование через Pix поможет поддерживать проект — любая сумма, полностью по желанию.',pixCode:'Pix «скопировать и вставить»',pixCopy:'Скопировать код Pix',pixCopied:'Код Pix скопирован',visitsLabel:'Посещения',lastUpdateLabel:'Последнее обновление'}
  };
  Object.keys(texts).forEach(function(lang){if(TR[lang])Object.assign(TR[lang],texts[lang])});

  function locale(){return LOCALES[S.lang]||'pt-BR'}

  function renderStats(){
    var visits=document.getElementById('visitCount');var updated=document.getElementById('lastUpdate');
    if(visits)visits.textContent=stats.visits===null?'—':Number(stats.visits).toLocaleString(locale());
    if(updated)updated.textContent=stats.updatedAt?new Date(stats.updatedAt).toLocaleDateString(locale(),{day:'2-digit',month:'short',year:'numeric'}):'—';
  }

  function cached(key,loader){
    try{var value=sessionStorage.getItem(key);if(value!==null)return Promise.resolve(value)}catch(e){}
    return loader().then(function(value){try{sessionStorage.setItem(key,value)}catch(e){}return value});
  }

  function getJson(url){return fetch(url,{cache:'no-store'}).then(function(resp){if(!resp.ok)throw new Error('HTTP '+resp.status);return resp.json()})}

  /* Conta uma visita por sessao do navegador. Abrindo pelo arquivo local ou localhost, so le o total para nao inflar o numero. */
  function loadVisits(){
    var published=/^https?:$/.test(location.protocol)&&!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    return cached('sqlScriptVisits',function(){return getJson(COUNTER_URL.replace('{op}',published?'hit':'get')).then(function(r){return String(r.value)})})
      .then(function(value){stats.visits=value}).catch(function(){});
  }

  /* Data do ultimo commit do repositorio; sem acesso a API, usa a data de modificacao da pagina. */
  function loadLastUpdate(){
    return cached('sqlScriptLastUpdate',function(){return getJson(COMMITS_URL).then(function(r){return r[0].commit.committer.date})})
      .then(function(value){stats.updatedAt=value}).catch(function(){stats.updatedAt=document.lastModified});
  }

  window.copyPixCode=function(){
    function done(){showToast(t('pixCopied'),'success')}
    function fallback(){var field=document.getElementById('pixPayload');field.focus();field.select();try{if(document.execCommand('copy'))done()}catch(e){}}
    if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(PIX_PAYLOAD).then(done,fallback);else fallback();
  };

  var originalRender=window.render;
  window.render=function(){originalRender();renderStats()};

  document.getElementById('pixPayload').value=PIX_PAYLOAD;
  document.getElementById('pixName').textContent=PIX_NAME;
  renderStats();
  Promise.all([loadVisits(),loadLastUpdate()]).then(renderStats);
})();
