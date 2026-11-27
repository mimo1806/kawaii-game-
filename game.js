// Mini Fight Kawaii - jeu de combat en local (HTML5 canvas, JS pur)
// 4 héroïnes avec leur style, attaque spéciale, 3 manches, son, mode contre l'ordi.

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const TAU = Math.PI * 2;

const GROUND = H - 70;
const GRAVITY = 0.8;
const ROUND_TIME = 60;    // secondes
const MAX_HP = 100;
const SP_MAX = 100;
const ROUNDS_TO_WIN = 2;
const STORAGE_KEY = 'minifight.settings.v2';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---------------------------------------------------------------
// Personnages et couleurs
// ---------------------------------------------------------------
const CHARACTERS = [
  { id: 'luna', label: 'Luna', role: 'Fée de la Lune', hair: 'long', acc: 'moon', weapon: 'moon',
    skirt: 24, speed: 6, power: 10, spDmg: 20, proj: 'moon', special: 'Croissant lunaire',
    stats: { Vitesse: 3, Force: 3, Magie: 4 } },
  { id: 'stella', label: 'Stella', role: 'Magicienne des Étoiles', hair: 'twin', acc: 'star', weapon: 'star',
    skirt: 23, speed: 6.6, power: 9, spDmg: 18, proj: 'star', special: "Pluie d'étoiles",
    stats: { Vitesse: 4, Force: 2, Magie: 5 } },
  { id: 'mochi', label: 'Mochi', role: 'Chaton Sucré', hair: 'bob', acc: 'cat', weapon: 'heart',
    skirt: 22, speed: 7.2, power: 9, spDmg: 22, proj: 'heart', special: 'Cœur gourmand',
    stats: { Vitesse: 5, Force: 2, Magie: 3 } },
  { id: 'aria', label: 'Aria', role: 'Princesse Cristal', hair: 'bun', acc: 'crown', weapon: 'crystal',
    skirt: 31, speed: 5.6, power: 11, spDmg: 24, proj: 'crystal', special: 'Éclat de cristal',
    stats: { Vitesse: 2, Force: 4, Magie: 4 } },
];

const PALETTES = [
  { label: 'Violet',    hair: '#9b5de5', hairDark: '#6f3bc0', hairLight: '#c9a2ff', dress: '#c9a2ff', dressDark: '#8f62e0', accent: '#ff9be8', iris: '#7a4dff', bar1: '#c77dff', bar2: '#7b2ff7' },
  { label: 'Bleu ciel', hair: '#4cc9f0', hairDark: '#2a8fc4', hairLight: '#a8ecff', dress: '#9ad8ff', dressDark: '#5aa8ec', accent: '#b5a7ff', iris: '#2f8fff', bar1: '#4cc9f0', bar2: '#3a5bff' },
  { label: 'Indigo',    hair: '#5d6cff', hairDark: '#3a46c4', hairLight: '#a9b4ff', dress: '#a9b4ff', dressDark: '#6f7de6', accent: '#ffb3f0', iris: '#4d3dff', bar1: '#7b8cff', bar2: '#3a2fd6' },
  { label: 'Lilas',     hair: '#c49bff', hairDark: '#9468d8', hairLight: '#ecdcff', dress: '#e6d4ff', dressDark: '#b996ee', accent: '#8fd3ff', iris: '#9b6bff', bar1: '#e0b3ff', bar2: '#9b6bff' },
  { label: 'Turquoise', hair: '#3fd9d0', hairDark: '#1fa3b0', hairLight: '#a2fff4', dress: '#a2ecff', dressDark: '#55bfd8', accent: '#c6a8ff', iris: '#1fb6c8', bar1: '#5ce1e6', bar2: '#4a6bff' },
];

// ---------------------------------------------------------------
// Réglages (sauvegardés dans le navigateur)
// ---------------------------------------------------------------
const settings = {
  mode: '2p',
  sound: true,
  players: [
    { name: '', ch: 0, pal: 0 },
    { name: '', ch: 1, pal: 1 },
  ],
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!s) return;
    if (s.mode === '2p' || s.mode === 'cpu') settings.mode = s.mode;
    if (typeof s.sound === 'boolean') settings.sound = s.sound;
    if (Array.isArray(s.players)) {
      s.players.slice(0, 2).forEach((p, i) => {
        if (typeof p.name === 'string') settings.players[i].name = p.name.slice(0, 12);
        if (Number.isInteger(p.ch) && CHARACTERS[p.ch]) settings.players[i].ch = p.ch;
        if (Number.isInteger(p.pal) && PALETTES[p.pal]) settings.players[i].pal = p.pal;
      });
    }
  } catch (e) { /* stockage indisponible : on ignore */ }
}

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------
// Son (petits bruitages synthétisés, aucun fichier)
// ---------------------------------------------------------------
let actx = null;
function audioInit() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
}
addEventListener('pointerdown', audioInit);
addEventListener('keydown', audioInit);

function tone(f1, f2, dur, type = 'sine', vol = 0.06, delay = 0) {
  if (!actx || !settings.sound) return;
  try {
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  } catch (e) { /* ignore */ }
}

const SFX = {
  hit()     { tone(320, 70, 0.12, 'square', 0.06); },
  block()   { tone(520, 320, 0.08, 'triangle', 0.06); },
  jump()    { tone(280, 640, 0.14, 'sine', 0.05); },
  swing()   { tone(520, 200, 0.08, 'sawtooth', 0.02); },
  special() { [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.03, 0.18, 'sine', 0.05, i * 0.06)); },
  ko()      { tone(420, 40, 0.8, 'sawtooth', 0.07); },
  tick()    { tone(880, 880, 0.08, 'square', 0.035); },
  go()      { tone(660, 1320, 0.25, 'square', 0.045); },
  win()     { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.06, i * 0.11)); },
};

// ---------------------------------------------------------------
// Clavier
// ---------------------------------------------------------------
const keys = {};
const tapped = {};
const NO_INPUT = { left: false, right: false, up: false, attack: false, block: false, special: false };

addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT') {            // on est en train d'écrire un nom
    if (e.code === 'Enter') tryStart();
    return;
  }
  if (tag === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) return; // le clic gère

  if (state !== 'menu' && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  tapped[e.code] = true;   // un appui très court ne doit pas être perdu entre deux images

  if (e.code === 'Enter') {
    if (state === 'menu') tryStart();
    else if (state === 'over') startMatch();
    else if (state === 'paused') resume();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'fight') pause();
    else if (state === 'paused') resume();
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (state === 'fight') pause();
});

// ---------------------------------------------------------------
// Petites fonctions de dessin
// ---------------------------------------------------------------
function drawStar(c, x, y, r, fill, stroke, lw = 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}

function polygon(c, pts, fill, ol, lw = 2.5) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (ol) { c.strokeStyle = ol; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}

function fillStroke(c, fill, ol, lw = 2.5) {
  c.fillStyle = fill;
  c.fill();
  if (ol) { c.strokeStyle = ol; c.lineWidth = lw; c.lineJoin = 'round'; c.stroke(); }
}

function limb(c, x1, y1, x2, y2, w, col, ol) {
  c.lineCap = 'round';
  if (ol) {
    c.strokeStyle = ol;
    c.lineWidth = w + 4;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }
  c.strokeStyle = col;
  c.lineWidth = w;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function heartPath(c, s) {
  c.beginPath();
  c.moveTo(0, 5 * s);
  c.bezierCurveTo(-14 * s, -4 * s, -8 * s, -14 * s, 0, -7 * s);
  c.bezierCurveTo(8 * s, -14 * s, 14 * s, -4 * s, 0, 5 * s);
  c.closePath();
}

// Forme magique (bout de baguette / projectile), centrée en (0,0)
function drawMagicShape(c, type, pal, K, OL, scale, rot) {
  c.save();
  c.rotate(rot);
  c.scale(scale, scale);
  const AC = K(pal.accent);
  if (type === 'moon') {
    // croissant = grand cercle moins un cercle décalé
    const R = 11, d = 5, r = 9;
    const ix = (d * d + R * R - r * r) / (2 * d);
    const a = Math.acos(ix / R);
    const b = Math.acos((ix - d) / r);
    c.beginPath();
    c.arc(0, 0, R, a, TAU - a, false);
    c.arc(d, 0, r, -b, b, true);
    c.closePath();
    c.fillStyle = K('#ffe98a');
    c.fill();
    c.strokeStyle = OL;
    c.lineWidth = 2;
    c.lineJoin = 'round';
    c.stroke();
  } else if (type === 'star') {
    drawStar(c, 0, 0, 12, K('#fff3a0'), AC, 2.5);
    drawStar(c, 0, 0, 5, K('#ffffff'), null);
  } else if (type === 'heart') {
    heartPath(c, 1.1);
    fillStroke(c, K('#ff8fc8'), OL, 2.2);
    c.fillStyle = K('rgba(255,255,255,0.75)');
    c.beginPath(); c.ellipse(-5, -6, 3, 2, -0.6, 0, TAU); c.fill();
  } else { // crystal
    polygon(c, [[0, -14], [9, 0], [0, 14], [-9, 0]], K('#bfe8ff'), OL, 2.2);
    polygon(c, [[0, -14], [9, 0], [0, 0]], K('#eefaff'), null);
    polygon(c, [[0, 14], [-9, 0], [0, 0]], K('#8fc4ff'), null);
    c.strokeStyle = OL;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-9, 0); c.lineTo(9, 0); c.stroke();
  }
  c.restore();
}

function drawWand(c, type, pal, K, OL, glow, t) {
  const AC = K(pal.accent);
  c.lineCap = 'round';
  c.strokeStyle = OL;
  c.lineWidth = 6.5;
  c.beginPath(); c.moveTo(-10, 0); c.lineTo(30, 0); c.stroke();
  c.strokeStyle = K('#fff6ff');
  c.lineWidth = 3.4;
  c.beginPath(); c.moveTo(-10, 0); c.lineTo(30, 0); c.stroke();
  c.strokeStyle = AC;
  c.lineWidth = 3.6;
  c.beginPath(); c.moveTo(6, 0); c.lineTo(10, 0); c.stroke();
  c.save();
  c.translate(39, 0);
  const r = 22 + glow * 16;
  const g = c.createRadialGradient(0, 0, 2, 0, 0, r);
  g.addColorStop(0, `rgba(255,250,200,${0.55 + glow * 0.3})`);
  g.addColorStop(1, 'rgba(255,250,200,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  drawMagicShape(c, type, pal, K, OL, 1 + glow * 0.25, type === 'star' ? t / 500 : 0);
  c.restore();
}

// ---------------------------------------------------------------
// Dessin d'un personnage (orienté vers la droite, pieds en 0,0)
// ---------------------------------------------------------------
function renderCharacter(c, ch, pal, p) {
  const t = p.t;
  const fl = p.flash;
  const K = (col) => (fl ? '#fff' : col);
  const OL = fl ? '#fff' : '#43307f';
  const SK = K('#ffe9de');
  const SKD = K('#f5c9b8');
  const HAIR = K(pal.hair), HD = K(pal.hairDark), HL = K(pal.hairLight);
  const DR = K(pal.dress), DD = K(pal.dressDark), AC = K(pal.accent), WH = K('#ffffff');

  const walk = p.moving ? Math.sin(t / 85) : 0;
  const walk2 = p.moving ? Math.cos(t / 85) : 0;
  const hlift = clamp(p.vy || 0, -16, 16) * 0.6;
  const sway = p.moving ? -walk2 * 4 : Math.sin(t / 400) * 2;
  const winHop = p.win ? -Math.abs(Math.sin(t / 170)) * 16 : 0;
  const bob = p.ko ? 0 : p.air ? 0 : p.moving ? -Math.abs(walk) * 3 : Math.sin(t / 260) * 1.6;

  // Cercle magique au sol pendant le sort
  if (p.cast != null) {
    c.save();
    c.globalAlpha = 0.35 + 0.4 * Math.sin(p.cast * Math.PI);
    c.strokeStyle = AC;
    c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, -2, 54, 13, 0, 0, TAU); c.stroke();
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, -2, 36, 9, 0, 0, TAU); c.stroke();
    c.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const a = t / 260 + (i * TAU) / 6;
      c.beginPath(); c.arc(Math.cos(a) * 45, -2 + Math.sin(a) * 11, 2.6, 0, TAU); c.fill();
    }
    c.restore();
  }

  c.save();
  if (p.ko) c.rotate(-p.ko);
  c.translate(0, bob + winHop);
  if (p.hurt) { c.translate(0, -30); c.rotate(-0.2); c.translate(0, 30); }
  else if (p.moving) { c.translate(0, -30); c.rotate(0.06); c.translate(0, 30); }

  // ---- Queue de chat ----
  if (ch.acc === 'cat') {
    c.lineCap = 'round';
    c.strokeStyle = OL; c.lineWidth = 11;
    c.beginPath(); c.moveTo(-10, -36); c.bezierCurveTo(-34, -30, -42 + sway * 2, -58, -32 + sway * 3, -72 - hlift); c.stroke();
    c.strokeStyle = HAIR; c.lineWidth = 7;
    c.beginPath(); c.moveTo(-10, -36); c.bezierCurveTo(-34, -30, -42 + sway * 2, -58, -32 + sway * 3, -72 - hlift); c.stroke();
    c.fillStyle = AC;
    c.beginPath(); c.arc(-32 + sway * 3, -72 - hlift, 5, 0, TAU); c.fill();
  }

  // ---- Cheveux arrière ----
  const sw = sway;
  if (ch.hair === 'long') {
    c.beginPath();
    c.moveTo(-30, -104);
    c.bezierCurveTo(-54, -84, -42 + sw, -52, -34 + sw * 1.5, -22 - hlift);
    c.quadraticCurveTo(-20 + sw, -16 - hlift, -8 + sw, -32 - hlift);
    c.lineTo(10, -84);
    c.closePath();
    fillStroke(c, HD, OL);
    c.strokeStyle = HAIR; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-36, -88); c.quadraticCurveTo(-42 + sw, -58, -32 + sw, -34 - hlift); c.stroke();
    c.beginPath(); c.moveTo(-26, -92); c.quadraticCurveTo(-30 + sw, -62, -22 + sw, -36 - hlift); c.stroke();
  } else if (ch.hair === 'twin') {
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 24, -110);
      c.bezierCurveTo(s * 50, -104, s * 52 + sw * s, -64, s * 40 + sw * s * 1.3, -36 - hlift);
      c.bezierCurveTo(s * 32 + sw * s, -62, s * 20, -86, s * 24, -110);
      fillStroke(c, HD, OL);
      c.strokeStyle = HAIR; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s * 33, -102); c.quadraticCurveTo(s * 44 + sw * s, -72, s * 38 + sw * s, -44 - hlift); c.stroke();
    }
  } else if (ch.hair === 'bob') {
    c.beginPath(); c.ellipse(-2, -84, 38, 37, 0, 0, TAU);
    fillStroke(c, HD, OL);
  } else { // bun : chignons + petites queues
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 26, -98);
      c.quadraticCurveTo(s * 42 + sw * s, -76, s * 34 + sw * s, -56 - hlift);
      c.quadraticCurveTo(s * 24, -72, s * 20, -92);
      c.closePath();
      fillStroke(c, HD, OL);
    }
  }

  // ---- Oreilles de chat ----
  if (ch.acc === 'cat') {
    for (const s of [-1, 1]) {
      polygon(c, [[s * 31, -102], [s * 9, -120], [s * 29, -144]], HAIR, OL);
      polygon(c, [[s * 26, -108], [s * 14, -118], [s * 26, -134]], AC, null);
    }
  }

  // ---- Bras arrière ----
  const shB = { x: -9, y: -60 };
  let hB;
  if (p.win) hB = { x: -22, y: -100 };
  else if (p.block) hB = { x: 13, y: -48 };
  else if (p.cast != null) hB = { x: 0, y: -94 };
  else if (p.atk != null) hB = { x: -23, y: -46 };
  else if (p.hurt || p.ko) hB = { x: -29, y: -76 };
  else if (p.air) hB = { x: -26, y: -72 };
  else hB = { x: -17 - walk * 6, y: -42 };
  limb(c, shB.x, shB.y, hB.x, hB.y, 7, SK, OL);
  c.beginPath(); c.arc(hB.x, hB.y, 5, 0, TAU); fillStroke(c, SK, OL, 2);

  // ---- Jambes ----
  let ff, bf;     // pieds avant / arrière
  if (p.ko || p.hurt) { ff = { x: 8, y: -13 }; bf = { x: -7, y: -7 }; }
  else if (p.air) { ff = { x: 9, y: -17 }; bf = { x: -6, y: -11 }; }
  else if (p.atk != null) { ff = { x: 17, y: -5 }; bf = { x: -11, y: -5 }; }
  else if (p.cast != null) { ff = { x: 12, y: -5 }; bf = { x: -12, y: -5 }; }
  else if (p.moving) {
    ff = { x: 5 + walk * 10, y: -5 - Math.max(0, walk2) * 6 };
    bf = { x: -5 - walk * 10, y: -5 - Math.max(0, -walk2) * 6 };
  } else { ff = { x: 6, y: -5 }; bf = { x: -6, y: -5 }; }

  for (const [hip, foot] of [[-6, bf], [6, ff]]) {
    limb(c, hip, -32, foot.x, foot.y, 7, SK, OL);                 // jambe
    const sx = lerp(hip, foot.x, 0.45), sy = lerp(-32, foot.y, 0.45);
    limb(c, sx, sy, foot.x, foot.y, 8, K('#f6f0ff'), null);        // chaussette
    limb(c, sx, sy, sx + (foot.x - hip) * 0.02, sy + 0.1, 8, AC, null); // liseré
    c.beginPath(); c.ellipse(foot.x + 3, foot.y + 2, 9.5, 5.2, 0, 0, TAU);
    fillStroke(c, AC, OL, 2);
    c.fillStyle = WH;
    c.beginPath(); c.arc(foot.x + 3, foot.y + 1, 1.7, 0, TAU); c.fill();
  }

  // ---- Jupe ----
  const sk = ch.skirt;
  const hemY = -24;
  c.beginPath();
  c.moveTo(-11, -47);
  c.lineTo(11, -47);
  c.lineTo(sk + sway * 0.4, hemY);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x1 = sk + sway * 0.4 - ((i + 0.5) * (2 * sk)) / n;
    const x2 = sk + sway * 0.4 - ((i + 1) * (2 * sk)) / n;
    c.quadraticCurveTo(x1, hemY + 7, x2, hemY);
  }
  c.closePath();
  fillStroke(c, DR, OL);
  c.strokeStyle = DD; c.lineWidth = 2.2; c.lineCap = 'round';
  for (const k of [-0.5, 0, 0.5]) {
    c.beginPath(); c.moveTo(k * 14, -45); c.lineTo(k * sk * 1.7 + sway * 0.3, hemY - 3); c.stroke();
  }
  if (ch.id === 'aria') { // jupon en dentelle
    c.fillStyle = K('#ffffff');
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(i * (sk * 0.3) + sway * 0.4, hemY + 3, 4.5, 0, Math.PI); c.fill(); }
  }

  // ---- Corsage ----
  roundRectPath(c, -11, -68, 22, 24, 7);
  fillStroke(c, DR, OL);
  polygon(c, [[-11, -66], [11, -66], [0, -50]], WH, OL, 2);   // col marin
  c.fillStyle = DD; c.fillRect(-11, -49, 22, 4);               // ceinture
  c.fillStyle = AC;
  c.beginPath(); c.moveTo(0, -55); c.lineTo(-9, -61); c.lineTo(-9, -49); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(0, -55); c.lineTo(9, -61); c.lineTo(9, -49); c.closePath(); c.fill();
  c.strokeStyle = OL; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -55); c.lineTo(-9, -61); c.lineTo(-9, -49); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(0, -55); c.lineTo(9, -61); c.lineTo(9, -49); c.closePath(); c.stroke();
  // broche
  c.save();
  c.translate(0, -55);
  drawMagicShape(c, ch.proj, pal, K, OL, 0.5, 0);
  c.restore();

  // ---- Tête ----
  const fx = 4;   // décalage du visage vers l'avant (vue 3/4)
  c.beginPath(); c.ellipse(0, -92, 30, 28, 0, 0, TAU);
  fillStroke(c, SK, OL);

  // Joues
  c.fillStyle = K('rgba(255,110,160,0.5)');
  c.beginPath(); c.ellipse(fx + 20, -71, 6, 3.6, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(fx - 20, -71, 6, 3.6, 0, 0, TAU); c.fill();
  c.strokeStyle = K('rgba(255,255,255,0.7)'); c.lineWidth = 1.2; c.lineCap = 'round';
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    c.beginPath(); c.moveTo(fx + s * (18 + i * 3), -73); c.lineTo(fx + s * (17 + i * 3), -69.5); c.stroke();
  }

  // Yeux
  for (const s of [-1, 1]) {
    const ex = fx + s * 11.5, ey = -81;
    if (p.ko) {
      c.strokeStyle = OL; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(ex - 5, ey - 5); c.lineTo(ex + 5, ey + 5); c.moveTo(ex + 5, ey - 5); c.lineTo(ex - 5, ey + 5); c.stroke();
    } else if (p.hurt) {
      c.strokeStyle = OL; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(ex - s * 5, ey - 4); c.lineTo(ex + s * 5, ey + 1); c.lineTo(ex - s * 5, ey + 6); c.stroke();
    } else if (p.win) {
      c.strokeStyle = '#2b1b4d'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(ex, ey + 4, 6, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke();
    } else if (p.blink) {
      c.strokeStyle = '#2b1b4d'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(ex, ey - 1, 6, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    } else {
      c.fillStyle = WH;
      c.beginPath(); c.ellipse(ex, ey, 8.2, 11, 0, 0, TAU); c.fill();
      if (fl) { c.fillStyle = '#fff'; } else {
        const g = c.createLinearGradient(0, ey - 10, 0, ey + 10);
        g.addColorStop(0, '#2a1b5e');
        g.addColorStop(0.55, pal.iris);
        g.addColorStop(1, '#bfe9ff');
        c.fillStyle = g;
      }
      c.beginPath(); c.ellipse(ex + 0.5, ey + 1, 6.5, 9.4, 0, 0, TAU); c.fill();
      c.fillStyle = K('#1d1240');
      c.beginPath(); c.ellipse(ex + 0.5, ey + 1, 3.2, 5.4, 0, 0, TAU); c.fill();
      c.fillStyle = WH;
      c.beginPath(); c.arc(ex - 2.3, ey - 3.6, 3.1, 0, TAU); c.fill();
      c.beginPath(); c.arc(ex + 2.6, ey + 4.6, 1.5, 0, TAU); c.fill();
      // cils du haut
      c.strokeStyle = '#2b1b4d'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.ellipse(ex, ey, 8.4, 11.2, 0, Math.PI * 1.08, Math.PI * 1.95); c.stroke();
      c.beginPath(); c.moveTo(ex + s * 7.5, ey - 5); c.lineTo(ex + s * 11.5, ey - 8); c.stroke();
    }
    // sourcil
    if (!p.ko) {
      c.strokeStyle = HD; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath();
      if (p.hurt) { c.moveTo(ex - 5, ey - 15 + s * 2); c.lineTo(ex + 5, ey - 18 - s * 2); }
      else c.arc(ex, ey - 10, 7, 1.2 * Math.PI, 1.8 * Math.PI);
      c.stroke();
    }
  }

  // Nez + bouche
  c.fillStyle = SKD;
  c.beginPath(); c.arc(fx + 1, -73, 1.1, 0, TAU); c.fill();
  c.strokeStyle = '#c2487a'; c.fillStyle = '#b83b6e'; c.lineWidth = 2; c.lineCap = 'round';
  if (p.atk != null || p.cast != null || p.win) {
    c.beginPath(); c.ellipse(fx + 1, -67.5, 4.2, 3.8, 0, 0, TAU); c.fill();
    c.fillStyle = '#ff8fb0';
    c.beginPath(); c.ellipse(fx + 1, -66, 2.6, 1.8, 0, 0, TAU); c.fill();
  } else if (p.hurt) {
    c.beginPath(); c.moveTo(fx - 5, -68); c.quadraticCurveTo(fx - 2, -71, fx + 1, -68); c.quadraticCurveTo(fx + 4, -65, fx + 7, -68); c.stroke();
  } else if (p.ko) {
    c.beginPath(); c.ellipse(fx + 1, -68, 3, 2, 0, 0, TAU); c.fill();
  } else if (ch.acc === 'cat') {
    c.beginPath(); c.arc(fx - 2.5, -71, 3, 0.1 * Math.PI, 0.95 * Math.PI); c.stroke();
    c.beginPath(); c.arc(fx + 3.5, -71, 3, 0.05 * Math.PI, 0.9 * Math.PI); c.stroke();
  } else {
    c.beginPath(); c.arc(fx + 1, -72, 4, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
  }

  // ---- Cheveux avant : frange + mèches ----
  c.beginPath();
  c.moveTo(-33, -90);
  c.bezierCurveTo(-35, -130, 35, -130, 34, -90);
  c.lineTo(32, -93);
  c.quadraticCurveTo(30, -82, 24, -96);
  c.quadraticCurveTo(14, -101, 8, -97);
  c.quadraticCurveTo(6, -80, 1, -97);
  c.quadraticCurveTo(-8, -102, -14, -97);
  c.quadraticCurveTo(-18, -82, -26, -95);
  c.quadraticCurveTo(-30, -92, -33, -92);
  c.closePath();
  fillStroke(c, HAIR, OL);
  for (const s of [-1, 1]) {
    const len = ch.hair === 'bob' ? 22 : 15;
    c.beginPath(); c.ellipse(s * 31, -80 + len * 0.1, 5.5, len, s * 0.06, 0, TAU);
    fillStroke(c, HAIR, OL, 2);
  }
  c.strokeStyle = HL; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-20, -112); c.quadraticCurveTo(-4, -120, 14, -113); c.stroke();
  c.lineWidth = 2.2;
  c.beginPath(); c.moveTo(19, -108); c.lineTo(24, -104); c.stroke();

  // ---- Accessoires ----
  if (ch.acc === 'moon') {
    c.save(); c.translate(-22, -112); c.rotate(-0.4);
    drawMagicShape(c, 'moon', pal, K, OL, 0.8, 0);
    c.restore();
    c.fillStyle = AC;
    c.beginPath(); c.arc(-14, -118, 3, 0, TAU); c.fill();
  } else if (ch.acc === 'star') {
    for (const s of [-1, 1]) drawStar(c, s * 24, -108, 8, K('#fff3a0'), AC, 2);
    drawStar(c, 0, -124, 6, K('#fff3a0'), AC, 2);
  } else if (ch.acc === 'cat') {
    const bx = -22, by = -122;
    polygon(c, [[bx, by], [bx - 12, by - 8], [bx - 12, by + 8]], AC, OL, 2);
    polygon(c, [[bx, by], [bx + 12, by - 8], [bx + 12, by + 8]], AC, OL, 2);
    c.fillStyle = WH; c.beginPath(); c.arc(bx, by, 3.5, 0, TAU); c.fill();
    // clochette
    c.fillStyle = K('#ffe27a'); c.strokeStyle = OL; c.lineWidth = 1.6;
    c.beginPath(); c.arc(fx + 0, -62, 4, 0, TAU); c.fill(); c.stroke();
  } else if (ch.acc === 'crown') {
    polygon(c, [[-15, -118], [-15, -131], [-8, -123], [0, -135], [8, -123], [15, -131], [15, -118]], K('#ffe27a'), OL, 2);
    c.fillStyle = K('#ff7fcf');
    c.beginPath(); c.arc(0, -123, 2.6, 0, TAU); c.fill();
    for (const s of [-1, 1]) {
      c.fillStyle = AC; c.beginPath(); c.arc(s * 26, -118, 7, 0, TAU); fillStroke(c, AC, OL, 2);
      c.fillStyle = WH; c.beginPath(); c.arc(s * 26, -118, 2.2, 0, TAU); c.fill();
    }
  }
  if (ch.hair === 'twin') {
    for (const s of [-1, 1]) {
      c.beginPath(); c.arc(s * 25, -106, 4.5, 0, TAU); fillStroke(c, AC, OL, 2);
    }
  }

  // ---- Bras avant + baguette ----
  const shF = { x: 10, y: -60 };
  let hF, wAng, glow = 0;
  if (p.win) { hF = { x: 22, y: -100 }; wAng = -1.05; glow = 0.5; }
  else if (p.atk != null) {
    const a = lerp(-2.0, 0.35, ease(clamp(p.atk * 1.15, 0, 1)));
    hF = { x: shF.x + Math.cos(a) * 20, y: shF.y + Math.sin(a) * 20 };
    wAng = a;
    // traînée du coup
    c.save();
    c.lineCap = 'round';
    c.globalAlpha = 0.6 * (1 - p.atk * 0.5);
    c.strokeStyle = AC; c.lineWidth = 12;
    c.beginPath(); c.arc(shF.x, shF.y, 66, -2.0, a); c.stroke();
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    c.beginPath(); c.arc(shF.x, shF.y, 66, -1.7, a); c.stroke();
    c.restore();
  } else if (p.cast != null) {
    const a = lerp(-1.7, -0.3, ease(clamp(p.cast * 1.6, 0, 1)));
    hF = { x: shF.x + Math.cos(a) * 21, y: shF.y + Math.sin(a) * 21 };
    wAng = a - 0.05;
    glow = 0.4 + p.cast * 1.1;
  } else if (p.block) { hF = { x: 14, y: -48 }; wAng = -1.57; }
  else if (p.ko) { hF = { x: 24, y: -50 }; wAng = 0.5; }
  else if (p.hurt) { hF = { x: 27, y: -76 }; wAng = -0.35; }
  else if (p.air) { hF = { x: 23, y: -70 }; wAng = -0.9; }
  else { hF = { x: 19 + walk * 5, y: -42 }; wAng = -1.2; }

  limb(c, shF.x, shF.y, hF.x, hF.y, 7, SK, OL);
  c.save();
  c.translate(hF.x, hF.y);
  c.rotate(wAng);
  drawWand(c, ch.weapon, pal, K, OL, glow, t);
  c.restore();
  c.beginPath(); c.arc(hF.x, hF.y, 5, 0, TAU); fillStroke(c, SK, OL, 2);
  // manches bouffantes
  for (const sx of [-9, 10]) {
    c.beginPath(); c.arc(sx, -61, 6.5, 0, TAU); fillStroke(c, DR, OL, 2);
  }

  c.restore();

  // Bulle de protection
  if (p.block) {
    const g = c.createRadialGradient(0, -62, 12, 0, -62, 70);
    g.addColorStop(0, 'rgba(255,255,255,0.04)');
    g.addColorStop(1, 'rgba(200,180,255,0.5)');
    c.fillStyle = g;
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, -62, 70, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.ellipse(-30, -100, 9, 4, -0.7, 0, TAU); c.fill();
  }
}

// ---------------------------------------------------------------
// Effets : particules, étincelles, projectiles
// ---------------------------------------------------------------
const particles = [];
const sparks = [];
const projectiles = [];
let projId = 0;
let hitstop = 0;
let shake = 0;

function burst(x, y, pal, n) {
  const chars = ['♥', '✦', '★'];
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 6 - 1,
      life: 45, max: 45,
      ch: chars[i % 3],
      color: i % 2 ? '#ffffff' : pal.accent,
      size: 14 + Math.random() * 12,
    });
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.vy += 0.25 * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    sparks[i].life -= dt;
    if (sparks[i].life <= 0) sparks.splice(i, 1);
  }
  shake = Math.max(0, shake - 0.7 * dt);
}

function drawEffects() {
  ctx.textAlign = 'center';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.font = `${p.size}px system-ui, sans-serif`;
    ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  for (const s of sparks) {
    const k = 1 - s.life / s.max;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const r1 = (s.big ? 22 : 14) + k * (s.big ? 34 : 22);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + 0.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1 * 0.55, Math.sin(a) * r1 * 0.55);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r1 * 0.5, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function spawnProjectile(f) {
  const dir = f.facing;
  projectiles.push({
    id: ++projId, owner: f, dir, type: f.char.proj, pal: f.pal,
    x: f.x + f.w / 2 + dir * 46, y: f.y + 50,
    vx: dir * (f.char.id === 'stella' ? 11 : f.char.id === 'aria' ? 8 : 9.5),
    dmg: f.char.spDmg, r: 24, life: 120, rot: 0,
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.rot += 0.18 * dt * p.dir;
    p.life -= dt;
    if (Math.random() < 0.6 * dt) {
      particles.push({
        x: p.x - p.dir * 14, y: p.y + (Math.random() - 0.5) * 20,
        vx: -p.dir * 1.5, vy: -0.5, life: 22, max: 22,
        ch: Math.random() < 0.5 ? '✦' : '✧', color: p.pal.accent, size: 14,
      });
    }
    const target = p.owner === fighters[0] ? fighters[1] : fighters[0];
    const box = { x: p.x - p.r, y: p.y - p.r, w: p.r * 2, h: p.r * 2 };
    if (overlap(box, target)) {
      target.takeHit(p.owner, p.dmg, p.dir, true);
      projectiles.splice(i, 1);
    } else if (p.life <= 0 || p.x < -60 || p.x > W + 60) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles() {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    g.addColorStop(0, 'rgba(255,250,200,0.8)');
    g.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    drawMagicShape(ctx, p.type, p.pal, (x) => x, '#43307f', 2.1, p.type === 'crystal' ? 0 : p.rot);
    ctx.restore();
  }
}

// ---------------------------------------------------------------
// Combattante
// ---------------------------------------------------------------
class Fighter {
  constructor(x, facing, controls) {
    this.startX = x;
    this.startFacing = facing;
    this.controls = controls;
    this.name = '';
    this.chIdx = 0;
    this.char = CHARACTERS[0];
    this.pal = PALETTES[0];
    this.isAI = false;
    this.w = 54;
    this.h = 124;
    this.wins = 0;
    this.seed = Math.random() * 3000;
    this.aiTimer = 0;
    this.aiMood = 0.5;
    this.aiBlockFor = 0;
    this.aiSeen = 0;
    this.aiAct = '';
    this.aiActTimer = 0;
    this.reset();
  }

  setLook(chIdx, palIdx) {
    this.chIdx = chIdx;
    this.char = CHARACTERS[chIdx];
    this.pal = PALETTES[palIdx];
  }

  reset() {
    this.x = this.startX;
    this.y = GROUND - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.startFacing;
    this.hp = MAX_HP;
    this.sp = 0;
    this.onGround = true;
    this.attackTimer = 0;   // > 0 : en train de frapper
    this.castTimer = 0;     // > 0 : en train de lancer son sort
    this.castFired = true;
    this.cooldown = 0;
    this.hitDone = false;
    this.hurtTimer = 0;
    this.blocking = false;
    this.koAngle = 0;
    this.win = false;
    this.aiBlockFor = 0;
    this.aiActTimer = 0;
  }

  get attackBox() {
    const range = 88;
    const x = this.facing === 1 ? this.x + this.w : this.x - range;
    return { x, y: this.y + 28, w: range, h: 52 };
  }

  readInput() {
    const c = this.controls;
    const on = (k) => !!(keys[k] || tapped[k]);
    return {
      left: on(c.left),
      right: on(c.right),
      up: on(c.up),
      attack: on(c.attack),
      block: on(c.block),
      special: on(c.special),
    };
  }

  // Petite IA : s'approche, frappe, pare, esquive les sorts, lance sa spéciale
  aiInput(dt, opp) {
    const inp = { left: false, right: false, up: false, attack: false, block: false, special: false };
    const myC = this.x + this.w / 2;
    const dx = (opp.x + opp.w / 2) - myC;
    const dist = Math.abs(dx);

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 10 + Math.random() * 20;
      this.aiMood = Math.random();
    }

    // Sort adverse qui arrive : parer ou sauter
    const inc = projectiles.find((p) => p.owner !== this && Math.sign(myC - p.x) === p.dir && Math.abs(p.x - myC) < 280);
    if (inc && inc.id !== this.aiSeen) {
      this.aiSeen = inc.id;
      this.aiAct = Math.random() < 0.55 ? 'block' : 'jump';
      this.aiActTimer = 30;
    }
    if (this.aiActTimer > 0) {
      this.aiActTimer -= dt;
      if (this.aiAct === 'block') inp.block = true;
      if (this.aiAct === 'jump') { inp.up = true; if (dx > 0) inp.right = false; }
    }

    if (this.aiActTimer <= 0) {
      if (dist > 95) {
        if (dx > 0) inp.right = true; else inp.left = true;
      } else if (this.aiMood < 0.15) {
        if (dx > 0) inp.left = true; else inp.right = true;
      }
      if (dist < 120 && this.cooldown <= 0 && Math.random() < 0.05 * dt) inp.attack = true;
      if (this.sp >= SP_MAX && dist > 170 && Math.random() < 0.08 * dt) inp.special = true;
      if (opp.attackTimer > 8 && dist < 140 && this.aiBlockFor <= 0 && Math.random() < 0.35) this.aiBlockFor = 18;
      if (Math.random() < 0.004 * dt) inp.up = true;
    }
    if (this.aiBlockFor > 0) { inp.block = true; this.aiBlockFor -= dt; }
    return inp;
  }

  update(dt, opponent, frozen) {
    const inp = frozen ? NO_INPUT : (this.isAI ? this.aiInput(dt, opponent) : this.readInput());
    const casting = this.castTimer > 0;
    const speed = this.char.speed;

    // Déplacement
    this.blocking = inp.block && this.onGround && !casting;
    if (casting) {
      this.vx = 0;
    } else if (this.hurtTimer <= 0 && !this.blocking) {
      if (inp.left && !inp.right) this.vx = -speed;
      else if (inp.right && !inp.left) this.vx = speed;
      else this.vx = 0;
    } else if (this.blocking) {
      this.vx = 0;
    } else {
      this.vx *= Math.pow(0.92, dt);     // recul quand on est touchée
    }

    // Saut
    if (inp.up && this.onGround && this.hurtTimer <= 0 && !this.blocking && !casting) {
      this.vy = -17;
      this.onGround = false;
      SFX.jump();
    }

    // Attaque
    if (inp.attack && this.cooldown <= 0 && this.hurtTimer <= 0 && !this.blocking && !casting) {
      this.attackTimer = 14;
      this.cooldown = 30;
      this.hitDone = false;
      SFX.swing();
    }

    // Attaque spéciale
    if (inp.special && this.sp >= SP_MAX && this.onGround && this.cooldown <= 0 &&
        this.hurtTimer <= 0 && !this.blocking && !casting && this.attackTimer <= 0) {
      this.castTimer = 26;
      this.castFired = false;
      this.cooldown = 45;
      this.sp = 0;
      SFX.special();
    }

    // Orientation vers l'adversaire
    if (this.attackTimer <= 0 && this.castTimer <= 0) {
      this.facing = opponent.x + opponent.w / 2 > this.x + this.w / 2 ? 1 : -1;
    }

    // Physique
    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND - this.h) {
      this.y = GROUND - this.h;
      this.vy = 0;
      this.onGround = true;
    }
    this.x = clamp(this.x, 0, W - this.w);

    // Timers
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.castTimer > 0) this.castTimer -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (!frozen) this.sp = Math.min(SP_MAX, this.sp + 0.025 * dt);
    if (this.hp <= 0) this.koAngle = Math.min(1.5, this.koAngle + 0.04 * dt);

    // Le sort part en milieu d'incantation
    if (!frozen && !this.castFired && this.castTimer <= 12) {
      this.castFired = true;
      spawnProjectile(this);
    }

    // Le coup touche à mi-animation
    if (!frozen && this.attackTimer > 0 && this.attackTimer < 9 && !this.hitDone) {
      this.hitDone = true;
      if (overlap(this.attackBox, opponent)) opponent.takeHit(this, this.char.power, this.facing, false);
    }
  }

  takeHit(attacker, dmg, dir, special) {
    const front = this.blocking && this.facing === -dir;
    this.hp = Math.max(0, this.hp - (front ? Math.ceil(dmg * 0.2) : dmg));
    this.vx = dir * (front ? 3 : special ? 12 : 9);
    if (!front) {
      this.hurtTimer = special ? 20 : 14;
      this.vy = -5;
      this.onGround = false;
      this.attackTimer = 0;
      this.castTimer = 0;
      this.castFired = true;
    }
    attacker.sp = Math.min(SP_MAX, attacker.sp + (front ? 4 : 12));
    this.sp = Math.min(SP_MAX, this.sp + (front ? 2 : 6));

    const px = this.x + this.w / 2 - dir * 8;
    const py = this.y + 52;
    burst(px, py, attacker.pal, front ? 4 : special ? 14 : 9);
    sparks.push({ x: px, y: py, life: 16, max: 16, big: special, color: attacker.pal.accent });
    hitstop = front ? 3 : special ? 9 : 6;
    shake = front ? 2 : special ? 11 : 6;
    if (front) SFX.block(); else SFX.hit();
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function poseOf(f, now) {
  const t = now + f.seed;
  const hurt = f.hurtTimer > 0;
  return {
    t,
    moving: Math.abs(f.vx) > 0.5 && f.onGround && !hurt && f.hp > 0 && f.castTimer <= 0,
    air: !f.onGround,
    vy: f.vy,
    atk: f.attackTimer > 0 ? 1 - f.attackTimer / 14 : null,
    cast: f.castTimer > 0 ? 1 - f.castTimer / 26 : null,
    hurt,
    flash: hurt && Math.floor(f.hurtTimer) % 4 < 2,
    block: f.blocking,
    ko: f.koAngle,
    win: f.win,
    blink: (t % 3400) < 140,
  };
}

// Dessine une combattante : cx = centre, footY = pieds, groundY = sol
function drawFighterAt(c, f, cx, footY, groundY, scale, now) {
  const air = Math.max(0, groundY - footY);
  c.save();
  c.fillStyle = `rgba(0,0,0,${0.32 * clamp(1 - air / 260, 0.3, 1)})`;
  c.beginPath();
  c.ellipse(cx, groundY + 4, 32 * scale * clamp(1 - air / 400, 0.5, 1), 8 * scale, 0, 0, TAU);
  c.fill();
  c.translate(cx, footY);
  c.scale(scale * f.facing, scale);
  renderCharacter(c, f.char, f.pal, poseOf(f, now));
  c.restore();
}

const fighters = [
  new Fighter(160, 1, { left: 'KeyA', right: 'KeyD', up: 'KeyW', attack: 'KeyF', block: 'KeyG', special: 'KeyH' }),
  new Fighter(W - 214, -1, { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', attack: 'KeyL', block: 'KeyK', special: 'KeyJ' }),
];

function separate() {
  const [a, b] = fighters;
  if (Math.abs(a.y - b.y) < 70 && overlap(a, b)) {
    const push = (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2;
    const dir = a.x < b.x ? -1 : 1;
    a.x = clamp(a.x + dir * push, 0, W - a.w);
    b.x = clamp(b.x - dir * push, 0, W - b.w);
  }
}

// ---------------------------------------------------------------
// État de la partie
// ---------------------------------------------------------------
let state = 'menu';   // menu | intro | fight | paused | ko | over
let round = 1;
let timeLeft = ROUND_TIME;
let introTimer = 0;
let introSfx = 0;
let koTimer = 0;
let koText = '';
let winner = null;

const menuEl = $('menu');
const gameWrap = $('gameWrap');
const pauseOverlay = $('pauseOverlay');
const overOverlay = $('overOverlay');
const helpEl = $('help');

function show(el, on) { el.hidden = !on; }

function showMenu() {
  state = 'menu';
  for (const k in keys) keys[k] = false;
  particles.length = 0; sparks.length = 0; projectiles.length = 0;
  show(menuEl, true);
  show(gameWrap, false);
  show(pauseOverlay, false);
  show(overOverlay, false);
  refreshMenu();
}

function startRoundIntro() {
  fighters.forEach((f) => f.reset());
  particles.length = 0; sparks.length = 0; projectiles.length = 0;
  hitstop = 0; shake = 0;
  timeLeft = ROUND_TIME;
  winner = null;
  introTimer = 110;
  introSfx = 0;
  state = 'intro';
  show(pauseOverlay, false);
  show(overOverlay, false);
}

function startMatch() {
  fighters.forEach((f) => { f.wins = 0; });
  round = 1;
  startRoundIntro();
}

function pause() {
  if (state !== 'fight') return;
  state = 'paused';
  show(pauseOverlay, true);
}

function resume() {
  if (state !== 'paused') return;
  state = 'fight';
  show(pauseOverlay, false);
}

function applySettings() {
  const cpu = settings.mode === 'cpu';
  fighters.forEach((f, i) => {
    const pl = settings.players[i];
    f.setLook(pl.ch, pl.pal);
    f.isAI = i === 1 && cpu;
    f.name = f.isAI ? f.char.label : pl.name.trim();
    f.wins = 0;
  });
}

function endRound() {
  const [a, b] = fighters;
  timeLeft = Math.max(0, timeLeft);
  if (a.hp > b.hp) winner = a;
  else if (b.hp > a.hp) winner = b;
  else winner = null;
  if (winner) winner.wins++;
  koText = (a.hp <= 0 || b.hp <= 0) ? 'K.O. ♥' : 'Temps écoulé !';
  koTimer = 130;
  state = 'ko';
  projectiles.length = 0;
  SFX.ko();
}

function showResult() {
  const [a, b] = fighters;
  const champ = a.wins > b.wins ? a : b;
  state = 'over';
  champ.win = true;
  $('overTitle').textContent = `${champ.name} gagne le match ! ♥`;
  $('overScore').textContent = `${a.name}  ${a.wins} – ${b.wins}  ${b.name}`;
  show(overOverlay, true);
  SFX.win();
}

// ---------------------------------------------------------------
// Menu
// ---------------------------------------------------------------
const ui = { panels: [] };
const previews = [];
const modeBtns = document.querySelectorAll('[data-mode]');

function setActive(list, idx) {
  list.forEach((b, j) => b.classList.toggle('active', j === idx));
}

function makeField(labelText, parent) {
  const l = document.createElement('div');
  l.className = 'field-label';
  l.textContent = labelText;
  parent.appendChild(l);
}

function refreshPanel(i) {
  const pl = settings.players[i];
  const ch = CHARACTERS[pl.ch];
  const pn = ui.panels[i];
  previews[i].setLook(pl.ch, pl.pal);
  pn.cname.textContent = ch.label;
  pn.role.textContent = ch.role;
  pn.special.textContent = `✦ Spéciale : ${ch.special}`;
  pn.stats.innerHTML = '';
  Object.entries(ch.stats).forEach(([k, v]) => {
    const lab = document.createElement('span');
    lab.textContent = k;
    const bar = document.createElement('span');
    bar.className = 'stat-bar';
    for (let n = 1; n <= 5; n++) {
      const seg = document.createElement('i');
      if (n <= v) seg.className = 'on';
      bar.appendChild(seg);
    }
    pn.stats.append(lab, bar);
  });
  setActive(pn.swatches, pl.pal);
  if (i === 1 && settings.mode === 'cpu') pn.input.value = ch.label;
}

function buildPanels() {
  const host = $('panels');
  host.innerHTML = '';
  settings.players.forEach((pl, i) => {
    const prevFighter = new Fighter(0, 1, {});
    previews.push(prevFighter);

    const sec = document.createElement('section');
    sec.className = 'panel';

    const title = document.createElement('h3');
    sec.appendChild(title);

    const pick = document.createElement('div');
    pick.className = 'pick';
    const left = document.createElement('button');
    left.type = 'button'; left.className = 'arrow'; left.textContent = '◀';
    left.setAttribute('aria-label', 'Personnage précédent');
    const prev = document.createElement('canvas');
    prev.className = 'preview';
    prev.width = 200; prev.height = 250;
    prev.title = "Clique pour voir ses attaques";
    const right = document.createElement('button');
    right.type = 'button'; right.className = 'arrow'; right.textContent = '▶';
    right.setAttribute('aria-label', 'Personnage suivant');
    pick.append(left, prev, right);
    sec.appendChild(pick);

    const cname = document.createElement('div'); cname.className = 'char-name';
    const role = document.createElement('div'); role.className = 'char-role';
    const special = document.createElement('div'); special.className = 'char-special';
    const stats = document.createElement('div'); stats.className = 'stats';
    sec.append(cname, role, special, stats);

    const change = (d) => {
      pl.ch = (pl.ch + d + CHARACTERS.length) % CHARACTERS.length;
      refreshPanel(i);
    };
    left.addEventListener('click', () => change(-1));
    right.addEventListener('click', () => change(1));
    prev.addEventListener('click', () => {
      if (Math.random() < 0.5) { prevFighter.attackTimer = 14; SFX.swing(); }
      else { prevFighter.castTimer = 26; SFX.special(); }
    });

    makeField('Nom du personnage', sec);
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = 'Ex : Luna';
    input.autocomplete = 'off';
    input.value = pl.name;
    input.addEventListener('input', () => {
      pl.name = input.value;
      input.classList.remove('error');
      $('menuError').textContent = '';
    });
    sec.appendChild(input);

    makeField('Couleur', sec);
    const sw = document.createElement('div');
    sw.className = 'swatches';
    const swatches = PALETTES.map((p, j) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.title = p.label;
      b.setAttribute('aria-label', p.label);
      b.style.background = `linear-gradient(135deg, ${p.hair} 50%, ${p.dress} 50%)`;
      b.addEventListener('click', () => { pl.pal = j; refreshPanel(i); });
      sw.appendChild(b);
      return b;
    });
    sec.appendChild(sw);

    host.appendChild(sec);
    ui.panels.push({ title, prev, input, cname, role, special, stats, swatches });
    refreshPanel(i);
  });
}

function refreshMenu() {
  const cpu = settings.mode === 'cpu';
  modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === settings.mode));

  ui.panels[0].title.textContent = 'Joueuse 1';
  const p2 = ui.panels[1];
  p2.input.disabled = cpu;
  p2.input.value = cpu ? CHARACTERS[settings.players[1].ch].label : settings.players[1].name;
  p2.input.classList.remove('error');
  p2.title.textContent = cpu ? 'Ordinateur' : 'Joueuse 2';

  $('menuError').textContent = '';
  $('soundBtn').textContent = settings.sound ? '🔊 Son' : '🔇 Muet';

  const k1 = '<strong>Joueuse 1</strong> : <kbd>Z</kbd><kbd>Q</kbd><kbd>D</kbd> (ou W/A/D) bouger et sauter · <kbd>F</kbd> frapper · <kbd>G</kbd> parer · <kbd>H</kbd> spéciale';
  const k2 = '<strong>Joueuse 2</strong> : flèches bouger et sauter · <kbd>L</kbd> frapper · <kbd>K</kbd> parer · <kbd>J</kbd> spéciale';
  helpEl.innerHTML = (cpu ? k1 : `${k1}<br>${k2}`) +
    '<br>La jauge ✦ se remplit en combattant : quand elle est pleine, lance ta spéciale !' +
    '<br><kbd>P</kbd> pause · <kbd>Entrée</kbd> valider · 3 manches, la première à 2 victoires gagne';
}

function tryStart() {
  if (state !== 'menu') return;
  const needed = settings.mode === 'cpu' ? [0] : [0, 1];
  const missing = needed.filter((i) => !settings.players[i].name.trim());
  if (missing.length) {
    missing.forEach((i) => ui.panels[i].input.classList.add('error'));
    $('menuError').textContent = missing.length > 1
      ? 'Donne un nom à tes deux personnages avant de jouer ✿'
      : 'Donne un nom à ton personnage avant de jouer ✿';
    ui.panels[missing[0]].input.focus();
    return;
  }
  saveSettings();
  applySettings();
  show(menuEl, false);
  show(gameWrap, true);
  startMatch();
}

function drawPreview(i, now, dt) {
  const f = previews[i];
  const cv = ui.panels[i].prev;
  const c = cv.getContext('2d');
  f.attackTimer = Math.max(0, f.attackTimer - dt);
  f.castTimer = Math.max(0, f.castTimer - dt);
  c.clearRect(0, 0, cv.width, cv.height);
  const g = c.createRadialGradient(cv.width / 2, cv.height * 0.45, 10, cv.width / 2, cv.height * 0.45, cv.width * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(155,93,229,0.04)');
  c.fillStyle = g;
  c.fillRect(0, 0, cv.width, cv.height);
  drawFighterAt(c, f, cv.width / 2 - 6, cv.height - 26, cv.height - 26, 1.3, now);
}

// ---------------------------------------------------------------
// Décor
// ---------------------------------------------------------------
const stars = Array.from({ length: 80 }, (_, i) => ({
  x: (i * 137.5) % W,
  y: (i * 71.3) % (GROUND - 120),
  r: 0.8 + (i % 3) * 0.7,
  t: i * 0.7,
}));
const sparkles = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 211) % W, y: 120 + ((i * 97) % 330), s: 0.15 + (i % 4) * 0.06, t: i,
}));
const flowers = Array.from({ length: 26 }, (_, i) => ({ x: 20 + i * 37 + (i % 3) * 6, c: i % 2 }));

function sparkle4(x, y, r, a) {
  ctx.globalAlpha = a;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCastle(x, base) {
  ctx.fillStyle = '#3a2a86';
  ctx.fillRect(x - 70, base - 90, 140, 90);
  for (const [tx, h] of [[-80, 150], [-30, 190], [30, 170], [80, 140]]) {
    ctx.fillRect(x + tx - 18, base - h, 36, h);
    polygon(ctx, [[x + tx - 24, base - h], [x + tx + 24, base - h], [x + tx, base - h - 38]], '#4b34a8', null);
  }
  ctx.fillStyle = 'rgba(255,230,150,0.85)';
  for (const [tx, ty] of [[-30, 150], [30, 130], [-80, 110], [80, 100], [0, 70], [-45, 60], [45, 60]]) {
    ctx.fillRect(x + tx - 3, base - ty, 6, 11);
  }
}

function drawBackground(now) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#150f4d');
  g.addColorStop(0.5, '#4d37a8');
  g.addColorStop(0.85, '#6c78f0');
  g.addColorStop(1, '#58a0ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(now / 700 + s.t));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }

  // Lune avec halo
  const mx = W - 170, my = 120;
  const halo = ctx.createRadialGradient(mx, my, 30, mx, my, 150);
  halo.addColorStop(0, 'rgba(255,240,255,0.5)');
  halo.addColorStop(1, 'rgba(255,240,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(mx, my, 150, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f7f0ff';
  ctx.beginPath(); ctx.arc(mx, my, 52, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e2d4ff';
  for (const [dx, dy, r] of [[-14, -10, 9], [14, 12, 12], [-8, 22, 6]]) {
    ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill();
  }

  // Nuages qui dérivent
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  for (const [bx, cy, sp] of [[100, 190, 0.012], [520, 140, 0.008], [800, 260, 0.016], [320, 300, 0.01]]) {
    const cx = ((bx + now * sp) % (W + 240)) - 120;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, TAU);
    ctx.arc(cx + 34, cy + 6, 25, 0, TAU);
    ctx.arc(cx - 34, cy + 8, 23, 0, TAU);
    ctx.fill();
  }

  // Collines lointaines + château
  ctx.fillStyle = '#35278a';
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.quadraticCurveTo(160, GROUND - 130, 340, GROUND - 40);
  ctx.quadraticCurveTo(520, GROUND - 150, 720, GROUND - 50);
  ctx.quadraticCurveTo(860, GROUND - 120, W, GROUND - 30);
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();
  drawCastle(240, GROUND - 60);

  // Collines proches
  ctx.fillStyle = '#4a3cb0';
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.quadraticCurveTo(220, GROUND - 60, 460, GROUND - 14);
  ctx.quadraticCurveTo(700, GROUND - 70, W, GROUND - 10);
  ctx.lineTo(W, GROUND); ctx.closePath(); ctx.fill();

  // Sol
  const gg = ctx.createLinearGradient(0, GROUND, 0, H);
  gg.addColorStop(0, '#9a86ff');
  gg.addColorStop(1, '#3a2a8a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  for (let i = -6; i <= 16; i++) {
    ctx.beginPath(); ctx.moveTo(W / 2 + (i - 5) * 30, GROUND + 2); ctx.lineTo(W / 2 + (i - 5) * 95, H); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillRect(0, GROUND, W, 3);

  // Fleurs au bord du sol
  for (const f of flowers) {
    ctx.fillStyle = f.c ? '#ffb3f0' : '#bfe0ff';
    for (let k = 0; k < 5; k++) {
      const a = (k * TAU) / 5;
      ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 3.5, GROUND + 12 + Math.sin(a) * 3.5, 2.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath(); ctx.arc(f.x, GROUND + 12, 2, 0, TAU); ctx.fill();
  }

  // Paillettes qui flottent
  ctx.fillStyle = '#fff';
  for (const s of sparkles) {
    const y = ((s.y - now * s.s) % 360 + 360) % 360 + 100;
    sparkle4(s.x, y, 5 + 2 * Math.sin(now / 300 + s.t), 0.35 + 0.35 * Math.sin(now / 500 + s.t));
  }
}

// ---------------------------------------------------------------
// Interface en jeu (barres, portraits, minuteur)
// ---------------------------------------------------------------
function drawPortrait(f, cx, cy, r, flip, now) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const g = ctx.createRadialGradient(cx, cy - 6, 4, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, f.pal.hairLight);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const k = r / 34;
  ctx.translate(cx, cy + 92 * k + 2);
  ctx.scale(k * (flip ? -1 : 1), k);
  const pose = poseOf(f, now);
  pose.moving = false; pose.air = false; pose.atk = null; pose.cast = null; pose.block = false; pose.ko = 0; pose.vy = 0;
  pose.win = false;
  renderCharacter(ctx, f.char, f.pal, pose);
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = f.pal.bar2;
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, TAU); ctx.stroke();
}

function drawBars(f, side, now) {
  const left = side === 'left';
  const bx = left ? 92 : W - 92 - 360;
  const px = left ? 50 : W - 50;
  const bw = 360, bh = 24, y = 20;

  roundRectPath(ctx, bx, y, bw, bh, 12);
  ctx.fillStyle = 'rgba(20,10,50,0.72)';
  ctx.fill();
  const w = Math.max(0, bw * (f.hp / MAX_HP));
  if (w > 0) {
    const x0 = left ? bx : bx + bw - w;
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, f.pal.bar1);
    g.addColorStop(1, f.pal.bar2);
    ctx.save();
    roundRectPath(ctx, bx, y, bw, bh, 12);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, w, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x0, y + 3, w, 6);
    ctx.restore();
  }
  roundRectPath(ctx, bx, y, bw, bh, 12);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Jauge spéciale
  const sw = 240, sh = 10, sy = 52;
  const sx = left ? bx : bx + bw - sw;
  roundRectPath(ctx, sx, sy, sw, sh, 5);
  ctx.fillStyle = 'rgba(20,10,50,0.72)';
  ctx.fill();
  const full = f.sp >= SP_MAX;
  const spw = sw * (f.sp / SP_MAX);
  if (spw > 0) {
    ctx.save();
    roundRectPath(ctx, sx, sy, sw, sh, 5);
    ctx.clip();
    ctx.fillStyle = full ? `hsl(${(now / 4) % 360},100%,75%)` : '#ffd86b';
    ctx.fillRect(left ? sx : sx + sw - spw, sy, spw, sh);
    ctx.restore();
  }
  roundRectPath(ctx, sx, sy, sw, sh, 5);
  ctx.strokeStyle = full ? '#fff' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (full) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = left ? 'left' : 'right';
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 110);
    const msg = `✦ SPÉCIALE PRÊTE ! (${left ? 'H' : 'J'})`;
    const mx = left ? bx + 62 : bx + bw - 62;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(60,30,130,0.9)';
    ctx.strokeText(msg, mx, 104);
    ctx.fillText(msg, mx, 104);
    ctx.globalAlpha = 1;
  }

  // Nom + manches gagnées
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = left ? 'left' : 'right';
  ctx.strokeStyle = 'rgba(60,30,130,0.85)';
  ctx.lineWidth = 4;
  const label = f.name.toLowerCase() === f.char.label.toLowerCase() ? f.name : `${f.name} · ${f.char.label}`;
  ctx.strokeText(label, left ? bx : bx + bw, 84);
  ctx.fillText(label, left ? bx : bx + bw, 84);
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    const hx = left ? bx + 4 + i * 22 : bx + bw - 4 - i * 22;
    ctx.save();
    ctx.translate(hx, 100);
    heartPath(ctx, 1.1);
    ctx.fillStyle = i < f.wins ? '#ff6fb8' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  drawPortrait(f, px, 52, 34, !left, now);
}

function bannerText(text, y, size, color = '#fff') {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(80,30,160,0.9)';
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}

function drawHUD(now) {
  drawBars(fighters[0], 'left', now);
  drawBars(fighters[1], 'right', now);

  // Minuteur
  ctx.beginPath(); ctx.arc(W / 2, 48, 32, 0, TAU);
  ctx.fillStyle = 'rgba(20,10,60,0.8)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = timeLeft < 10 ? '#ff8fc7' : '#fff';
  ctx.stroke();
  ctx.fillStyle = timeLeft < 10 ? '#ffc2e6' : '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.ceil(timeLeft)), W / 2, 59);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = '#d9c2ff';
  ctx.fillText(`MANCHE ${round}`, W / 2, 98);
}

function drawNameTag(f) {
  if (f.hp <= 0) return;
  const x = f.x + f.w / 2;
  const y = f.y - 14 - (f.onGround ? 0 : 0);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(60,30,130,0.85)';
  ctx.strokeText(f.name, x, y - 22);
  ctx.fillStyle = '#fff';
  ctx.fillText(f.name, x, y - 22);
  ctx.fillStyle = f.pal.accent;
  polygon(ctx, [[x - 5, y - 16], [x + 5, y - 16], [x, y - 8]], f.pal.accent, null);
}

function draw(now, dt) {
  if (state === 'menu') {
    ui.panels.forEach((_, i) => drawPreview(i, now, dt));
    return;
  }
  ctx.save();
  if (shake > 0.2) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
  drawBackground(now);
  fighters.forEach((f) => drawFighterAt(ctx, f, f.x + f.w / 2, f.y + f.h, GROUND, 1, now));
  drawProjectiles();
  drawEffects();
  if (state !== 'ko' && state !== 'over') fighters.forEach(drawNameTag);
  ctx.restore();

  drawHUD(now);

  if (state === 'intro') {
    if (introTimer > 55) bannerText(`Manche ${round}`, H / 2 - 10, 72, '#ffd9f5');
    else bannerText('Combat !', H / 2 - 10, 88, '#fff7a8');
  } else if (state === 'ko') {
    bannerText(koText, H / 2 - 10, 84, '#ffd9f5');
  }
}

// ---------------------------------------------------------------
// Mise à jour
// ---------------------------------------------------------------
function update(dt) {
  updateEffects(dt);

  if (state === 'intro') {
    fighters.forEach((f) => f.update(dt, f === fighters[0] ? fighters[1] : fighters[0], true));
    introTimer -= dt;
    if (introSfx === 0) { introSfx = 1; SFX.tick(); }
    if (introSfx === 1 && introTimer <= 55) { introSfx = 2; SFX.go(); }
    if (introTimer <= 0) state = 'fight';
    return;
  }

  if (state === 'fight') {
    if (hitstop > 0) { hitstop -= dt; return; }
    fighters[0].update(dt, fighters[1], false);
    fighters[1].update(dt, fighters[0], false);
    updateProjectiles(dt);
    separate();
    timeLeft -= dt / 60;
    if (fighters[0].hp <= 0 || fighters[1].hp <= 0 || timeLeft <= 0) endRound();
    return;
  }

  if (state === 'ko') {
    const slow = dt * 0.4;
    fighters[0].update(slow, fighters[1], true);
    fighters[1].update(slow, fighters[0], true);
    koTimer -= dt;
    if (koTimer < 90 && winner) winner.win = true;
    if (koTimer <= 0) {
      if (fighters.some((f) => f.wins >= ROUNDS_TO_WIN)) showResult();
      else { if (winner) round++; startRoundIntro(); }
    }
    return;
  }

  if (state === 'over') {
    fighters.forEach((f) => f.update(dt, f === fighters[0] ? fighters[1] : fighters[0], true));
  }
}

// Boucle de jeu : vitesse identique quel que soit l'écran (60 Hz, 144 Hz...)
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / (1000 / 60), 3);
  last = now;
  update(dt);
  for (const k in tapped) delete tapped[k];
  draw(now, dt);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------
modeBtns.forEach((b) => b.addEventListener('click', () => {
  settings.mode = b.dataset.mode;
  refreshMenu();
  refreshPanel(1);
}));
$('playBtn').addEventListener('click', tryStart);
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', startMatch);
$('pauseMenuBtn').addEventListener('click', showMenu);
$('rematchBtn').addEventListener('click', startMatch);
$('overMenuBtn').addEventListener('click', showMenu);
$('pauseBtn').addEventListener('click', pause);
$('quitBtn').addEventListener('click', showMenu);
$('soundBtn').addEventListener('click', () => {
  settings.sound = !settings.sound;
  $('soundBtn').textContent = settings.sound ? '🔊 Son' : '🔇 Muet';
  saveSettings();
});
// Évite qu'un bouton garde le focus (sinon Entrée/Espace le re-déclenche)
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) b.blur();
});

loadSettings();
buildPanels();
showMenu();
requestAnimationFrame(loop); 
