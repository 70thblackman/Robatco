'use strict';
/* Deterministic reel renderer: window.renderFrame(t) paints the whole 1080x1920 frame for time t (seconds). */

const DUR = 38.0, FADE = 0.4;
const K = 1080 / 939;                       // displayed px per original portrait px at zoom 1
const Z = s => s.replace(/~/g, '‌');   // ~ -> ZWNJ (half-space)

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const eIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eIOs = t => -(Math.cos(Math.PI * t) - 1) / 2;
const eO = t => 1 - Math.pow(1 - t, 3);
const eBack = t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* keys: [[time, v0, v1, ...], ...]  -> interpolated array of values */
function track(t, keys, ease = eIOs) {
  if (t <= keys[0][0]) return keys[0].slice(1);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t < b[0]) { const u = ease((t - a[0]) / (b[0] - a[0])); return a.slice(1).map((v, j) => lerp(v, b[j + 1], u)); }
  }
  return keys[keys.length - 1].slice(1);
}

/* ---------------------------------------------------------------- timeline */
const TL = {
  s1: 0, s2: 4.0, s3: 8.5, s4: 12.0, s5: 15.8, s6: 20.0, s7: 26.0, s8: 30.6, s9: 33.8, end: DUR
};
const SEAL_T = 21.43;           // stamp hits (synced with the music hit)
const WHIP_T = 28.0;            // S7 whip-pan
const FLASHES = [               // [time, peak, length]
  [TL.s6, .55, .45], [SEAL_T, .45, .30], [WHIP_T + .05, .22, .30], [TL.s8, .18, .5], [TL.s9, .30, .5]
];

const SCENES = [
  { id: 's1', kind: 'portrait', t0: TL.s1, t1: TL.s2,
    cap: 'سلام. من دکتر [[قازاریان]] هستم.', capAt: .9,
    cam: [[0, 470, 65, .80, 540, 340], [4.6, 470, 65, 2.0, 540, 400]] },
  { id: 's2', kind: 'photo', img: 'p2', t0: TL.s2, t1: TL.s3,
    tags: [{ txt: Z('دامپزشک · صنعت فرآورده~های گوشتی'), a: .3, b: 99 }],
    cap: Z('دامپزشک بودم و در صنعت [[فرآورده~های گوشتی]] ایران کار کردم.'), capAt: .5,
    cam: [[0, .5, .5, 1.0], [5.2, .48, .33, 1.5]] },
  { id: 's3', kind: 'photo', img: 'p3', t0: TL.s3, t1: TL.s4,
    tags: [{ txt: 'استاد دانشگاه تهران', a: .3, b: 99 }],
    cap: Z('استاد دانشکده~ی دامپزشکی [[دانشگاه تهران]] بودم.'), capAt: .5,
    cam: [[0, .72, .30, 1.15], [1.6, .70, .38, 1.3], [4.0, .36, .66, 1.75]] },
  { id: 's4', kind: 'photo', img: 'p4', t0: TL.s4, t1: TL.s5,
    tags: [{ txt: Z('نخستین جوجه~کشی صنعتی ایران'), a: .3, b: 99 }],
    cap: Z('مدیر پروژه~ی اولین کارخانه~ی [[جوجه~کشی صنعتی]] ایران بودم.'), capAt: .5,
    cam: [[0, .5, .52, 1.0], [4.4, .5, .50, 1.8]] },
  { id: 's5', kind: 'photo', img: 'p5', t0: TL.s5, t1: TL.s6, vintage: true,
    tags: [{ txt: 'پیش از انقلاب · کرمانشاه', a: .3, b: 99 }],
    cap: Z('قبل از انقلاب، ریاست [[سازمان ملی شیر کرمانشاه]] را بر عهده داشتم.'), capAt: .5,
    cam: [[0, .30, .55, 1.1], [3.2, .72, .50, 1.45], [5.0, .74, .50, 1.52]] },
  { id: 's6', kind: 'photo', img: 'p6', t0: TL.s6, t1: TL.s7, seal: true,
    tags: [{ txt: 'تدوین استاندارد ملی', a: .3, b: 99 }],
    cap: Z('[[استاندارد ملی ۲۳۰۳]] را تدوین کردم؛ مبنای کیفیت فرآورده~های گوشتی تا امروز.'), capAt: .5, capStep: .38,
    cam: [[0, .5, .5, 1.0], [1.4, .33, .46, 1.3], [2.6, .33, .70, 2.2], [3.0, .33, .70, 2.2], [4.2, .68, .72, 1.9], [6.5, .52, .56, 1.2]] },
  { id: 's7', kind: 'photo', img: 'p7', t0: TL.s7, t1: TL.s8,
    tags: [{ txt: Z('انجمن ملی فرآورده~های گوشتی'), a: .3, b: 2.0 }, { txt: 'دبیرستان گوشت · دهه ۶۰', a: 2.3, b: 99 }],
    cap: Z('[[انجمن فرآورده~های گوشتی]] و اولین [[مجتمع آموزشی]] صنعت گوشت را تأسیس کردم.'), capAt: .4, capStep: .34,
    cam: [[0, .22, .62, 1.75], [WHIP_T - TL.s7, .30, .58, 1.95], [WHIP_T - TL.s7 + .45, .74, .46, 1.9], [5.2, .66, .50, 1.5]] },
  { id: 's8', kind: 'portrait', t0: TL.s8, t1: TL.s9, glow: true,
    cap: 'کیفیت، میراث من است.', capAt: .9, capStep: .42, capGold: true,
    cam: [[0, 470, 65, 1.7, 540, 330], [3.6, 470, 65, .80, 540, 340]] },
  { id: 's9', kind: 'end', t0: TL.s9, t1: TL.end }
];

/* variant 2 (?v=2): third-person narration, no first-person lines in the name of the late Dr. Ghazarian */
if (new URLSearchParams(location.search).get('v') === '2') {
  const V2 = {
    s1: 'امروز، به یاد [[دکتر قازاریان]]',
    s2: Z('دامپزشک و فعال صنعت [[فرآورده~های گوشتی]] ایران.'),
    s3: Z('استاد دانشکده~ی دامپزشکی [[دانشگاه تهران]].'),
    s4: Z('مدیر پروژه~ی اولین کارخانه~ی [[جوجه~کشی صنعتی]] ایران.'),
    s5: Z('پیش از انقلاب، رئیس [[سازمان ملی شیر کرمانشاه]].'),
    s6: Z('تدوین~کننده~ی [[استاندارد ملی ۲۳۰۳]]؛ مبنای کیفیت فرآورده~های گوشتی تا امروز.'),
    s7: Z('بنیان~گذار [[انجمن فرآورده~های گوشتی]] و اولین [[مجتمع آموزشی]] صنعت گوشت.'),
    s8: 'کیفیت، میراث او.'
  };
  SCENES.forEach(sc => { if (V2[sc.id]) sc.cap = V2[sc.id]; });
}

/* ---------------------------------------------------------------- DOM build */
const root = document.getElementById('scenes');
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

function buildCaption(sc, parent, cls) {
  const box = el('div', 'cap ' + (cls || ''));
  const parts = sc.cap.split(/(\[\[.*?\]\])/).filter(Boolean);
  const words = [];
  parts.forEach(p => {
    const key = p.startsWith('[[');
    const txt = key ? p.slice(2, -2) : p;
    const glue = !key && words.length && /^\S/.test(txt);   // punctuation glued to the previous (highlighted) word
    txt.split(/\s+/).filter(Boolean).forEach((w, i) => { if (i === 0 && glue) words[words.length - 1].w += w; else words.push({ w, key: key || sc.capGold }); });
  });
  words.forEach((o, i) => {
    const s = el('span', 'w' + (o.key ? ' k' : ''), o.w);
    box.appendChild(s);
    if (i < words.length - 1) box.appendChild(document.createTextNode(' '));
    o.el = s;
  });
  sc.words = words;
  const n = words.length, d = sc.t1 - sc.t0;
  sc.step = sc.capStep || clamp((d - sc.capAt - 1.1) / n, .14, .42);
  parent.appendChild(box);
  sc.capEl = box;
}

SCENES.forEach(sc => {
  const e = el('div', 'scene'); e.id = sc.id; sc.el = e; root.appendChild(e);
  sc.d = sc.t1 - sc.t0;

  if (sc.kind === 'photo') {
    const bg = el('div', 'bg'); const bgi = el('img'); bgi.src = `../assets/panels/bg_${sc.img}.jpg`; bg.appendChild(bgi); e.appendChild(bg);
    sc.bgi = bgi;
    e.appendChild(el('div', 'bgshade'));
    sc.tagEls = (sc.tags || []).map(t => {
      const tg = el('div', 'tag', `<span class="dot"></span><span class="txt">${t.txt}</span><span class="ln"></span>`); e.appendChild(tg); return tg;
    });
    const fr = el('div', 'frame'); const im = el('img'); im.src = `../assets/panels/${sc.img}.jpg`; fr.appendChild(im);
    if (sc.vintage) { const sep = el('div'); sep.style.cssText = 'position:absolute;inset:0;background:rgba(120,90,50,.10);mix-blend-mode:multiply'; fr.appendChild(sep); }
    fr.appendChild(el('div', 'fvig')); e.appendChild(fr);
    sc.fr = fr; sc.im = im;
    e.appendChild(el('div', 'gline top'));
    const gb = el('div', 'gline bot', '<i></i>'); e.appendChild(gb); sc.prog = gb.firstChild;
    buildCaption(sc, e);
  } else if (sc.kind === 'portrait') {
    const w = el('div', 'world');
    const A = el('img'); A.id = 'pA'; A.src = '../assets/panels/portrait_full.jpg'; w.appendChild(A);
    const B = el('img'); B.id = 'pB'; B.src = '../assets/panels/portrait_top4x_ext.jpg'; w.appendChild(B);
    e.appendChild(w); sc.world = w;
    e.appendChild(el('div', 'ptop'));
    e.appendChild(el('div', 'pshade'));
    if (sc.glow) { sc.glowEl = el('div', 'glow'); e.appendChild(sc.glowEl); }
    buildCaption(sc, e, 'p');
  } else {
    e.id = 's9';
    e.appendChild(el('div', 'pat'));
    sc.dustBoost = true;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.id = 'orn'; svg.setAttribute('viewBox', '0 0 860 560');
    const mk = (d, sw, fill) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', fill || 'none'); p.setAttribute('stroke', '#e0c577'); p.setAttribute('stroke-width', sw); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round'); svg.appendChild(p); return p; };
    const outer = mk('M26 0 H834 L860 26 V534 L834 560 H26 L0 534 V26 Z', 3.2);
    const inner = mk('M44 18 H816 L842 44 V516 L816 542 H44 L18 516 V44 Z', 1.4);
    // finials (top and bottom centre)
    const fin = (flip) => {
      const g = document.createElementNS(NS, 'g'); g.setAttribute('transform', `translate(430 ${flip ? 560 : 0}) scale(1 ${flip ? -1 : 1})`);
      const bgc = document.createElementNS(NS, 'rect'); bgc.setAttribute('x', -150); bgc.setAttribute('y', -3); bgc.setAttribute('width', 300); bgc.setAttribute('height', 24); bgc.setAttribute('fill', '#13264a'); bgc.setAttribute('opacity', .0); g.appendChild(bgc);
      const paths = [
        'M0 -4 C-15 -26 -15 -54 0 -78 C15 -54 15 -26 0 -4 Z',
        'M-6 -4 C-34 -12 -52 -34 -50 -62 C-30 -52 -12 -32 -6 -4 Z',
        'M6 -4 C34 -12 52 -34 50 -62 C30 -52 12 -32 6 -4 Z',
        'M-56 2 C-80 0 -96 -14 -92 -30 C-88 -44 -72 -42 -72 -30',
        'M56 2 C80 0 96 -14 92 -30 C88 -44 72 -42 72 -30',
        'M-104 0 H-60', 'M104 0 H60'
      ];
      const els = paths.map((d, i) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', i < 3 ? 'rgba(224,197,119,.16)' : 'none'); p.setAttribute('stroke', '#e0c577'); p.setAttribute('stroke-width', 2.6); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); g.appendChild(p); return p; });
      [[-118, 0], [118, 0], [0, -92]].forEach(([x, y]) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 4.2); c.setAttribute('fill', '#e0c577'); g.appendChild(c); els.push(c); });
      svg.appendChild(g); return els;
    };
    const f1 = fin(false), f2 = fin(true);
    // corner diamonds
    const dia = [[0, 0], [860, 0], [0, 560], [860, 560]].map(([x, y]) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', `M${x} ${y - 11} L${x + 11} ${y} L${x} ${y + 11} L${x - 11} ${y} Z`); p.setAttribute('fill', '#e0c577'); svg.appendChild(p); return p; });
    e.appendChild(svg);
    sc.svg = svg; sc.drawn = [outer, inner]; sc.fin = f1.concat(f2); sc.dia = dia;
    [outer, inner].concat(f1.filter(x => x.tagName === 'path'), f2.filter(x => x.tagName === 'path')).forEach(p => { const L = p.getTotalLength(); p.dataset.len = L; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    sc.name = el('div', null, 'دکتر قازاریان،'); sc.name.id = 'name'; e.appendChild(sc.name);
    sc.dates = el('div', null, '۱۳۰۴ تا کنون'); sc.dates.id = 'dates'; e.appendChild(sc.dates);
    sc.occ = el('div', null, 'به مناسبت <b>روز جهانی استاندارد</b>'); sc.occ.id = 'occ'; e.appendChild(sc.occ);
    sc.logo = el('img'); sc.logo.id = 'logo'; sc.logo.src = '../assets/src/robat-logo.png'; e.appendChild(sc.logo);
    sc.site = el('div', null, 'WWW.ROBATCO.COM'); sc.site.id = 'site'; e.appendChild(sc.site);
  }
});

/* dust + grain */
const dustEl = document.getElementById('dust');
const DUST = Array.from({ length: 30 }, (_, i) => { const r = rng(i * 77 + 5); const o = { x: r() * 1080, y0: r() * 2300, v: 22 + r() * 40, sz: 4 + r() * 9, ph: r() * 6.28, sw: 14 + r() * 30 }; o.el = el('i'); o.el.style.width = o.el.style.height = o.sz + 'px'; dustEl.appendChild(o.el); return o; });
const grainEl = document.getElementById('grain');
{ const c = document.createElement('canvas'); c.width = c.height = 220; const g = c.getContext('2d'); const id = g.createImageData(220, 220); const r = rng(1234);
  for (let i = 0; i < id.data.length; i += 4) { const v = 90 + r() * 120; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0); grainEl.style.backgroundImage = `url(${c.toDataURL()})`; grainEl.style.backgroundSize = '220px 220px'; }

const hdr = document.getElementById('hdr'), seal = document.getElementById('seal'), ring = document.getElementById('ring');
const flash = document.getElementById('flash'), fadein = document.getElementById('fadein'), stage = document.getElementById('stage');

/* ---------------------------------------------------------------- per-frame */
function camPhoto(sc, lt) {
  const [fx, fy, s] = track(lt, sc.cam);
  const FH = 800, FW = 1080, asp = sc.im.naturalWidth / sc.im.naturalHeight;
  let IH = FH, IW = FH * asp; if (IW < FW) { IW = FW; IH = FW / asp; }
  sc.im.style.width = IW + 'px';
  const tx = clamp(FW / 2 - fx * IW * s, FW - IW * s, 0);
  const ty = clamp(FH / 2 - fy * IH * s, FH - IH * s, 0);
  sc.im.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
}

function camPortrait(sc, lt) {
  const [ox, oy, scl, tx, ty] = track(lt, sc.cam);
  const S = K * scl;
  sc.world.style.transform = `translate(${tx - (ox + 300) * S}px,${ty - (oy + 260) * S}px) scale(${S})`;
}

function caption(sc, lt, t) {
  sc.words.forEach((o, i) => {
    const p = eO(clamp((lt - (sc.capAt + i * sc.step)) / .38));
    o.el.style.opacity = p;
    o.el.style.transform = `translateY(${(1 - p) * 30}px)`;
    o.el.style.filter = p < 1 ? `blur(${(1 - p) * 7}px)` : 'none';
  });
  const next = SCENES[SCENES.indexOf(sc) + 1];
  const tn = next ? next.t0 : DUR;
  sc.capEl.style.opacity = 1 - eIO(clamp((t - (tn - .12)) / .26));
}

window.renderFrame = function (t) {
  const frameNo = Math.round(t * 30);
  const r = rng(frameNo * 31 + 7);

  /* stage shake at the stamp hit */
  const sk = clamp((t - SEAL_T) / .45);
  const amp = (t >= SEAL_T && sk < 1) ? (1 - sk) * (1 - sk) * 16 : 0;
  stage.style.transform = amp ? `translate(${Math.sin(t * 90) * amp}px,${Math.cos(t * 110) * amp}px)` : 'none';

  SCENES.forEach((sc, i) => {
    const next = SCENES[i + 1];
    const lt = t - sc.t0;
    const show = lt >= -0.001 && (!next || t < next.t0 + FADE + .05);
    sc.el.style.display = show ? 'block' : 'none';
    if (!show) return;
    const a = i === 0 ? 1 : eIO(clamp(lt / FADE));
    sc.el.style.opacity = a;

    if (sc.kind === 'photo') {
      camPhoto(sc, lt);
      const zb = 1.12 + lt * .012;
      sc.bgi.style.transform = `scale(${zb}) translate(${Math.sin(lt * .5) * -12}px,${lt * -2}px)`;
      const o = eO(clamp(lt / .7));
      sc.fr.style.clipPath = `inset(${(1 - o) * 400}px 0 ${(1 - o) * 400}px 0)`;
      sc.fr.style.transform = `scale(${1.05 - .05 * o})`;
      sc.prog.style.transform = `scaleX(${clamp(lt / (sc.d + FADE))})`;
      sc.tagEls.forEach((tg, k) => {
        const T = sc.tags[k];
        const inn = eO(clamp((lt - T.a) / .5)), out = 1 - eIO(clamp((lt - T.b) / .25));
        tg.style.opacity = inn * out;
        tg.style.transform = `translateX(${(1 - inn) * 50}px)`;
      });
      caption(sc, lt, t);
    } else if (sc.kind === 'portrait') {
      camPortrait(sc, lt);
      if (sc.glowEl) sc.glowEl.style.opacity = eIO(clamp((lt - .4) / 1.6)) * .9;
      caption(sc, lt, t);
    } else {
      const f = x => clamp(x);
      const lt0 = lt;
      sc.drawn.concat(sc.fin.filter(x => x.tagName === 'path')).forEach((p, k) => { p.style.strokeDashoffset = p.dataset.len * (1 - eIO(f((lt0 - .1 - (k > 1 ? .5 : 0)) / (k > 1 ? .9 : 1.5)))); });
      sc.fin.forEach(x => { if (x.tagName === 'circle') x.style.opacity = eO(f((lt0 - 1.0) / .5)); });
      sc.dia.forEach(x => x.style.opacity = eO(f((lt0 - .9) / .4)));
      const up = (node, t0, dist = 36, d = .7) => { const p = eO(f((lt0 - t0) / d)); node.style.opacity = p; node.style.transform = `translateY(${(1 - p) * dist}px)`; };
      up(sc.name, .55); up(sc.dates, 1.0); up(sc.occ, 1.55, 24);
      const lg = eBack(f((lt0 - 1.9) / .6)); sc.logo.style.opacity = f((lt0 - 1.9) / .3); sc.logo.style.transform = `scale(${lerp(.6, 1, lg)})`;
      up(sc.site, 2.5, 16, .5);
      sc.el.style.transform = `scale(${1 + lt0 * .004})`;
    }
  });

  /* header pill */
  const hp = eO(clamp((t - .35) / .6));
  hdr.style.opacity = hp; hdr.style.transform = `translateX(-50%) translateY(${(1 - hp) * -30}px)`;

  /* stamp / seal */
  const s6 = SCENES[5];
  const inS6 = t >= SEAL_T - .3 && t < TL.s7 + FADE;
  if (inS6) {
    const u = clamp((t - (SEAL_T - .23)) / .23);
    const out = 1 - eIO(clamp((t - (TL.s7 - .05)) / .4));
    const bounce = t > SEAL_T ? Math.sin((t - SEAL_T) * 28) * Math.exp(-(t - SEAL_T) * 9) * .045 : 0;
    seal.style.opacity = clamp(u * 3) * out;
    seal.style.transform = `rotate(-9deg) scale(${lerp(2.7, 1, eO(u)) + bounce})`;
    const rp = clamp((t - SEAL_T) / .6);
    ring.style.opacity = t >= SEAL_T ? (1 - rp) * .85 : 0;
    ring.style.transform = `scale(${1 + rp * .9})`;
  } else { seal.style.opacity = 0; ring.style.opacity = 0; }

  /* flash */
  let fl = 0;
  FLASHES.forEach(([T, pk, L]) => { const p = (t - T) / L; if (p >= 0 && p < 1) fl = Math.max(fl, pk * Math.pow(1 - p, 2.2)); });
  flash.style.opacity = fl;

  /* fade from black at start */
  fadein.style.opacity = 1 - eIO(clamp(t / .6));

  /* gold dust (portrait close + end card) */
  const dBoost = (t >= TL.s8 - .2) ? eIO(clamp((t - TL.s8 + .2) / 1.0)) : 0;
  document.getElementById('dust').style.opacity = dBoost * .8;
  if (dBoost > 0) DUST.forEach(o => {
    const y = 2100 - ((o.y0 + t * o.v) % 2300);
    const x = o.x + Math.sin(t * .8 + o.ph) * o.sw;
    o.el.style.transform = `translate(${x}px,${y}px)`;
    o.el.style.opacity = .35 + .65 * Math.abs(Math.sin(t * 1.3 + o.ph));
  });

  /* grain jitter */
  grainEl.style.backgroundPosition = `${Math.floor(r() * 220)}px ${Math.floor(r() * 220)}px`;
};

window.ready = (async () => {
  await document.fonts.load('800 40px Vazirmatn', 'دکتر قازاریان ۱۲۳۴');
  await document.fonts.load('600 40px Vazirmatn', 'WORLD STANDARDS DAY');
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()));
  window.renderFrame(0);
  return true;
})();
