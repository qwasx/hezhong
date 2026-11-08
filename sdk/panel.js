// HeZhong drop-in mod manager — one call gives your game an "Installed / Browse hub" panel (English & 中文).
// 合众现成的模组管理面板——一行代码给游戏加上「已安装 / 模组平台」面板（中英双语）。
//
//   import { mountPanel } from './panel.js';
//   const close = mountPanel(hz, document.body, { lang: 'zh', onChange: () => location.reload() });
//
// Plain DOM, no framework, no inline event handlers; styles are scoped under .hz-panel.
import { localized } from './validate.js';

const T = {
  en: { title: 'Mods', installed: 'Installed', browse: 'Browse hub', import: 'Import file…', none: 'No mods installed yet.', on: 'Enabled', off: 'Disabled', remove: 'Remove', install: 'Install', update: 'Update to', have: 'Installed', server: 'Hub address, e.g. https://hub.example.com', connect: 'Connect', search: 'Search mods', go: 'Search', sorts: { downloads: 'Most downloaded', new: 'Newest', rating: 'Top rated' }, loading: 'Loading…', empty: 'No mods found.', reload: 'Changes take effect after a reload.', reloadBtn: 'Reload', downloads: 'downloads', close: 'Close', warn: 'Mods are code written by other players. They run inside the game only, but can change your save — install only what you trust.', loaded: 'running', failed: 'failed', disabled: 'disabled', installedMsg: (n) => `Installed "${n}".`, removedMsg: (n) => `Removed "${n}".` },
  zh: { title: '模组', installed: '已安装', browse: '模组平台', import: '导入文件…', none: '还没装模组。', on: '已启用', off: '已停用', remove: '卸载', install: '安装', update: '更新到', have: '已安装', server: '平台地址，如 https://hub.example.com', connect: '连接', search: '搜索模组', go: '搜索', sorts: { downloads: '下载最多', new: '最新', rating: '评分最高' }, loading: '载入中…', empty: '没有找到模组。', reload: '改动在重新载入后生效。', reloadBtn: '重新载入', downloads: '次下载', close: '关闭', warn: '模组是其他玩家写的代码，只在游戏里运行，但能改你的存档——只装信得过的。', loaded: '运行中', failed: '加载失败', disabled: '未启用', installedMsg: (n) => `已安装「${n}」。`, removedMsg: (n) => `已卸载「${n}」。` },
};
const CSS = `.hz-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:2147483000;font:14px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.hz-panel{width:min(760px,94vw);max-height:86vh;display:flex;flex-direction:column;background:#fbf8f1;color:#2a251e;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden}
.hz-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #e6dfd0}.hz-head b{font-size:18px;margin-right:auto}
.hz-tabs{display:flex;gap:6px;padding:10px 16px 0}.hz-sp{flex:1}.hz-body{padding:10px 16px 16px;overflow:auto}
.hz-panel button{font:inherit;border:1px solid #d6ccb8;background:#fff;border-radius:6px;padding:4px 12px;cursor:pointer;color:inherit}.hz-panel button.on,.hz-panel button.pri{background:#2f7a5c;border-color:#2f7a5c;color:#fff}.hz-panel button:disabled{opacity:.5;cursor:default}
.hz-panel input,.hz-panel select{font:inherit;border:1px solid #d6ccb8;border-radius:6px;padding:4px 8px;background:#fff;color:inherit;min-width:0}
.hz-bar{display:flex;gap:6px;margin-bottom:8px}.hz-bar input{flex:1}
.hz-row{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid #e6dfd0;border-radius:8px;margin-bottom:8px;background:#fff}
.hz-ico{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none;background:#e2efe6;display:flex;align-items:center;justify-content:center;font-size:22px;color:#2f7a5c}
.hz-main{flex:1;min-width:0}.hz-main small{color:#857a66;display:block}.hz-main p{margin:2px 0 0;white-space:pre-wrap;color:#4a4236}
.hz-acts{display:flex;flex-direction:column;gap:6px}.hz-msg{padding:6px 10px;border-radius:6px;background:#e2efe6;color:#2f7a5c;margin-bottom:8px}.hz-msg.err{background:#f6e0dd;color:#a8302a}
.hz-note{color:#857a66;font-size:12px;margin-top:8px}.hz-ok{color:#2f7a5c}.hz-bad{color:#a8302a}
@media (prefers-color-scheme:dark){.hz-panel{background:#211c15;color:#ece3cf}.hz-row,.hz-panel button,.hz-panel input,.hz-panel select{background:#2a241c;border-color:#3d352a}.hz-head{border-color:#3d352a}.hz-main p{color:#cfc4ad}}`;

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

/**
 * Open the mod manager. Returns a close() function. 打开模组管理面板，返回关闭函数。
 * @param {import('./hezhong.js').HeZhong} hz
 * @param {HTMLElement} [host=document.body]
 * @param {{ lang?: 'en'|'zh', onChange?: () => void, onClose?: () => void }} [opt]
 */
export function mountPanel(hz, host = document.body, opt = {}) {
  const lang = opt.lang ?? (/^zh/i.test(navigator.language) ? 'zh' : 'en'), t = T[lang] ?? T.en;
  if (!document.getElementById('hz-panel-css')) document.head.append(el('style', { id: 'hz-panel-css' }, CSS));
  let tab = 'installed', dirty = false, msg = null, list = null, q = '', sort = 'downloads';
  const body = el('div', { class: 'hz-body' });
  const tabs = el('div', { class: 'hz-tabs' });
  const close = () => { mask.remove(); opt.onClose?.(); };
  const mask = el('div', { class: 'hz-mask', onclick: (e) => { if (e.target === mask) close(); } },
    el('div', { class: 'hz-panel', role: 'dialog', 'aria-label': t.title }, el('div', { class: 'hz-head' }, el('b', {}, t.title), el('button', { onclick: close, 'aria-label': t.close }, '×')), tabs, body));
  const file = el('input', { type: 'file', accept: '.hzmod,application/json', hidden: true, onchange: async () => { const f = file.files?.[0]; file.value = ''; if (!f) return; try { const b = await hz.importText(await f.text()); changed(t.installedMsg(localized(b.manifest, lang).name)); } catch (e) { say(e.message, true); } } });
  const say = (s, err = false) => { msg = { s, err }; render(); };
  const changed = (s) => { dirty = true; opt.onChange?.(); say(s); };
  const statusOf = (id) => hz.status.find((s) => s.id === id);
  const icon = (b) => { const m = b.manifest ?? b, src = b.files && m.icon ? b.files[m.icon] : m.icon === true ? hz.iconUrl(m.id) : null; return src ? el('img', { class: 'hz-ico', src, alt: '' }) : el('div', { class: 'hz-ico' }, (localized(m, lang).name || '?')[0]); };

  async function render() {
    tabs.replaceChildren(
      el('button', { class: tab === 'installed' ? 'on' : '', onclick: () => { tab = 'installed'; msg = null; render(); } }, t.installed),
      el('button', { class: tab === 'browse' ? 'on' : '', onclick: () => { tab = 'browse'; msg = null; render(); if (hz.server && !list) search(); } }, t.browse),
      el('span', { class: 'hz-sp' }), el('button', { onclick: () => file.click() }, t.import), file);
    const top = [];
    if (msg) top.push(el('div', { class: 'hz-msg' + (msg.err ? ' err' : '') }, msg.s));
    if (dirty) top.push(el('div', { class: 'hz-msg' }, t.reload + ' ', el('button', { class: 'pri', onclick: () => location.reload() }, t.reloadBtn)));
    if (tab === 'installed') {
      const all = await hz.installed(), en = hz.enabled();
      body.replaceChildren(...top, ...(all.length ? all.map((b) => {
        const m = b.manifest, L = localized(m, lang), s = statusOf(m.id);
        return el('div', { class: 'hz-row' }, icon(b), el('div', { class: 'hz-main' }, el('b', {}, L.name), el('small', {}, `v${m.version} · ${m.author || '—'} · ${m.id}`), el('p', {}, L.desc),
          s ? el('small', { class: s.state === 'loaded' ? 'hz-ok' : s.state === 'disabled' ? '' : 'hz-bad' }, s.state === 'loaded' ? t.loaded : s.state === 'disabled' ? t.disabled : `${t.failed}: ${s.error}`) : null),
          el('div', { class: 'hz-acts' }, el('button', { class: en[m.id] ? 'on' : '', onclick: () => { hz.setEnabled(m.id, !en[m.id]); dirty = true; opt.onChange?.(); render(); } }, en[m.id] ? t.on : t.off),
            el('button', { onclick: async () => { await hz.remove(m.id); changed(t.removedMsg(L.name)); } }, t.remove)));
      }) : [el('p', {}, t.none)]), el('p', { class: 'hz-note' }, t.warn));
    } else {
      const srv = el('input', { value: hz.server, placeholder: t.server });
      const qi = el('input', { value: q, placeholder: t.search, onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') { q = qi.value; search(); } } });
      const so = el('select', { onchange: () => { sort = so.value; search(); } }, ...Object.entries(t.sorts).map(([k, n]) => el('option', { value: k, selected: k === sort }, n)));
      const local = new Map((await hz.installed()).map((b) => [b.manifest.id, b.manifest.version]));
      const rows = list === 'loading' ? [el('p', {}, t.loading)] : Array.isArray(list) ? (list.length ? list.map((m) => {
        const L = localized(m, lang), have = local.get(m.id), newer = have && m.version.localeCompare(have, undefined, { numeric: true }) > 0;
        return el('div', { class: 'hz-row' }, icon(m), el('div', { class: 'hz-main' }, el('b', {}, L.name), el('small', {}, `v${m.version} · ${m.author} · ${m.downloads} ${t.downloads}${m.ratings ? ` · ★${m.rating.toFixed(1)}` : ''}`), el('p', {}, L.desc)),
          el('div', { class: 'hz-acts' }, el('button', { class: 'pri', disabled: have && !newer, onclick: async (e) => { e.target.disabled = true; try { await hz.install(m.id); changed(t.installedMsg(L.name)); } catch (err) { say(err.message, true); } } }, have ? (newer ? `${t.update} v${m.version}` : t.have) : t.install)));
      }) : [el('p', {}, t.empty)]) : [];
      body.replaceChildren(...top, el('div', { class: 'hz-bar' }, srv, el('button', { onclick: () => { hz.setServer(srv.value.trim()); search(); } }, t.connect)),
        hz.server ? el('div', { class: 'hz-bar' }, qi, so, el('button', { onclick: () => { q = qi.value; search(); } }, t.go)) : null, ...rows);
    }
  }
  async function search() { list = 'loading'; render(); try { list = (await hz.browse({ q, sort })).mods; msg = null; } catch (e) { list = []; msg = { s: e.message, err: true }; } render(); }
  host.append(mask);
  render();
  return close;
}
