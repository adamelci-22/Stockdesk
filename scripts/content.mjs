import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// Minimal frontmatter parser. Supports: key: value, key: [a, b], key: a, b.
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim().replace(/^["']|["']$/g, '');
    data[kv[1]] = v;
  }
  return { data, body: m[2] };
}

export function parseList(v) {
  if (!v) return [];
  return String(v)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^\$/, '').toUpperCase())
    .filter(Boolean);
}

const DATE_RE = /^(\d{4}-\d{2}-\d{2})/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}-(\d{2})(\d{2})/;

export function loadItem(kind, file, dir) {
  const slug = basename(file, '.md');
  const { data, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
  const date = data.date || (slug.match(DATE_RE) || [])[1];
  if (!date) throw new Error(`${kind}/${file}: missing date (frontmatter or filename prefix)`);
  const tm = slug.match(TIME_RE);
  const time = data.time || (tm ? `${tm[1]}:${tm[2]}` : '');
  const h1 = body.match(/^#\s+(.+)$/m);
  const title = data.title || (h1 && h1[1]) || slug;
  return {
    kind,
    slug,
    title,
    date,
    time,
    sort: `${date}T${time || '00:00'}`,
    tickers: parseList(data.tickers),
    severity: (data.severity || '').toLowerCase(),
    summary: data.summary || '',
    body,
    url: `/${kind}/${slug}/`,
  };
}

export function loadAll(root = '.') {
  const out = { digests: [], alerts: [] };
  for (const kind of ['digests', 'alerts']) {
    const dir = join(root, kind);
    if (!existsSync(dir)) continue;
    out[kind] = readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .map((f) => loadItem(kind, f, dir))
      .sort((a, b) => b.sort.localeCompare(a.sort));
  }
  return out;
}
