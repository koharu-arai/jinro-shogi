// 背景の夜の村:流れる雲・月・またたく星・灯りのともる家と煙突の煙・ときどき走り抜ける狼
const root = document.getElementById('scene');
const rnd = (a, b) => a + Math.random() * (b - a);

// 星
let stars = '';
for (let i = 0; i < 46; i++) {
  const s = rnd(1, 2.6).toFixed(1);
  stars += `<i class="star" style="left:${rnd(0, 100).toFixed(1)}%;top:${rnd(0, 52).toFixed(1)}%;width:${s}px;height:${s}px;animation-delay:${rnd(0, 4).toFixed(2)}s;animation-duration:${rnd(2.2, 4.8).toFixed(2)}s"></i>`;
}

// 雲(ふわっとした形をSVGで)
const cloud = (w, o) => `<svg viewBox="0 0 220 80" width="${w}" style="opacity:${o}"><path d="M30 64c-16 0-26-9-26-20s11-20 25-19c4-13 17-21 32-19 9-12 25-17 40-12 13-9 33-7 43 6 17-3 33 8 34 23 14 2 24 11 24 22 0 12-10 19-24 19z"/></svg>`;
const clouds = [
  { top: 9,  w: 210, o: .55, d: 95,  dl: -20 },
  { top: 20, w: 150, o: .4,  d: 70,  dl: -55 },
  { top: 31, w: 260, o: .35, d: 130, dl: -90 },
  { top: 14, w: 120, o: .3,  d: 60,  dl: -10 },
].map(c => `<div class="cloud" style="top:${c.top}%;animation-duration:${c.d}s;animation-delay:${c.dl}s">${cloud(c.w, c.o)}</div>`).join('');

// 家:x, 幅, 高さ, 屋根の高さ, 煙突の位置(なしは null)
const houses = [
  [38, 34, 26, 16, 0.7], [76, 26, 20, 13, null], [104, 40, 30, 18, 0.25], [150, 30, 22, 14, 0.75],
  [186, 46, 34, 20, 0.3], [238, 30, 22, 15, null], [270, 38, 28, 17, 0.7], [316, 28, 21, 13, 0.3], [350, 36, 26, 16, null],
];
const GROUND = 128;
let hs = '', smoke = '';
houses.forEach(([x, w, h, r, ch], k) => {
  const top = GROUND - h;
  hs += `<rect x="${x}" y="${top}" width="${w}" height="${h}" class="hw"/>`;
  hs += `<path d="M${x - 4} ${top + 1}L${x + w / 2} ${top - r}L${x + w + 4} ${top + 1}Z" class="hr"/>`;
  if (ch != null) {
    const cx = x + w * ch - 3, cy = top - r * (1 - Math.abs(ch - .5) * 2) - 4;
    hs += `<rect x="${cx}" y="${cy}" width="7" height="${top - cy + 2}" class="hw"/>`;
    for (let p = 0; p < 5; p++) smoke += `<circle class="puff" cx="${cx + 3.5}" cy="${cy - 2}" r="3.6" style="animation-delay:${(p * 1.3 + k * .41).toFixed(2)}s"/>`;
  }
  // 窓(灯りはランダムに点いたり消えたり)
  const n = w > 32 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const wx = x + (n === 1 ? w / 2 - 4 : w * (i ? .66 : .2) - 2), lit = Math.random() < .8;
    hs += `<rect x="${wx.toFixed(1)}" y="${top + h * .32}" width="8" height="9" rx="1.2" class="win${lit ? '' : ' off'}" style="animation-delay:${rnd(0, 9).toFixed(1)}s;animation-duration:${rnd(7, 16).toFixed(1)}s"/>`;
  }
});
// 木(針葉樹)
const trees = [8, 24, 66, 140, 226, 300, 338, 384, 396].map((x, i) => {
  const h = 22 + (i * 7) % 14;
  return `<path d="M${x} ${GROUND - h}l9 ${h * .45}h-4l7 ${h * .4}h-5l5 ${h * .15}h-24l5 -${h * .15}h-5l7 -${h * .4}h-4z" class="tree"/>`;
}).join('');

root.innerHTML = `
  <div class="sky"></div>
  <div class="stars">${stars}</div>
  <div class="moonwrap"><div class="moon-halo"></div><div class="moonball"><i></i><i></i><i></i></div></div>
  <div class="clouds">${clouds}</div>
  <svg class="hills far" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice"><path d="M0 104C40 86 80 92 120 98s70-22 120-14 80 18 110 8 40-6 50-2V140H0z"/></svg>
  <div class="ridge"><div class="wolf" id="sceneWolf">
    <svg viewBox="0 0 120 56"><path class="wb" d="M20 30Q40 18 75 22Q88 20 95 14L99 6L103 14L111 17L113 22L104 25Q98 30 92 31Q80 36 60 36Q40 37 28 34Q14 38 3 29Q14 30 20 30Z"/>
      <g class="fa"><path d="M88 31L101 44L104 42L92 30Z"/><path d="M83 33L93 47L96 46L88 32Z"/><path d="M33 33L17 45L14 43L28 32Z"/><path d="M39 34L27 48L24 47L35 33Z"/></g>
      <g class="fb"><path d="M86 32L80 47L83 48L90 33Z"/><path d="M81 33L72 46L75 47L85 34Z"/><path d="M33 33L43 47L46 46L38 33Z"/><path d="M40 34L52 46L54 44L44 34Z"/></g></svg>
  </div></div>
  <svg class="village" viewBox="0 0 400 140" preserveAspectRatio="xMidYMax slice">
    <path class="hill-near" d="M0 120C60 112 120 116 200 118s150-8 200-4V140H0z"/>
    ${trees}${hs}<g class="smoke">${smoke}</g>
    <rect x="0" y="${GROUND}" width="400" height="${140 - GROUND}" class="ground"/>
  </svg>
  <div class="mist"><i></i><i></i></div>`;

// 狼がランダムに走り抜ける(左右どちらからも)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wolf = document.getElementById('sceneWolf');
function run() {
  if (!document.hidden) {
    const ltr = Math.random() < .5, dur = rnd(5.5, 8.5);
    wolf.style.setProperty('--dir', ltr ? 1 : -1);
    wolf.style.setProperty('--sz', rnd(.8, 1.15).toFixed(2));
    wolf.className = 'wolf go ' + (ltr ? 'ltr' : 'rtl');
    wolf.style.animationDuration = dur + 's';
    setTimeout(() => { wolf.className = 'wolf'; }, dur * 1000 + 100);
  }
  setTimeout(run, rnd(9000, 22000));
}
if (!reduce) setTimeout(run, rnd(2500, 6000));

// アプリらしく:ピンチ・ダブルタップ・Ctrl+ホイールでのズームと、長押しメニューを止める
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
// 文字の選択・コピーは、部屋コードとフレンドコード(.code)と入力欄だけ
document.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea,.code')) e.preventDefault(); });
document.addEventListener('copy', e => { const sel = String(document.getSelection() || ''); const n = document.getSelection()?.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentElement); if (sel && !(el && el.closest('input,textarea,.code'))) e.preventDefault(); });
