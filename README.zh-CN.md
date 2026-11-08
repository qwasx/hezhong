<p align="center"><img src="server/public/favicon.svg" width="72" alt="合众"></p>

<h1 align="center">合众 · HeZhong</h1>
<p align="center"><b>网页游戏的开放模组平台。人人都是创作者。</b></p>
<p align="center"><a href="README.md">English</a> · <a href="docs/zh/game-developers.md">游戏开发者</a> · <a href="docs/zh/mod-creators.md">模组创作者</a> · <a href="docs/zh/api.md">接口文档</a> · <a href="docs/zh/self-hosting.md">自建部署</a></p>

---

合众让任何网页游戏都能拥有类似 Steam 创意工坊的模组生态：

- **平台服务端 + 网页商店**：自己部署。游戏开发者登记游戏，创作者发布模组，玩家浏览、评分、下载。界面中英双语。
- **游戏 SDK**：游戏里接十来行代码，玩家就能在游戏里安装模组。加载、事件、存档、依赖、出错隔离，SDK 全包了；还自带一个现成的模组管理面板。
- **创作者命令行**：`hezhong init`、`pack`、`publish`。模组就是普通的 JavaScript，谁都能做。

零运行时依赖，只要 Node 18 以上。一个进程、一个数据目录就能跑，也可以用 Docker。

```
 ┌────────────┐     安装 / 更新      ┌────────────────┐    发布     ┌────────────┐
 │  你的游戏   │ ◀─────────────────── │    合众平台     │ ◀────────── │   创作者    │
 │  + SDK     │     浏览 / 评分      │  接口 + 网页商店 │ (命令行/网页) │            │
 └────────────┘                      └────────────────┘             └────────────┘
```

## 一分钟试玩

```bash
git clone https://github.com/qwasx/hezhong && cd hezhong
npm run example
```

打开 **http://localhost:8080/examples/slime-garden/**，点 **Mods · 模组**，再点「模组平台」，给「彩虹史莱姆」点「安装」，然后刷新页面。网页商店在 **http://localhost:8787**（演示账号 `demo` / `demo-password`）。

## 游戏开发者：给游戏加上模组

```js
// npm i github:qwasx/hezhong   （或者直接把 sdk/ 文件夹拷进项目）
import { HeZhong } from 'hezhong';
import { mountPanel } from 'hezhong/panel';

const hz = new HeZhong({ game: 'my-game', server: 'https://hub.example.com', apiVersion: 1 });

// 1. 游戏建世界之前：加载已启用的模组，把「你的模组接口」交给每个模组
await hz.load((ctx) => ({
  addEnemy: (def) => enemies.push({ ...def, id: `${ctx.id}:${def.id}` }),
  toast: (text) => showToast(text),
}));

// 2. 派发事件给模组。每个回调单独兜错：模组坏了也拖不垮游戏
hz.emit('start');
hz.emit('kill', enemy);

// 3. 给玩家一个模组管理面板：已安装 / 模组平台 / 导入文件
modsButton.onclick = () => mountPanel(hz);

// 4. 模组自己的存档数据，和游戏存档放在一起
save.mods = hz.exportData();      // 读档时：hz.importData(save.mods)
```

**模组能做什么，由你决定。** `makeApi` 返回的对象，就是模组能看到的全部接口。详见 [docs/zh/game-developers.md](docs/zh/game-developers.md)。

## 创作者：做一个模组

```bash
npm i -D github:qwasx/hezhong                    # 安装 hezhong 命令行
npx hezhong init my-mod --game my-game          # 生成 manifest.json 和 index.js
# 编辑 index.js
npx hezhong pack my-mod                          # 打包成 dist/my-mod-0.1.0.hzmod
npx hezhong login --server https://hub.example.com --name 你的名字
npx hezhong publish dist/my-mod-0.1.0.hzmod
```

```js
// index.js
export default function setup(api, ctx) {        // api = 游戏给的模组接口，ctx = 合众提供
  api.addEnemy({ id: 'fire-wolf', hp: 40, color: '#e63' });
  ctx.on('kill', (e) => ctx.store.set('kills', (ctx.store.get('kills') ?? 0) + 1));
}
```

详见 [docs/zh/mod-creators.md](docs/zh/mod-creators.md)。

## 平台运营者

```bash
PORT=8787 DATA_DIR=/srv/hezhong ADMIN_TOKEN=$(openssl rand -hex 24) node server/server.mjs
# 或者
docker build -t hezhong . && docker run -d -p 8787:8787 -v /srv/hezhong:/data -e ADMIN_TOKEN=... hezhong
```

HTTPS、备份、限额、内容管理见 [docs/zh/self-hosting.md](docs/zh/self-hosting.md)。

## 目录

| 路径 | 内容 |
|---|---|
| `server/` | 平台服务端（`server.mjs`）与网页商店（`public/`），中英双语 |
| `sdk/hezhong.js` | 游戏 SDK：安装、加载、事件、存档、出错隔离（附 `.d.ts`） |
| `sdk/panel.js` | 现成的模组管理面板，中英双语 |
| `sdk/validate.js` | 模组包格式规则，服务端、SDK、命令行共用 |
| `cli/hezhong.mjs` | `init` · `pack` · `validate` · `register` · `login` · `publish` |
| `examples/` | 示例游戏「史莱姆花园」和示例模组「彩虹史莱姆」 |
| `test/run.mjs` | 端到端测试（服务端 + SDK + 命令行） |

## 安全

模组是别人写的代码。在浏览器里，它运行在游戏页面中：碰不到玩家电脑上的文件，但能做游戏页面能做的任何事，包括改存档。合众做了这些来降低风险：

- 每个模组包都要校验；
- 下载会核对校验和；
- 模组只拿得到游戏愿意给的接口；
- 出问题的模组会被隔离、停用；
- 网页商店有严格的内容安全策略；
- 作者、游戏登记人、管理员都能下架模组。

需要更强隔离的游戏，可以把模组放进 iframe 或 Worker 里运行，通过 `postMessage` 暴露接口。在 SDK 的 `makeApi` 里做这件事最自然。

## 许可证

[MIT](LICENSE)
