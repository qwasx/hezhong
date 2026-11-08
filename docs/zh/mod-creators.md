# 模组创作者：做模组、发模组

[English](../en/mod-creators.md)

一个模组就是一个文件夹，里面有 `manifest.json`、`index.js`，以及要用的图片、声音、数据。命令行把它打成一个 `.hzmod` 文件，可以发布到平台，也可以直接发给朋友导入。

## 1. 准备

```bash
npm i -D github:qwasx/hezhong      # 装上 hezhong 命令（需要 Node 18+）
npm i -D esbuild                   # 可选：让 index.js 可以 import 文件夹里的其他文件
```

## 2. 用模板起步

```bash
npx hezhong init my-mod --game slime-garden
```

## 3. manifest.json

```json
{
  "id": "rainbow-slime",
  "game": "slime-garden",
  "name": "Rainbow Slime",
  "version": "1.0.0",
  "author": "你的名字",
  "desc": "模组的作用，可以换行。",
  "api": 1,
  "icon": "icon.png",
  "deps": [],
  "tags": ["slime"],
  "locales": { "zh": { "name": "彩虹史莱姆", "desc": "中文简介" } }
}
```

| 字段 | 规则 |
|---|---|
| `id` | 3–32 位：`a-z`、`0-9`、`-`，字母开头。在平台上归第一个发布它的人。 |
| `game` | 目标游戏的标识。 |
| `version` | `x.y.z`，每次发布都要比上次高。 |
| `api` | 需要的游戏模组接口版本（看游戏的文档），默认 `1`。 |
| `icon` | 文件夹里的 png / webp / jpeg / gif。 |
| `deps` | 同一游戏里必须先加载的其他模组 id。 |
| `locales` | 可选：`name`、`desc` 的其他语言版本。 |

## 4. index.js

```js
export default function setup(api, ctx) {
  // api = 游戏给的模组接口：能加什么、能做什么取决于游戏，请看游戏的文档
  api.addSlime({ id: `${ctx.id}:rainbow`, color: (t) => `hsl(${t / 8 % 360} 80% 60%)`, points: 5 });

  // ctx = 合众提供，每个游戏都一样
  ctx.on('pop', (e) => {                                  // 监听游戏事件
    const n = (ctx.store.get('pops') ?? 0) + 1;           // 存档数据，随游戏存档保存
    ctx.store.set('pops', n);
  });
  const iconUrl = ctx.file('icon.png');                   // 包里的文件（图片是 data: 网址）
  ctx.log('loaded', ctx.manifest.version);
}
```

好习惯：

- 你加的东西，id 都带上模组 id 前缀，很多游戏会强制要求。
- `tick` 回调要轻。
- 不要在循环里抛错。回调连续出错的模组会被停用。
- `ctx.store` 里只存需要的东西，而且只存能转成 JSON 的值。

## 5. 本地试玩

```bash
npx hezhong pack my-mod          # 得到 dist/my-mod-1.0.0.hzmod
```

在游戏里打开模组面板 →「导入文件」→ 选 `.hzmod` → 重新载入。

## 6. 发布

```bash
npx hezhong register --server https://hub.example.com --name 你的名字   # 第一次
npx hezhong login    --server https://hub.example.com --name 你的名字   # 换电脑时
npx hezhong publish dist/my-mod-1.0.0.hzmod
```

密码取自环境变量 `$HEZHONG_PASSWORD`，没有就交互输入。也可以在网页上「发布模组」上传文件。

**更新**：调高 `version`，重新 `pack`、`publish`，玩家那边会出现「更新」按钮。

**下架**：「我的模组与游戏」→「下架」。

## 模组包格式（写工具的人看）

`.hzmod` 是一个 JSON：

```json
{ "format": "hezhong-mod@1", "manifest": { ... }, "main": "index.js", "files": { "index.js": "export default …", "icon.png": "data:image/png;base64,…" } }
```

限制：

- 每个包 20MB 以内；
- 最多 500 个文件；
- 文件名只能用 `[\w\-./]`，不能有 `..`。

规则写在 `sdk/validate.js` 里。
