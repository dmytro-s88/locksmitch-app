# locksmitch-app

Phone web app for LocksMitch (app.locksmitch.com): leads, lead card, invoice, money. Static files on GitHub Pages; all data comes from the Telegram bot's web app (Apps Script, `../LocksMitch-bot/src/App.gs`) via `POST { action, key, ...params }`.

- `index.html`, `app.css`, `app.js` — screens and bot calls.
- `core.js` — logic without DOM (sorting, URLs, formatting, state reducer). Tests: `node --test core.test.js`.
- `manifest.webmanifest`, `sw.js` — install icon and app-shell cache (the bot API is never cached).
- Sign in: send `/app` to the bot, enter the 6-digit code. Only Dima has access.
- Deploy: push to `main`, GitHub Pages publishes within a minute. Bump `?v=` in index.html and `CACHE` in sw.js when css/js change.

Spec and plan: `../LocksMitch-bot/docs/superpowers/{specs,plans}/2026-11-07-app-pwa*.md`.
