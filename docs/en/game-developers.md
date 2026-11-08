# Game developers: add mods to your game

[中文](../zh/game-developers.md)

HeZhong does not know anything about your game. **You** decide what a mod may do. HeZhong takes care of the rest:

- distribution (browse, install, update);
- validation and checksums;
- load order and dependencies;
- events;
- per-mod save data;
- keeping a broken mod from breaking your game.

## 1. Register your game on a hub

Open the hub's storefront → **Add your game**. Fill in:

- **slug**: e.g. `my-game`. It is permanent, and it is how mods target your game.
- **name** and **description**, with an optional Chinese translation.
- **homepage**.
- **mod API version**: start with `1`.

You can also register from code: `POST /api/games` (see [api.md](api.md)).

## 2. Install the SDK

```bash
npm i github:qwasx/hezhong
```

Or copy `sdk/hezhong.js`, `sdk/validate.js` and optionally `sdk/panel.js` into your project. They are plain ES modules with no dependencies.

## 3. Load mods before your game starts

```js
import { HeZhong } from 'hezhong';

const hz = new HeZhong({
  game: 'my-game',                    // your slug
  server: 'https://hub.example.com',  // the hub players install from (they can change it in the panel)
  apiVersion: 1,                      // the highest mod API version this build supports
  gameVersion: '1.4.2',               // optional, visible to mods as ctx.gameVersion
});

const statuses = await hz.load((ctx) => createModApi(ctx));
```

`load()` reads every enabled mod from local storage (IndexedDB in browsers) and sorts them by dependency. For each mod it imports the entry module and calls its `setup(api, ctx)`:

- `api` is whatever `createModApi(ctx)` returns. This is your mod API.
- `ctx` is provided by HeZhong:
  - `id`, `manifest`, `gameVersion`;
  - `file(name)` for the mod's bundled files (images come back as `data:` URLs);
  - `on(event, fn)` to listen to your events;
  - `store.get/set` for persistent per-mod data;
  - `log(...)`.

`statuses` tells you what happened to each mod: `loaded`, `error`, `missing-dep` or `disabled`, with an error message where relevant.

### Designing your mod API

Keep it small and explicit. Hand out functions, not your internal objects.

```js
function createModApi(ctx) {
  return {
    // content
    addItem(def) { requirePrefix(def.id, ctx.id); items.set(def.id, sanitizeItem(def)); },
    addEnemy(def) { requirePrefix(def.id, ctx.id); enemies.set(def.id, sanitizeEnemy(def)); },
    // actions
    giveItem(id, n = 1) { player.inventory.add(id, clamp(n, 1, 999)); },
    toast(text) { ui.toast(String(text).slice(0, 200)); },
    // read-only views
    get player() { return { level: player.level, x: player.x, y: player.y }; },
  };
}
const requirePrefix = (id, mod) => { if (!String(id).startsWith(mod + ':')) throw new Error(`ids must start with "${mod}:"`); };
```

Tips:

- **Namespace content ids** with the mod id (`mod-id:thing`). This avoids collisions between mods.
- **Validate and clamp** whatever mods hand you (numbers, string lengths, colors).
- **Version your API.** When you break it, raise `apiVersion` in the SDK and on the hub (`PATCH /api/games/:slug`). Mods declare the version they need in `manifest.api`, and the SDK refuses mods that need a newer one.
- If a mod's `setup` throws, only that mod is marked `error`. Your game keeps going.

## 4. Fire events

```js
hz.emit('start');                 // after a new game / load
hz.emit('tick', dt);              // per frame, if you want — keep handlers cheap
hz.emit('kill', { id: enemy.id, x: enemy.x, y: enemy.y });
const extraLoot = hz.emit('loot', enemy).flat();   // handlers may return values
```

Each handler runs in its own `try/catch`. A mod whose handlers keep throwing (20 times by default, set with `maxErrors`) is switched off, and its status says why.

Document your event names and payloads. They are part of your mod API.

## 5. Let players manage mods

The fastest way is the drop-in panel:

```js
import { mountPanel } from 'hezhong/panel';
modsButton.onclick = () => mountPanel(hz, document.body, { lang: 'zh', onChange: () => {/* ask to reload */} });
```

It has three parts:

- **Installed**: enable, disable or remove mods, and see each mod's status.
- **Browse hub**: search, sort, install and update.
- **Import file**: install a `.hzmod` file.

Mods are loaded once at start-up, so players reload after making changes. The panel offers a reload button.

To build your own UI, use the same methods:

- `hz.browse({ q, sort, page })`, `hz.details(id)`, `hz.iconUrl(id)`;
- `hz.install(id)`, `hz.updates()`;
- `hz.installed()`, `hz.enabled()`, `hz.setEnabled(id, on)`, `hz.remove(id)`;
- `hz.importText(text)`.

## 6. Save mod data with your save

```js
save.mods = hz.exportData();       // when saving
hz.importData(save.mods);          // when loading, before hz.emit('start')
```

## Isolation options

By default mods run in your page, like any script you include. That is the simplest setup and enough for most games.

For untrusted content at scale, consider these:

- Run mods in a sandboxed `<iframe>` or a Worker, and make `createModApi` forward calls over `postMessage`.
- Use a Content-Security-Policy on your game page.
- Let only reviewed mods through, by running your own hub and taking down anything bad.

## Checklist

- [ ] Game registered on the hub, `slug` and `apiVersion` set.
- [ ] `hz.load()` called before the world is built.
- [ ] Events emitted and documented.
- [ ] Mod API sanitizes input and namespaces ids.
- [ ] `exportData` / `importData` wired into saves.
- [ ] Players can open the mod panel.
- [ ] A short "how to mod my game" page for creators, listing your API and events.
