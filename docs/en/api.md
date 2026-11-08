# HTTP API

[中文](../zh/api.md)

**Responses.** Everything is JSON unless noted. Errors look like `{ "error": "…" }` and carry the matching HTTP status. Error text follows `Accept-Language` (`zh…` → Chinese) or `?lang=zh|en`.

**Auth.** Endpoints that need a signed-in user take `Authorization: Bearer <token>`. Tokens are valid for 30 days.

**CORS.** CORS is open by default (`CORS_ORIGIN`), so games on any origin, including `file://`, can call the API.

## Accounts

| Method | Path | Body → Result |
|---|---|---|
| POST | `/api/auth/register` | `{ name, password }` → `{ name, token }`. Name: 2–24 chars. Password: 8+ chars. |
| POST | `/api/auth/login` | `{ name, password }` → `{ name, token }` |
| POST | `/api/auth/logout` | Revokes the current token. |
| GET | `/api/me` | → `{ name, games: [Game…], mods: [Mod…] }`, including taken-down items. |

## Games

| Method | Path | Notes |
|---|---|---|
| GET | `/api/games?q=` | → `{ total, games: [Game] }` |
| POST | `/api/games` | Auth. `{ slug, name, desc?, homepage?, api?, locales? }`. Can be admin-only, see `OPEN_GAMES`. |
| GET | `/api/games/:game` | → `Game` |
| PATCH | `/api/games/:game` | Owner or admin. Any of `name desc homepage api locales`. |

`Game` = `{ slug, name, locales, desc, homepage, owner, api, created, mods }`

## Mods

| Method | Path | Notes |
|---|---|---|
| GET | `/api/mods?q=&sort=&tag=&page=` | Across all games. |
| GET | `/api/games/:game/mods?q=&sort=downloads\|new\|rating&tag=&page=` | → `{ total, page, pageSize, mods: [Mod] }`, 24 per page. |
| GET | `/api/games/:game/mods/:id` | → `ModDetail` = `Mod` + `{ deps, versions: [{ version, size, sha256, at, downloads }] }` |
| GET | `/api/games/:game/mods/:id/download[?v=x.y.z][&dl]` | The `.hzmod` JSON. Header `X-Content-SHA256`. `dl` triggers a file download. Counts a download. |
| GET | `/api/games/:game/mods/:id/icon` | Icon image. |
| POST | `/api/games/:game/mods` | Auth. Body = the `.hzmod` file. Publishes a new mod or a new version. |
| POST | `/api/games/:game/mods/:id/rate` | Auth. `{ stars: 1..5 }`. You can't rate your own mod. |
| DELETE | `/api/games/:game/mods/:id` | Author, game owner or admin. Takes the mod down (files are kept). |

`Mod` = `{ id, game, name, locales, version, author, owner, desc, tags, api, downloads, rating, ratings, updated, created, size, icon }`

Publishing rules:

- The bundle must pass `validateBundle` with `manifest.game === :game`.
- `manifest.api` must be ≤ the game's `api`.
- The mod id belongs to its first publisher.
- Versions are unique and only go up.

## Admin

Send the header `X-Admin-Token: <ADMIN_TOKEN>`.

| Method | Path | Body |
|---|---|---|
| POST | `/api/admin/hide` | `{ game, mod?, hidden }`. Hide or restore a mod, or a whole game when `mod` is omitted. |

Admins may also call `PATCH /api/games/:game`, `DELETE …/mods/:id` and `POST /api/games` (even when registration is closed).

## Misc

`GET /api/health` → `{ ok, name, version, games, mods, openGames }`

## Rate limits (per IP)

| What | Limit |
|---|---|
| Register / login | 20 per 10 min |
| Uploads | 30 per hour |
| Ratings | 60 per hour |
| Game registrations | 10 per day |
