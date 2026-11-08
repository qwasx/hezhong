// HeZhong storefront — games directory, mods, publishing, game registration. English / 中文.
// 合众网页：游戏目录、模组、发布、登记游戏。中英双语。玩家写的内容一律以纯文本显示。
const $ = (s) => document.querySelector(s);
const app = $('#app');

// ------------------------------------------------------------ i18n
const I18N = {
  en: {
    brand: 'HeZhong', slogan: 'Open mod hub for web games', search: 'Search', searchPh: 'Search mods, games, authors, tags', publish: 'Publish a mod', newGame: 'Add your game', signin: 'Sign in / Register', signout: 'Sign out', lang: '中文',
    footer: 'HeZhong is open source and self-hostable. Mods are code written by players: they run only inside the game, but can change saves — install what you trust.', source: 'Source on GitHub',
    heroTitle: 'Everyone is a creator.', heroSub: 'HeZhong connects web games with the people who play them. Game developers add a few lines of SDK; players install mods with one click; anyone can make and share one.',
    forPlayers: 'For players', forPlayersT: 'Browse mods for your favourite games, install them from inside the game, rate what you love.',
    forCreators: 'For creators', forCreatorsT: 'Write a mod in plain JavaScript, pack it with one command, publish it here. Updates reach players automatically.',
    forDevs: 'For game developers', forDevsT: 'Register your game, define what mods may touch, drop in the SDK — a mod manager panel included.',
    games: 'Games', popular: 'Popular mods', noGames: 'No games yet — be the first to add yours.', mods: 'mods', downloads: 'downloads', dlHead: 'Downloads', noRating: 'No ratings yet', loading: 'Loading…',
    sortDownloads: 'Most downloaded', sortNew: 'Newest', sortRating: 'Top rated', total: (n) => `${n} mods`, none: 'No mods found.', noneYet: 'No mods yet. Publish the first one!', prev: 'Previous', next: 'Next', homepage: 'Play / homepage', modApi: 'Mod API',
    download: (v) => `Download v${v} (.hzmod)`, installHint: 'Easier: open the game\'s mod panel, connect to this hub and press Install. A downloaded .hzmod can also be imported there.',
    modId: 'Mod id', game: 'Game', author: 'Author', publisher: 'Publisher', updated: 'Updated', size: 'Size', deps: 'Requires', versions: 'Versions', version: 'Version', released: 'Released', rateIt: 'Rate it:', rated: (s) => `Rated ${s} ★ — thanks!`, signinToRate: 'Sign in to rate', tags: 'Tags',
    signTitle: 'Sign in / Register', userName: 'User name (2–24 chars)', password: 'Password (8+ chars)', doSignin: 'Sign in', doRegister: 'Create account',
    pubTitle: 'Publish or update a mod', pubHelp1: 'Pack your mod folder into a .hzmod with the CLI:', pubHelp2: 'A mod id belongs to whoever publishes it first. To update, raise the version in manifest.json and upload again.', pickGame: 'Game', file: 'Mod file (.hzmod, max 20 MB)', doPublish: 'Publish', chooseFile: 'Choose a .hzmod file first', uploading: 'Uploading…', published: (n, v) => `"${n}" v${v} is live!`,
    ngTitle: 'Add your game', ngHelp: 'Registering gives your game a slug. Creators publish mods for it here; your game installs them through the SDK.', slug: 'Slug (3–32 chars: a-z 0-9 -)', gName: 'Name', gNameZh: 'Chinese name (optional)', gDesc: 'Description', gDescZh: 'Chinese description (optional)', gHome: 'Homepage / where to play (https://…)', gApi: 'Mod API version your game supports', doRegisterGame: 'Register game', gameRegistered: 'Registered! Integrate the SDK next:',
    integrate: 'Integrate the SDK', mine: 'My mods & games', myGames: 'My games', myMods: 'My mods', status: 'Status', live: 'Live', hidden: 'Taken down', takeDown: 'Take down', confirmDown: (n) => `Take down "${n}"? Players will no longer find or download it.`, noneMine: 'Nothing here yet.',
  },
  zh: {
    brand: '合众', slogan: '网页游戏的开放模组平台', search: '搜索', searchPh: '搜索模组、游戏、作者、标签', publish: '发布模组', newGame: '登记游戏', signin: '登录 / 注册', signout: '退出', lang: 'EN',
    footer: '合众开源、可自建。模组是玩家写的代码，只在游戏里运行，但能改存档——请只装信得过的。', source: 'GitHub 源码',
    heroTitle: '人人都是创作者。', heroSub: '合众把网页游戏和玩家连在一起：游戏开发者接几行 SDK，玩家在游戏里一键装模组，任何人都能做模组、分享模组。',
    forPlayers: '玩家', forPlayersT: '给喜欢的游戏找模组，在游戏里一键安装，给好作品打分。',
    forCreators: '创作者', forCreatorsT: '用普通的 JavaScript 写模组，一条命令打包，在这里发布；更新会自动推到玩家那里。',
    forDevs: '游戏开发者', forDevsT: '登记你的游戏，定好模组能碰什么，接上 SDK——还自带一个模组管理面板。',
    games: '游戏', popular: '热门模组', noGames: '还没有游戏，来登记第一个吧。', mods: '个模组', downloads: '次下载', dlHead: '下载', noRating: '尚无评分', loading: '载入中…',
    sortDownloads: '下载最多', sortNew: '最新', sortRating: '评分最高', total: (n) => `共 ${n} 个模组`, none: '没有找到模组。', noneYet: '还没有模组，来发布第一个！', prev: '上一页', next: '下一页', homepage: '去玩 / 主页', modApi: '模组接口',
    download: (v) => `下载 v${v}（.hzmod）`, installHint: '在游戏里装更方便：打开游戏的模组面板，连上本平台后点「安装」；下载的 .hzmod 也可以在那里导入。',
    modId: '模组 id', game: '游戏', author: '作者', publisher: '发布者', updated: '更新', size: '大小', deps: '依赖', versions: '版本记录', version: '版本', released: '发布', rateIt: '打分：', rated: (s) => `已打 ${s} 星，谢谢！`, signinToRate: '登录后可以打分', tags: '标签',
    signTitle: '登录 / 注册', userName: '用户名（2–24 位）', password: '密码（至少 8 位）', doSignin: '登录', doRegister: '注册新账号',
    pubTitle: '发布 / 更新模组', pubHelp1: '用命令行把模组文件夹打成 .hzmod：', pubHelp2: '模组 id 归第一个发布它的人；更新时把 manifest.json 里的版本号调高，再上传即可。', pickGame: '游戏', file: '模组文件（.hzmod，最大 20MB）', doPublish: '发布', chooseFile: '先选一个 .hzmod 文件', uploading: '上传中…', published: (n, v) => `「${n}」v${v} 发布成功！`,
    ngTitle: '登记游戏', ngHelp: '登记后你的游戏会有一个标识：创作者在这里给它发布模组，你的游戏通过 SDK 安装它们。', slug: '标识（3–32 位：a-z 0-9 -）', gName: '名称（英文或原名）', gNameZh: '中文名（可选）', gDesc: '简介', gDescZh: '中文简介（可选）', gHome: '主页 / 在哪玩（https://…）', gApi: '游戏支持的模组接口版本', doRegisterGame: '登记游戏', gameRegistered: '登记成功！下一步接入 SDK：',
    integrate: '接入 SDK', mine: '我的模组与游戏', myGames: '我的游戏', myMods: '我的模组', status: '状态', live: '上架中', hidden: '已下架', takeDown: '下架', confirmDown: (n) => `下架「${n}」？玩家将搜不到、下不了它。`, noneMine: '这里还什么都没有。',
  },
};
let lang = localStorage.getItem('hz.lang') || (/^zh/i.test(navigator.language) ? 'zh' : 'en');
const t = (k, ...a) => { const v = I18N[lang][k] ?? I18N.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; };
const loc = (o) => { const L = o.locales?.[lang]; return { name: L?.name || o.name, desc: L?.desc || o.desc || '' }; };

// ------------------------------------------------------------ utils
let session = JSON.parse(localStorage.getItem('hz.session') || 'null');
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
async function api(path, opt = {}) {
  const headers = { 'Accept-Language': lang, ...(opt.headers || {}) };
  if (session) headers.Authorization = 'Bearer ' + session.token;
  if (opt.json !== undefined) { headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(opt.json); }
  const r = await fetch(path, { ...opt, headers });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && session && !path.startsWith('/api/auth')) setSession(null);
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
const date = (x) => new Date(x).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const stars = (r, n) => (n ? `${'★'.repeat(Math.round(r))}${'☆'.repeat(5 - Math.round(r))} ${r.toFixed(1)} (${n})` : t('noRating'));
const modIcon = (m) => (m.icon ? h('img', { class: 'ico', src: `/api/games/${m.game}/mods/${m.id}/icon?v=${m.updated}`, alt: '' }) : h('div', { class: 'ico' }, (loc(m).name || '?')[0]));
const gameIcon = (g) => h('div', { class: 'ico game' }, (loc(g).name || '?')[0]);
const msgBox = () => h('div');
const say = (box, text, err = false) => box.replaceChildren(h('div', { class: 'msg' + (err ? ' err' : '') }, text));
const code = (s) => h('pre', { class: 'code' }, s);

function setSession(s) { session = s; if (s) localStorage.setItem('hz.session', JSON.stringify(s)); else localStorage.removeItem('hz.session'); chrome(); }
function chrome() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-t]').forEach((e) => { e.textContent = t(e.dataset.t); });
  $('#q').placeholder = t('searchPh'); $('#lang').textContent = t('lang');
  const w = $('#who'); w.replaceChildren();
  if (session) w.append(h('a', { href: '#/me' }, session.name), h('a', { href: '#/', onclick: async () => { try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* */ } setSession(null); } }, t('signout')));
  else w.append(h('a', { href: '#/login' }, t('signin')));
}
const modCard = (m, showGame) => h('a', { class: 'card', href: `#/g/${m.game}/m/${m.id}` }, modIcon(m), h('div', { class: 'meta' },
  h('b', {}, loc(m).name), h('span', { class: 'sub' }, `v${m.version} · ${m.author} · ${m.downloads} ${t('downloads')}${showGame ? ' · ' + m.game : ''}`),
  h('span', { class: 'stars' }, stars(m.rating, m.ratings)), h('span', { class: 'desc' }, loc(m).desc),
  m.tags.length ? h('div', { class: 'tags' }, m.tags.map((x) => h('span', { class: 'tag' }, x))) : null));

// ------------------------------------------------------------ pages
async function home(q = '') {
  const gamesBox = h('div', { class: 'grid' }), modsBox = h('div', { class: 'grid' });
  app.replaceChildren(
    q ? null : h('section', { class: 'hero' }, h('h1', {}, t('heroTitle')), h('p', {}, t('heroSub')),
      h('div', { class: 'three' }, [['forPlayers', 'forPlayersT'], ['forCreators', 'forCreatorsT'], ['forDevs', 'forDevsT']].map(([a, b]) => h('div', { class: 'panel' }, h('h3', {}, t(a)), h('p', {}, t(b)))))),
    h('h2', {}, t('games')), gamesBox, h('h2', {}, t('popular')), modsBox);
  try {
    const [g, m] = await Promise.all([api(`/api/games?q=${encodeURIComponent(q)}`), api(`/api/mods?q=${encodeURIComponent(q)}&sort=downloads`)]);
    if (!g.games.length) gamesBox.replaceWith(h('p', { class: 'empty' }, t('noGames')));
    for (const x of g.games) gamesBox.append(h('a', { class: 'card', href: `#/g/${x.slug}` }, gameIcon(x), h('div', { class: 'meta' }, h('b', {}, loc(x).name), h('span', { class: 'sub' }, `${x.slug} · ${x.mods} ${t('mods')}`), h('span', { class: 'desc' }, loc(x).desc))));
    if (!m.mods.length) modsBox.replaceWith(h('p', { class: 'empty' }, q ? t('none') : t('noneYet')));
    for (const x of m.mods.slice(0, 12)) modsBox.append(modCard(x, true));
  } catch (e) { say(gamesBox, e.message, true); }
}

const gstate = { q: '', sort: 'downloads', page: 0 };
async function game(slug) {
  let g; try { g = await api(`/api/games/${slug}`); } catch (e) { app.replaceChildren(h('div', { class: 'msg err' }, e.message)); return; }
  const sorts = [['downloads', 'sortDownloads'], ['new', 'sortNew'], ['rating', 'sortRating']];
  const grid = h('div', { class: 'grid' }), count = h('span', { class: 'count' }, t('loading'));
  const qi = h('input', { type: 'search', value: gstate.q, placeholder: t('searchPh'), onkeydown: (e) => { if (e.key === 'Enter') { gstate.q = qi.value.trim(); gstate.page = 0; game(slug); } } });
  app.replaceChildren(
    h('div', { class: 'panel head' }, gameIcon(g), h('div', {}, h('h1', {}, loc(g).name), h('p', { class: 'prose' }, loc(g).desc),
      h('p', { class: 'sub' }, `${g.slug} · ${t('modApi')} v${g.api} · ${g.mods} ${t('mods')}`, g.homepage ? [' · ', h('a', { href: g.homepage, rel: 'noopener', target: '_blank' }, t('homepage'))] : null))),
    h('div', { class: 'bar' }, sorts.map(([k, n]) => h('button', { class: 'tab' + (gstate.sort === k ? ' on' : ''), onclick: () => { gstate.sort = k; gstate.page = 0; game(slug); } }, t(n))), qi, count),
    grid);
  try {
    const r = await api(`/api/games/${slug}/mods?q=${encodeURIComponent(gstate.q)}&sort=${gstate.sort}&page=${gstate.page}`);
    count.textContent = t('total', r.total);
    if (!r.mods.length) grid.replaceWith(h('p', { class: 'empty' }, gstate.q ? t('none') : t('noneYet')));
    for (const m of r.mods) grid.append(modCard(m));
    if (r.total > r.pageSize) app.append(h('div', { class: 'bar' }, h('button', { disabled: gstate.page === 0, onclick: () => { gstate.page--; game(slug); } }, t('prev')), h('button', { disabled: (gstate.page + 1) * r.pageSize >= r.total, onclick: () => { gstate.page++; game(slug); } }, t('next'))));
  } catch (e) { say(grid, e.message, true); }
  if (session?.name === g.owner) app.append(h('div', { class: 'panel gap' }, h('h3', {}, t('integrate')), integrateSnippet(g)));
}

async function mod(slug, id) {
  let m; try { m = await api(`/api/games/${slug}/mods/${id}`); } catch (e) { app.replaceChildren(h('div', { class: 'msg err' }, e.message)); return; }
  const box = msgBox(), rate = h('div', { class: 'rate' });
  if (session && session.name !== m.owner) rate.append(t('rateIt'), ...[1, 2, 3, 4, 5].map((s) => h('button', { title: `${s}`, onclick: async () => { try { await api(`/api/games/${slug}/mods/${id}/rate`, { method: 'POST', json: { stars: s } }); say(box, t('rated', s)); setTimeout(() => mod(slug, id), 700); } catch (e) { say(box, e.message, true); } } }, '★'.repeat(s))));
  else if (!session) rate.append(h('a', { href: '#/login' }, t('signinToRate')));
  const dl = (v) => `/api/games/${slug}/mods/${id}/download?v=${v}&dl=1`;
  app.replaceChildren(h('div', { class: 'detail' },
    h('div', {},
      h('div', { class: 'panel' }, h('div', { class: 'head' }, modIcon(m), h('div', {}, h('h1', {}, loc(m).name), h('div', { class: 'stars' }, stars(m.rating, m.ratings)),
        m.tags.length ? h('div', { class: 'tags' }, m.tags.map((x) => h('span', { class: 'tag' }, x))) : null)), h('div', { class: 'prose' }, loc(m).desc)),
      h('div', { class: 'panel gap' }, h('h3', {}, t('versions')), h('table', { class: 'vers' }, h('tr', {}, h('th', {}, t('version')), h('th', {}, t('released')), h('th', {}, t('size')), h('th', {}, t('dlHead')), h('th', {})),
        m.versions.map((v) => h('tr', {}, h('td', {}, 'v' + v.version), h('td', {}, date(v.at)), h('td', {}, size(v.size)), h('td', {}, String(v.downloads)), h('td', {}, h('a', { href: dl(v.version) }, '⇩'))))))),
    h('div', { class: 'side' }, h('div', { class: 'panel' },
      h('a', { class: 'btn primary', href: dl(m.version) }, t('download', m.version)), h('p', { class: 'note' }, t('installHint')),
      h('dl', {}, h('dt', {}, t('game')), h('dd', {}, h('a', { href: `#/g/${slug}` }, slug)), h('dt', {}, t('modId')), h('dd', {}, m.id), h('dt', {}, t('author')), h('dd', {}, m.author), h('dt', {}, t('publisher')), h('dd', {}, m.owner),
        h('dt', {}, t('dlHead')), h('dd', {}, String(m.downloads)), h('dt', {}, t('updated')), h('dd', {}, date(m.updated)), h('dt', {}, t('modApi')), h('dd', {}, 'v' + m.api),
        m.deps.length ? [h('dt', {}, t('deps')), h('dd', {}, m.deps.map((d) => h('a', { href: `#/g/${slug}/m/${d}` }, d + ' ')))] : null),
      rate, box))));
}

function login() {
  const name = h('input', { maxlength: 24, autocomplete: 'username' }), pw = h('input', { type: 'password', autocomplete: 'current-password' }), box = msgBox();
  const go = async (p) => { try { setSession(await api(p, { method: 'POST', json: { name: name.value.trim(), password: pw.value } })); location.hash = '#/me'; } catch (e) { say(box, e.message, true); } };
  app.replaceChildren(h('div', { class: 'panel form' }, h('h2', {}, t('signTitle')), h('label', {}, t('userName'), name), h('label', {}, t('password'), pw), box,
    h('div', { class: 'bar' }, h('button', { class: 'primary', onclick: () => go('/api/auth/login') }, t('doSignin')), h('button', { onclick: () => go('/api/auth/register') }, t('doRegister')))));
}

async function upload() {
  if (!session) return login();
  const file = h('input', { type: 'file', accept: '.hzmod,application/json' }), sel = h('select', {}), box = msgBox();
  const btn = h('button', { class: 'primary', onclick: async () => {
    const f = file.files[0]; if (!f) return say(box, t('chooseFile'), true);
    btn.disabled = true; say(box, t('uploading'));
    try {
      const text = await f.text(); let game = sel.value;
      try { game = JSON.parse(text).manifest?.game || game; } catch { /* server reports it */ }
      const r = await api(`/api/games/${game}/mods`, { method: 'POST', body: text, headers: { 'Content-Type': 'application/json' } });
      say(box, t('published', loc(r).name, r.version)); setTimeout(() => { location.hash = `#/g/${r.game}/m/${r.id}`; }, 900);
    } catch (e) { say(box, e.message, true); }
    btn.disabled = false;
  } }, t('doPublish'));
  app.replaceChildren(h('div', { class: 'panel form' }, h('h2', {}, t('pubTitle')), h('p', {}, t('pubHelp1')), code('npx hezhong pack ./my-mod\nnpx hezhong login --server ' + location.origin + ' --name <you>\nnpx hezhong publish dist/my-mod-1.0.0.hzmod'),
    h('p', {}, t('pubHelp2')), h('label', {}, t('pickGame'), sel), h('label', {}, t('file'), file), box, h('div', {}, btn)));
  try { for (const g of (await api('/api/games')).games) sel.append(h('option', { value: g.slug }, `${loc(g).name} (${g.slug})`)); } catch { /* */ }
}

function integrateSnippet(g) {
  return code(`import { HeZhong } from 'hezhong';          // or copy sdk/hezhong.js
import { mountPanel } from 'hezhong/panel';

const hz = new HeZhong({ game: '${g.slug}', server: '${location.origin}', apiVersion: ${g.api} });
await hz.load((ctx) => ({ /* your game's mod API */ }));   // before the game starts
hz.emit('start');                                          // fire events mods listen to
document.querySelector('#mods-button').onclick = () => mountPanel(hz);`);
}
function newGame() {
  if (!session) return login();
  const f = { slug: h('input', { maxlength: 32 }), name: h('input', { maxlength: 60 }), nameZh: h('input', { maxlength: 60 }), desc: h('textarea', { rows: 3, maxlength: 4000 }), descZh: h('textarea', { rows: 3, maxlength: 4000 }), home: h('input', { placeholder: 'https://' }), api: h('input', { type: 'number', min: 1, value: 1 }) };
  const box = msgBox();
  const go = async () => {
    try {
      const g = await api('/api/games', { method: 'POST', json: { slug: f.slug.value.trim(), name: f.name.value.trim(), desc: f.desc.value, homepage: f.home.value.trim(), api: +f.api.value || 1, locales: f.nameZh.value.trim() || f.descZh.value.trim() ? { zh: { name: f.nameZh.value.trim(), desc: f.descZh.value } } : {} } });
      box.replaceChildren(h('div', { class: 'msg' }, t('gameRegistered')), integrateSnippet(g), h('p', {}, h('a', { href: `#/g/${g.slug}` }, '→ ' + loc(g).name)));
    } catch (e) { say(box, e.message, true); }
  };
  app.replaceChildren(h('div', { class: 'panel form' }, h('h2', {}, t('ngTitle')), h('p', {}, t('ngHelp')),
    h('label', {}, t('slug'), f.slug), h('label', {}, t('gName'), f.name), h('label', {}, t('gNameZh'), f.nameZh), h('label', {}, t('gDesc'), f.desc), h('label', {}, t('gDescZh'), f.descZh), h('label', {}, t('gHome'), f.home), h('label', {}, t('gApi'), f.api),
    box, h('div', {}, h('button', { class: 'primary', onclick: go }, t('doRegisterGame')))));
}

async function me() {
  if (!session) return login();
  try {
    const r = await api('/api/me');
    const table = (rows, kind) => rows.length ? h('table', { class: 'vers' }, h('tr', {}, h('th', {}, kind === 'g' ? t('game') : t('modId')), h('th', {}, t('status')), h('th', {})),
      rows.map((x) => h('tr', {}, h('td', {}, h('a', { href: kind === 'g' ? `#/g/${x.slug}` : `#/g/${x.game}/m/${x.id}` }, `${loc(x).name}`), ' ', h('small', { class: 'sub' }, kind === 'g' ? x.slug : `${x.game} · v${x.version} · ${x.downloads} ${t('downloads')}`)),
        h('td', {}, x.hidden ? t('hidden') : t('live')),
        h('td', {}, kind === 'm' && !x.hidden ? h('button', { onclick: async () => { if (!confirm(t('confirmDown', loc(x).name))) return; await api(`/api/games/${x.game}/mods/${x.id}`, { method: 'DELETE' }); me(); } }, t('takeDown')) : null)))) : h('p', { class: 'empty' }, t('noneMine'));
    app.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t('mine')), h('h3', {}, t('myGames')), table(r.games, 'g'), h('h3', {}, t('myMods')), table(r.mods, 'm'),
      h('p', { class: 'bar' }, h('a', { class: 'btn primary', href: '#/upload' }, t('publish')), h('a', { class: 'btn', href: '#/new-game' }, t('newGame')))));
  } catch (e) { app.replaceChildren(h('div', { class: 'msg err' }, e.message)); }
}

// ------------------------------------------------------------ router
let lastQ = '';
function route() {
  const p = location.hash.replace(/^#/, '') || '/';
  let m;
  window.scrollTo(0, 0);
  if ((m = /^\/g\/([a-z0-9-]+)\/m\/([a-z0-9-]+)$/.exec(p))) mod(m[1], m[2]);
  else if ((m = /^\/g\/([a-z0-9-]+)$/.exec(p))) game(m[1]);
  else if (p === '/login') login();
  else if (p === '/upload') upload();
  else if (p === '/new-game') newGame();
  else if (p === '/me') me();
  else home(lastQ);
}
$('#search').addEventListener('submit', (e) => { e.preventDefault(); lastQ = $('#q').value.trim(); if ((location.hash || '#/') !== '#/') location.hash = '#/'; else home(lastQ); });
$('#lang').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; localStorage.setItem('hz.lang', lang); chrome(); route(); });
window.addEventListener('hashchange', route);
chrome();
route();
