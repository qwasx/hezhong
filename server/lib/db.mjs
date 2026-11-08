// Tiny JSON-file store: the whole DB lives in memory; writes are coalesced and done atomically (temp file + rename).
// 极简 JSON 文件库：整库常驻内存，改动后合并写盘（先写临时文件再改名，断电也不会写坏）
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export function openDb(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'db.json');
  const data = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  data.users ??= {}; data.tokens ??= {}; data.games ??= {}; data.mods ??= {};
  let timer = null;
  const flush = () => {
    timer = null;
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  };
  return {
    data,
    /** 标记已改动：50ms 内的改动合并成一次写盘 */
    save() { if (!timer) timer = setTimeout(flush, 50); },
    flushNow() { if (timer) { clearTimeout(timer); flush(); } },
  };
}
