import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { loadAll } from './content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Agent-written content: never pass raw HTML through.
marked.use({ renderer: { html: ({ text }) => text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]) } });
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const NAV = [
  ['/', 'Today'],
  ['/alerts/', 'Alerts'],
  ['/tickers/', 'Tickers'],
  ['/archive/', 'Archive'],
];

function layout({ title, path, content, builtAt }) {
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${path === href || (href !== '/' && path.startsWith(href)) ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)} · StockDesk</title>
<meta name="theme-color" content="#0b0f14">
<meta name="robots" content="noindex,nofollow">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="StockDesk">
<link rel="stylesheet" href="/app.css">
</head>
<body>
<header class="top"><a class="brand" href="/">StockDesk</a><span class="built">Updated ${esc(builtAt)}</span></header>
<main>${content}</main>
<nav class="tabs" aria-label="Primary">${nav}</nav>
<script src="/app.js" defer></script>
</body>
</html>
`;
}

const chip = (t) => `<a class="chip" href="/tickers/${encodeURIComponent(t)}/">${esc(t)}</a>`;

function row(it) {
  const sev = it.severity ? `<span class="sev sev-${esc(it.severity)}">${esc(it.severity)}</span>` : '';
  return `<li class="row ${it.kind === 'alerts' ? 'alert' : 'digest'}">
<a class="row-main" href="${it.url}">
<span class="row-meta">${esc(it.date)}${it.time ? ' ' + esc(it.time) : ''} ${sev}</span>
<span class="row-title">${esc(it.title)}</span>
${it.summary ? `<span class="row-sum">${esc(it.summary)}</span>` : ''}
</a>
${it.tickers.length ? `<span class="chips">${it.tickers.map(chip).join('')}</span>` : ''}
</li>`;
}

const list = (items, empty) =>
  items.length ? `<ul class="rows">${items.map(row).join('')}</ul>` : `<p class="empty">${esc(empty)}</p>`;

export function build({ root = '.', out = 'dist', now = new Date() } = {}) {
  const { digests, alerts } = loadAll(root);
  const builtAt = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const outDir = join(root, out);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const write = (rel, data) => {
    const p = join(outDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
  };
  const page = (path, title, content) =>
    write(join(path, 'index.html'), layout({ title, path, content, builtAt }));

  const all = [...digests, ...alerts];

  // Today = most recent date that has content.
  const latest = all.map((i) => i.date).sort().at(-1);
  const todayDigests = digests.filter((d) => d.date === latest);
  const todayAlerts = alerts.filter((a) => a.date === latest);
  let today = `<h1>Today</h1><p class="sub">${latest ? esc(latest) : 'No content yet'}</p>`;
  if (todayDigests.length) {
    for (const d of todayDigests) {
      today += `<article class="card"><h2><a href="${d.url}">${esc(d.title)}</a></h2>${d.tickers.length ? `<div class="chips">${d.tickers.map(chip).join('')}</div>` : ''}<div class="prose">${marked.parse(d.body)}</div></article>`;
    }
  } else {
    today += '<p class="empty">No digest yet.</p>';
  }
  today += `<h2 class="sec">Alerts</h2>${list(todayAlerts, 'No alerts.')}`;
  page('/', 'Today', today);

  page('/alerts/', 'Alerts', `<h1>Alerts</h1>${list(alerts, 'No alerts yet.')}`);

  // Article pages
  for (const it of all) {
    const label = it.kind === 'alerts' ? 'Alert' : 'Digest';
    page(
      it.url,
      it.title,
      `<p class="crumb"><a href="/${it.kind === 'alerts' ? 'alerts' : 'archive'}/">&larr; ${label}s</a></p>
<article class="card"><h1>${esc(it.title)}</h1>
<p class="row-meta">${esc(it.date)}${it.time ? ' ' + esc(it.time) : ''} ${it.severity ? `<span class="sev sev-${esc(it.severity)}">${esc(it.severity)}</span>` : ''}</p>
${it.tickers.length ? `<div class="chips">${it.tickers.map(chip).join('')}</div>` : ''}
<div class="prose">${marked.parse(it.body)}</div></article>`,
    );
  }

  // Tickers
  const byTicker = new Map();
  for (const it of all) for (const t of it.tickers) (byTicker.get(t) || byTicker.set(t, []).get(t)).push(it);
  const tickers = [...byTicker.keys()].sort();
  page(
    '/tickers/',
    'Tickers',
    `<h1>Tickers</h1>${
      tickers.length
        ? `<input id="filter" type="search" placeholder="Filter tickers" autocomplete="off" aria-label="Filter tickers">
<ul class="tickers">${tickers
            .map((t) => {
              const items = byTicker.get(t);
              const a = items.filter((i) => i.kind === 'alerts').length;
              return `<li data-t="${esc(t)}"><a href="/tickers/${encodeURIComponent(t)}/"><b>${esc(t)}</b><span>${items.length} item${items.length === 1 ? '' : 's'}${a ? ` · ${a} alert${a === 1 ? '' : 's'}` : ''}</span></a></li>`;
            })
            .join('')}</ul>`
        : '<p class="empty">No tickers yet.</p>'
    }`,
  );
  for (const t of tickers) {
    const items = byTicker.get(t).sort((a, b) => b.sort.localeCompare(a.sort));
    page(`/tickers/${encodeURIComponent(t)}/`, t, `<p class="crumb"><a href="/tickers/">&larr; Tickers</a></p><h1>${esc(t)}</h1>${list(items, '')}`);
  }

  // Archive: digests grouped by month, alerts counted per month.
  const months = new Map();
  for (const it of all) {
    const m = it.date.slice(0, 7);
    (months.get(m) || months.set(m, []).get(m)).push(it);
  }
  const archive = [...months.keys()]
    .sort()
    .reverse()
    .map((m) => {
      const items = months.get(m);
      return `<details${m === [...months.keys()].sort().at(-1) ? ' open' : ''}><summary>${esc(m)} <span class="count">${items.length}</span></summary>${list(items, '')}</details>`;
    })
    .join('');
  page('/archive/', 'Archive', `<h1>Archive</h1>${archive || '<p class="empty">Nothing yet.</p>'}`);

  // Static assets
  cpSync(join(here, '..', 'site', 'static'), outDir, { recursive: true });
  write('404.html', layout({ title: 'Not found', path: '/404', content: '<h1>Not found</h1><p><a href="/">Go to Today</a></p>', builtAt }));
  write('_headers', `/*\n  X-Robots-Tag: noindex\n  Cache-Control: no-cache\n/icon.svg\n  Cache-Control: public, max-age=86400\n`);
  write('version.json', JSON.stringify({ builtAt, digests: digests.length, alerts: alerts.length, tickers: tickers.length }));
  return { digests: digests.length, alerts: alerts.length, tickers: tickers.length, outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = build({ root: process.env.SITE_ROOT || '.' });
  console.log(`built ${r.digests} digests, ${r.alerts} alerts, ${r.tickers} tickers -> ${r.outDir}`);
}
