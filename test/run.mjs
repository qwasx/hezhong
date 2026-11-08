// HeZhong test suite: server API, SDK (install / load / events / isolation), CLI pack & publish — all against a real hub.
// 合众测试：服务端接口、SDK（安装 / 加载 / 事件 / 出错隔离）、命令行打包发布——全部对着真实服务跑。
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createHub } from '../server/server.mjs';
import { HeZhong, memoryStorage, validateBundle, localized } from '../sdk/hezhong.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'hezhong-test-'));
const port = 21000 + Math.floor(Math.random() * 20000), base = `http://127.0.0.1:${port}`;
const hub = createHub({ dataDir: join(tmp, 'data'), adminToken: 'admin-test-token' });
await hub.listen(port);
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const call = async (method, path, { json, body, token, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = 'Bearer ' + token; if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await fetch(base + path, { method, headers: h, body }); const ct = r.headers.get('content-type') || '';
  return { status: r.status, data: ct.includes('json') ? await r.json() : await r.arrayBuffer(), headers: r.headers };
};
// async: the hub runs in this same process, so a blocking child would deadlock / 平台跑在本进程里，子进程必须异步
const cli = async (...a) => (await promisify(execFile)(process.execPath, [join(ROOT, 'cli', 'hezhong.mjs'), ...a], { env: { ...process.env, HOME: tmp, USERPROFILE: tmp, HEZHONG_PASSWORD: 'creator-pass-1' }, encoding: 'utf8' })).stdout;

try {
  console.log('1. Accounts / 账号');
  let r = await call('POST', '/api/auth/register', { json: { name: 'dev', password: 'dev-password' } });
  ok(r.status === 200 && r.data.token, 'register');
  const tDev = r.data.token;
  ok((await call('POST', '/api/auth/register', { json: { name: 'dev', password: 'dev-password' } })).status === 409, 'duplicate name rejected');
  ok((await call('POST', '/api/auth/register', { json: { name: 'x', password: 'short' } })).status === 400, 'bad name / short password rejected');
  r = await call('POST', '/api/auth/login', { json: { name: 'dev', password: 'nope-nope' }, headers: { 'Accept-Language': 'zh-CN' } });
  ok(r.status === 401 && r.data.error === '用户名或密码不对', 'errors come back in the requested language (zh)');
  ok((await call('POST', '/api/auth/login', { json: { name: 'dev', password: 'nope-nope' } })).data.error === 'Wrong user name or password', '…and in English by default');

  console.log('2. Games / 游戏');
  ok((await call('POST', '/api/games', { json: { slug: 'slime-garden', name: 'Slime Garden' } })).status === 401, 'registering a game needs sign-in');
  r = await call('POST', '/api/games', { token: tDev, json: { slug: 'slime-garden', name: 'Slime Garden', desc: 'demo', api: 1, locales: { zh: { name: '史莱姆花园', desc: '示例' } } } });
  ok(r.status === 200 && r.data.slug === 'slime-garden' && r.data.locales.zh.name === '史莱姆花园', 'register a game (with Chinese locale)');
  ok((await call('POST', '/api/games', { token: tDev, json: { slug: 'slime-garden', name: 'Again' } })).status === 409, 'slug taken');
  ok((await call('POST', '/api/games', { token: tDev, json: { slug: 'Bad Slug', name: 'x' } })).status === 400, 'bad slug rejected');
  await call('POST', '/api/games', { token: tDev, json: { slug: 'other-game', name: 'Other Game' } });
  ok((await call('GET', '/api/games')).data.total === 2, 'games directory');
  ok((await call('PATCH', '/api/games/slime-garden', { token: tDev, json: { api: 2 } })).data.api === 2, 'owner can edit (raise mod API to v2)');

  console.log('3. CLI: init, pack, validate, login, publish / 命令行');
  const modDir = join(tmp, 'my-slime');
  ok(/Created/.test(await cli('init', modDir, '--game', 'slime-garden', '--id', 'my-slime')), 'hezhong init scaffolds a mod');
  const man = JSON.parse(readFileSync(join(modDir, 'manifest.json'), 'utf8'));
  writeFileSync(join(modDir, 'manifest.json'), JSON.stringify({ ...man, name: 'My Slime', author: 'creator', desc: 'test mod' }));
  writeFileSync(join(modDir, 'index.js'), `export default function setup(api, ctx) { api.addSlime({ id: ctx.id + ':blue', color: 'blue' }); ctx.on('pop', (e) => { ctx.store.set('n', (ctx.store.get('n') ?? 0) + 1); return 'seen:' + e.kind; }); }`);
  const out = await cli('pack', modDir, '--out', join(tmp, 'dist'));
  const fmod = join(tmp, 'dist', 'my-slime-0.1.0.hzmod');
  ok(/my-slime-0\.1\.0\.hzmod/.test(out), 'hezhong pack builds a .hzmod');
  ok(/is valid/.test(await cli('validate', fmod)), 'hezhong validate');
  ok(/Signed in/.test(await cli('register', '--server', base, '--name', 'creator')), 'hezhong register (token saved locally)');
  ok(/Published slime-garden\/my-slime v0\.1\.0/.test(await cli('publish', fmod)), 'hezhong publish');
  const bundle = JSON.parse(readFileSync(fmod, 'utf8'));

  console.log('4. Publishing rules / 发布规则');
  const tCreator = JSON.parse(readFileSync(join(tmp, '.hezhong.json'), 'utf8')).token;
  const pub = (b, token, game = 'slime-garden') => call('POST', `/api/games/${game}/mods`, { body: typeof b === 'string' ? b : JSON.stringify(b), token });
  ok((await pub(bundle, tCreator)).status === 409, 'same version twice rejected');
  ok((await pub(bundle, tDev)).status === 403, "someone else can't take an existing mod id");
  ok((await pub(bundle, tCreator, 'other-game')).status === 400, 'mod for game A cannot be published under game B');
  ok((await pub({ ...bundle, manifest: { ...bundle.manifest, version: '0.2.0', api: 3 } }, tCreator)).status === 400, 'mod needing a newer API than the game supports is rejected');
  ok((await pub('{not json', tCreator)).status === 400, 'garbage rejected');
  r = await pub({ ...bundle, manifest: { ...bundle.manifest, version: '0.2.0', locales: { zh: { name: '我的史莱姆', desc: '测试' } } } }, tCreator);
  ok(r.status === 200 && r.data.version === '0.2.0' && r.data.versions.length === 2, 'update to 0.2.0');
  ok((await pub({ ...bundle, manifest: { ...bundle.manifest, version: '0.1.5' } }, tCreator)).status === 409, 'version cannot go backwards');

  console.log('5. Browse, search, download / 浏览、搜索、下载');
  ok((await call('GET', '/api/games/slime-garden/mods')).data.total === 1 && (await call('GET', '/api/games/other-game/mods')).data.total === 0, 'mods are listed per game');
  ok((await call('GET', '/api/mods?q=' + encodeURIComponent('我的史莱姆'))).data.total === 1, 'search matches localized names');
  r = await call('GET', '/api/games/slime-garden/mods/my-slime/download');
  ok(r.status === 200 && r.data.manifest.version === '0.2.0' && r.headers.get('x-content-sha256'), 'download latest with checksum header');
  ok((await call('GET', '/api/games/slime-garden/mods/my-slime/download?v=0.1.0')).data.manifest.version === '0.1.0', 'older versions stay downloadable');
  ok((await call('GET', '/api/games/slime-garden/mods/..%2f..%2fetc/download')).status === 404, 'path traversal is a 404');
  r = await fetch(base + '/api/games', { method: 'OPTIONS' });
  ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'CORS preflight (games on any origin / file:// can connect)');

  console.log('6. SDK: install from hub, load, events, persistence, isolation / SDK');
  const kinds = [];
  const hz = new HeZhong({ game: 'slime-garden', server: base, apiVersion: 2, storage: memoryStorage() });
  ok((await hz.browse()).mods[0].id === 'my-slime', 'sdk.browse()');
  await hz.install('my-slime');
  ok((await hz.installed()).length === 1 && hz.enabled()['my-slime'], 'sdk.install() verifies checksum, validates, stores, enables');
  // a broken mod and a mod with a missing dependency, imported from files / 坏模组与缺依赖的模组
  const mk = (id, code, extra = {}) => JSON.stringify({ format: 'hezhong-mod@1', manifest: { id, game: 'slime-garden', name: id, version: '1.0.0', author: 't', desc: '', ...extra }, main: 'index.js', files: { 'index.js': code } });
  await hz.importText(mk('broken', 'export default function () { throw new Error("boom"); }'));
  await hz.importText(mk('needs-dep', 'export default function () {}', { deps: ['missing-mod'] }));
  await hz.importText(mk('noisy', 'export default function (api, ctx) { ctx.on("tick", () => { throw new Error("bad tick"); }); }'));
  let wrong = null; try { await hz.importText(mk('foreign', 'export default function(){}', { game: 'other-game' })); } catch (e) { wrong = e.message; }
  ok(wrong && /other-game/.test(wrong), 'SDK refuses mods made for another game');
  const st = await hz.load((ctx) => ({ addSlime: (d) => kinds.push({ ...d, by: ctx.id }) }));
  const S = (id) => st.find((s) => s.id === id);
  ok(S('my-slime').state === 'loaded' && kinds.some((k) => k.id === 'my-slime:blue'), "mod ran setup(api, ctx) against the game's API");
  ok(S('broken').state === 'error' && /boom/.test(S('broken').error), 'a mod that throws in setup is isolated');
  ok(S('needs-dep').state === 'missing-dep', 'missing dependency reported, mod not loaded');
  ok(hz.emit('pop', { kind: 'x' }).includes('seen:x'), 'emit() reaches handlers and returns their results');
  for (let i = 0; i < 25; i++) hz.emit('tick', 0.016);
  ok(S('noisy').state === 'error' && /Switched off/.test(S('noisy').error) && hz.loaded.every((m) => m.id !== 'noisy'), 'a mod that keeps throwing gets switched off; the game keeps going');
  ok(hz.exportData()['my-slime'].n === 1, 'ctx.store data is exported for the save file');
  const hz2 = new HeZhong({ game: 'slime-garden', server: base, apiVersion: 2, storage: memoryStorage() }); hz2.importData(hz.exportData());
  ok(hz2.data['my-slime'].n === 1, '…and restored from it');
  ok((await hz.updates()).length === 0, 'sdk.updates(): nothing newer');
  ok(localized({ name: 'A', desc: 'a', locales: { zh: { name: '甲', desc: '' } } }, 'zh').name === '甲', 'localized() picks the Chinese name');
  ok(validateBundle(JSON.parse(mk('ok-mod', 'x'))) === null && validateBundle({ format: 'nope' })?.code === 'format', 'validateBundle()');

  console.log('7. Ratings, take-down, admin / 评分、下架、管理');
  ok((await call('POST', '/api/games/slime-garden/mods/my-slime/rate', { token: tCreator, json: { stars: 5 } })).status === 403, "can't rate your own mod");
  ok((await call('POST', '/api/games/slime-garden/mods/my-slime/rate', { token: tDev, json: { stars: 4 } })).data.rating === 4, 'rate 4★');
  const t3 = (await call('POST', '/api/auth/register', { json: { name: 'stranger', password: 'stranger-pass' } })).data.token;
  ok((await call('DELETE', '/api/games/slime-garden/mods/my-slime', { token: t3 })).status === 403, "strangers can't take a mod down");
  ok((await call('DELETE', '/api/games/slime-garden/mods/my-slime', { token: tDev })).status === 200, 'the game owner can take a mod down');
  ok((await call('GET', '/api/games/slime-garden/mods/my-slime/download')).status === 404, 'taken-down mods cannot be downloaded');
  ok((await call('POST', '/api/admin/hide', { json: { game: 'slime-garden', mod: 'my-slime', hidden: false }, headers: { 'X-Admin-Token': 'wrong' } })).status === 403, 'admin token checked');
  ok((await call('POST', '/api/admin/hide', { json: { game: 'slime-garden', mod: 'my-slime', hidden: false }, headers: { 'X-Admin-Token': 'admin-test-token' } })).status === 200, 'admin can restore it');
  ok((await call('GET', '/api/me', { token: tCreator })).data.mods.length === 1, '/api/me lists my mods');

  console.log('8. Website & persistence / 网页与持久化');
  r = await fetch(base + '/');
  ok(r.status === 200 && (await r.text()).includes('app.js') && (r.headers.get('content-security-policy') || '').includes("script-src 'self'"), 'storefront served with a strict CSP');
  await hub.close();
  // fresh port: Node's fetch keeps pooled sockets to the old instance / 换个端口，避开 fetch 连接池里的旧连接
  const hub2 = createHub({ dataDir: join(tmp, 'data') }); await hub2.listen(port + 1);
  r = { status: 0, data: {} }; { const x = await fetch(`http://127.0.0.1:${port + 1}/api/games/slime-garden/mods/my-slime`); r = { status: x.status, data: await x.json() }; }
  ok(r.status === 200 && r.data.versions.length === 2 && r.data.ratings === 1, 'data survives a restart');
  await hub2.close();
} catch (e) { console.error(e); fails++; }
finally { try { await hub.close(); } catch { /* already closed */ } rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? `\n${n - fails}/${n} passed, ${fails} failed` : `\n${n}/${n} passed`);
process.exit(fails ? 1 : 0);
