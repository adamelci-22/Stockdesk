import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build.mjs';
import { parseFrontmatter, parseList } from '../scripts/content.mjs';
import { buildMessage, send } from '../scripts/notify.mjs';

const root = mkdtempSync(join(tmpdir(), 'sd-'));
cpSync('tests/fixtures', root, { recursive: true });
const r = build({ root, now: new Date('2026-11-26T12:00:00Z') });
const read = (p) => readFileSync(join(root, 'dist', p), 'utf8');

test('frontmatter and lists', () => {
  assert.deepEqual(parseFrontmatter('---\na: 1\n---\nbody').data, { a: '1' });
  assert.deepEqual(parseFrontmatter('no fm').data, {});
  assert.deepEqual(parseList('[nvda, $AAPL , ]'), ['NVDA', 'AAPL']);
});

test('build counts', () => {
  assert.equal(r.digests, 2);
  assert.equal(r.alerts, 2);
  assert.equal(r.tickers, 4);
});

test('all pages and assets exist', () => {
  for (const p of ['index.html', 'alerts/index.html', 'tickers/index.html', 'archive/index.html', 'tickers/NVDA/index.html',
    'digests/2026-11-25/index.html', 'alerts/2026-11-26-0935-NVDA-gap/index.html', 'manifest.webmanifest', 'sw.js', 'app.js', 'app.css',
    'apple-touch-icon.png', 'icon-512.png', '404.html', '_headers'])
    assert.ok(existsSync(join(root, 'dist', p)), p);
});

test('today shows latest day with its alerts', () => {
  const h = read('index.html');
  assert.match(h, /Thanksgiving closed/);
  assert.match(h, /NVDA gaps above 150/);
  assert.doesNotMatch(h, /Pre-market digest/);
});

test('alerts newest first', () => {
  const h = read('alerts/index.html');
  assert.ok(h.indexOf('NVDA gaps') < h.indexOf('Plain note'));
  assert.match(h, /sev-high/);
});

test('ticker normalisation and page', () => {
  assert.match(read('tickers/index.html'), /data-t="MSFT"/);
  assert.match(read('tickers/NVDA/index.html'), /2026-11-25/);
});

test('title falls back to h1 and markdown renders', () => {
  assert.match(read('alerts/2026-11-25-1400-aapl-note/index.html'), /<h1>Plain note/);
  assert.match(read('digests/2026-11-25/index.html'), /<table>/);
});

test('archive groups by month', () => {
  assert.match(read('archive/index.html'), /2026-11/);
});

test('rejects item without date', () => {
  const bad = mkdtempSync(join(tmpdir(), 'sd-bad-'));
  cpSync('tests/fixtures', bad, { recursive: true });
  cpSync(join(bad, 'alerts/2026-11-26-0935-NVDA-gap.md'), join(bad, 'alerts/nodate.md'));
  assert.throws(() => build({ root: bad }), /missing date/);
});

test('ntfy message: click link, priority, tags', () => {
  const m = buildMessage('tests/fixtures/alerts/2026-11-26-0935-NVDA-gap.md', { topic: 't', siteUrl: 'https://x.pages.dev/' });
  assert.equal(m.click, 'https://x.pages.dev/alerts/2026-11-26-0935-NVDA-gap/');
  assert.equal(m.priority, 4);
  assert.equal(m.title, 'Alert: NVDA gaps above 150 on volume');
  assert.deepEqual(m.tags, ['rotating_light', 'nvda']);
  const d = buildMessage('tests/fixtures/digests/2026-11-25.md', { topic: 't', siteUrl: 'https://x.pages.dev' });
  assert.equal(d.click, 'https://x.pages.dev/digests/2026-11-25/');
  assert.equal(d.priority, 3);
});

test('ntfy ignores non-article files', () => {
  assert.equal(buildMessage('README.md', { topic: 't', siteUrl: 'u' }), null);
  assert.equal(buildMessage('alerts/_template.md', { topic: 't', siteUrl: 'u' }), null);
});

test('ntfy send posts JSON and throws on error', async () => {
  let seen;
  await send({ topic: 't' }, { token: 'tk', fetchImpl: async (u, o) => ((seen = { u, o }), { ok: true }) });
  assert.equal(seen.u, 'https://ntfy.sh/');
  assert.equal(seen.o.headers.Authorization, 'Bearer tk');
  await assert.rejects(send({}, { fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'no' }) }), /403/);
});

test('raw html in markdown is escaped', () => {
  assert.doesNotMatch(read('alerts/2026-11-25-1400-aapl-note/index.html'), /<script>alert/);
});

test('new-files.sh lists only added article files', async () => {
  const { execFileSync } = await import('node:child_process');
  const sh = join(process.cwd(), 'scripts/new-files.sh');
  const d = mkdtempSync(join(tmpdir(), 'sd-git-'));
  const g = (...a) => execFileSync('git', a, { cwd: d, encoding: 'utf8' }).trim();
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  cpSync('tests/fixtures', d, { recursive: true });
  g('add', '.'); g('commit', '-qm', 'one');
  const before = g('rev-parse', 'HEAD');
  cpSync('tests/fixtures/alerts/2026-11-26-0935-NVDA-gap.md', join(d, 'alerts/2026-11-27-0935-new.md'));
  cpSync('tests/fixtures/alerts/2026-11-26-0935-NVDA-gap.md', join(d, 'alerts/_tmpl.md'));
  execFileSync('sh', ['-c', 'echo x >> digests/2026-11-25.md'], { cwd: d });
  g('add', '.'); g('commit', '-qm', 'two');
  const out = execFileSync(sh, [before, 'HEAD'], { cwd: d, encoding: 'utf8' }).trim();
  assert.equal(out, 'alerts/2026-11-27-0935-new.md');
  const first = execFileSync(sh, ['0000000000000000000000000000000000000000', before], { cwd: d, encoding: 'utf8' }).trim().split('\n');
  assert.equal(first.length, 4);
});
