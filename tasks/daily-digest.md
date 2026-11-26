# Task: StockDesk daily digest

Run: weekdays 08:00 America/New_York. Repo: adamelci-22/Stockdesk. Branch: main.

## Goal
Write one pre-market digest. Commit it. Stop.

## Data access (verified 2026-11-26)
- Massive `/v2/aggs/ticker/{T}/prev` and `/v2/aggs/ticker/{T}/range/...` work on this plan.
- Massive snapshot endpoints return NOT_ENTITLED. Do not use them.
- Live quotes and pre-market: use Robinhood `get_equity_quotes`. State in the file when a number is not from Massive.

## Steps
1. Read `config/watchlist.json`. Read the last 3 files in `digests/` for context. Do not repeat their content.
2. If today is a US market holiday, write a short closed-market digest. Name the next open session. Skip step 3.
3. Pull data. Use Massive aggregates for history. Use Robinhood read-only tools for live quotes.
   - Index futures or SPY, QQQ, IWM: pre-market change.
   - Each watchlist ticker: pre-market price, change %, volume vs average, gap %.
   - Earnings today for watchlist tickers (`get_earnings_calendar`).
   - Key levels: prior close, prior high, prior low, 20-day SMA.
   - Macro calendar for today: data releases and Fed speakers.
4. Write `digests/YYYY-MM-DD.md` using the template below. Use the real date in ET.
5. `git add`, commit `digest: YYYY-MM-DD`, `git pull --rebase origin main`, `git push origin main`. Retry push up to 4 times.
6. Print the file path. Done.

## Template
```
---
title: <Headline with the day's main driver>
date: YYYY-MM-DD
time: 08:00
tickers: [<every ticker discussed>]
summary: <one line: bias plus main catalyst>
---
# <same as title>

## Bias
- Direction: bullish | bearish | neutral.
- Probability: NN% for the call. Risk: low | medium | high.
- Rationale: one sentence tied to structure or catalyst.

## Catalysts today
- HH:MM ET event. Expected impact.

## Setups
### TICKER
- Trigger: price and condition.
- Entry / Stop / Target: numbers.
- Risk/reward: N:1. Probability: NN%.
- Rationale: one sentence.

## Levels
| Ticker | Support | Resistance | Pre-mkt |
|---|---|---|---|

## Earnings
- TICKER: time, consensus, implied move.
```

## Rules
- Every number comes from a tool call. If data is missing, write `n/a`. Never invent.
- No setup without entry, stop, target, probability.
- Short sentences. Active voice. No hedging words. No disclaimers. No filler.
- Max 400 words.
- Read-only on brokerage. Never place, cancel, or modify orders. Never alter watchlists or alerts in Robinhood.
- Touch only the one new file in `digests/`.
- If data tools all fail: write nothing. Exit with the error. A false digest is worse than none.
