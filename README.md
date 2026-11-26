# StockDesk

Home-screen web app. Reads `digests/` and `alerts/` markdown. Pages: Today, Alerts, Tickers, Archive.

- Build: `npm ci && npm run build` -> `dist/`
- Test: `npm test`
- Content contract: `tasks/README.md`
- Scheduled task prompts: `tasks/daily-digest.md`, `tasks/alert-monitor.md`

## Deploy (one-time setup)

1. Cloudflare Pages: create project `stockdesk` (Direct Upload). Note the URL.
2. Cloudflare Access (Zero Trust > Access > Applications): add a self-hosted app for the Pages domain, e.g. `stockdesk.pages.dev`.
   - Policy: Allow, include your email only.
   - Also protect preview URLs: use `*.stockdesk.pages.dev`.
3. API token: Pages Edit permission. Account ID from dashboard.
4. ntfy: pick a long random topic. Install the ntfy app. Subscribe.
5. GitHub repo > Settings > Secrets and variables > Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NTFY_TOPIC`. Optional: `NTFY_TOKEN`.
   - Variables: `SITE_URL` (https://stockdesk.pages.dev, or your Access domain), `CF_PAGES_PROJECT` (default `stockdesk`). Optional: `NTFY_SERVER`.
6. Merge to `main`. The Deliver workflow runs on any push touching `digests/`, `alerts/`, `scripts/`, `site/`.

## Delivery

`.github/workflows/deliver.yml`: test, build, deploy, then ntfy push per newly added file.
Push click link: `SITE_URL/<digests|alerts>/<slug>/`. Alert priority follows severity.

## Install as an app

iOS: Safari > Share > Add to Home Screen. Android: Chrome > Install app.
