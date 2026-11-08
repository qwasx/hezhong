// Run the whole demo locally: a HeZhong hub on :8787 (seeded with the Slime Garden game and the Rainbow Slime mod)
// and a static server on :8080 for the demo game.   本地跑完整演示：合众平台 :8787（已登记示例游戏与模组）+ 示例游戏 :8080。
//
//   npm run example     →  open http://localhost:8080/examples/slime-garden/  and press "Mods · 模组"
//   (ports: HUB_PORT=8787 DEMO_PORT=8080)
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, extname, resolve } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createHub } from '../server/server.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA = join(ROOT, 'examples', '.data');
mkdirSync(DATA, { recursive: true });
const hub = createHub({ dataDir: DATA });
const HUB_PORT = +(process.env.HUB_PORT || 8787), DEMO_PORT = +(process.env.DEMO_PORT || 8080);
await hub.listen(HUB_PORT);
const HUB = `http://localhost:${HUB_PORT}`;

// seed: demo account → game → mod (idempotent) / 初始化：演示账号、游戏、模组（重复运行无妨）
const call = async (path, opt = {}) => { const r = await fetch(HUB + path, opt); return { status: r.status, data: await r.json().catch(() => ({})) }; };
const json = (b, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: typeof b === 'string' ? b : JSON.stringify(b) });
let r = await call('/api/auth/login', json({ name: 'demo', password: 'demo-password' }));
if (r.status !== 200) r = await call('/api/auth/register', json({ name: 'demo', password: 'demo-password' }));
const token = r.data.token;
await call('/api/games', json({ slug: 'slime-garden', name: 'Slime Garden', desc: 'A tiny demo game for HeZhong: pop the slimes. Mods can add new kinds of slime.', homepage: `http://localhost:${DEMO_PORT}/examples/slime-garden/`, api: 1, locales: { zh: { name: '史莱姆花园', desc: '合众的示例小游戏：戳破史莱姆。模组可以加入新的史莱姆。' } } }, token));
execFileSync(process.execPath, [join(ROOT, 'cli', 'hezhong.mjs'), 'pack', join(ROOT, 'examples', 'mods', 'rainbow-slime'), '--out', join(DATA, 'dist')], { stdio: 'inherit' });
const bundle = readFileSync(join(DATA, 'dist', 'rainbow-slime-1.0.0.hzmod'), 'utf8');
r = await call('/api/games/slime-garden/mods', json(bundle, token));
console.log(r.status === 200 ? '✓ Rainbow Slime published' : `• Rainbow Slime: ${r.data.error}`);

// static files for the demo game / 示例游戏的静态文件
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  if (!f.startsWith(ROOT) || p.includes('..') || !existsSync(f) || statSync(f).isDirectory() || p.includes('/.data/')) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
}).listen(DEMO_PORT, () => console.log(`\nDemo game / 示例游戏: http://localhost:${DEMO_PORT}/examples/slime-garden/?hub=${HUB}\nHub / 平台:           ${HUB}  (user demo / demo-password)\n`));
