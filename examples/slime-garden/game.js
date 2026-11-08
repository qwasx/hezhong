// Slime Garden — a tiny demo game showing how any web game plugs into HeZhong.
// 史莱姆花园——一个很小的示例游戏，演示任何网页游戏怎样接入合众。
//
// The game decides what mods may do (its "mod API"): here mods can add slime kinds, show toasts,
// read the score, and listen to "start", "tick" and "pop" events. 游戏自己决定模组能做什么。
import { HeZhong } from '../../sdk/hezhong.js';
import { mountPanel } from '../../sdk/panel.js';

const HUB = new URLSearchParams(location.search).get('hub') ?? `${location.protocol}//${location.hostname}:8787`;
const hz = new HeZhong({ game: 'slime-garden', server: localStorage.getItem('hezhong:slime-garden:server') ? undefined : HUB, apiVersion: 1, gameVersion: '1.0.0' });

// ---------- the game's own data
const kinds = [{ id: 'green', name: 'Green slime', color: '#5aa850', size: 1, speed: 1, points: 1 }];
let score = +(localStorage.getItem('sg.score') || 0);
const toastEl = document.getElementById('toast');
const toast = (s) => { toastEl.textContent = s; toastEl.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('on'), 2200); };

// ---------- the game's mod API (what a mod's setup(api, ctx) receives)
hz.importData(JSON.parse(localStorage.getItem('sg.modData') || '{}'));
const status = await hz.load((ctx) => ({
  addSlime(def) {
    if (!def || typeof def.id !== 'string' || !def.id.startsWith(ctx.id + ':')) throw new Error(`slime id must start with "${ctx.id}:"`);
    kinds.push({ name: def.id, color: '#888', size: 1, speed: 1, points: 1, ...def, size: Math.min(3, Math.max(0.4, +def.size || 1)), speed: Math.min(4, Math.max(0.2, +def.speed || 1)), points: Math.min(100, Math.max(0, +def.points || 1)) });
  },
  toast: (s) => toast(String(s).slice(0, 120)),
  get score() { return score; },
  addScore: (n) => { score += Math.max(-1000, Math.min(1000, +n || 0)); },
}));
for (const s of status) if (s.state === 'error' || s.state === 'missing-dep') console.warn('mod', s.id, s.error);

// ---------- the game
const cv = document.getElementById('c'), g = cv.getContext('2d');
const resize = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
addEventListener('resize', resize); resize();
const slimes = [];
const spawn = () => {
  const k = kinds[Math.floor(Math.random() * kinds.length)];
  slimes.push({ k, x: 40 + Math.random() * (innerWidth - 80), y: 80 + Math.random() * (innerHeight - 140), vx: (Math.random() - 0.5) * 60 * k.speed, ph: Math.random() * 6, r: 22 * k.size });
};
for (let i = 0; i < 8; i++) spawn();
const scoreEl = document.getElementById('score');
cv.addEventListener('pointerdown', (e) => {
  for (let i = slimes.length - 1; i >= 0; i--) {
    const s = slimes[i];
    if (Math.hypot(e.clientX - s.x, e.clientY - (s.y - s.r * 0.6)) < s.r * 1.1) {
      slimes.splice(i, 1); score += s.k.points;
      hz.emit('pop', { kind: s.k.id, points: s.k.points, x: s.x, y: s.y });
      spawn(); break;
    }
  }
});
document.getElementById('mods').onclick = () => mountPanel(hz, document.body, { onClose: () => {} });
hz.emit('start');
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t;
  hz.emit('tick', dt);
  g.fillStyle = '#dfeccf'; g.fillRect(0, 0, innerWidth, innerHeight);
  for (const s of slimes) {
    s.ph += dt * 4 * s.k.speed; s.x += s.vx * dt;
    if (s.x < s.r || s.x > innerWidth - s.r) s.vx *= -1;
    const hop = Math.abs(Math.sin(s.ph)) * 14 * s.k.size, squash = 1 + Math.cos(s.ph * 2) * 0.08;
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(s.x, s.y + 4, s.r, s.r * 0.3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = typeof s.k.color === 'function' ? s.k.color(t) : s.k.color;
    g.beginPath(); g.ellipse(s.x, s.y - hop - s.r * 0.6, s.r * squash, s.r * 0.8 / squash, 0, Math.PI, 0); g.lineTo(s.x + s.r * squash, s.y - hop - s.r * 0.6); g.ellipse(s.x, s.y - hop - s.r * 0.6, s.r * squash, s.r * 0.35, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(s.x - s.r * 0.3, s.y - hop - s.r * 0.75, 2.5, 0, 7); g.arc(s.x + s.r * 0.3, s.y - hop - s.r * 0.75, 2.5, 0, 7); g.fill();
  }
  scoreEl.textContent = `Score ${score} · ${hz.loaded.length} mod(s)`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('beforeunload', () => { localStorage.setItem('sg.score', String(score)); localStorage.setItem('sg.modData', JSON.stringify(hz.exportData())); });
window.__sg = { hz, kinds, slimes, get score() { return score; } };
