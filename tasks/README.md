# Scheduled tasks

Two tasks write markdown to this repo. The Deliver Action does the rest.

| Task | File | Schedule (America/New_York) |
|---|---|---|
| Daily digest | `tasks/daily-digest.md` | Weekdays 08:00 |
| Alert monitor | `tasks/alert-monitor.md` | Weekdays 09:35 to 15:35, hourly |

Paste the full text of each file as the task prompt.
Each task commits straight to `main`. No PR.

## File contract (shared)

Path:
- Digest: `digests/YYYY-MM-DD.md` (second digest same day: `digests/YYYY-MM-DD-pm.md`)
- Alert: `alerts/YYYY-MM-DD-HHMM-TICKER-slug.md` (ET, 24h, slug lowercase, hyphens)

Frontmatter:
```
---
title: <plain headline, under 80 chars>
date: YYYY-MM-DD
time: HH:MM            # optional, ET
tickers: [NVDA, AAPL]  # uppercase, no $
severity: low|medium|high|critical   # alerts only
summary: <one line, under 200 chars. Shown in push body.>
---
```

Rules:
- Never edit or delete an existing file. New file = new push.
- Never create a file starting with `_`.
- No raw HTML. It is escaped.
- One commit per file. Message: `digest: YYYY-MM-DD` or `alert: TICKER short reason`.
