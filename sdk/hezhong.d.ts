// Type definitions for the HeZhong SDK. 合众 SDK 类型定义。

export const FORMAT: 'hezhong-mod@1';
export const SDK_VERSION: string;

/** A mod's manifest. 模组清单。 */
export interface ModManifest {
  /** 3–32 chars: lowercase letters, digits, "-"; unique within a game. */
  id: string;
  /** Slug of the game this mod is for. 目标游戏的标识。 */
  game: string;
  name: string;
  /** x.y.z */
  version: string;
  author?: string;
  desc?: string;
  /** Mod API version of the game this mod needs (default 1). 需要的游戏模组接口版本。 */
  api?: number;
  /** File name (in `files`) of a png / webp / jpeg / gif icon. */
  icon?: string;
  /** Ids of mods (same game) that must load first. */
  deps?: string[];
  tags?: string[];
  /** Translations, e.g. { zh: { name, desc } }. 其他语言的名称与简介。 */
  locales?: Record<string, { name?: string; desc?: string }>;
}
/** A .hzmod file. 一个 .hzmod 文件。 */
export interface ModBundle {
  format: 'hezhong-mod@1';
  manifest: ModManifest;
  /** Entry file name in `files`; an ES module whose default export is setup(api, ctx). */
  main: string;
  /** Text files verbatim; binary files as data: URLs. */
  files: Record<string, string>;
}

/** What HeZhong gives every mod (second argument of setup). 合众交给每个模组的上下文。 */
export interface ModContext {
  readonly id: string;
  readonly manifest: ModManifest;
  readonly gameVersion: string;
  readonly sdkVersion: string;
  /** A file from the bundle (text, or data: URL for binaries). */
  file(name: string): string | undefined;
  /** Listen to a game event. Handlers are isolated; returning a value makes it visible to the game's emit(). */
  on(event: string, handler: (...args: any[]) => unknown): void;
  /** Persistent per-mod data, saved with the game's save file. 随游戏存档保存的模组数据。 */
  store: { get<T = unknown>(key: string): T | undefined; set(key: string, value: unknown): void };
  log(...args: unknown[]): void;
}
/** A mod's entry point. 模组入口。 */
export type ModSetup<API = any> = (api: API, ctx: ModContext) => void | Promise<void>;

export interface ModStatus {
  id: string; name: string; version: string;
  state: 'loaded' | 'error' | 'disabled' | 'missing-dep';
  error?: string;
  /** How many times its handlers threw. */
  errors: number;
}
export interface HubMod {
  id: string; game: string; name: string; locales: Record<string, { name?: string; desc?: string }>;
  version: string; author: string; owner: string; desc: string; tags: string[]; api: number;
  downloads: number; rating: number; ratings: number; updated: number; created: number; size: number; icon: boolean;
}
export interface HubModDetail extends HubMod { deps: string[]; versions: { version: string; size: number; sha256: string; at: number; downloads: number }[] }
export interface HubGame { slug: string; name: string; locales: Record<string, { name?: string; desc?: string }>; desc: string; homepage: string; owner: string; api: number; created: number; mods: number }

export interface Storage {
  list(): Promise<ModBundle[]>;
  get(id: string): Promise<ModBundle | undefined>;
  put(b: ModBundle): Promise<void>;
  remove(id: string): Promise<void>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function memoryStorage(): Storage;
export function browserStorage(game: string): Storage;

export interface ValidationError { code: string; en: string; zh: string }
export function validateBundle(b: unknown, opt?: { game?: string; apiVersion?: number }): ValidationError | null;
export function cmpVersion(a: string, b: string): number;
export function localized(m: { name: string; desc?: string; locales?: Record<string, { name?: string; desc?: string }> }, lang: string): { name: string; desc: string };

export interface HeZhongOptions {
  /** Your game's slug on the hub. */
  game: string;
  /** Hub base URL, e.g. https://hub.example.com */
  server?: string;
  /** Highest mod API version your game supports (default 1). */
  apiVersion?: number;
  gameVersion?: string;
  storage?: Storage;
  fetch?: typeof fetch;
  /** Switch a mod off after this many handler errors (default 20). */
  maxErrors?: number;
}

export class HeZhong {
  constructor(opt: HeZhongOptions);
  readonly game: string;
  server: string;
  status: ModStatus[];
  /** Per-mod persistent data; save it with your game. */
  data: Record<string, Record<string, unknown>>;
  readonly loaded: ModManifest[];

  setServer(url: string): void;
  info(): Promise<HubGame>;
  browse(q?: { q?: string; sort?: 'downloads' | 'new' | 'rating'; tag?: string; page?: number }): Promise<{ total: number; page: number; pageSize: number; mods: HubMod[] }>;
  details(id: string): Promise<HubModDetail>;
  iconUrl(id: string): string;
  pageUrl(id: string): string;
  install(id: string, opt?: { version?: string; enable?: boolean }): Promise<ModBundle>;
  updates(): Promise<{ id: string; from: string; to: string }[]>;

  importText(text: string, opt?: { enable?: boolean }): Promise<ModBundle>;
  installed(): Promise<ModBundle[]>;
  enabled(): Record<string, boolean>;
  setEnabled(id: string, on: boolean): void;
  remove(id: string): Promise<void>;

  /** Load enabled mods (dependencies first); makeApi builds the object your game hands to each mod. */
  load<API>(makeApi?: (ctx: ModContext) => API): Promise<ModStatus[]>;
  /** Fire an event to all mods; returns handlers' non-undefined results. */
  emit(event: string, ...args: unknown[]): unknown[];
  exportData(): Record<string, Record<string, unknown>>;
  importData(d: unknown): void;
}
