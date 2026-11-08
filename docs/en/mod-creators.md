# Mod creators: make and publish a mod

[中文](../zh/mod-creators.md)

A mod is a folder with a `manifest.json` and an `index.js` (plus any images, sounds or data). The CLI packs it into one `.hzmod` file. You can publish that file on a hub, or send it to friends to import directly.

## 1. Set up

```bash
npm i -D github:qwasx/hezhong      # gives you the `hezhong` command (Node 18+)
npm i -D esbuild                   # optional: lets index.js import other files in your folder
```

## 2. Start from a template

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
  "author": "You",
  "desc": "What it does. Line breaks are fine.",
  "api": 1,
  "icon": "icon.png",
  "deps": [],
  "tags": ["slime"],
  "locales": { "zh": { "name": "彩虹史莱姆", "desc": "中文简介" } }
}
```

| Field | Rules |
|---|---|
| `id` | 3–32 chars: `a-z`, `0-9`, `-`, starting with a letter. On a hub it belongs to whoever publishes it first. |
| `game` | The target game's slug. |
| `version` | `x.y.z`. Every published version must be higher than the last. |
| `api` | The game's mod API version you need (see the game's docs). Default `1`. |
| `icon` | A png / webp / jpeg / gif in your folder. |
| `deps` | Ids of other mods for the same game that must load first. |
| `locales` | Optional translations of `name` and `desc`. |

## 4. index.js

```js
export default function setup(api, ctx) {
  // `api` = the GAME's mod API: what you can add or do depends on the game. Read its docs.
  api.addSlime({ id: `${ctx.id}:rainbow`, color: (t) => `hsl(${t / 8 % 360} 80% 60%)`, points: 5 });

  // `ctx` = from HeZhong, the same in every game:
  ctx.on('pop', (e) => {                                  // listen to the game's events
    const n = (ctx.store.get('pops') ?? 0) + 1;           // persistent data, saved with the game
    ctx.store.set('pops', n);
  });
  const iconUrl = ctx.file('icon.png');                   // bundled files (images as data: URLs)
  ctx.log('loaded', ctx.manifest.version);
}
```

Good habits:

- Prefix everything you add with your mod id. Many games require it.
- Keep `tick` handlers cheap.
- Don't throw in loops. A mod whose handlers keep throwing gets switched off.
- Store only what you need in `ctx.store`, and only JSON-serializable values.

## 5. Test locally

```bash
npx hezhong pack my-mod          # → dist/my-mod-1.0.0.hzmod
```

In the game, open the mod panel → **Import file** → choose the `.hzmod` → reload.

## 6. Publish

```bash
npx hezhong register --server https://hub.example.com --name you   # once
npx hezhong login    --server https://hub.example.com --name you   # on a new machine
npx hezhong publish dist/my-mod-1.0.0.hzmod
```

The password is read from `$HEZHONG_PASSWORD` or asked interactively. You can also upload the file in the storefront (**Publish a mod**).

**To update**, raise `version`, then `pack` and `publish` again. Players see an **Update** button.

**To take a mod down**, go to **My mods & games** → **Take down**.

## Bundle format (for tool authors)

A `.hzmod` is JSON:

```json
{ "format": "hezhong-mod@1", "manifest": { ... }, "main": "index.js", "files": { "index.js": "export default …", "icon.png": "data:image/png;base64,…" } }
```

Limits:

- 20 MB per bundle;
- 500 files;
- file names `[\w\-./]`, with no `..`.

The rules live in `sdk/validate.js`.
