# SQL Script Manager

## Português

Gerenciador local de scripts SQL Server. A aplicação funciona diretamente no navegador e salva os dados no IndexedDB.

### Como usar

1. Abra o arquivo `index.html` em um navegador moderno, preferencialmente Chrome ou Edge.
2. Crie scripts pelo botão **Novo Script** ou importe um arquivo JSON pelo botão **Importar Banco**.
3. Use a busca, pastas, categorias, tags, favoritos e scripts fixados para encontrar os comandos.
4. Escolha a apresentação **Blocos**, **Linhas** ou **Tabela**.
5. Use **PT**, **EN**, **ES**, **FR**, **DE**, **IT**, **ZH**, **JA**, **KO** ou **RU** em **Configurações > Tema / Idioma**.

### Banco de scripts

O banco versionado do projeto está em `Backup/sql_scripts.json`.

URL correta para importar a versão publicada:

`https://raw.githubusercontent.com/MeioDormindo/SiteScriptsSql/main/Backup/sql_scripts.json`

O arquivo deve conter `scripts`, `folders` e `categories`. O aplicativo mantém os dados importados no armazenamento local do navegador.

### Recursos

- Destaque de sintaxe SQL na visualização.
- Busca por texto, `tag:`, `folder:`, `category:`, `favorite` e `pinned`.
- Paginação com 12, 24 ou 48 scripts.
- Tamanho de cards configurável.
- Favoritos, fixação, tags e histórico básico de versões.
- Detecção de conteúdo duplicado ao salvar.
- Atalhos: `Ctrl + K` busca, `Ctrl + N` novo script e `Ctrl + S` salvar.
- **Resetar aplicativo** em Configurações restaura os dados locais e não apaga o JSON de backup.
- Scripts protegidos por senha (AES-GCM, criptografados no navegador).
- Conta opcional na nuvem e listas compartilhadas (veja abaixo).

### Listas compartilhadas

Em **Compartilhados**, na barra lateral, o botão **+** assina uma lista de outra pessoa:

- **GitHub / URL**: informe `usuario/repositorio`, um link do GitHub ou a URL direta de um JSON. Sem branch, o app tenta `main` e depois `master`; sem arquivo, tenta `sql_scripts.json` e depois `Backup/sql_scripts.json`. O repositório precisa ser público. Exemplo: `MeioDormindo/SiteScriptsSql`.
- **Código**: informe um código no formato `SQL-XXXX-XXXX` (exige a nuvem configurada, mas não exige login).

As listas assinadas ficam somente leitura e são verificadas a cada 15 minutos (ajustável em **Configurações > Compartilhados**), ao abrir o app e ao voltar para a aba. Use **Copiar para meus scripts** ou **Copiar lista inteira** para editar uma cópia.

Para publicar, clique com o botão direito em uma pasta:

- **Exportar JSON para GitHub** baixa `sql_scripts.json`. Coloque-o na raiz de um repositório público e faça commit; cada novo commit chega a quem assina.
- **Compartilhar pasta…** publica a pasta (com subpastas) na nuvem e gera um código. Depois de alterar a pasta, use **Configurações > Minhas listas publicadas > Publicar alterações**.

Scripts protegidos por senha nunca entram em listas publicadas.

### Conta na nuvem (opcional)

O app continua funcionando sem conta. Com uma conta, scripts, pastas, categorias e assinaturas sincronizam entre aparelhos:

- Exclusões também sincronizam. Em conflito, vale a última alteração e a versão perdida vai para o histórico do script.
- Scripts protegidos por senha só saem do aparelho criptografados. O histórico de versões não é enviado.
- A senha da conta fica apenas no Supabase Auth, como hash bcrypt.
- **Esqueci minha senha** envia um link por e-mail. O link sempre obriga a definir uma nova senha e encerra as outras sessões.
- Antes da primeira sincronização num aparelho com dados, o app pergunta se deve combinar ou usar só os dados da nuvem e guarda um backup para download em **Configurações**.

### Configurar o Supabase (uma vez, pelo dono do site)

1. Crie um projeto gratuito em [supabase.com](https://supabase.com) (região São Paulo).
2. Em **SQL Editor**, cole e rode todo o arquivo [`supabase/schema.sql`](supabase/schema.sql). Ele pode ser rodado de novo com segurança.
3. Em **Authentication > Sign In / Providers > Email**: mantenha o provedor ligado, ative **Confirm email** e defina a senha mínima com 8 caracteres.
4. Em **Authentication > URL Configuration**:
   - **Site URL**: `https://meiodormindo.github.io/SiteScriptsSql/`
   - **Redirect URLs**: `https://meiodormindo.github.io/SiteScriptsSql/**`, `http://127.0.0.1:5500/**` e `http://localhost:5500/**` (testes locais).
5. Configure um **SMTP próprio** em **Authentication > Emails > SMTP Settings** (por exemplo Resend ou Brevo). O envio padrão do Supabase só entrega para membros do projeto e permite poucos e-mails por hora; sem SMTP próprio, confirmação de cadastro e recuperação de senha não chegam aos usuários.
6. Opcional: traduza os modelos de e-mail **Confirm signup** e **Reset password**, mantendo `{{ .ConfirmationURL }}`.
7. Em **Project Settings > API**, copie a **Project URL** e a chave **anon** (ou *publishable*) para [`js/cloud-config.js`](js/cloud-config.js). A chave anon é pública por design; quem protege os dados é o Row Level Security do schema. **Nunca** use a chave *service_role*.

Projetos gratuitos pausam após cerca de uma semana sem uso. Enquanto isso o app segue funcionando localmente; reative o projeto no painel do Supabase.

A recuperação de senha precisa do site aberto por `http(s)`. Abrindo o `index.html` como arquivo, o link do e-mail leva ao site publicado.

### Cuidados

Revise os scripts antes de executá-los em produção. Alguns comandos podem alterar bancos, índices, permissões, backups ou arquivos. O gerenciador apenas armazena e organiza os scripts; ele não executa SQL diretamente.

## English

Local SQL Server script manager. The application runs directly in a modern browser and stores data in IndexedDB.

### Usage

1. Open `index.html` in Chrome, Edge, or another modern browser.
2. Create scripts with **New Script** or import a JSON database with **Import DB**.
3. Use search, folders, categories, tags, favorites, and pinned scripts to find commands.
4. Choose **Blocks**, **Rows**, or **Table** view.
5. Choose **PT**, **EN**, **ES**, **FR**, **DE**, **IT**, **ZH**, **JA**, **KO**, or **RU** in **Settings > Theme / Language**.

The project database is stored in `Backup/sql_scripts.json`. Import the published database from:

`https://raw.githubusercontent.com/MeioDormindo/SiteScriptsSql/main/Backup/sql_scripts.json`

The application keeps imported data in the browser's local storage. **Reset application** clears local data but does not delete the backup JSON file.

### Shared lists and cloud account

Use **Shared > +** in the sidebar to subscribe to someone else's list:

- **GitHub / URL**: `user/repo`, a GitHub link, or a direct JSON URL. The app tries `main`, then `master`, and `sql_scripts.json`, then `Backup/sql_scripts.json`.
- **Code**: a `SQL-XXXX-XXXX` code. This needs the cloud to be configured, but no sign-in.

Subscribed lists are read-only. They are checked every 15 minutes (configurable), on startup, and when the tab regains focus. You can copy scripts into your own.

To share, right-click a folder:

- **Export JSON for GitHub**: commit the downloaded file to a public repository.
- **Share folder…**: publishes the folder to the cloud and gives you a code.

Password-protected scripts are never published.

An optional account syncs scripts, folders, categories and subscriptions across devices. Deletes sync too. Conflicts go to the latest change, and the losing version is kept in the script's history. Password-protected scripts are uploaded encrypted only, and version history stays on the device.

The account password is stored only by Supabase Auth, as a bcrypt hash. Password recovery always requires setting a new password and signs out other sessions.

Setup (site owner, once):

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor.
3. Enable email confirmation.
4. Set the Site URL and redirect URLs to the published site.
5. Configure custom SMTP. The built-in mailer only reaches project members.
6. Put the project URL and the anon key in [`js/cloud-config.js`](js/cloud-config.js). Never use the service_role key.

The Portuguese section above has the detailed steps.

Always review SQL before running it in production. The manager stores and organizes scripts; it does not execute SQL directly.

## Español

Administrador local de scripts para SQL Server. La aplicación funciona directamente en un navegador moderno y guarda los datos en IndexedDB.

### Uso

1. Abra `index.html` en Chrome, Edge u otro navegador moderno.
2. Cree scripts con **Nuevo script** o importe un banco JSON con **Importar banco**.
3. Use búsqueda, carpetas, categorías, etiquetas, favoritos y scripts fijados.
4. Elija la vista **Bloques**, **Filas** o **Tabla**.
5. Seleccione el idioma en **Configuración > Tema / Idioma**.

La base del proyecto está en `Backup/sql_scripts.json`. La URL publicada es:

`https://raw.githubusercontent.com/MeioDormindo/SiteScriptsSql/main/Backup/sql_scripts.json`

La opción **Restablecer aplicación** limpia los datos locales, pero no elimina el archivo JSON de respaldo. Revise siempre los scripts antes de ejecutarlos en producción.

## Français

Gestionnaire local de scripts SQL Server. Ouvrez `index.html` dans un navigateur moderne. Les données sont enregistrées dans IndexedDB. Utilisez les dossiers, catégories, tags, favoris, scripts épinglés et les vues **Blocs**, **Lignes** ou **Tableau**. Le fichier de données est `Backup/sql_scripts.json`. Vérifiez toujours les scripts avant une exécution en production.

## Deutsch

Lokaler SQL-Server-Skriptmanager. Öffnen Sie `index.html` in einem modernen Browser. Die Daten werden in IndexedDB gespeichert. Verwenden Sie Ordner, Kategorien, Tags, Favoriten, angeheftete Skripte sowie die Ansichten **Blöcke**, **Zeilen** und **Tabelle**. Die Datenbank befindet sich in `Backup/sql_scripts.json`. Prüfen Sie Skripte vor dem Einsatz in der Produktion.

## Italiano

Gestore locale di script SQL Server. Aprire `index.html` in un browser moderno. I dati vengono salvati in IndexedDB. Sono disponibili cartelle, categorie, tag, preferiti, script fissati e le viste **Blocchi**, **Righe** e **Tabella**. Il database si trova in `Backup/sql_scripts.json`. Controllare sempre gli script prima dell'esecuzione in produzione.

## 中文

SQL Server 本地脚本管理器。请使用现代浏览器打开 `index.html`，数据保存在 IndexedDB 中。应用支持文件夹、分类、标签、收藏、置顶脚本以及 **块**、**行** 和 **表格**视图。数据文件位于 `Backup/sql_scripts.json`。在生产环境执行脚本前请务必检查内容。

## 日本語

SQL Server 用のローカルスクリプト管理ツールです。最新のブラウザーで `index.html` を開いてください。データは IndexedDB に保存されます。フォルダー、カテゴリ、タグ、お気に入り、固定スクリプト、**ブロック**、**行**、**テーブル**表示に対応しています。データベースは `Backup/sql_scripts.json` にあります。本番環境で実行する前に必ず SQL を確認してください。

## 한국어

SQL Server 로컬 스크립트 관리자입니다. 최신 브라우저에서 `index.html`을 열어 사용합니다. 데이터는 IndexedDB에 저장됩니다. 폴더, 카테고리, 태그, 즐겨찾기, 고정 스크립트와 **블록**, **행**, **테이블** 보기를 지원합니다. 데이터베이스 파일은 `Backup/sql_scripts.json`에 있습니다. 운영 환경에서 실행하기 전에 SQL을 반드시 검토하세요.

## Русский

Локальный менеджер скриптов SQL Server. Откройте `index.html` в современном браузере. Данные сохраняются в IndexedDB. Поддерживаются папки, категории, теги, избранное, закреплённые скрипты и представления **Блоки**, **Строки** и **Таблица**. Файл базы находится в `Backup/sql_scripts.json`. Перед запуском в рабочей среде обязательно проверьте SQL.

## Project structure

```text
index.html              HTML entry point
css/style.css           Application styles
js/app.js               Core application logic
js/i18n.js              Translations for ES, FR, DE, IT, ZH, JA, KO, RU (PT/EN live in app.js)
js/ui-preferences.js    Card size and ordering preferences
js/feature-pack.js      Tags, views, pagination, reset, password protection, and language controls
js/donate.js            Pix donation, visit counter, and last update date (sidebar footer)
js/cloud-i18n.js        Texts for account, sync and shared lists (all 10 languages)
js/sync-core.js         Change tracking, deletions (tombstones), import sanitizing, scheduler
js/cloud-config.js      Supabase project URL and public anon key
js/cloud.js             Account (sign-up, sign-in, password recovery) and cloud sync
js/sharing.js           Shared lists (GitHub/URL and share codes) and publishing
supabase/schema.sql     Database schema with Row Level Security (run in the Supabase SQL Editor)
img/pix-qr.svg          Pix QR Code generated from the payload in js/donate.js
Backup/sql_scripts.json Script database
```