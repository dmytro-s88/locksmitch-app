# locksmitch-app - статус (2026-11-07)

Приложение на телефон для LocksMitch: app.locksmitch.com. Статика на GitHub Pages (репозиторий dmytro-s88/locksmitch-app), данные из бота (`LocksMitch-bot/src/App.gs`). Спек и план в `LocksMitch-bot/docs/superpowers/`.

## Состояние
- Версия: v0.4 (экран денег: месяц ‹ ›, плитки доход / расходы / прибыль / мили, долги коллег, последние операции, «+ Expense»; экран чека: строки из лида, правка, Create invoice / estimate, PDF, Sign, Print, Paid cash / Zelle / card; вход по коду из /app, список Open/Today/Done, карточка: адрес, мили, Call/Text/Go, подсказка цены, чеки, заметки; действия Done / Call back / Scheduled / Lost / Price / Note / Confirm text / Thank-you text с предпросмотром SMS и откатом при ошибке). Чек и деньги в работе.
- Деплой: `git push` в main → GitHub Pages. После правок css/js поднять `?v=` в index.html и `CACHE` в sw.js.
- Тесты: `node --test core.test.js`.

## Журнал изменений (новые сверху)

| Версия | Дата | Что изменилось |
|---|---|---|
| 0.4 | 2026-11-07 | Экран «Money»: переключатель месяца, четыре плитки, долги коллег, последние 20 операций (доход, расход, пробег), форма «+ Expense» (сумма, где, категория из бота, business / personal, описание). core.js: monthLabel, shiftMonth (12 тестов). |
| 0.3 | 2026-11-07 | Экран чека: из карточки «Invoice» → черновик со строками из лида и подсказки цены (правка, добавление, удаление, итог считается на лету), Create invoice / Create estimate, потом PDF, Sign, Print (ссылки бота на 2 часа), Paid cash / Zelle / card. Чеки лида в карточке открываются тапом. core.js: lineValid, событие lines (10 тестов). |
| 0.2 | 2026-11-07 | Действия в карточке: Done (сумма, оплата, галочка «работа коллеги»), Call back / Scheduled / Lost с заметкой, Price (сохранить или предпросмотр SMS), Note, Confirm text, Thank-you text. Оптимистичное обновление (core.js leadPatch / leadRollback / leadSettled, 8 тестов). SMS уходит только по кнопке Send после предпросмотра. |
| 0.1 | 2026-11-07 | Первая версия: каркас, core.js с тестами (6), вход, список лидов, карточка (только чтение). Репозиторий и GitHub Pages созданы, CNAME app.locksmitch.com. |
