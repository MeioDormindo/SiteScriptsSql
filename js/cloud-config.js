/* Configuracao da nuvem (Supabase). Enquanto url/anonKey estiverem vazios, o app funciona so localmente
   e os recursos de conta e de listas por codigo ficam ocultos (assinaturas por GitHub/URL continuam funcionando).

   Onde achar: painel do Supabase > Project Settings > API (ou API Keys):
   - url:     "Project URL", ex.: https://abcdefghijklmnop.supabase.co
   - anonKey: chave "anon" / "publishable" (publica por design; a seguranca vem do Row Level Security).
   NUNCA coloque aqui a chave "service_role" / "secret". */
window.CLOUD_CONFIG={
  url:'https://lcgoxbqxvndpjzirnmrq.supabase.co',
  anonKey:'sb_publishable_cTnYwhCxyQGrCed5LVPaZg_qxzvBu2D',
  siteUrl:'https://meiodormindo.github.io/SiteScriptsSql/',
  minPassword:8
};
