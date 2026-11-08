# locksmitch-app - статус (2026-11-07)

Приложение на телефон для LocksMitch: app.locksmitch.com. Статика на GitHub Pages (репозиторий dmytro-s88/locksmitch-app), данные из бота (`LocksMitch-bot/src/App.gs`). Спек и план в `LocksMitch-bot/docs/superpowers/`.

## Состояние
- Версия: v0.2 (вход по коду из /app, список Open/Today/Done, карточка: адрес, мили, Call/Text/Go, подсказка цены, чеки, заметки; действия Done / Call back / Scheduled / Lost / Price / Note / Confirm text / Thank-you text с предпросмотром SMS и откатом при ошибке). Чек и деньги в работе.
- Деплой: `git push` в main → GitHub Pages. После правок css/js поднять `?v=` в index.html и `CACHE` в sw.js.
- Тесты: `node --test core.test.js`.

## Журнал изменений (новые сверху)

| Версия | Дата | Что изменилось |
|---|---|---|
| 0.2 | 2026-11-07 | Действия в карточке: Done (сумма, оплата, галочка «работа коллеги»), Call back / Scheduled / Lost с заметкой, Price (сохранить или предпросмотр SMS), Note, Confirm text, Thank-you text. Оптимистичное обновление (core.js leadPatch / leadRollback / leadSettled, 8 тестов). SMS уходит только по кнопке Send после предпросмотра. |
| 0.1 | 2026-11-07 | Первая версия: каркас, core.js с тестами (6), вход, список лидов, карточка (только чтение). Репозиторий и GitHub Pages созданы, CNAME app.locksmitch.com. |
