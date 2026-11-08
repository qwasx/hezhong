// HeZhong mod bundle validation — shared by the server, the SDK and the CLI.
// 合众模组包校验——服务端、SDK、命令行共用同一套规则。

export const FORMAT = 'hezhong-mod@1';
export const ID_RE = /^[a-z][a-z0-9-]{2,31}$/;          // mod id & game slug
export const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
export const MAX_BYTES = 20 * 1024 * 1024;
const FILE_RE = /^[\w\-./]{1,100}$/;
const IMG_RE = /^data:image\/(png|webp|jpeg|gif);base64,/;

export function cmpVersion(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

const str = (v, max, min = 0) => typeof v === 'string' && v.trim().length >= min && v.length <= max;

/**
 * Validate a bundle. Returns null when OK, otherwise an error code + message (English & Chinese).
 * 校验模组包：合格返回 null，否则返回 { code, en, zh }。
 * @param {any} B
 * @param {{ game?: string, apiVersion?: number }} [opt] - expected game slug / highest mod API the game supports
 */
export function validateBundle(B, opt = {}) {
  const E = (code, en, zh) => ({ code, en, zh });
  if (!B || typeof B !== 'object') return E('not_bundle', 'Not a mod bundle', '不是模组包');
  if (B.format !== FORMAT) return E('format', `Unknown format (expected ${FORMAT})`, `格式不对（要 ${FORMAT}）`);
  const m = B.manifest;
  if (!m || typeof m !== 'object') return E('manifest', 'Missing manifest', '缺少清单 manifest');
  if (typeof m.id !== 'string' || !ID_RE.test(m.id)) return E('id', 'Mod id: 3–32 chars, lowercase letters, digits, "-", starting with a letter', '模组 id：3–32 位小写字母、数字、连字符，字母开头');
  if (typeof m.game !== 'string' || !ID_RE.test(m.game)) return E('game', 'manifest.game must be the slug of the target game', 'manifest.game 要写目标游戏的标识');
  if (opt.game && m.game !== opt.game) return E('wrong_game', `This mod is for "${m.game}", not "${opt.game}"`, `这是「${m.game}」的模组，不是「${opt.game}」的`);
  if (!str(m.name, 60, 1)) return E('name', 'Name: 1–60 chars', '名称 1–60 字');
  if (typeof m.version !== 'string' || !VERSION_RE.test(m.version)) return E('version', 'Version must look like x.y.z', '版本号要写成 x.y.z');
  if (!str(m.author ?? '', 60)) return E('author', 'Author: up to 60 chars', '作者最多 60 字');
  if (!str(m.desc ?? '', 4000)) return E('desc', 'Description: up to 4000 chars', '简介最多 4000 字');
  if (m.api !== undefined && (!Number.isInteger(m.api) || m.api < 1)) return E('api', 'api must be a positive integer', 'api 要写正整数');
  if (opt.apiVersion !== undefined && (m.api ?? 1) > opt.apiVersion) return E('api_too_new', `Needs mod API v${m.api}; the game supports up to v${opt.apiVersion}`, `需要模组接口 v${m.api}，游戏只支持到 v${opt.apiVersion}`);
  if (m.deps !== undefined && (!Array.isArray(m.deps) || m.deps.length > 32 || m.deps.some((d) => typeof d !== 'string' || !ID_RE.test(d)))) return E('deps', 'deps must be a list of mod ids', 'deps 要写模组 id 列表');
  if (m.tags !== undefined && (!Array.isArray(m.tags) || m.tags.length > 8 || m.tags.some((t) => !str(t, 20, 1)))) return E('tags', 'Up to 8 tags, 20 chars each', '标签最多 8 个、每个 20 字以内');
  if (m.locales !== undefined) {
    if (!m.locales || typeof m.locales !== 'object' || Array.isArray(m.locales)) return E('locales', 'locales must be an object like { "en": { "name", "desc" } }', 'locales 要写成 { "en": { "name", "desc" } }');
    for (const [k, v] of Object.entries(m.locales)) if (!/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(k) || !v || typeof v !== 'object' || !str(v.name ?? '', 60) || !str(v.desc ?? '', 4000)) return E('locales', `Bad locale entry "${k}"`, `本地化条目「${k}」不合规`);
  }
  if (!B.files || typeof B.files !== 'object' || Array.isArray(B.files)) return E('files', 'Missing files', '缺少文件 files');
  const names = Object.keys(B.files);
  if (names.length > 500) return E('files', 'Too many files (max 500)', '文件太多（最多 500 个）');
  for (const k of names) {
    if (!FILE_RE.test(k) || k.includes('..') || k.startsWith('/')) return E('file_name', `Bad file name: ${k}`, `文件名不合规：${k}`);
    if (typeof B.files[k] !== 'string') return E('file_type', `File content must be text: ${k}`, `文件内容必须是文本：${k}`);
  }
  if (typeof B.main !== 'string' || typeof B.files[B.main] !== 'string') return E('main', 'Entry file "main" is not in files', '入口文件 main 不在 files 里');
  if (m.icon !== undefined && (typeof m.icon !== 'string' || !IMG_RE.test(B.files[m.icon] ?? ''))) return E('icon', 'icon must name a png / webp / jpeg / gif in files', 'icon 要指向 files 里的 png / webp / jpeg / gif 图片');
  return null;
}

/** Localized manifest text. 取某语言的名称与简介（没有就退回原文）。 */
export function localized(m, lang) {
  const L = m.locales?.[lang] ?? m.locales?.[String(lang).split('-')[0]];
  return { name: L?.name || m.name, desc: L?.desc || m.desc || '' };
}
