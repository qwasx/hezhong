# 自建平台

[English](../en/self-hosting.md)

## 运行

```bash
node server/server.mjs
```

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `8787` | 监听端口 |
| `DATA_DIR` | `./data` | 数据目录：要能写，要备份 |
| `ADMIN_TOKEN` | 空 | 管理员口令；为空时没有管理接口。请用一长串随机字符 |
| `OPEN_GAMES` | `1` | `0` = 只有管理员能登记游戏（适合只服务自家游戏的平台） |
| `CORS_ORIGIN` | `*` | 允许哪些来源调用接口。游戏可能跑在任何域名，包括 `file://` |

### Docker

```bash
docker build -t hezhong .
docker run -d --name hezhong -p 8787:8787 -v /srv/hezhong:/data -e ADMIN_TOKEN=... --restart=always hezhong
```

### 嵌进自己的 Node 程序

```js
import { createHub } from 'hezhong/server';
const hub = createHub({ dataDir: '/srv/hezhong', adminToken: process.env.ADMIN_TOKEN, openGames: false });
await hub.listen(8787);
```

## 上线清单

- **HTTPS**：前面挂 Caddy、Nginx 或云负载均衡。https 的游戏只能连 https 的平台。
- **传 `X-Forwarded-For`**：限流按客户端 IP 算。
- **请求体大小**：代理至少放行 21MB。Nginx 里写 `client_max_body_size 21m;`。
- **备份**：拷贝 `DATA_DIR`。
  - `db.json` 存账号、游戏、模组、评分；
  - `mods/<游戏>/<id>/` 存模组包和图标。
- **管理口令**：一定要设，保管好，泄露了就换。

Caddy 示例：

```
hub.example.com {
  reverse_proxy 127.0.0.1:8787
  request_body { max_size 21MB }
}
```

## 内容管理

- 作者可以下架自己的模组；游戏登记人可以下架自己游戏的模组。
- 管理员可以隐藏或恢复任何模组、游戏：

  ```bash
  curl -X POST https://hub.example.com/api/admin/hide -H "X-Admin-Token: $ADMIN_TOKEN" \
       -H 'Content-Type: application/json' -d '{"game":"my-game","mod":"bad-mod","hidden":true}'
  ```

- 下架的内容文件保留，可以恢复。
- 需要先审后上的话，可以在发布接口（`server/server.mjs` 的 `POST /api/games/:game/mods`）里加一个「待审」状态。

## 规模

数据存在一个常驻内存的 JSON 文件里，原子写盘。一台小云主机撑几万个模组、几十万次下载没有压力。

再大可以把 `server/lib/db.mjs` 换成正式数据库，把 `mods/` 目录换成对象存储，HTTP 接口不变。
