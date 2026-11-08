# Self-hosting a hub

[中文](../zh/self-hosting.md)

## Run

```bash
node server/server.mjs
```

| Env | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Listen port. |
| `DATA_DIR` | `./data` | Where everything is stored. Must be writable. Back it up. |
| `ADMIN_TOKEN` | *(empty)* | Admin secret. If empty, admin endpoints are disabled. Use a long random string. |
| `OPEN_GAMES` | `1` | `0` = only admins can register games, which suits a hub dedicated to your own games. |
| `CORS_ORIGIN` | `*` | Origins allowed to call the API. Games may run on any origin, including `file://`. |

### Docker

```bash
docker build -t hezhong .
docker run -d --name hezhong -p 8787:8787 -v /srv/hezhong:/data -e ADMIN_TOKEN=... --restart=always hezhong
```

### Embed in your own Node app

```js
import { createHub } from 'hezhong/server';
const hub = createHub({ dataDir: '/srv/hezhong', adminToken: process.env.ADMIN_TOKEN, openGames: false });
await hub.listen(8787);
```

## Production checklist

- **HTTPS.** Put Caddy, Nginx or a cloud load balancer in front. A game served over https can only call an https hub.
- **Forward `X-Forwarded-For`.** Rate limits are per client IP.
- **Body size.** Allow at least 21 MB through the proxy. In Nginx: `client_max_body_size 21m;`
- **Backups.** Copy `DATA_DIR`:
  - `db.json` holds accounts, games, mods and ratings;
  - `mods/<game>/<id>/` holds the bundles and icons.
- **Admin token.** Set it, keep it secret, and rotate it if it leaks.

Example Caddyfile:

```
hub.example.com {
  reverse_proxy 127.0.0.1:8787
  request_body { max_size 21MB }
}
```

## Moderation

- Authors can take their own mods down. Game owners can take down mods for their game.
- Admins can hide or restore any mod or game:

  ```bash
  curl -X POST https://hub.example.com/api/admin/hide -H "X-Admin-Token: $ADMIN_TOKEN" \
       -H 'Content-Type: application/json' -d '{"game":"my-game","mod":"bad-mod","hidden":true}'
  ```

- Taken-down items keep their files, so they can be restored later.
- If you need review before release, add a pending state in the publish route (`server/server.mjs`, `POST /api/games/:game/mods`).

## Scale

The store is a single JSON file kept in memory and written atomically. That is comfortable for tens of thousands of mods and hundreds of thousands of downloads on one small VM.

Beyond that, you can replace `server/lib/db.mjs` with a real database and the `mods/` folder with object storage. The HTTP API stays the same.
