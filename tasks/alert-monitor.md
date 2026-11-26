# Task: StockDesk alert monitor

Run: weekdays hourly at :35, 09:35 to 15:35 America/New_York. Repo: adamelci-22/Stockdesk. Branch: main.

## Goal
Check the watchlist against the alert rules. Write one file per new trigger. Write nothing if no trigger fires. Most runs write nothing.

## Data access (verified 2026-11-26)
- Massive `/v2/aggs/ticker/{T}/prev` and `/v2/aggs/ticker/{T}/range/...` work on this plan.
- Massive snapshot endpoints return NOT_ENTITLED. Do not use them.
- Live quotes and pre-market: use Robinhood `get_equity_quotes`. State in the file when a number is not from Massive.

## Steps
1. Read `config/watchlist.json` (tickers, `alert_rules`).
2. Check the market is open now (ET). If closed or holiday: exit, write nothing.
3. List `alerts/` files dated today. This is the dedupe set.
4. For each ticker in `indices` and `tickers`, pull the live quote from Robinhood and history from Massive aggregates. Evaluate:
   - Move: abs(change from prior close) >= `price_move_pct`.
   - Gap: abs(open vs prior close) >= `gap_pct`.
   - Volume: volume pace >= `volume_multiple` times the 20-day average for this time of day.
   - Levels: price crossed any level in `alert_rules.levels[TICKER]`.
   - Earnings or SEC filing in the last hour for the ticker (`get_earnings_results`, `get_sec_filing_index`).
5. Dedupe. Skip a trigger when an alert file today already has the same ticker and the same trigger type. Allow a repeat only if the move extended by another full `price_move_pct`.
6. Severity:
   - critical: abs move >= 2x threshold, or halt, or filing with material event.
   - high: threshold hit with volume confirmation.
   - medium: threshold hit without volume.
   - low: level cross only.
7. For each trigger write `alerts/YYYY-MM-DD-HHMM-TICKER-slug.md` (ET time now). Template below.
8. One commit per file: `alert: TICKER short reason`. Then `git pull --rebase origin main`, `git push origin main`. Retry push up to 4 times.
9. Print the list of files written, or `no triggers`.

## Template
```
---
title: TICKER <what happened, with number>
date: YYYY-MM-DD
time: HH:MM
tickers: [TICKER]
severity: low|medium|high|critical
summary: <one line: trigger and action>
---
# <same as title>

- Trigger: rule hit, actual value vs threshold.
- Context: volume, news, level. One or two bullets.
- Action: watch | long | short | avoid.
- Entry / Stop / Target: numbers, or n/a if action is watch.
- Probability: NN%. Risk: low | medium | high.
- Rationale: one sentence tied to structure or catalyst.
```

## Rules
- Every number comes from a tool call. Never invent.
- Cap: 5 new alerts per run. Keep the highest severity.
- Short sentences. Active voice. No hedging words. No disclaimers. No filler.
- Read-only on brokerage. Never place, cancel, or modify orders. Never alter watchlists or alerts in Robinhood.
- Touch only new files in `alerts/`. Never edit or delete existing files.
- If data tools all fail: write nothing. Exit with the error.
