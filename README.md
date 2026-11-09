# Digital курсы

Сайт онлайн-школы цифровых профессий на трёх языках (RU, UZ, EN) с AI-ассистентом, который отвечает по документам школы (RAG, Gemini). Next.js 16, TypeScript, Tailwind.

## Запуск

```bash
npm install
cp .env.example .env.local   # впишите GEMINI_API_KEY
npm run ingest               # строит индекс по папке knowledge/
npm run dev                  # http://localhost:3000
```

Проверка перед выкладкой: `npm run build && npm run lint`.

## Данные: папка `knowledge/`

Единственное хранилище данных, базы данных нет.

- `catalog.xlsx` — курсы и наставники для сайта (листы `Courses` и `Teachers`). Добавили строку — курс появился на сайте, удалили — исчез, `active = FALSE` — скрыт.
- Остальные файлы (`.txt .md .pdf .docx .xlsx .xls .csv`) читает ассистент. Изменения подхватываются сами, индекс (`data/index.json`) пересобирается только для изменённых файлов.
- Сейчас там вымышленные тестовые данные. Замените их настоящими.

## Google Drive

Папка на Drive заменяет `knowledge/`: файлы скачиваются, изменённые (по `modifiedTime`) обновляются, удалённые на Drive удаляются и на сайте. Google Docs превращаются в `.docx`, Google Sheets в `.xlsx`.

Настройка один раз:

1. В [Google Cloud Console](https://console.cloud.google.com) создайте проект и включите **Google Drive API**.
2. Настройте экран согласия (OAuth consent screen), добавьте право `drive.readonly`. Переведите приложение в статус **In production**: в статусе Testing токен живёт всего 7 дней. Для личного использования проверка Google не нужна, будет предупреждение «приложение не проверено».
3. Создайте **OAuth client ID** типа **Desktop app**. Впишите `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` в `.env.local`.
4. Впишите `GOOGLE_DRIVE_FOLDER_ID`: это последняя часть адреса папки в Drive (`.../folders/<ID>`).
5. **Загрузите на Drive файлы из `knowledge/`** (включая `catalog.xlsx`). Первая синхронизация переносит всё, что сейчас лежит в `knowledge/`, в `knowledge-sample/`, и оставляет только файлы с Drive.
6. `npm run drive-auth` — войдите в Google в браузере, токен запишется в `.env.local`.
7. `npm run sync` — скачать файлы с Drive и обновить индекс.

Дальше: `npm run drive-sync` скачивает изменения вручную. На обычном сервере сайт сам проверяет Drive не чаще раза в 5 минут.

Если Drive не настроен, всё работает по локальной папке `knowledge/`.

## Выкладка на Vercel

На Vercel диск только для чтения, поэтому синхронизация и индексация идут **при сборке**: скрипт `vercel-build` выполняет `npm run sync`, затем `next build`, а `knowledge/` и индекс включаются в серверную сборку (`next.config.ts`).

- В настройках проекта задайте `GEMINI_API_KEY` и все `GOOGLE_*`.
- Чтобы обновить содержимое после правок на Drive, запустите повторный деплой (кнопка Redeploy или Deploy Hook, его можно вызывать по расписанию).
- Лимит «15 вопросов в минуту» хранится в памяти одного экземпляра и на Vercel действует слабее.
- Не коммитьте настоящие данные школы в репозиторий: когда Drive подключён, добавьте `knowledge/` в `.gitignore`.

## Модели Gemini

По умолчанию ответы дают `gemini-3.5-flash-lite`, эмбеддинги — `gemini-embedding-001`. Меняются переменными `GEMINI_CHAT_MODEL` и `GEMINI_EMBEDDING_MODEL`. Модель эмбеддингов должна вести себя как `gemini-embedding-001` (один вектор на текст, поддержка `taskType`); при смене модели индекс пересобирается сам.

## Структура

- `src/app/[locale]/` — страница на трёх языках, `src/components/` — секции и чат
- `src/app/api/chat/route.ts` — API ассистента (потоковый ответ, лимиты)
- `src/lib/rag/` — чтение файлов, нарезка, индекс, поиск
- `src/lib/drive/` — доступ к Google Drive и синхронизация
- `src/lib/catalog.ts` — чтение `catalog.xlsx`
- `messages/` — тексты сайта (RU, UZ, EN)
- `scripts/` — `ingest`, `drive-auth`, `drive-sync`
- `tasks.md` — шаги проекта и что сделано
