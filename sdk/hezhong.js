// HeZhong SDK — drop this into your web game to let players install mods from a HeZhong hub and run them.
// 合众 SDK——放进你的网页游戏：玩家可以从合众平台安装模组，游戏负责加载、运行、兜错。
//
//   import { HeZhong } from './hezhong.js';
//   const hz = new HeZhong({ game: 'slime-garden', server: 'https://hub.example.com', apiVersion: 1 });
//   await hz.load((ctx) => ({ addSlime: (def) => {...} }));   // before your game starts
//   hz.emit('tick', dt);                                        // whenever something happens
//
// Zero dependencies. Works in browsers (IndexedDB) and in Node 18+ (memory storage, for tests / tools).
// 零依赖：浏览器里用 IndexedDB 存模组；Node 18+ 里用内存存储（测试、工具用）。
import { FORMAT, validateBundle, cmpVersion, localized, MAX_BYTES } from './validate.js';

export { FORMAT, validateBundle, cmpVersion, localized };
export const SDK_VERSION = '1.0.0';

// ------------------------------------------------------------ storage
/** In-memory storage (Node, tests). 内存存储。 */
export function memoryStorage() {
  const bundles = new Map(), kv = new Map();
  return {
    async list() { return [...bundles.values()]; },
    async get(id) { return bundles.get(id); },
    async put(b) { bundles.set(b.manifest.id, b); },
    async remove(id) { bundles.delete(id); },
    getItem: (k) => kv.get(k) ?? null, setItem: (k, v) => { kv.set(k, v); },
  };
}
/** IndexedDB storage, one database per game. 浏览器存储：每个游戏一个库。 */
export function browserStorage(game) {
  const DB = `hezhong:${game}`, OS = 'bundles';
  let dbp = null;
  const open = () => dbp ??= new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(OS);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
  const tx = async (mode, f) => {
    const db = await open(); if (!db) throw new Error('IndexedDB unavailable / 浏览器存储不可用');
    return new Promise((res, rej) => { const q = f(db.transaction(OS, mode).objectStore(OS)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  };
  return {
    list: () => tx('readonly', (s) => s.getAll()),
    get: (id) => tx('readonly', (s) => s.get(id)),
    put: (b) => tx('readwrite', (s) => s.put(b, b.manifest.id)),
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
    getItem: (k) => { try { return localStorage.getItem(`hezhong:${game}:${k}`); } catch { return null; } },
    setItem: (k, v) => { try { localStorage.setItem(`hezhong:${game}:${k}`, v); } catch { /* private mode */ } },
  };
}

const isNode = () => !!globalThis.process?.versions?.node;
async function sha256Hex(text) {
  const c = globalThis.crypto?.subtle; if (!c) return null;
  const buf = await c.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function importModule(code) {
  let url, revoke = false;
  if (!isNode() && typeof Blob !== 'undefined' && URL.createObjectURL) { url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); revoke = true; }
  else url = 'data:text/javascript;base64,' + (typeof Buffer !== 'undefined' ? Buffer.from(code, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(code))));
  try { return (await import(/* @vite-ignore */ /* webpackIgnore: true */ url)).default; }
  finally { if (revoke) URL.revokeObjectURL(url); }
}

// ------------------------------------------------------------ the SDK
export class HeZhong {
  /**
   * @param {object} o
   * @param {string} o.game            your game's slug on the hub / 游戏在平台上的标识
   * @param {string} [o.server]        hub base URL, e.g. https://hub.example.com / 平台地址
   * @param {number} [o.apiVersion=1]  highest mod API version your game supports / 游戏支持的最高模组接口版本
   * @param {string} [o.gameVersion]   passed to mods as ctx.gameVersion
   * @param {object} [o.storage]       memoryStorage() / browserStorage(game) / your own
   * @param {Function} [o.fetch]       custom fetch (tests)
   * @param {number} [o.maxErrors=20]  a mod whose hooks throw this many times gets switched off
   */
  constructor(o) {
    if (!o?.game) throw new Error('HeZhong: "game" is required / 需要 game');
    this.game = o.game;
    this.apiVersion = o.apiVersion ?? 1;
    this.gameVersion = o.gameVersion ?? '';
    this.storage = o.storage ?? (typeof indexedDB !== 'undefined' ? browserStorage(o.game) : memoryStorage());
    this._fetch = o.fetch ?? ((...a) => globalThis.fetch(...a));
    this.maxErrors = o.maxErrors ?? 20;
    this.server = (o.server ?? this.storage.getItem('server') ?? '').replace(/\/+$/, '');
    /** per-mod runtime state / 每个模组的运行状态 */
    this.status = [];
    /** per-mod persistent data — save it with your game's save file / 模组的存档数据，请随游戏存档一起保存 */
    this.data = {};
    this._mods = [];
  }

  // ---------- hub (server) side
  setServer(url) { this.server = String(url || '').replace(/\/+$/, ''); this.storage.setItem('server', this.server); }
  async _get(path) {
    if (!this.server) throw new Error('No hub server configured / 还没设置平台地址');
    const r = await this._fetch(this.server + path, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
    return { data, text, headers: r.headers };
  }
  /** Game info on the hub. 平台上的游戏信息。 */
  async info() { return (await this._get(`/api/games/${this.game}`)).data; }
  /** Browse / search mods for this game. 浏览、搜索本游戏的模组。 */
  async browse({ q = '', sort = 'downloads', tag = '', page = 0 } = {}) {
    return (await this._get(`/api/games/${this.game}/mods?q=${encodeURIComponent(q)}&sort=${sort}&tag=${encodeURIComponent(tag)}&page=${page}`)).data;
  }
  async details(id) { return (await this._get(`/api/games/${this.game}/mods/${encodeURIComponent(id)}`)).data; }
  iconUrl(id) { return `${this.server}/api/games/${this.game}/mods/${encodeURIComponent(id)}/icon`; }
  pageUrl(id) { return `${this.server}/#/g/${this.game}/m/${encodeURIComponent(id)}`; }
  /** Download, verify and install a mod (replaces any older version). 下载、校验并安装（替换旧版本）。 */
  async install(id, { version, enable = true } = {}) {
    const { text, headers } = await this._get(`/api/games/${this.game}/mods/${encodeURIComponent(id)}/download${version ? '?v=' + version : ''}`);
    const want = headers.get?.('x-content-sha256');
    if (want) { const got = await sha256Hex(text); if (got && got !== want) throw new Error('Checksum mismatch / 校验和不符，下载可能损坏'); }
    return this.importText(text, { enable });
  }
  /** Mods with a newer version on the hub. 平台上有新版本的模组。 */
  async updates() {
    const out = [];
    for (const b of await this.installed()) {
      try { const d = await this.details(b.manifest.id); if (cmpVersion(d.version, b.manifest.version) > 0) out.push({ id: b.manifest.id, from: b.manifest.version, to: d.version }); } catch { /* removed from hub */ }
    }
    return out;
  }

  // ---------- local library
  /** Install from a .hzmod file's text. 从 .hzmod 文件内容安装。 */
  async importText(text, { enable = true } = {}) {
    if (text.length > MAX_BYTES) throw new Error('Bundle too large (max 20 MB) / 模组包太大');
    let b; try { b = JSON.parse(text); } catch { throw new Error('Not a .hzmod bundle / 不是模组包'); }
    const err = validateBundle(b, { game: this.game, apiVersion: this.apiVersion });
    if (err) throw Object.assign(new Error(`${err.en} / ${err.zh}`), { code: err.code });
    await this.storage.put(b);
    if (enable) this.setEnabled(b.manifest.id, true);
    return b;
  }
  installed() { return this.storage.list(); }
  enabled() { try { return JSON.parse(this.storage.getItem('enabled') || '{}'); } catch { return {}; } }
  setEnabled(id, on) { const e = this.enabled(); if (on) e[id] = true; else delete e[id]; this.storage.setItem('enabled', JSON.stringify(e)); }
  async remove(id) { await this.storage.remove(id); this.setEnabled(id, false); }

  // ---------- runtime
  /**
   * Load every enabled mod, dependencies first. Call once, before your game builds its world.
   * 加载所有已启用的模组（依赖先加载）。在游戏建世界之前调用一次。
   *
   * Each mod's entry file must `export default function setup(api, ctx)`.
   * `api` is whatever your makeApi(ctx) returns — that is YOUR game's mod API.
   * `ctx` is provided by HeZhong: { id, manifest, gameVersion, file(name), on(event, fn), store: { get, set }, log(...) }.
   *
   * @param {(ctx: object) => object} makeApi
   * @returns {Promise<object[]>} status list
   */
  async load(makeApi = () => ({})) {
    const en = this.enabled(), all = await this.installed();
    const byId = new Map(all.map((b) => [b.manifest.id, b]));
    const st = (b, state, error) => ({ id: b.manifest.id, name: b.manifest.name, version: b.manifest.version, state, error, errors: 0 });
    this.status = all.filter((b) => !en[b.manifest.id]).map((b) => st(b, 'disabled'));
    const order = [], done = new Set(), bad = new Set();
    const visit = (b, path) => {
      const id = b.manifest.id;
      if (done.has(id) || bad.has(id)) return;
      if (path.includes(id)) { bad.add(id); this.status.push(st(b, 'error', 'Dependency cycle / 依赖成环')); return; }
      for (const d of b.manifest.deps ?? []) {
        const dep = byId.get(d);
        if (!dep || !en[d]) { bad.add(id); this.status.push(st(b, 'missing-dep', `Needs mod "${d}" (not installed or disabled) / 缺少依赖「${d}」`)); return; }
        visit(dep, [...path, id]);
        if (bad.has(d)) { bad.add(id); this.status.push(st(b, 'missing-dep', `Dependency "${d}" failed to load / 依赖「${d}」没能加载`)); return; }
      }
      done.add(id); order.push(b);
    };
    for (const b of all) if (en[b.manifest.id]) visit(b, []);
    for (const b of order) await this._loadOne(b, makeApi, st);
    return this.status;
  }
  async _loadOne(b, makeApi, st) {
    const s = st(b, 'loaded');
    const err = validateBundle(b, { game: this.game, apiVersion: this.apiVersion });
    if (err) { s.state = 'error'; s.error = `${err.en} / ${err.zh}`; this.status.push(s); return; }
    const mod = { b, s, hooks: new Map(), dead: false };
    const id = b.manifest.id, self = this;
    const ctx = Object.freeze({
      id, manifest: b.manifest, gameVersion: this.gameVersion, sdkVersion: SDK_VERSION,
      file: (name) => b.files[name],
      on(ev, fn) { if (typeof fn !== 'function') throw new Error('on(event, fn): fn must be a function'); if (!mod.hooks.has(ev)) mod.hooks.set(ev, []); mod.hooks.get(ev).push(fn); },
      store: { get: (k) => self.data[id]?.[k], set: (k, v) => { (self.data[id] ??= {})[k] = v; } },
      log: (...a) => console.log(`[mod ${id}]`, ...a),
    });
    try {
      const setup = await importModule(b.files[b.main]);
      if (typeof setup !== 'function') throw new Error('Entry must `export default function setup(api, ctx)` / 入口要默认导出 setup(api, ctx)');
      await setup(makeApi(ctx), ctx);
      this._mods.push(mod);
    } catch (e) { s.state = 'error'; s.error = String(e?.message ?? e); console.warn(`[mod ${id}] failed to load`, e); }
    this.status.push(s);
  }
  /**
   * Fire an event to every loaded mod. Each handler is isolated: a throwing mod never breaks your game,
   * and one that keeps throwing is switched off. Returns the handlers' non-undefined results.
   * 向所有模组派发事件。每个回调单独兜错；连续出错的模组会被停用。返回各回调的非 undefined 返回值。
   */
  emit(ev, ...args) {
    const out = [];
    for (const m of this._mods) {
      if (m.dead) continue;
      for (const fn of m.hooks.get(ev) ?? []) {
        try { const r = fn(...args); if (r !== undefined) out.push(r); }
        catch (e) {
          m.s.errors++;
          if (m.s.errors <= 3) console.warn(`[mod ${m.s.id}] "${ev}" handler threw`, e);
          if (m.s.errors >= this.maxErrors) { m.dead = true; m.s.state = 'error'; m.s.error = `Switched off after ${m.s.errors} errors / 出错太多已停用: ${e?.message ?? e}`; break; }
        }
      }
    }
    return out;
  }
  /** Mods currently running. 正在运行的模组。 */
  get loaded() { return this._mods.filter((m) => !m.dead).map((m) => m.b.manifest); }
  /** Per-mod data for your save file. 交给游戏存档的模组数据。 */
  exportData() { return JSON.parse(JSON.stringify(this.data)); }
  importData(d) { this.data = d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : {}; }
}
