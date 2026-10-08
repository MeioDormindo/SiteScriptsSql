# Testes

Testes de navegador, sem dependências: um servidor local em PowerShell e o Edge headless.

```powershell
# 1. Gerar as páginas de teste a partir do index.html atual
.\tests\make-pages.ps1
# 2. Subir o servidor (porta 8765) em outro terminal
.\tests\serve.ps1
# 3. Rodar uma suíte (o resultado sai no terminal)
.\tests\run-tests.ps1 -Page test.html                     # 84 testes com Supabase simulado
.\tests\run-tests.ps1 -Page test.html -Query layout=novo  # os mesmos, no layout novo
.\tests\run-tests.ps1 -Page persist.html                  # cache local (IndexedDB)
.\tests\run-tests.ps1 -Page bench.html -Seconds 400       # desempenho com 1k/5k/10k scripts
```

- `test/mock-supabase.js` simula o Supabase em memória: RLS, trigger LWW e RPCs.
- `test/stub-net.js` responde com valores fixos o contador de visitas e a API do GitHub.
- `test/e2e-tests.js` roda contra o Supabase real e recebe e-mail e senha pela URL (`?e=...&p=...`). As credenciais nunca ficam no código.
- `cdp.mjs` e `seed.mjs` (Node 22+) controlam o Edge pelo DevTools Protocol, para screenshots e teclas reais. Servem para a comparação visual do layout Clássico com um baseline em `tests/base` (veja o comentário em `make-pages.ps1`).
