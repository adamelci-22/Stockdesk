import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { parseFrontmatter, parseList } from './content.mjs';

// Build the ntfy JSON payload for one new file (e.g. "alerts/2026-11-26-0935-NVDA-gap.md").
export function buildMessage(file, { topic, siteUrl, read = (f) => readFileSync(f, 'utf8') }) {
  const kind = basename(dirname(file));
  if (kind !== 'digests' && kind !== 'alerts') return null;
  if (!file.endsWith('.md') || basename(file).startsWith('_')) return null;
  const slug = basename(file, '.md');
  const { data, body } = parseFrontmatter(read(file));
  const h1 = body.match(/^#\s+(.+)$/m);
  const title = data.title || (h1 && h1[1]) || slug;
  const tickers = parseList(data.tickers);
  const sev = (data.severity || '').toLowerCase();
  const isAlert = kind === 'alerts';
  const priority = !isAlert ? 3 : sev === 'critical' ? 5 : sev === 'high' ? 4 : 3;
  const text = (data.summary || body.replace(/^#.*$/m, '').replace(/[#*_`>\[\]]/g, '').trim()).slice(0, 240);
  return {
    topic,
    title: `${isAlert ? 'Alert' : 'Digest'}: ${title}`,
    message: text || title,
    click: `${siteUrl.replace(/\/+$/, '')}/${kind}/${slug}/`,
    priority,
    tags: [isAlert ? 'rotating_light' : 'newspaper', ...tickers.slice(0, 3).map((t) => t.toLowerCase())],
  };
}

export async function send(payload, { server = 'https://ntfy.sh', token, fetchImpl = fetch } = {}) {
  const res = await fetchImpl(server.replace(/\/+$/, '') + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${await res.text()}`);
  return res;
}

async function main() {
  const files = process.argv.slice(2);
  const { NTFY_TOPIC: topic, SITE_URL: siteUrl, NTFY_SERVER: server, NTFY_TOKEN: token, DRY_RUN: dry } = process.env;
  if (!topic || !siteUrl) throw new Error('NTFY_TOPIC and SITE_URL are required');
  let failed = 0;
  for (const f of files) {
    const msg = buildMessage(f, { topic, siteUrl });
    if (!msg) continue;
    if (dry) {
      console.log(JSON.stringify({ ...msg, topic: '***' }));
      continue;
    }
    try {
      await send(msg, { server, token });
      console.log(`sent ${f} -> ${msg.click}`);
    } catch (e) {
      failed++;
      console.error(`FAILED ${f}: ${e.message}`);
    }
  }
  if (failed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
