// HeZhong (合众) — an open mod hub for web games. Zero dependencies, Node 18+.
// 合众：面向网页游戏的开放模组平台。零依赖，Node 18 以上即可运行。
//
//   · Game developers register their game and get a slug; their game talks to /api/games/<slug>/… via the SDK.
//     游戏开发者登记自己的游戏、拿到一个标识；游戏通过 SDK 调用 /api/games/<标识>/…
//   · Creators publish mods (.hzmod bundles) for any registered game. Players browse, rate and install them.
//     创作者为任何已登记的游戏发布模组（.hzmod）；玩家浏览、评分、安装。
//
// Run / 运行:  node server/server.mjs      (env: PORT, DATA_DIR, ADMIN_TOKEN, OPEN_GAMES, CORS_ORIGIN — see docs)
import { createServer } from 'http';
import { writeFileSync, mkdirSync, existsSync, statSync, createReadStream } from 'fs';
import { join, extname, resolve } from 'path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { openDb } from './lib/db.mjs';
import { validateBundle, cmpVersion, ID_RE, MAX_BYTES } from '../sdk/validate.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const VERSION = '1.0.0';
const PAGE = 24, TOKEN_DAYS = 30;

// ------------------------------------------------------------ helpers
const sha = (s) => createHash('sha256').update(s).digest('hex');
const now = () => Date.now();
class HttpErr extends Error { constructor(code, en, zh) { super(en); this.code = code; this.zh = zh ?? en; } }
const fail = (code, en, zh) => { throw new HttpErr(code, en, zh); };
const langOf = (req, url) => { const q = url?.searchParams.get('lang'); if (q) return q.startsWith('zh') ? 'zh' : 'en'; return /^zh/i.test(req.headers['accept-language'] || '') ? 'zh' : 'en'; };
const str = (v, max, min = 0) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

function hashPw(pw, salt = randomBytes(16).toString('hex')) { return { salt, hash: scryptSync(pw, salt, 32).toString('hex') }; }
function checkPw(pw, u) { const h = scryptSync(pw, u.salt, 32), want = Buffer.from(u.hash, 'hex'); return want.length === h.length && timingSafeEqual(h, want); }
function readBody(req, max) {
  return new Promise((res, rej) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > max) { rej(new HttpErr(413, `Payload too large (max ${Math.round(max / 1048576)} MB)`, `内容太大（上限 ${Math.round(max / 1048576)}MB）`)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}
async function jsonBody(req, max = 64 * 1024) { const t = await readBody(req, max); try { return JSON.parse(t || '{}'); } catch { fail(400, 'Body is not valid JSON', '请求内容不是合法 JSON'); } }

/**
 * Create a HeZhong server instance. 创建一个合众服务实例。
 * @param {{ port?: number, dataDir?: string, adminToken?: string, openGames?: boolean, cors?: string, publicDir?: string }} cfg
 */
export function createHub(cfg = {}) {
  const DATA = resolve(cfg.dataDir ?? process.env.DATA_DIR ?? join(HERE, '..', 'data'));
  const ADMIN = cfg.adminToken ?? process.env.ADMIN_TOKEN ?? '';
  const OPEN_GAMES = cfg.openGames ?? (process.env.OPEN_GAMES ?? '1') !== '0';
  const CORS = cfg.cors ?? process.env.CORS_ORIGIN ?? '*';
  const PUB = cfg.publicDir ?? join(HERE, 'public');
  const db = openDb(DATA), D = db.data;
  const modKey = (g, id) => `${g}/${id}`;
  const modDir = (g, id) => join(DATA, 'mods', g, id);

  // ---------- auth
  const issueToken = (name) => {
    const t = randomBytes(24).toString('base64url');
    D.tokens[sha(t)] = { user: name, exp: now() + TOKEN_DAYS * 864e5 };
    for (const [k, v] of Object.entries(D.tokens)) if (v.exp < now()) delete D.tokens[k];
    db.save(); return t;
  };
  const userOf = (req) => { const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || ''); if (!m) return null; const r = D.tokens[sha(m[1])]; return r && r.exp > now() && D.users[r.user] ? r.user : null; };
  const needUser = (req) => userOf(req) ?? fail(401, 'Please sign in first', '请先登录');
  const isAdmin = (req) => { const h = req.headers['x-admin-token']; return !!ADMIN && typeof h === 'string' && h.length === ADMIN.length && timingSafeEqual(Buffer.from(h), Buffer.from(ADMIN)); };

  // ---------- rate limit (sliding window per IP & kind)
  const buckets = new Map();
  const limit = (req, kind, max, win) => {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?', key = kind + '|' + ip, t = now();
    const a = (buckets.get(key) || []).filter((x) => t - x < win);
    if (a.length >= max) fail(429, 'Too many requests, please slow down', '操作太频繁，请稍后再试');
    a.push(t); buckets.set(key, a);
  };
  const gc = setInterval(() => { const t = now(); for (const [k, a] of buckets) if (!a.some((x) => t - x < 36e5)) buckets.delete(k); }, 6e5); gc.unref();

  // ---------- views
  const gameCard = (g) => ({ slug: g.slug, name: g.name, locales: g.locales || {}, desc: g.desc, homepage: g.homepage || '', owner: g.owner, api: g.api, created: g.created, mods: Object.values(D.mods).filter((m) => m.game === g.slug && !m.hidden).length });
  const modCard = (m) => { const r = Object.values(m.ratings || {}); return { id: m.id, game: m.game, name: m.name, locales: m.locales || {}, version: m.latest, author: m.author, owner: m.owner, desc: m.desc, tags: m.tags || [], api: m.api, downloads: m.downloads, rating: r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0, ratings: r.length, updated: m.updated, created: m.created, size: m.versions.at(-1)?.size ?? 0, icon: !!m.icon }; };
  const modDetail = (m) => ({ ...modCard(m), deps: m.deps || [], versions: m.versions.map((v) => ({ version: v.v, size: v.size, sha256: v.sha256, at: v.at, downloads: v.downloads })).reverse() });
  const gameOf = (slug) => { const g = D.games[slug]; if (!g || g.hidden) fail(404, 'No such game', '没有这个游戏'); return g; };
  const modOf = (g, id) => { const m = D.mods[modKey(g, id)]; if (!m || m.hidden) fail(404, 'No such mod', '没有这个模组'); return m; };
  const listMods = (url, filter) => {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 60), sort = url.searchParams.get('sort') || 'downloads', tag = (url.searchParams.get('tag') || '').trim();
    const page = Math.max(0, Math.min(1000, +(url.searchParams.get('page') || 0) | 0));
    let L = Object.values(D.mods).filter((m) => !m.hidden && filter(m)).map(modCard);
    if (q) L = L.filter((m) => [m.name, m.id, m.author, m.desc, ...m.tags, ...Object.values(m.locales).flatMap((x) => [x.name, x.desc])].join(' ').toLowerCase().includes(q));
    if (tag) L = L.filter((m) => m.tags.includes(tag));
    L.sort(sort === 'new' ? (a, b) => b.updated - a.updated : sort === 'rating' ? (a, b) => b.rating - a.rating || b.ratings - a.ratings : (a, b) => b.downloads - a.downloads);
    return { total: L.length, page, pageSize: PAGE, mods: L.slice(page * PAGE, page * PAGE + PAGE) };
  };

  // ---------- routes
  const routes = [];
  const route = (method, path, fn) => routes.push({ method, re: new RegExp('^' + path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  route('GET', '/api/health', () => ({ ok: true, name: 'HeZhong', version: VERSION, games: Object.values(D.games).filter((g) => !g.hidden).length, mods: Object.values(D.mods).filter((m) => !m.hidden).length, openGames: OPEN_GAMES }));

  route('POST', '/api/auth/register', async (req) => {
    limit(req, 'auth', 20, 6e5);
    const { name, password } = await jsonBody(req);
    if (typeof name !== 'string' || !/^[\w一-龥\-]{2,24}$/.test(name)) fail(400, 'User name: 2–24 chars (letters, digits, _ -, Chinese)', '用户名 2–24 位，可用中文、字母、数字、下划线、连字符');
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) fail(400, 'Password: at least 8 characters', '密码至少 8 位');
    if (D.users[name]) fail(409, 'That user name is taken', '这个用户名已经有人用了');
    D.users[name] = { ...hashPw(password), created: now() }; db.save();
    return { name, token: issueToken(name) };
  });
  route('POST', '/api/auth/login', async (req) => {
    limit(req, 'auth', 20, 6e5);
    const { name, password } = await jsonBody(req);
    const u = typeof name === 'string' ? D.users[name] : null;
    if (!u || typeof password !== 'string' || !checkPw(password, u)) fail(401, 'Wrong user name or password', '用户名或密码不对');
    return { name, token: issueToken(name) };
  });
  route('POST', '/api/auth/logout', (req) => { const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || ''); if (m) { delete D.tokens[sha(m[1])]; db.save(); } return { ok: true }; });
  route('GET', '/api/me', (req) => {
    const u = needUser(req);
    return { name: u, games: Object.values(D.games).filter((g) => g.owner === u).map((g) => ({ ...gameCard(g), hidden: !!g.hidden })), mods: Object.values(D.mods).filter((m) => m.owner === u).map((m) => ({ ...modCard(m), hidden: !!m.hidden })) };
  });

  // games
  route('GET', '/api/games', (req, P, url) => {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    let L = Object.values(D.games).filter((g) => !g.hidden).map(gameCard);
    if (q) L = L.filter((g) => [g.slug, g.name, g.desc, ...Object.values(g.locales).flatMap((x) => [x.name, x.desc])].join(' ').toLowerCase().includes(q));
    L.sort((a, b) => b.mods - a.mods || a.created - b.created);
    return { total: L.length, games: L };
  });
  const gameFields = (b, g) => {
    if (b.name !== undefined) { if (!str(b.name, 60, 1)) fail(400, 'Game name: 1–60 chars', '游戏名称 1–60 字'); g.name = b.name.trim(); }
    if (b.desc !== undefined) { if (!str(b.desc, 4000)) fail(400, 'Description: up to 4000 chars', '简介最多 4000 字'); g.desc = b.desc; }
    if (b.homepage !== undefined) { if (b.homepage && !/^https?:\/\/[^\s]{3,300}$/.test(b.homepage)) fail(400, 'Homepage must be an http(s) URL', '主页要是 http(s) 网址'); g.homepage = b.homepage; }
    if (b.api !== undefined) { if (!Number.isInteger(b.api) || b.api < 1 || b.api > 1000) fail(400, 'api must be a positive integer', 'api 要写正整数'); g.api = b.api; }
    if (b.locales !== undefined) {
      if (!b.locales || typeof b.locales !== 'object' || Array.isArray(b.locales)) fail(400, 'locales must be an object', 'locales 要写成对象');
      for (const [k, v] of Object.entries(b.locales)) if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(k) || !v || !str(v.name ?? '', 60) || !str(v.desc ?? '', 4000)) fail(400, `Bad locale "${k}"`, `本地化「${k}」不合规`);
      g.locales = b.locales;
    }
  };
  route('POST', '/api/games', async (req) => {
    const u = needUser(req);
    if (!OPEN_GAMES && !isAdmin(req)) fail(403, 'Game registration is closed on this hub', '本平台暂不开放登记游戏');
    limit(req, 'game', 10, 864e5);
    const b = await jsonBody(req);
    if (typeof b.slug !== 'string' || !ID_RE.test(b.slug)) fail(400, 'Game slug: 3–32 chars, lowercase letters, digits, "-"', '游戏标识：3–32 位小写字母、数字、连字符');
    if (D.games[b.slug]) fail(409, 'That slug is taken', '这个标识已被占用');
    const g = { slug: b.slug, owner: u, created: now(), api: 1, name: '', desc: '', homepage: '', locales: {} };
    gameFields({ api: 1, ...b }, g);
    if (!g.name) fail(400, 'Game name: 1–60 chars', '游戏名称 1–60 字');
    D.games[g.slug] = g; db.save();
    return gameCard(g);
  });
  route('GET', '/api/games/:game', (req, P) => gameCard(gameOf(P.game)));
  route('PATCH', '/api/games/:game', async (req, P) => {
    const g = gameOf(P.game);
    if (!isAdmin(req) && g.owner !== needUser(req)) fail(403, 'Only the game owner can edit it', '只有游戏的登记人能改');
    gameFields(await jsonBody(req), g); db.save();
    return gameCard(g);
  });

  // mods
  route('GET', '/api/mods', (req, P, url) => listMods(url, () => true));
  route('GET', '/api/games/:game/mods', (req, P, url) => { gameOf(P.game); return listMods(url, (m) => m.game === P.game); });
  route('GET', '/api/games/:game/mods/:id', (req, P) => { gameOf(P.game); return modDetail(modOf(P.game, P.id)); });
  route('GET', '/api/games/:game/mods/:id/download', (req, P, url, res) => {
    gameOf(P.game); const m = modOf(P.game, P.id);
    const want = url.searchParams.get('v') || m.latest, ver = m.versions.find((v) => v.v === want);
    if (!ver) fail(404, 'No such version', '没有这个版本');
    const f = join(modDir(m.game, m.id), ver.v + '.hzmod'); if (!existsSync(f)) fail(404, 'File missing', '文件丢失');
    ver.downloads = (ver.downloads || 0) + 1; m.downloads = (m.downloads || 0) + 1; db.save();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': statSync(f).size, 'X-Content-SHA256': ver.sha256, ...(url.searchParams.has('dl') ? { 'Content-Disposition': `attachment; filename="${m.id}-${ver.v}.hzmod"` } : {}) });
    createReadStream(f).pipe(res);
  });
  route('GET', '/api/games/:game/mods/:id/icon', (req, P, url, res) => {
    const m = modOf(P.game, P.id); if (!m.icon) fail(404, 'No icon', '没有图标');
    const f = join(modDir(m.game, m.id), m.icon.file); if (!existsSync(f)) fail(404, 'No icon', '没有图标');
    res.writeHead(200, { 'Content-Type': m.icon.mime, 'Cache-Control': 'public, max-age=600' });
    createReadStream(f).pipe(res);
  });
  route('POST', '/api/games/:game/mods', async (req, P) => {
    const user = needUser(req);
    limit(req, 'upload', 30, 36e5);
    const g = gameOf(P.game);
    const text = await readBody(req, MAX_BYTES + 4096);
    let B; try { B = JSON.parse(text); } catch { fail(400, 'Not a valid .hzmod bundle', '不是有效的模组包（.hzmod）'); }
    const err = validateBundle(B, { game: g.slug, apiVersion: g.api }); if (err) fail(400, err.en, err.zh);
    const man = B.manifest, key = modKey(g.slug, man.id);
    let m = D.mods[key];
    if (m && m.owner !== user) fail(403, `Mod id "${man.id}" belongs to ${m.owner}; pick another id`, `模组 id「${man.id}」已被「${m.owner}」占用，请换一个`);
    if (m && m.versions.some((v) => v.v === man.version)) fail(409, `Version ${man.version} is already published; bump the version`, `版本 ${man.version} 已经发布过，请调高版本号`);
    if (m && cmpVersion(man.version, m.latest) < 0) fail(409, `New version must be higher than ${m.latest}`, `新版本号要比当前的 ${m.latest} 高`);
    mkdirSync(modDir(g.slug, man.id), { recursive: true });
    writeFileSync(join(modDir(g.slug, man.id), man.version + '.hzmod'), text);
    let icon = m?.icon;
    if (man.icon) { const mm = /^data:(image\/(png|webp|jpeg|gif));base64,(.*)$/.exec(B.files[man.icon]); if (mm) { const file = 'icon.' + (mm[2] === 'jpeg' ? 'jpg' : mm[2]); writeFileSync(join(modDir(g.slug, man.id), file), Buffer.from(mm[3], 'base64')); icon = { file, mime: mm[1] }; } }
    const t = now();
    if (!m) m = D.mods[key] = { id: man.id, game: g.slug, owner: user, created: t, downloads: 0, ratings: {}, versions: [] };
    Object.assign(m, { name: man.name, locales: man.locales || {}, author: man.author || user, desc: man.desc || '', tags: man.tags || [], deps: man.deps || [], api: man.api ?? 1, latest: man.version, updated: t, icon, hidden: false });
    m.versions.push({ v: man.version, size: text.length, sha256: sha(text), at: t, downloads: 0 });
    db.save();
    return modDetail(m);
  });
  route('POST', '/api/games/:game/mods/:id/rate', async (req, P) => {
    const user = needUser(req); limit(req, 'rate', 60, 36e5);
    const m = modOf(P.game, P.id);
    const { stars } = await jsonBody(req);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) fail(400, 'Rating: 1–5 stars', '评分 1–5 星');
    if (m.owner === user) fail(403, "You can't rate your own mod", '不能给自己的模组打分');
    m.ratings[user] = stars; db.save();
    return modCard(m);
  });
  route('DELETE', '/api/games/:game/mods/:id', (req, P) => {
    const m = D.mods[modKey(P.game, P.id)]; if (!m) fail(404, 'No such mod', '没有这个模组');
    if (!isAdmin(req) && m.owner !== needUser(req) && D.games[m.game]?.owner !== userOf(req)) fail(403, 'Only the author, the game owner or an admin can take it down', '只有作者、游戏登记人或管理员能下架');
    m.hidden = true; db.save();
    return { ok: true };
  });
  route('POST', '/api/admin/hide', async (req) => {
    if (!isAdmin(req)) fail(403, 'Admin token required', '需要管理员口令');
    const { game, mod, hidden } = await jsonBody(req);
    const o = mod ? D.mods[modKey(game, mod)] : D.games[game];
    if (!o) fail(404, 'Not found', '找不到');
    o.hidden = !!hidden; db.save();
    return { ok: true, hidden: o.hidden };
  });

  // ---------- static site
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
  const serveStatic = (pathname, res) => {
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    if (rel.includes('..')) return false;
    const f = join(PUB, rel);
    if (!f.startsWith(PUB) || !existsSync(f) || statSync(f).isDirectory()) return false;
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    createReadStream(f).pipe(res);
    return true;
  };

  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', CORS);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, Accept-Language');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'X-Content-SHA256');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url || '/', 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) {
        for (const r of routes) {
          if (r.method !== req.method) continue;
          const m = r.re.exec(url.pathname); if (!m) continue;
          const P = m.groups || {};
          for (const k of ['game', 'id']) if (P[k] !== undefined && !ID_RE.test(P[k])) fail(404, 'Not found', '找不到');
          const out = await r.fn(req, P, url, res);
          if (out !== undefined) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(out)); }
          return;
        }
        fail(404, 'No such endpoint', '没有这个接口');
      }
      if (req.method === 'GET' && (serveStatic(url.pathname, res) || serveStatic('/', res))) return;
      fail(404, 'Not found', '找不到');
    } catch (e) {
      const code = e instanceof HttpErr ? e.code : 500;
      if (code === 500) console.error(e);
      const zh = langOf(req, url) === 'zh';
      if (!res.headersSent) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: code === 500 ? (zh ? '服务器出错了' : 'Server error') : zh ? e.zh : e.message })); }
      else res.end();
    }
  });
  return {
    server, db,
    listen(port = cfg.port ?? +(process.env.PORT || 8787)) { return new Promise((r) => server.listen(port, () => { console.log(`HeZhong hub on http://localhost:${port}  (data: ${DATA})`); r(server); })); },
    close() { db.flushNow(); return new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); }); },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hub = createHub();
  hub.listen();
  const stop = async () => { await hub.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
}
