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
js/ui-preferences.js    Card size and ordering preferences
js/feature-pack.js      Tags, views, pagination, reset, and language controls
Backup/sql_scripts.json Script database
```