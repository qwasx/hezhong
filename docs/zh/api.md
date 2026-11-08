# 接口文档

[English](../en/api.md)

**返回格式**：除特别注明外都返回 JSON。出错时返回 `{ "error": "…" }`，并带上对应的 HTTP 状态码。报错的语言跟随请求头 `Accept-Language`（以 `zh` 开头为中文），或用 `?lang=zh|en` 指定。

**登录**：需要登录的接口，请求头带 `Authorization: Bearer <token>`。token 30 天有效。

**跨域**：默认全开（`CORS_ORIGIN`），任何域名的游戏都能调用，包括 `file://`。

## 账号

| 方法 | 路径 | 请求 → 返回 |
|---|---|---|
| POST | `/api/auth/register` | `{ name, password }` → `{ name, token }`。用户名 2–24 位，密码至少 8 位。 |
| POST | `/api/auth/login` | `{ name, password }` → `{ name, token }` |
| POST | `/api/auth/logout` | 作废当前 token。 |
| GET | `/api/me` | → `{ name, games: [游戏…], mods: [模组…] }`，含已下架的。 |

## 游戏

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/games?q=` | → `{ total, games: [Game] }` |
| POST | `/api/games` | 需登录。`{ slug, name, desc?, homepage?, api?, locales? }`。可以设为只许管理员登记，见 `OPEN_GAMES`。 |
| GET | `/api/games/:game` | → `Game` |
| PATCH | `/api/games/:game` | 登记人或管理员。可改 `name desc homepage api locales` 中任意几项。 |

`Game` = `{ slug, name, locales, desc, homepage, owner, api, created, mods }`

## 模组

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/mods?q=&sort=&tag=&page=` | 跨所有游戏。 |
| GET | `/api/games/:game/mods?q=&sort=downloads\|new\|rating&tag=&page=` | → `{ total, page, pageSize, mods: [Mod] }`，每页 24 个。 |
| GET | `/api/games/:game/mods/:id` | → `ModDetail` = `Mod` + `{ deps, versions: [{ version, size, sha256, at, downloads }] }` |
| GET | `/api/games/:game/mods/:id/download[?v=x.y.z][&dl]` | `.hzmod` 文件内容，响应头带 `X-Content-SHA256`；带 `dl` 时浏览器存成文件。下载数 +1。 |
| GET | `/api/games/:game/mods/:id/icon` | 图标图片。 |
| POST | `/api/games/:game/mods` | 需登录。请求体就是 `.hzmod` 文件，用于发布新模组或新版本。 |
| POST | `/api/games/:game/mods/:id/rate` | 需登录。`{ stars: 1..5 }`，不能给自己打分。 |
| DELETE | `/api/games/:game/mods/:id` | 作者、游戏登记人或管理员：下架（文件保留）。 |

`Mod` = `{ id, game, name, locales, version, author, owner, desc, tags, api, downloads, rating, ratings, updated, created, size, icon }`

发布规则：

- 模组包要通过 `validateBundle`，且 `manifest.game` 等于 `:game`；
- `manifest.api` 不能超过游戏的 `api`；
- 模组 id 归第一个发布者；
- 版本号不能重复，只能升不能降。

## 管理

请求头带 `X-Admin-Token: <ADMIN_TOKEN>`。

| 方法 | 路径 | 请求体 |
|---|---|---|
| POST | `/api/admin/hide` | `{ game, mod?, hidden }`：下架或恢复一个模组；省略 `mod` 时作用于整个游戏。 |

管理员也可以调用 `PATCH /api/games/:game`、`DELETE …/mods/:id`，以及 `POST /api/games`（即使关闭了公开登记）。

## 其他

`GET /api/health` → `{ ok, name, version, games, mods, openGames }`

## 限流（每个 IP）

| 操作 | 上限 |
|---|---|
| 注册 / 登录 | 每 10 分钟 20 次 |
| 上传 | 每小时 30 次 |
| 评分 | 每小时 60 次 |
| 登记游戏 | 每天 10 次 |
