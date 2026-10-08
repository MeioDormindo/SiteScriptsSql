> **Estado em 2026-10-08 (branch `layout-ide`, ainda não publicado no `main`)**
> - Feito: `css/a11y.css`, `css/ide.css`, `js/a11y.js`, `js/layout-ide.js`, `js/layout-i18n.js`, script de pré-pintura e atributos no `index.html`, evento `cloudStatus` no `cloud.js`, harness em `tests/`.
> - Verificado: suíte com mock 84/84 e persistência 12/12, nos layouts Clássico e Novo (`?layout=novo`).
> - Falta:
>   - comparação visual do Clássico com o baseline (pixels, DOM e estilos: `tests/cdp.mjs` + `tests/seed.mjs`; baseline = commit `3ceb7aa`);
>   - revisar screenshots do layout novo (escuro e claro, celular);
>   - testes de teclado com teclas reais e axe-core;
>   - README.
>   - Só depois: merge no `main`.
# Plano: layout novo "Novo (beta)" estilo IDE + correções de acessibilidade nos dois layouts

## Contexto

O layout atual (agora chamado **Clássico**) continua sendo o padrão. O pedido é criar um layout **completamente novo**, mais "tecnológico" e coerente com uma ferramenta de SQL, aplicando regras de IHC. Decisões já tomadas com você:

- **Visual:** estilo IDE (VS Code / DataGrip):
  - barra de atividades e explorador;
  - lista densa e painel de prévia acoplado;
  - barra de status;
  - fundo grafite com destaque ciano;
  - fonte mono para dados.
- **Escopo:** visual + interações:
  - prévia acoplada (clique seleciona, Enter abre);
  - paleta de comandos;
  - barra de status com o estado da sincronização em texto;
  - navegação completa por teclado;
  - menu ⋯ visível em pastas e categorias.
- **Clássico:** recebe as correções de acessibilidade **invisíveis** (atributos, teclado, foco). Nenhuma mudança visual.
- **Troca:** opção em Configurações "Layout: Clássico (padrão) / Novo (beta)", salva por aparelho, e o link `?layout=novo` para testar sem salvar.

**O que a leitura do código mostrou e muda o desenho:**
1. **Atalhos de teclado já ocupados.**
   - Ctrl+K já foca a busca (app.js:260).
   - Ctrl+N cria script (feature-pack.js:444), mas Chrome e Edge reservam essa combinação.
   - Por isso, novo script passa a ter **Alt+N** nos dois layouts. A paleta usa Ctrl+K e Ctrl+Shift+P apenas no layout novo.
2. **Esc fecha tudo de uma vez** (`closeModal();closeConfirm();hideCtx()` em app.js:260). Uma prévia acoplada fecharia junto com um confirm. Passa a fechar **só a camada de cima**.
3. **O menu de contexto se fecha sozinho em 5 s** (app.js:240-242 e sharing.js:433). Isso quebra o uso por teclado (WCAG 2.2.1). Enquanto o foco estiver dentro do menu, ele não fecha.
4. **O atalho "f" do feature-pack está morto.** Ele usa `S.filter.activeScript`, que ninguém define. Não vamos definir esse campo, senão F alternaria o favorito duas vezes.
5. **Os diálogos próprios do cloud.js não passam pelos wrappers.** `openOwn`/`closeOwn` chamam `openModal`/`closeModal` originais. Por isso, o estado dos modais vem de **MutationObserver**, não só de wrappers.
6. **Os módulos podem carregar antes ou depois do primeiro render**, porque o IndexedDB é assíncrono. Cada módulo novo decora o DOM ao carregar **e** embrulha as funções de render.
7. **As páginas de teste estão desatualizadas**: são cópias do index.html antigo (`v=20261007`). Passam a ser geradas a partir do index.html.

## Arquivos

| Arquivo | O que muda |
|---|---|
| `index.html` | Edita:<br>• script inline no `<head>` (layout e tema antes da pintura);<br>• `<link>` de `a11y.css` e `ide.css`;<br>• ids e atributos invisíveis;<br>• skip link;<br>• três `<script>` novos no fim;<br>• cache-buster novo em todos os assets. |
| `js/cloud.js` | Edita só 2 linhas:<br>• `Core.emit('cloudStatus',s)` dentro de `setStatus`;<br>• `Cloud.statusText=statusText`. |
| `css/a11y.css` | Novo. Vale para os dois layouts e só afeta:<br>• `:focus-visible`;<br>• `.sr-only`;<br>• `.skip-link`;<br>• anel de foco no card via `:has()`;<br>• `prefers-reduced-motion`;<br>• `forced-colors`. |
| `css/ide.css` | Novo. Toda regra prefixada com `html[data-layout="ide"]`: tokens, grade do shell, restyle. |
| `js/layout-i18n.js` | Novo. Cerca de 110 chaves nas 10 línguas, com fallback para o inglês (mesmo padrão do cloud-i18n.js). |
| `js/a11y.js` | Novo. Correções invisíveis para os dois layouts; expõe `window.A11y`. |
| `js/layout-ide.js` | Novo, em duas partes:<br>• **comum aos dois layouts:** API `window.Layout`, card "Layout" nas Configurações, espelho do tema, Alt+N;<br>• **só no IDE:** shell, barra de atividades, barra de status, prévia acoplada, teclado, menus ⋯, paleta, ajuda de atalhos. |
| `README.md` | Atalhos, troca de layout, estrutura do projeto. |

**Não são editados:**
- `app.js`, `feature-pack.js`, `sharing.js`, `sync-core.js` e `style.css`.

**Ordem de carregamento:** `… cloud.js → sharing.js → layout-i18n.js → a11y.js → layout-ide.js`. Os dois últimos ficam como wrappers mais externos.

## Arquitetura

### Pré-pintura (script inline no `<head>`, antes dos CSS)

Lê o layout e o tema antes da primeira pintura:
- `?layout=novo|ide|new|beta` ou `classico|clássico|classic`. O link tem prioridade e **não salva**; marca `data-layout-trial`.
- Sem link, usa `localStorage['sqlsm-layout']`.
- Define `data-layout` (`classic` ou `ide`) e `data-theme` (vindo de `localStorage['sqlsm-theme']`).

Isso também elimina o flash escuro que hoje aparece para quem usa tema claro. O tema é espelhado no localStorage em `Core.on('saved')`.

### Wrappers (do mais interno para o mais externo)

| Função | O que é acrescentado |
|---|---|
| `renderMain` | a11y: roles, rótulos, restauração de foco.<br>IDE: roving tabindex, `aria-current`, skeleton, estados vazios, barra de status. |
| `renderSidebar` | a11y: roles, tabindex, aria, restauração de foco.<br>IDE: botão ⋯, roving. |
| `updateTop` | `aria-label` e `aria-pressed` do cabeçalho; textos do shell (troca de idioma). |
| `openViewScript` + `openModal` | IDE: uma flag de uso único decide se a prévia é acoplada. Um observer em `#mHead` desacopla qualquer conteúdo "estrangeiro" (diálogos do cloud). |
| `openSettings` | Card "Layout", acrescentado por último via `setTimeout(0)`, depois do card do sharing. |
| `showToast`, `toggleHL`, `onSearch`, `hideCtx`, `toggleSidebar` | a11y:<br>• região live;<br>• `aria-pressed`;<br>• anúncio de resultados;<br>• menu com foco não fecha;<br>• `aria-expanded` e foco no drawer. |

- **Observers:** observam `#modalOvl`/`#confirmOvl` (classe), `#mHead`, `#mBody`/`#mFoot` (agrupados por frame, ignorando `#codeView`), `#confirmBox`, `#ctxContainer` e `#accountBtn` (title). **Só gravam atributos**, então não entram em loop.
- **Idempotência:**
  - Cada wrapper de render tem um contador de profundidade, então os renders aninhados do `fitPageToViewport` decoram uma única vez, no DOM final e com a lente do sharing já desmontada.
  - Nós injetados são verificados por marcador antes de criar.
- **Restauração de foco (dois layouts):**
  - Antes do render, guarda a chave do item focado: id do script + parte, ou a chave da barra lateral, + o índice.
  - Depois do render, refoca o mesmo item (`preventScroll`). Se ele sumiu, usa o mesmo índice; se não houver, `#mainContent`.
  - Mantém o lugar do usuário depois de F/P (que reordenam), exclusão, sync em segundo plano e paginação.
- **Nunca tocar:**
  - `#sidebarContent` em si;
  - o `onclick` dos cards;
  - os filhos dos cards (`div[title]`, `div[style*="JetBrains Mono"]`, `.script-card-actions`, `.script-tools`, `.empty-state`, `[data-ctx-*]`);
  - os ids usados por outros módulos (`#sName/#sCont/#sCat/#sFld`, `#mFoot .btn-accent`, `#setUrl`, `#hlToggle`, `#codeView`, filtros rápidos, `#accountBtn`, ids do Pix).
- **Clássico intocado visualmente.** Só mudam:
  - atributos (`role`, `tabindex`, `aria-*`, `for`, `inert`, `data-a11y-*`);
  - duas regiões `.sr-only`;
  - o skip link fora da tela;
  - o anel de foco, que só aparece com teclado.

  Sem classes, sem estilos e sem `title` novo.

  Os inputs de texto do Clássico mantêm o foco atual (borda de destaque), porque um anel nesses campos seria uma mudança visível. As falhas de contraste que já existem no Clássico ficam como estão; só o IDE as corrige.

## Layout IDE

### Shell

Grade com 3 linhas e 2 colunas:
- **Linhas:** cabeçalho 44px / corpo / status 32px.
- **Colunas:** barra de atividades 48px / corpo.

Altura `100dvh`. O JS injeta só no IDE `#ideActivity`, `#idePreviewSlot`, `#ideStatus` e `#idePalette`. A grade já reserva as células, então nada "pula".

**Explorador:** 264px. **Prévia:** `clamp(380px,36vw,760px)`.

A coluna de prévia é **fixa**: quando nada está aberto, mostra "Nenhum script selecionado" e a dica ↑↓/Enter. Assim, a lista não muda de largura.

A prévia acoplada reaproveita `#modalOvl` com a classe `.is-docked`: posição fixa na coluna, sem fundo escuro, sem sombra.

**Mobile (≤768px):**
- sem barra de atividades;
- mantém o drawer lateral atual;
- barra de status só com texto;
- prévia volta a ser o overlay normal.

### Cabeçalho

Da esquerda para a direita:
- menu (só no mobile);
- logo e nome;
- **busca** larga (máx. 560px, placeholder "Filtrar scripts…", chip `/`);
- botão **"Comandos  Ctrl K"**;
- **Novo script** como único botão de destaque;
- Importar .txt, Importar banco e Backup só como ícone, com `title` e `aria-label`;
- Sync URL;
- conta, tema e configurações.

No desktop, os filtros rápidos vão para a barra de atividades.

### Barra de atividades

`role=toolbar`, vertical, roving tabindex, botões 40×40.
- **Em cima:**
  - Explorador (mostrar/ocultar, salvo);
  - Paleta;
  - Favoritos, Fixados e Protegidos (com contador): chamam `toggleQuickFilter`, com `aria-pressed`;
  - Listas compartilhadas.
- **Embaixo:**
  - alternar painel de prévia (salvo);
  - Atalhos (?).

### Tipografia e tamanhos

- **Fontes:** DM Sans na interface, 13px. JetBrains Mono em dados: prévia da lista, código 13px/1.6, contagens, datas, caminhos, códigos de lista e teclas. As duas já são carregadas.
- **Rótulos de seção:** 11px, caixa alta.
- **Espaçamento:** 2, 4, 8, 12, 16, 24, 32. **Raio:** 4 / 6 / 8.
- **Alvos de clique:**
  - ícones 32px;
  - linhas do explorador 32px;
  - linhas da lista ≥56px;
  - 44px em telas de toque (`pointer:coarse`).

### Tokens de cor

O IDE **redefine as variáveis existentes** (`--bg0..4`, `--tx0..3`, `--acc`, `--acc2`, `--red`, `--grn`…), então os estilos inline que usam `var()` já mudam sozinhos. Todos atingem contraste ≥4,5:1 no texto e ≥3:1 no resto (medido).

| | Escuro | Claro |
|---|---|---|
| Fundo da lista / explorador / cards | #1f2228 / #1b1e23 / #23262c | #ffffff / #f3f5f7 / #ffffff |
| Barras de atividade e status | #15171b | #e8ebef |
| Seleção | #123a42 + barra 2px ciano | #d9f1f4 + barra 2px |
| Texto principal / secundário / fraco | #e6e8eb / #a7afba / #98a1ad | #1a1e24 / #56606c / #5f6975 |
| Destaque (ciano) | #3fc9d8, texto sobre ele #06181c | #006b79, texto branco |
| Foco | #5ee0ef | #007a8a |

**Sintaxe SQL**, com contraste mínimo ≥4,6:
- palavra-chave #6cb6ff / #0550ae;
- string #8fd694 / #116329;
- número #f2b36f / #953800;
- função #d2a8ff / #6639ba;
- comentário #a0a8b3 / #5f6b77.

**Categorias:**
- A cor **nunca é texto**: medimos de 2,5 a 4,2:1, abaixo do mínimo.
- Vira uma faixa de 3px à esquerda.
- O texto do selo usa `--tx1`.

**Seleção:**
- Não depende só da cor de fundo: a barra ciano (6,18:1) também marca a linha.

### Lista, tabela e blocos (só CSS, sobre seletores estruturais existentes)

- **Linhas (padrão):** grade de duas linhas com **altura uniforme** de ≥56px, para a paginação "cabe na tela" continuar exata.
  - Linha 1: nome, caminho da pasta (mono, com reticências) e meta (mono, 11px).
  - Linha 2: prévia do SQL em uma linha.
  - Tags ficam ocultas na lista e aparecem na prévia.
- **Ações ★ e fixar:** à direita, aparecem no hover, no foco, na seleção ou quando estão ativas. Sempre visíveis em telas de toque.
- **Tabela:** linhas de 40px, mono.
- **Blocos:** só os tokens novos, sem animação de "subir".
- **Linha selecionada:** `[aria-current="true"]`, sem mudar o tamanho da caixa.

### Estados

- **Vazio** (sem scripts): o conteúdo atual + "Alt+N cria um script · Ctrl+K abre os comandos".
- **Vazio** (os filtros não acham nada): botão **"Limpar filtros"**.
- **Carregando** (antes do IndexedDB): linhas skeleton e "Carregando…" na barra de status.
- **Animação:** 120–160ms. Com `prefers-reduced-motion`, tudo vira instantâneo, nos dois layouts.

## Interações (heurísticas de Nielsen)

### Prévia acoplada (master-detail)

Disponível a partir de 1100px.
- **Clique ou Enter numa linha:** abre a prévia, que move `aria-current` para a linha. O foco **continua na lista**.
- **↑↓ com a prévia aberta:** a prévia acompanha, com 150ms de debounce.
- **Tab ou F6:** entra na prévia.
- **Atalhos:** E, C, F, P e Delete agem sobre o script previsto.
- **Esc:** fecha a prévia e devolve o foco à linha.
- **Botão Cancelar do rodapé:** fica oculto na prévia; o X continua.

Editar, histórico, ajuda, configurações e os diálogos do cloud **substituem** a prévia como overlay normal. Ao fechar, a prévia volta, a menos que o próprio usuário a tenha fechado.

Abaixo de 1100px, ou com o painel recolhido, a prévia funciona como hoje: overlay com semântica de diálogo.

**Listas compartilhadas:** a prévia funciona normalmente. E, F, P e Delete mostram "Lista somente leitura: use Copiar para meus scripts".

### Paleta de comandos

- **Como abre:** Ctrl/Cmd+K ou Ctrl+Shift+P (só no IDE), o botão "Comandos" ou a barra de atividades. Fica bloqueada durante a troca de senha obrigatória.
- **Semântica:** diálogo modal com `combobox` + `listbox`, `aria-activedescendant` e anúncio "N resultados".
- **O que busca:**
  - scripts (nome, tags, pasta e categoria; o conteúdo não);
  - pastas, categorias e listas (aplicam o filtro);
  - comandos.

  A busca ignora acentos e aceita fuzzy. Com o prefixo `>`, só comandos.
- **Comandos disponíveis:**
  - novo, importar .txt, importar banco, backup;
  - configurações, tema, voltar ao clássico;
  - assinar lista, verificar listas;
  - sincronizar agora e conta;
  - modo de exibição;
  - filtros e limpar filtros;
  - ir para busca / explorador / lista / prévia;
  - mostrar ou ocultar painéis;
  - atalhos.

  **Resetar fica de fora**, por ser destrutivo.
- **Recentes** quando o campo está vazio. O último item é sempre "Filtrar a lista por 'q'".
- **Teclas:**
  - ↑↓ (circular) e PgUp/PgDn;
  - Enter abre a prévia;
  - Ctrl+Enter edita;
  - Shift+Enter copia;
  - Esc fecha e devolve o foco.

### Teclado (IDE)

| Onde | Teclas |
|---|---|
| Global | • Ctrl+K / Ctrl+Shift+P: paleta<br>• Alt+N: novo<br>• `/`: busca<br>• `?`: ajuda<br>• F6 / Shift+F6: alterna áreas (a paleta tem "Ir para…" como alternativa)<br>• Esc: fecha a camada de cima |
| Linha da lista | • ↑↓ (nos blocos também ←→)<br>• Home/End<br>• PgUp/PgDn troca de página<br>• Enter/Espaço: prévia<br>• E: editar<br>• C: copiar<br>• F: favoritar<br>• P: fixar<br>• Delete: excluir (com confirmação) |
| Explorador | • ↑↓, Home/End<br>• Enter: filtra<br>• Shift+F10 / tecla Menu: menu<br>• F2: renomear<br>• Delete: excluir (com confirmação) |
| Menus (dois layouts) | • ↑↓, Home/End, Enter<br>• Esc/Tab fecham e devolvem o foco |

- Teclas simples são ignoradas dentro de campos, durante composição (IME) e com Ctrl/Alt/Meta.
- **WCAG 2.1.4:** o card "Layout" tem a opção **"Atalhos de tecla única"** para desligar `/` e `?`. E, C, F, P e Delete só funcionam com foco na linha ou na prévia.

### Menus ⋯

**IDE:** botão ⋯ fixo de 24px em pastas, categorias e listas.
- Aparece no hover, no foco ou na seleção; sempre visível em telas de toque.
- Abre o **mesmo** menu de contexto de hoje, incluindo os itens de compartilhar do sharing, já com foco no primeiro item.

**Teclado (nos dois layouts):** Shift+F10 ou a tecla Menu.

### Barra de status

- **Sincronização** (botão): bolinha + **texto**.
  - Estados: "Sincronizado", "Pendente", "Sincronizando", "Sem conexão", "Erro na sincronização" (detalhe no `title`), "Entrar para sincronizar" e "Somente neste aparelho".
  - O clique faz a ação que o estado pede.
- **Contexto:** "Todos os scripts", "Pasta: A › B", "Categoria: X" ou "Lista: Nome", seguido da busca e dos filtros ativos.
- **Contagem** (mono): "12 de 140 scripts".
- **Modo de exibição:** o clique alterna.
- **"Layout: Novo (beta)":** volta ao Clássico, com confirmação.
- **"? Atalhos".**
- **Anúncios:** só os erros e a perda de conexão, para não poluir.

### Ajuda de atalhos

Modal com tabela (`th scope`, `<kbd>`) em cinco grupos:
- Geral;
- Lista;
- Explorador;
- Prévia;
- Editor.

### Troca de layout

- **Card "Layout" nas Configurações:** rádios "Clássico (padrão)" / "Novo (beta)", descrição, botão **"Aplicar e recarregar"** (não troca só ao marcar o rádio), opção de teclas simples.
- **Com `?layout=`:** o card mostra "Você está testando … Preferência salva: X" e o botão **"Usar sempre"**.
- **Ao aplicar:** salva a escolha, remove o parâmetro e recarrega depois do `Core.whenReady`.
- **A escolha sobrevive** ao reset local, como o tema e o idioma.

## Acessibilidade nos dois layouts (a11y.js + a11y.css)

| Elemento | Correção | WCAG |
|---|---|---|
| Botões do cabeçalho | `aria-label` com o mesmo texto visível; no mobile, `.hide-m` esconde o texto. Filtros rápidos e tema com `aria-pressed`. `#menuBtn` com `aria-expanded` e foco no drawer. | 1.1.1, 4.1.2, 2.5.3 |
| Busca | `aria-label`, wrapper com `role=search`; anúncio "N scripts encontrados". | 1.3.1, 4.1.3 |
| Barra lateral | `navigation` com rótulo e seções como `heading`.<br>Itens como `button` com `tabindex=0`, Enter/Espaço, `aria-current` e `aria-expanded`.<br>Menu com Shift+F10. | 1.3.1, 2.1.1, 4.1.2 |
| Menus de contexto | `menu`/`menuitem`, navegação por setas, Esc devolve o foco, não fecham sozinhos com foco dentro. | 2.1.1, 2.1.2, 2.2.1 |
| Cards | Grade como `list`, card como `listitem`, nome como `button` com Enter/Espaço.<br>★ e fixar com `aria-label` e `aria-pressed`. | 1.3.1, 2.1.1, 4.1.2 |
| Paginação | `navigation`; ‹ › com rótulo; "Página N" com `aria-current=page`. | 1.1.1, 1.3.1 |
| Modal | `dialog aria-modal`, título associado, foco inicial, Tab circular, foco restaurado ao fechar, fundo `inert`. | 4.1.2, 2.4.3, 2.4.11 |
| Confirm / senha | `alertdialog` com a mensagem descrita.<br>Foco na caixa, não num botão: alguns "Cancelar" são destrutivos.<br>**Esc fecha só ele.** | 4.1.2, 3.3.4 |
| `#codeView` | Rolável por teclado (`tabindex=0`, region). `#hlToggle` com `aria-pressed`. | 2.1.1, 4.1.2 |
| Campos | `label for` nos rótulos sem associação. `aria-label` em conteúdo, URL, hex e senhas. | 1.3.1, 3.3.2 |
| Erros e toasts | `role=alert`. Toasts copiados para regiões live (polite; erros assertive). | 3.3.1, 4.1.3 |
| Foco | • Anéis de foco só com teclado: no Clássico na cor `--acc2`, no IDE na cor de foco.<br>• Skip link "Pular para a lista de scripts".<br>• Foco restaurado depois de re-render. | 2.4.7, 2.4.1, 2.4.3 |
| Movimento / alto contraste | `prefers-reduced-motion` e `forced-colors`. | 2.3.3 |

## i18n

`js/layout-i18n.js`, nas 10 línguas, com fallback para o inglês. Grupos de chaves:
- `a11y*`: rótulos, skip, resultados, paginação;
- `layout*` e `singleKeys`: card de configurações;
- `ide*`: shell;
- `st*`: barra de status;
- `pv*`: prévia;
- `pal*`: paleta;
- `cmd*`: comandos;
- `kb*`: ajuda de atalhos;
- `emptyFiltered` e `emptyHint`.

Reaproveita as chaves existentes:
- `newScript`, `importTxt`, `importDB`, `backupDB`, `settings`;
- `syncSynced/Pending/Running/Offline`, `syncNow`;
- `shSubscribe`, `shCheckAll`, `shClose`;
- `favoritesFilter`, `pinnedFilter`, `protectedFilter`;
- `rowsView`, `blocksView`, `tableView`, `allScripts`.

## Riscos

**Riscos e mitigações:**
- **Diálogos do cloud fora dos wrappers.** Todo o estado vem de observers. Testar a troca de senha obrigatória e o "combinar dados" com a prévia acoplada.
- **Renders aninhados e paginação "cabe na tela".** Só atributos depois do render; altura de linha uniforme no IDE; nenhuma classe que mude o tamanho da caixa.
- **Focus trap vs. prévia acoplada.** Acoplada é uma *região*: sem trap e sem `inert`. Overlay é um *diálogo*.
- **F6 pode ser capturado pelo navegador.** A paleta tem "Ir para…" como alternativa.
- **Cache do GitHub Pages.** Bump do `?v=` de todos os assets no mesmo commit.

**Fora da v1:**
- divisores redimensionáveis;
- barra de abas no mobile;
- números de linha e minimap;
- troca de layout sem recarregar;
- editar dentro da prévia (risco de perder edição ao trocar de linha);
- busca da paleta dentro de listas compartilhadas;
- multi-seleção.

## Verificação

1. **Harness estável:**
   - Copiar o harness do scratchpad para `E:\Site\Script\_sqlsm-tests`, fora do repo.
   - `make-pages.ps1` gera as páginas de teste **a partir do index.html**, trocando o SDK pelo mock e a config pela de teste e injetando a suíte.
   - Baseline via `git archive 3ceb7aa` em `/base/`.
   - Novos parâmetros no `run-tests.ps1`: `-Query`, `-Width/-Height`, `-ReducedMotion`.
2. **Regressão:**
   - As suítes atuais (84 mock, e2e, persist 12) passam **no Clássico e com `?layout=novo`**.
   - Benchmark: o render no IDE fica dentro de +15% do Clássico em 1k, 5k e 10k scripts.
3. **`a11y-tests.js` (Clássico):**
   - atributos;
   - Enter/Espaço na barra lateral e nos cards;
   - Shift+F10 abre o menu com foco, ↓ navega, Esc devolve o foco;
   - o menu não fecha em 5s com foco dentro;
   - modal: trap, Tab circular e restauração;
   - Esc num confirm sobre um modal fecha só o confirm;
   - Esc no "descartar alterações?" mantém o editor;
   - toasts chegam na região live;
   - F mantém o foco no mesmo script depois de reordenar.
4. **`ide-tests.js`:**
   - O shell aparece uma única vez depois dos renders aninhados.
   - Preferência: `?layout=novo` não grava, e `?layout=classico` vence uma preferência `ide` salva.
   - Paleta: Ctrl+K, filtro, `aria-activedescendant`, Enter acopla a prévia, `>` mostra só comandos, Esc devolve o foco.
   - Lista: ↑↓ move o único `tabindex=0`; E abre o editor como diálogo; Cancelar restaura a prévia; Delete abre o confirm.
   - Prévia com diálogo do cloud por cima fica desacoplada; abaixo de 1100px, overlay.
   - Barra de status: contagem e `cloudStatus='error'`.
   - O ⋯ abre o menu com os itens de compartilhar; em lista compartilhada, E mostra o aviso de somente leitura.
   - O skeleton aparece antes do IndexedDB carregar.
5. **axe-core** (versão fixa, WCAG 2.2 AA):
   - **Cenários:** lista (3 modos), prévia, editor, configurações, confirm, senha, menu, paleta, ajuda, vazio, lista compartilhada e mobile.
   - **Temas:** cada cenário no escuro e no claro.
   - **Meta no IDE:** 0 serious/critical.
   - **Meta no Clássico:** nenhuma violação nova contra `/base`; `button-name`, `label`, `aria-dialog-name` e `scrollable-region-focusable` devem cair.
6. **Clássico visualmente igual**, medido de três formas:
   - DOM normalizado, removendo os atributos permitidos;
   - `getComputedStyle` dos elementos principais;
   - **diff de pixels** de screenshots 1400×900 e 390×844, base vs. novo. Esperado: 0.
7. **Screenshots para você revisar:**
   - Clássico, escuro e claro;
   - IDE, escuro e claro, em: lista, prévia, paleta, ajuda, card de layout, vazio, editor e mobile.
8. **Manual:**
   - percorrer tudo só com teclado;
   - NVDA rápido;
   - Alto Contraste do Windows;
   - zoom de 200% e largura de 320px;
   - movimento reduzido.

## Fases (cada uma pode ser publicada sozinha)

| Fase | Escopo |
|---|---|
| P0 | Harness:<br>• gerador de páginas;<br>• baseline;<br>• diffs de DOM, estilo e pixels;<br>• axe. |
| P1 | Base de acessibilidade (Clássico com diff visual zero):<br>• `a11y.css`, `a11y.js`;<br>• chaves a11y;<br>• atributos e skip link no index.html;<br>• hook do cloud.js;<br>• Alt+N;<br>• espelho do tema. |
| P2 | Fundação do layout novo:<br>• script de pré-pintura;<br>• API Layout, card e `?layout=`;<br>• `ide.css` (tokens, shell, cabeçalho, restyle);<br>• barras de atividade e status;<br>• skeleton e estados vazios. |
| P3 | Prévia e navegação:<br>• prévia acoplada, seleção e regra de restauração;<br>• roving na lista, no explorador e na barra de atividades;<br>• menus ⋯, F2 e Delete. |
| P4 | Paleta e atalhos:<br>• paleta, comandos e recentes;<br>• ajuda de atalhos;<br>• opção de teclas simples. |
| P5 | Acabamento:<br>• traduções nas 10 línguas;<br>• README;<br>• revisão das screenshots e passe manual de acessibilidade;<br>• bump de cache;<br>• branch `layout-ide` e commit/publicação só com o seu ok. |
