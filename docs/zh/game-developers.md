# 游戏开发者：给游戏加上模组

[English](../en/game-developers.md)

合众对你的游戏一无所知，**模组能做什么由你决定**。其余的事合众包了：

- 分发（浏览、安装、更新）；
- 校验和校验和核对；
- 加载顺序与依赖；
- 事件；
- 每个模组的存档数据；
- 不让一个坏模组拖垮游戏。

## 1. 在平台上登记游戏

打开平台网页 →「登记游戏」，填写：

- **标识**：如 `my-game`。登记后不能改，模组靠它认准你的游戏。
- **名称、简介**：可以附中文翻译。
- **主页**。
- **模组接口版本**：先填 `1`。

也可以用代码登记：`POST /api/games`（见 [api.md](api.md)）。

## 2. 安装 SDK

```bash
npm i github:qwasx/hezhong
```

也可以直接把 `sdk/hezhong.js`、`sdk/validate.js`（还有可选的 `sdk/panel.js`）拷进项目。它们都是零依赖的普通 ES 模块。

## 3. 游戏开始前加载模组

```js
import { HeZhong } from 'hezhong';

const hz = new HeZhong({
  game: 'my-game',                    // 你的游戏标识
  server: 'https://hub.example.com',  // 玩家从哪个平台装模组（玩家可在面板里改）
  apiVersion: 1,                      // 这个版本的游戏支持的最高模组接口版本
  gameVersion: '1.4.2',               // 可选，模组从 ctx.gameVersion 读到
});

const statuses = await hz.load((ctx) => createModApi(ctx));
```

`load()` 从本地（浏览器里是 IndexedDB）读出所有已启用的模组，按依赖排好顺序。对每个模组，它导入入口模块并调用 `setup(api, ctx)`：

- `api` 是 `createModApi(ctx)` 的返回值，就是**你的模组接口**。
- `ctx` 由合众提供：
  - `id`、`manifest`、`gameVersion`；
  - `file(name)`：取模组包里的文件，图片得到 `data:` 网址；
  - `on(事件, 回调)`：监听你派发的事件；
  - `store.get/set`：每个模组自己的存档数据；
  - `log(...)`。

`statuses` 记着每个模组的结果：`loaded`（已加载）、`error`（出错）、`missing-dep`（缺依赖）或 `disabled`（未启用），出错时附带原因。

### 怎么设计模组接口

保持小而明确：给出去的是函数，不是游戏内部对象。

```js
function createModApi(ctx) {
  return {
    // 加内容
    addItem(def) { requirePrefix(def.id, ctx.id); items.set(def.id, sanitizeItem(def)); },
    addEnemy(def) { requirePrefix(def.id, ctx.id); enemies.set(def.id, sanitizeEnemy(def)); },
    // 做动作
    giveItem(id, n = 1) { player.inventory.add(id, clamp(n, 1, 999)); },
    toast(text) { ui.toast(String(text).slice(0, 200)); },
    // 只读数据
    get player() { return { level: player.level, x: player.x, y: player.y }; },
  };
}
const requirePrefix = (id, mod) => { if (!String(id).startsWith(mod + ':')) throw new Error(`id 要以「${mod}:」开头`); };
```

建议：

- **内容 id 带上模组 id 前缀**（`模组id:东西`），免得模组之间撞名。
- **模组给的数据都要校验、夹紧**（数值范围、文字长度、颜色）。
- **接口要有版本号**。不兼容地改了接口时，在 SDK 和平台上都调高 `apiVersion`（`PATCH /api/games/:标识`）。模组在 `manifest.api` 里声明自己需要的版本，SDK 会拒绝需要更高版本的模组。
- 模组的 `setup` 抛错，只有这个模组被标为出错，游戏照常运行。

## 4. 派发事件

```js
hz.emit('start');                 // 新开局 / 读档之后
hz.emit('tick', dt);              // 每帧（可选，回调要轻）
hz.emit('kill', { id: enemy.id, x: enemy.x, y: enemy.y });
const extraLoot = hz.emit('loot', enemy).flat();   // 回调可以有返回值
```

每个回调都单独 `try/catch`。回调连续出错的模组（默认 20 次，可用 `maxErrors` 设置）会被停用，状态里写明原因。

事件名和参数请写进文档，它们也是你模组接口的一部分。

## 5. 让玩家管理模组

最省事的是现成的面板：

```js
import { mountPanel } from 'hezhong/panel';
modsButton.onclick = () => mountPanel(hz, document.body, { lang: 'zh', onChange: () => {/* 提示重新载入 */} });
```

面板有三部分：

- 「已安装」：启用、停用、卸载，看每个模组的状态；
- 「模组平台」：搜索、排序、安装、更新；
- 「导入文件」：安装 `.hzmod` 文件。

模组在启动时加载，所以改动后要重新载入，面板上有按钮。

想自己做界面，可以用这些方法：

- `hz.browse({ q, sort, page })`、`hz.details(id)`、`hz.iconUrl(id)`；
- `hz.install(id)`、`hz.updates()`；
- `hz.installed()`、`hz.enabled()`、`hz.setEnabled(id, on)`、`hz.remove(id)`；
- `hz.importText(text)`。

## 6. 模组数据随存档

```js
save.mods = hz.exportData();       // 存档时
hz.importData(save.mods);          // 读档时，在 hz.emit('start') 之前
```

## 隔离方案

默认情况下，模组和你引入的其他脚本一样运行在游戏页面里。这样最简单，大多数游戏够用。

如果要大规模接纳陌生人的内容，可以考虑：

- 把模组放进沙箱 `<iframe>` 或 Worker 里运行，让 `createModApi` 通过 `postMessage` 转发调用；
- 给游戏页面加内容安全策略（CSP）；
- 自建平台，只放审核过的模组，有问题就下架。

## 清单

- [ ] 游戏已在平台登记，设好了 `slug` 和 `apiVersion`。
- [ ] 在建世界之前调用了 `hz.load()`。
- [ ] 派发了事件，并写进了文档。
- [ ] 模组接口校验输入，内容 id 带前缀。
- [ ] `exportData` / `importData` 接进了存档。
- [ ] 玩家能打开模组面板。
- [ ] 给创作者写了一页「怎么给我的游戏做模组」，列出接口和事件。
