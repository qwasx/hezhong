// Example HeZhong mod for Slime Garden. 史莱姆花园的示例模组。
// `api` is Slime Garden's mod API; `ctx` is provided by HeZhong (events, persistent store, files, logging).
export default function setup(api, ctx) {
  api.addSlime({
    id: 'rainbow-slime:rainbow',
    name: 'Rainbow slime',
    color: (t) => `hsl(${(t / 8) % 360} 80% 60%)`,
    size: 1.3, speed: 1.4, points: 5,
  });
  ctx.on('pop', (e) => {
    const n = (ctx.store.get('pops') ?? 0) + 1;
    ctx.store.set('pops', n);                                 // saved with the game / 随游戏存档
    if (e.kind === 'rainbow-slime:rainbow') api.toast('★ +5');
    if (n % 10 === 0) api.toast(`${n} pops! / 已戳破 ${n} 只！`);
  });
}
