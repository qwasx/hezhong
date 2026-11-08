<p align="center"><img src="server/public/favicon.svg" width="72" alt="HeZhong"></p>

<h1 align="center">HeZhong · 合众</h1>
<p align="center"><b>An open mod hub for web games. Everyone is a creator.</b></p>
<p align="center"><a href="README.zh-CN.md">中文</a> · <a href="docs/en/game-developers.md">Game developers</a> · <a href="docs/en/mod-creators.md">Mod creators</a> · <a href="docs/en/api.md">HTTP API</a> · <a href="docs/en/self-hosting.md">Self-hosting</a></p>

---

HeZhong ("合众", *many hands together*) gives any browser game a Steam-Workshop-style mod ecosystem:

- **A hub server + storefront.** You host it. Game developers register their games. Creators publish mods. Players browse, rate and download them. The UI is in English and Chinese.
- **A drop-in game SDK.** About ten lines in your game, and players can install mods from inside it. The SDK handles loading, events, saves, dependencies and error isolation. A ready-made mod manager panel is included.
- **A CLI for creators.** `hezhong init`, `pack` and `publish`. A mod is plain JavaScript, so anyone can make one.

It has zero runtime dependencies. It needs only Node 18+. It runs as one process with one data folder, or as a Docker image.

```
 ┌────────────┐   install / update   ┌────────────────┐   publish   ┌────────────┐
 │ Your game  │ ◀─────────────────── │   HeZhong hub   │ ◀────────── │  Creators  │
 │ + SDK      │   browse / rate      │ API + storefront│   (CLI/web) │            │
 └────────────┘                      └────────────────┘             └────────────┘
```

## Try it in one minute

```bash
git clone https://github.com/qwasx/hezhong && cd hezhong
npm run example
```

Open **http://localhost:8080/examples/slime-garden/** and press **Mods · 模组**. Then choose **Browse hub** → **Install** on *Rainbow Slime* and reload. The storefront runs at **http://localhost:8787** (demo user `demo` / `demo-password`).

## For game developers: add mods to your game

```js
// npm i github:qwasx/hezhong   (or just copy the sdk/ folder into your project)
import { HeZhong } from 'hezhong';
import { mountPanel } from 'hezhong/panel';

const hz = new HeZhong({ game: 'my-game', server: 'https://hub.example.com', apiVersion: 1 });

// 1. Before your game builds its world: load enabled mods and hand each one YOUR mod API.
await hz.load((ctx) => ({
  addEnemy: (def) => enemies.push({ ...def, id: `${ctx.id}:${def.id}` }),
  toast: (text) => showToast(text),
}));

// 2. Fire events mods can listen to. Handlers are isolated: a broken mod never crashes your game.
hz.emit('start');
hz.emit('kill', enemy);

// 3. Give players a mod manager: installed / browse hub / import file.
modsButton.onclick = () => mountPanel(hz);

// 4. Keep the mods' own save data together with your save file.
save.mods = hz.exportData();      // later: hz.importData(save.mods)
```

**You decide what mods can do.** The object you return from `makeApi` is the entire surface a mod sees. See [docs/en/game-developers.md](docs/en/game-developers.md).

## For creators: make a mod

```bash
npm i -D github:qwasx/hezhong                    # installs the `hezhong` CLI
npx hezhong init my-mod --game my-game          # manifest.json + index.js
# edit index.js
npx hezhong pack my-mod                          # → dist/my-mod-0.1.0.hzmod
npx hezhong login --server https://hub.example.com --name you
npx hezhong publish dist/my-mod-0.1.0.hzmod
```

```js
// index.js
export default function setup(api, ctx) {        // api = the game's mod API, ctx = from HeZhong
  api.addEnemy({ id: 'fire-wolf', hp: 40, color: '#e63' });
  ctx.on('kill', (e) => ctx.store.set('kills', (ctx.store.get('kills') ?? 0) + 1));
}
```

See [docs/en/mod-creators.md](docs/en/mod-creators.md).

## For hub operators

```bash
PORT=8787 DATA_DIR=/srv/hezhong ADMIN_TOKEN=$(openssl rand -hex 24) node server/server.mjs
# or
docker build -t hezhong . && docker run -d -p 8787:8787 -v /srv/hezhong:/data -e ADMIN_TOKEN=... hezhong
```

See [docs/en/self-hosting.md](docs/en/self-hosting.md) for HTTPS, backups, limits and moderation.

## What's inside

| Path | What |
|---|---|
| `server/` | Hub server (`server.mjs`) and storefront (`public/`), English / 中文 |
| `sdk/hezhong.js` | Game SDK: install, load, events, saves, isolation (+ `.d.ts`) |
| `sdk/panel.js` | Drop-in mod manager panel, English / 中文 |
| `sdk/validate.js` | Bundle format rules, shared by server, SDK and CLI |
| `cli/hezhong.mjs` | `init` · `pack` · `validate` · `register` · `login` · `publish` |
| `examples/` | *Slime Garden* demo game and the *Rainbow Slime* mod |
| `test/run.mjs` | End-to-end tests (server + SDK + CLI) |

## Safety

Mods are code written by other people. In the browser they run inside the game's page. They cannot touch the player's files, but they can do anything the game page can, including changing saves. HeZhong reduces the risk:

- every bundle is validated;
- downloads are checksum-verified;
- a mod is only ever handed the API the game chooses to give it;
- a misbehaving mod is isolated and switched off;
- the storefront runs under a strict Content-Security-Policy;
- authors, game owners and admins can take mods down.

If your game needs stronger isolation, run mod code in an iframe or worker and expose your API over `postMessage`. The SDK's `makeApi` is the natural place to do that.

## License

[MIT](LICENSE)
