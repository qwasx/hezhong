#!/usr/bin/env node
// HeZhong CLI — scaffold, pack, validate and publish mods.  合众命令行：新建、打包、校验、发布模组。
//
//   hezhong init <dir> --game <slug> [--id <mod-id>]
//   hezhong pack <dir> [--out <dir>]
//   hezhong validate <file.hzmod | dir>
//   hezhong register|login --server <url> --name <user>        (password from $HEZHONG_PASSWORD or prompt)
//   hezhong publish <file.hzmod> [--server <url>]
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, extname, relative, resolve, basename } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { FORMAT, validateBundle, MAX_BYTES, ID_RE } from '../sdk/validate.js';

const argv = process.argv.slice(2);
const cmd = argv[0];
const pos = argv.slice(1).filter((a, i, A) => !a.startsWith('--') && !(A[i - 1]?.startsWith('--')));
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CONF = join(homedir(), '.hezhong.json');
const conf = () => { try { return JSON.parse(readFileSync(CONF, 'utf8')); } catch { return {}; } };
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };
const TEXT = new Set(['.json', '.txt', '.md', '.csv', '.glsl', '.frag', '.vert']);

async function pack(dir, outDir = 'dist') {
  dir = resolve(dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const main = manifest.main ?? 'index.js'; delete manifest.main;
  const files = {};
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f), rel = relative(dir, p).split('\\').join('/');
      if (f.startsWith('.') || f === 'node_modules' || f === 'dist') continue;
      if (statSync(p).isDirectory()) { walk(p); continue; }
      const ext = extname(f).toLowerCase();
      if (rel === 'manifest.json' || ['.js', '.mjs', '.ts'].includes(ext)) continue;
      if (MIME[ext]) files[rel] = `data:${MIME[ext]};base64,` + readFileSync(p).toString('base64');
      else if (TEXT.has(ext)) files[rel] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  // Bundle the entry into one ES module with esbuild when available; otherwise ship it as-is (must be self-contained).
  // 有 esbuild 就把入口打成一个 ES 模块；没有就原样打包（入口必须不 import 别的文件）。
  let code;
  try {
    const { build } = await import('esbuild');
    const r = await build({ entryPoints: [join(dir, main)], bundle: true, format: 'esm', platform: 'browser', target: 'es2020', write: false, legalComments: 'none', charset: 'utf8' });
    code = r.outputFiles[0].text;
  } catch (e) {
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    code = readFileSync(join(dir, main), 'utf8');
    if (/^\s*import\s[^(]/m.test(code)) die('Entry imports other files but esbuild is not installed (npm i -D esbuild) / 入口 import 了别的文件，请先安装 esbuild');
  }
  files['index.js'] = code;
  const bundle = { format: FORMAT, manifest, main: 'index.js', files };
  const err = validateBundle(bundle); if (err) die(`${err.en} / ${err.zh}`);
  const text = JSON.stringify(bundle);
  if (text.length > MAX_BYTES) die('Bundle exceeds 20 MB / 模组包超过 20MB');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${manifest.id}-${manifest.version}.hzmod`);
  writeFileSync(out, text);
  console.log(`✓ ${out}  (${Math.ceil(text.length / 1024)} KB, ${Object.keys(files).length} files)`);
  return out;
}

function ask(q, hidden) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) rl._writeToOutput = (s) => { if (!s.includes(q)) rl.output.write(''); else rl.output.write(s); };
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); res(a); });
  });
}
async function api(server, path, { method = 'GET', body, token, json } = {}) {
  const headers = { 'Accept-Language': process.env.LANG?.startsWith('zh') ? 'zh' : 'en' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await fetch(server.replace(/\/+$/, '') + path, { method, headers, body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) die(data.error || `HTTP ${r.status}`);
  return data;
}

const HELP = `HeZhong CLI · 合众命令行

  hezhong init <dir> --game <slug> [--id <mod-id>]   new mod from a template / 用模板新建模组
  hezhong pack <dir> [--out dist]                    build a .hzmod bundle   / 打包成 .hzmod
  hezhong validate <file.hzmod|dir>                  check a bundle          / 校验
  hezhong register --server <url> --name <user>      create an account       / 注册
  hezhong login    --server <url> --name <user>      sign in                 / 登录
  hezhong publish <file.hzmod> [--server <url>]      publish or update       / 发布或更新

Password is read from $HEZHONG_PASSWORD or asked interactively. 密码取自环境变量 HEZHONG_PASSWORD，或交互输入。`;

switch (cmd) {
  case 'init': {
    const dir = pos[0], game = flag('game');
    if (!dir || !game) die('Usage: hezhong init <dir> --game <slug>');
    const id = flag('id', basename(resolve(dir)).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^[^a-z]+/, '') || 'my-mod');
    if (!ID_RE.test(id)) die(`Bad mod id "${id}" — use --id / 模组 id 不合规，请用 --id 指定`);
    if (existsSync(join(dir, 'manifest.json'))) die('manifest.json already exists / 已存在');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ id, game, name: id, version: '0.1.0', author: '', desc: 'Describe your mod here. / 在这里介绍你的模组。', api: 1, tags: [], locales: { zh: { name: id, desc: '' } } }, null, 2) + '\n');
    writeFileSync(join(dir, 'index.js'), `// ${id} — a HeZhong mod for "${game}".\n// \`api\` is the game's own mod API (see the game's docs). \`ctx\` comes from HeZhong.\n/** @param {any} api @param {import('hezhong').ModContext} ctx */\nexport default function setup(api, ctx) {\n  ctx.log('hello from', ctx.id);\n  ctx.on('start', () => {\n    // runs when the game starts / 游戏开始时\n  });\n}\n`);
    console.log(`✓ Created ${dir}/manifest.json and index.js. Next: hezhong pack ${dir}`);
    break;
  }
  case 'pack': { if (!pos[0]) die('Usage: hezhong pack <dir>'); await pack(pos[0], flag('out', 'dist')); break; }
  case 'validate': {
    const p = pos[0]; if (!p) die('Usage: hezhong validate <file|dir>');
    if (statSync(p).isDirectory()) { await pack(p, flag('out', 'dist')); break; }
    let b; try { b = JSON.parse(readFileSync(p, 'utf8')); } catch { die('Not JSON / 不是 JSON'); }
    const err = validateBundle(b); if (err) die(`${err.en} / ${err.zh}`);
    console.log(`✓ ${b.manifest.game}/${b.manifest.id} v${b.manifest.version} is valid / 合格`);
    break;
  }
  case 'register': case 'login': {
    const server = flag('server', conf().server), name = flag('name');
    if (!server || !name) die(`Usage: hezhong ${cmd} --server <url> --name <user>`);
    const password = process.env.HEZHONG_PASSWORD ?? await ask('Password / 密码: ', true);
    const r = await api(server, `/api/auth/${cmd}`, { method: 'POST', json: { name, password } });
    writeFileSync(CONF, JSON.stringify({ server, name: r.name, token: r.token }, null, 2), { mode: 0o600 });
    console.log(`✓ Signed in as ${r.name} @ ${server} (token saved to ${CONF})`);
    break;
  }
  case 'publish': {
    const f = pos[0], c = conf(), server = flag('server', c.server);
    if (!f) die('Usage: hezhong publish <file.hzmod>');
    if (!server || !c.token) die('Sign in first: hezhong login --server <url> --name <user> / 请先登录');
    const text = readFileSync(f, 'utf8');
    let b; try { b = JSON.parse(text); } catch { die('Not a .hzmod / 不是模组包'); }
    const err = validateBundle(b); if (err) die(`${err.en} / ${err.zh}`);
    const r = await api(server, `/api/games/${b.manifest.game}/mods`, { method: 'POST', body: text, token: c.token });
    console.log(`✓ Published ${r.game}/${r.id} v${r.version} → ${server.replace(/\/+$/, '')}/#/g/${r.game}/m/${r.id}`);
    break;
  }
  default: console.log(HELP);
}
