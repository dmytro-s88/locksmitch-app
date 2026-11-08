# locksmitch-app - статус (2026-11-07)

Приложение на телефон для LocksMitch: app.locksmitch.com. Статика на GitHub Pages (репозиторий dmytro-s88/locksmitch-app), данные из бота (`LocksMitch-bot/src/App.gs`). Спек и план в `LocksMitch-bot/docs/superpowers/`.

## Состояние
- Версия: v0.1 (вход по коду из /app, список лидов Open/Today/Done, карточка лида: адрес, мили, Call/Text/Go, подсказка цены, чеки, заметки). Чек и деньги в работе.
- Деплой: `git push` в main → GitHub Pages. После правок css/js поднять `?v=` в index.html и `CACHE` в sw.js.
- Тесты: `node --test core.test.js`.

## Журнал изменений (новые сверху)

| Версия | Дата | Что изменилось |
|---|---|---|
| 0.1 | 2026-11-07 | Первая версия: каркас, core.js с тестами (6), вход, список лидов, карточка (только чтение). Репозиторий и GitHub Pages созданы, CNAME app.locksmitch.com. |
