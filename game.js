// Mini Fight Kawaii - jeu de combat en local (HTML5 canvas, JS pur)
// Menu : nom du personnage, couleur, accessoire, mode 2 joueuses / contre l'ordi.

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const TAU = Math.PI * 2;

const GROUND = H - 70;
const GRAVITY = 0.8;
const ROUND_TIME = 60;   // secondes
const MAX_HP = 100;
const CPU_NAME = 'Mochi';
const STORAGE_KEY = 'minifight.settings.v1';

const SKIN = '#ffe6dc';
const EYE = '#2b1b4d';

// ---------------------------------------------------------------
// Looks disponibles
// ---------------------------------------------------------------
const PALETTES = [
  { label: 'Violet',   hair: '#9b5de5', hairDark: '#7b3fc4', dress: '#c9a2ff', dressDark: '#a77be8', accent: '#ff9be8', bar1: '#c77dff', bar2: '#7b2ff7' },
  { label: 'Bleu ciel', hair: '#4cc9f0', hairDark: '#2fa6d4', dress: '#9ad8ff', dressDark: '#6bb8f2', accent: '#b5a7ff', bar1: '#4cc9f0', bar2: '#3a5bff' },
  { label: 'Indigo',   hair: '#5d6cff', hairDark: '#4350d6', dress: '#a9b4ff', dressDark: '#7f8cf0', accent: '#ffb3f0', bar1: '#7b8cff', bar2: '#3a2fd6' },
  { label: 'Lilas',    hair: '#c49bff', hairDark: '#a070e6', dress: '#e6d4ff', dressDark: '#c9aef5', accent: '#8fd3ff', bar1: '#e0b3ff', bar2: '#9b6bff' },
];

const ACCESSORIES = [
  { id: 'bow',  label: 'Nœud' },
  { id: 'cat',  label: 'Oreilles de chat' },
  { id: 'star', label: 'Étoiles' },
];

// ---------------------------------------------------------------
// Réglages (sauvegardés dans le navigateur)
// ---------------------------------------------------------------
const settings = {
  mode: '2p',
  players: [
    { name: '', pal: 0, acc: 0 },
    { name: '', pal: 1, acc: 1 },
  ],
};

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!s) return;
    if (s.mode === '2p' || s.mode === 'cpu') settings.mode = s.mode;
    if (Array.isArray(s.players)) {
      s.players.slice(0, 2).forEach((p, i) => {
        if (typeof p.name === 'string') settings.players[i].name = p.name.slice(0, 12);
        if (Number.isInteger(p.pal) && PALETTES[p.pal]) settings.players[i].pal = p.pal;
        if (Number.isInteger(p.acc) && ACCESSORIES[p.acc]) settings.players[i].acc = p.acc;
      });
    }
  } catch (e) { /* stockage indisponible : on ignore */ }
}

function saveSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------
// Clavier
// ---------------------------------------------------------------
const keys = {};
const NO_INPUT = { left: false, right: false, up: false, attack: false, block: false };

addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT') {            // on est en train d'écrire un nom
    if (e.code === 'Enter') tryStart();
    return;
  }
  if (tag === 'BUTTON' && (e.code === 'Enter' || e.code === 'Space')) return; // le clic gère

  if ((state === 'fight' || state === 'paused') && (e.code.startsWith('Arrow') || e.code === 'Space')) {
    e.preventDefault();
  }
  keys[e.code] = true;
  if (e.repeat) return;

  if (e.code === 'Enter') {
    if (state === 'menu') tryStart();
    else if (state === 'over') startRound();
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
// Dessin
// ---------------------------------------------------------------
function drawStar(c, x, y, r, fill, stroke) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = stroke;
  c.stroke();
}

function triangle(c, x1, y1, x2, y2, x3, y3) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.lineTo(x3, y3);
  c.closePath();
  c.fill();
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------
// Particules (cœurs et étoiles quand on est touchée)
// ---------------------------------------------------------------
const particles = [];

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

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.vy += 0.25 * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  ctx.textAlign = 'center';
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.font = `${p.size}px system-ui, sans-serif`;
    ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.globalAlpha = 1;
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
    this.pal = PALETTES[0];
    this.acc = 'bow';
    this.isAI = false;
    this.w = 50;
    this.h = 110;
    this.wins = 0;
    this.aiTimer = 0;
    this.aiMood = 0.5;
    this.aiBlockFor = 0;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = GROUND - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.startFacing;
    this.hp = MAX_HP;
    this.onGround = true;
    this.attackTimer = 0;   // > 0 : en train de frapper
    this.cooldown = 0;
    this.hitDone = false;
    this.hurtTimer = 0;
    this.blocking = false;
    this.aiBlockFor = 0;
  }

  get attackBox() {
    const range = 70;
    const x = this.facing === 1 ? this.x + this.w : this.x - range;
    return { x, y: this.y + 20, w: range, h: 35 };
  }

  readInput() {
    const c = this.controls;
    return {
      left: !!keys[c.left],
      right: !!keys[c.right],
      up: !!keys[c.up],
      attack: !!keys[c.attack],
      block: !!keys[c.block],
    };
  }

  // Petite IA : s'approche, frappe, pare parfois
  aiInput(dt, opp) {
    const inp = { left: false, right: false, up: false, attack: false, block: false };
    const dx = (opp.x + opp.w / 2) - (this.x + this.w / 2);
    const dist = Math.abs(dx);

    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 10 + Math.random() * 20;
      this.aiMood = Math.random();
    }

    if (dist > 95) {
      if (dx > 0) inp.right = true; else inp.left = true;
    } else if (this.aiMood < 0.15) {            // recule un peu
      if (dx > 0) inp.left = true; else inp.right = true;
    }

    if (dist < 115 && this.cooldown <= 0 && Math.random() < 0.05 * dt) inp.attack = true;

    if (opp.attackTimer > 8 && dist < 135 && this.aiBlockFor <= 0 && Math.random() < 0.35) {
      this.aiBlockFor = 18;
    }
    if (this.aiBlockFor > 0) {
      inp.block = true;
      this.aiBlockFor -= dt;
    }

    if (Math.random() < 0.004 * dt) inp.up = true;
    return inp;
  }

  update(dt, opponent, frozen) {
    const inp = frozen ? NO_INPUT : (this.isAI ? this.aiInput(dt, opponent) : this.readInput());

    // Déplacement
    const speed = 6;
    this.blocking = inp.block && this.onGround;
    if (this.hurtTimer <= 0 && !this.blocking) {
      if (inp.left && !inp.right) this.vx = -speed;
      else if (inp.right && !inp.left) this.vx = speed;
      else this.vx = 0;
    } else if (this.blocking) {
      this.vx = 0;
    }

    // Saut
    if (inp.up && this.onGround && this.hurtTimer <= 0 && !this.blocking) {
      this.vy = -16;
      this.onGround = false;
    }

    // Attaque
    if (inp.attack && this.cooldown <= 0 && this.hurtTimer <= 0 && !this.blocking) {
      this.attackTimer = 14;
      this.cooldown = 30;
      this.hitDone = false;
    }

    // Orientation vers l'adversaire
    if (this.attackTimer <= 0) {
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
    this.x = Math.max(0, Math.min(W - this.w, this.x));

    // Timers
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;

    // Touche l'adversaire à mi-animation
    if (!frozen && this.attackTimer > 0 && this.attackTimer < 9 && !this.hitDone) {
      this.hitDone = true;
      if (overlap(this.attackBox, opponent)) opponent.takeHit(this);
    }
  }

  takeHit(attacker) {
    const blockedFront = this.blocking && this.facing === -attacker.facing;
    const dmg = blockedFront ? 2 : 10;
    this.hp = Math.max(0, this.hp - dmg);
    this.vx = attacker.facing * (blockedFront ? 3 : 9);
    if (!blockedFront) {
      this.hurtTimer = 14;
      this.vy = -5;
      this.onGround = false;
    }
    burst(this.x + this.w / 2, this.y + 40, attacker.pal, blockedFront ? 4 : 9);
  }

  // target : contexte de dessin (le jeu ou l'aperçu du menu)
  draw(target = ctx, groundY = GROUND) {
    const ctx = target;
    const pal = this.pal;
    const f = this.facing;
    const cx = this.x + this.w / 2;
    const now = performance.now();
    const hurt = this.hurtTimer > 0;
    const flash = hurt && Math.floor(this.hurtTimer) % 4 < 2;
    const attacking = this.attackTimer > 0;
    const idle = this.onGround && this.vx === 0 && !attacking;
    const bob = idle ? Math.sin(now / 220) * 2 : 0;
    const top = this.y + bob;
    const headY = top + 36;

    const skin = flash ? '#fff' : SKIN;
    const hair = flash ? '#fff' : pal.hair;
    const hairDark = flash ? '#fff' : pal.hairDark;
    const dress = flash ? '#fff' : pal.dress;
    const dressDark = flash ? '#fff' : pal.dressDark;
    const accent = flash ? '#fff' : pal.accent;

    ctx.save();
    ctx.lineCap = 'round';

    // Ombre
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 4, 30, 8, 0, 0, TAU);
    ctx.fill();

    // Couettes (derrière la tête)
    ctx.fillStyle = hairDark;
    for (const s of [-1, 1]) {
      const sway = Math.sin(now / 300 + s) * 2 - this.vx * 0.6;
      ctx.beginPath();
      ctx.ellipse(cx + s * 31 + sway, top + 56, 9, 21, s * 0.25, 0, TAU);
      ctx.fill();
    }

    // Oreilles de chat (derrière la tête)
    if (this.acc === 'cat') {
      for (const s of [-1, 1]) {
        ctx.fillStyle = hair;
        triangle(ctx, cx + s * 8, top + 10, cx + s * 31, top + 22, cx + s * 27, top - 9);
        ctx.fillStyle = accent;
        triangle(ctx, cx + s * 13, top + 10, cx + s * 26, top + 17, cx + s * 25, top - 1);
      }
    }

    // Jambes + chaussures (petites et rondes)
    ctx.fillStyle = skin;
    ctx.fillRect(cx - 11, top + 96, 8, 10);
    ctx.fillRect(cx + 3, top + 96, 8, 10);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(cx - 7 + f * 2, top + 107, 8, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 7 + f * 2, top + 107, 8, 5, 0, 0, TAU); ctx.fill();

    // Robe
    ctx.fillStyle = dress;
    triangle(ctx, cx - 10, top + 66, cx + 10, top + 66, cx + 23, top + 98);
    triangle(ctx, cx - 10, top + 66, cx + 23, top + 98, cx - 23, top + 98);
    ctx.fillStyle = dressDark;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 9.2, top + 98, 5, 0, Math.PI);
      ctx.fill();
    }
    // Petit nœud sur la robe
    ctx.fillStyle = accent;
    triangle(ctx, cx, top + 72, cx - 8, top + 67, cx - 8, top + 77);
    triangle(ctx, cx, top + 72, cx + 8, top + 67, cx + 8, top + 77);

    // Main arrière
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(cx - f * 17, top + 80, 5.5, 0, TAU); ctx.fill();

    // Grosse tête
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(cx, headY, 31, 0, TAU); ctx.fill();

    // Cheveux : calotte + frange + mèches sur les côtés
    ctx.fillStyle = hair;
    ctx.beginPath(); ctx.arc(cx, headY, 32, Math.PI, TAU); ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * 11, headY - 10, 8, 13 - Math.abs(i), 0, 0, TAU);
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * 28, headY + 8, 5, 14, 0, 0, TAU);
      ctx.fill();
    }

    // Accessoire : nœud ou étoiles
    const ax = cx - f * 22;
    const ay = top + 10;
    if (this.acc === 'bow') {
      ctx.fillStyle = accent;
      triangle(ctx, ax, ay, ax - 12, ay - 9, ax - 12, ay + 9);
      triangle(ctx, ax, ay, ax + 12, ay - 9, ax + 12, ay + 9);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ax, ay, 3.8, 0, TAU); ctx.fill();
    } else if (this.acc === 'star') {
      drawStar(ctx, ax, ay, 11, flash ? '#fff' : '#fff7a8', accent);
      drawStar(ctx, ax + f * -8, ay + 16, 6, flash ? '#fff' : '#fff7a8', accent);
    }

    // Joues roses
    ctx.fillStyle = 'rgba(255,120,170,0.55)';
    ctx.beginPath(); ctx.ellipse(cx - 19 + f * 2, headY + 14, 6.5, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 19 + f * 2, headY + 14, 6.5, 4, 0, 0, TAU); ctx.fill();

    // Yeux
    const ex = cx + f * 3;
    if (hurt) {
      ctx.strokeStyle = EYE;
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        const x = ex + s * 11;
        ctx.beginPath();
        ctx.moveTo(x - s * 5, headY - 2);
        ctx.lineTo(x + s * 5, headY + 4);
        ctx.lineTo(x - s * 5, headY + 10);
        ctx.stroke();
      }
    } else {
      for (const s of [-1, 1]) {
        const x = ex + s * 11;
        ctx.fillStyle = EYE;
        ctx.beginPath(); ctx.ellipse(x, headY + 4, 7, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 2, headY - 1, 3.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5, headY + 8, 1.7, 0, TAU); ctx.fill();
      }
    }

    // Bouche
    ctx.strokeStyle = '#d6577f';
    ctx.fillStyle = '#d6577f';
    ctx.lineWidth = 2;
    if (attacking || hurt) {
      ctx.beginPath(); ctx.ellipse(ex, headY + 20, 3, 4, 0, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(ex, headY + 15, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }

    // Attaque : petit bras + étoile magique
    if (attacking) {
      const b = this.attackBox;
      const hx = f === 1 ? b.x + b.w - 14 : b.x + 14;
      const hy = top + 76;
      ctx.strokeStyle = skin;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cx + f * 12, top + 74);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      const pulse = 1 + Math.sin(this.attackTimer) * 0.15;
      drawStar(ctx, hx, hy, 18 * pulse, flash ? '#fff' : '#fff7a8', accent);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(hx - f * 26, hy - 10, 3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hx - f * 36, hy + 8, 2, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(cx + f * 17, top + 80, 5.5, 0, TAU); ctx.fill();
    }

    // Bulle de protection
    if (this.blocking) {
      const g = ctx.createRadialGradient(cx, top + 60, 10, cx, top + 60, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.05)');
      g.addColorStop(1, 'rgba(200,180,255,0.45)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, top + 60, 64, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(cx - 30, top + 26, 8, 4, -0.6, 0, TAU); ctx.fill();
    }

    ctx.restore();
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const fighters = [
  new Fighter(160, 1, { left: 'KeyA', right: 'KeyD', up: 'KeyW', attack: 'KeyF', block: 'KeyG' }),
  new Fighter(W - 210, -1, { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', attack: 'KeyL', block: 'KeyK' }),
];

// ---------------------------------------------------------------
// État de la partie
// ---------------------------------------------------------------
let state = 'menu';   // menu | fight | paused | ko | over
let timeLeft = ROUND_TIME;
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
  particles.length = 0;
  show(menuEl, true);
  show(gameWrap, false);
  show(pauseOverlay, false);
  show(overOverlay, false);
  refreshMenu();
}

function startRound() {
  fighters.forEach((f) => f.reset());
  particles.length = 0;
  timeLeft = ROUND_TIME;
  winner = null;
  state = 'fight';
  show(pauseOverlay, false);
  show(overOverlay, false);
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
    f.pal = PALETTES[pl.pal];
    f.acc = ACCESSORIES[pl.acc].id;
    f.isAI = i === 1 && cpu;
    f.name = f.isAI ? CPU_NAME : pl.name.trim();
    f.wins = 0;
  });
}

function endRound() {
  const [a, b] = fighters;
  timeLeft = Math.max(0, timeLeft);
  if (a.hp > b.hp) { winner = a; a.wins++; }
  else if (b.hp > a.hp) { winner = b; b.wins++; }
  else winner = null;
  koText = (a.hp <= 0 || b.hp <= 0) ? 'K.O. ♥' : 'Temps écoulé !';
  koTimer = 70;
  state = 'ko';
}

function showResult() {
  const [a, b] = fighters;
  state = 'over';
  $('overTitle').textContent = winner ? `${winner.name} gagne ! ♥` : 'Égalité ! ♥';
  $('overScore').textContent = `${a.name}  ${a.wins} – ${b.wins}  ${b.name}`;
  show(overOverlay, true);
}

// ---------------------------------------------------------------
// Menu
// ---------------------------------------------------------------
const ui = { panels: [] };
const modeBtns = document.querySelectorAll('[data-mode]');

function setActive(list, idx) {
  list.forEach((b, j) => b.classList.toggle('active', j === idx));
}

function syncLooks() {
  fighters.forEach((f, i) => {
    f.pal = PALETTES[settings.players[i].pal];
    f.acc = ACCESSORIES[settings.players[i].acc].id;
  });
}

function makeField(labelText, parent) {
  const l = document.createElement('div');
  l.className = 'field-label';
  l.textContent = labelText;
  parent.appendChild(l);
}

function buildPanels() {
  const host = $('panels');
  host.innerHTML = '';
  settings.players.forEach((pl, i) => {
    const sec = document.createElement('section');
    sec.className = 'panel';

    const title = document.createElement('h3');
    title.textContent = `Joueuse ${i + 1}`;
    sec.appendChild(title);

    const prev = document.createElement('canvas');
    prev.className = 'preview';
    prev.width = 140;
    prev.height = 140;
    sec.appendChild(prev);

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
      b.addEventListener('click', () => { pl.pal = j; setActive(swatches, j); syncLooks(); });
      sw.appendChild(b);
      return b;
    });
    setActive(swatches, pl.pal);
    sec.appendChild(sw);

    makeField('Accessoire', sec);
    const ch = document.createElement('div');
    ch.className = 'chips';
    const chips = ACCESSORIES.map((a, j) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = a.label;
      b.addEventListener('click', () => { pl.acc = j; setActive(chips, j); syncLooks(); });
      ch.appendChild(b);
      return b;
    });
    setActive(chips, pl.acc);
    sec.appendChild(ch);

    host.appendChild(sec);
    ui.panels.push({ title, prev, input });
  });
}

function refreshMenu() {
  const cpu = settings.mode === 'cpu';
  modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === settings.mode));

  const p2 = ui.panels[1];
  p2.input.disabled = cpu;
  p2.input.value = cpu ? CPU_NAME : settings.players[1].name;
  p2.input.classList.remove('error');
  p2.title.textContent = cpu ? 'Ordinateur' : 'Joueuse 2';

  $('menuError').textContent = '';
  syncLooks();

  const k1 = '<strong>Joueuse 1</strong> : <kbd>Z</kbd><kbd>Q</kbd><kbd>D</kbd> (ou W/A/D) pour bouger et sauter · <kbd>F</kbd> frapper · <kbd>G</kbd> parer';
  const k2 = '<strong>Joueuse 2</strong> : flèches pour bouger et sauter · <kbd>L</kbd> frapper · <kbd>K</kbd> parer';
  helpEl.innerHTML = (cpu ? k1 : `${k1}<br>${k2}`) + '<br><kbd>P</kbd> pause · <kbd>Entrée</kbd> valider';
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
  startRound();
}

// Aperçu animé dans le menu
function drawPreview(i) {
  const f = fighters[i];
  const prev = ui.panels[i].prev;
  const c = prev.getContext('2d');
  c.clearRect(0, 0, prev.width, prev.height);
  const sx = f.x, sy = f.y;
  f.x = (prev.width - f.w) / 2;
  f.y = 18;
  f.draw(c, f.y + f.h);
  f.x = sx;
  f.y = sy;
}

// ---------------------------------------------------------------
// Rendu du jeu
// ---------------------------------------------------------------
const stars = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 137.5) % W,
  y: (i * 71.3) % (GROUND - 40),
  r: 1 + (i % 3),
  t: i * 0.7,
}));

function drawBar(x, fighter, align) {
  const bw = 380, bh = 26, y = 20;
  roundRectPath(x, y, bw, bh, 13);
  ctx.fillStyle = 'rgba(20,10,50,0.7)';
  ctx.fill();

  const w = Math.max(0, bw * (fighter.hp / MAX_HP));
  if (w > 0) {
    const bx = align === 'left' ? x : x + bw - w;
    const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
    g.addColorStop(0, fighter.pal.bar1);
    g.addColorStop(1, fighter.pal.bar2);
    ctx.save();
    roundRectPath(x, y, bw, bh, 13);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(bx, y, w, bh);
    ctx.restore();
  }
  roundRectPath(x, y, bw, bh, 13);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.fillText(`♥ ${fighter.name}  ·  victoires : ${fighter.wins}`, align === 'left' ? x + 4 : x + bw - 4, 66);
}

function centerText(text, y, size, color = '#fff') {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(80,30,160,0.8)';
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}

function drawBackground(now) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1458');
  g.addColorStop(0.55, '#5b3fb8');
  g.addColorStop(1, '#4a8bff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const s of stars) {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(now / 700 + s.t));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }

  // Lune
  ctx.fillStyle = '#f3ecff';
  ctx.beginPath(); ctx.arc(W - 150, 130, 50, 0, TAU); ctx.fill();
  ctx.fillStyle = '#5b3fb8';
  ctx.beginPath(); ctx.arc(W - 128, 118, 44, 0, TAU); ctx.fill();

  // Nuages doux
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const [cx, cy] of [[200, 200], [520, 150], [760, 260]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, TAU);
    ctx.arc(cx + 30, cy + 6, 24, 0, TAU);
    ctx.arc(cx - 30, cy + 8, 22, 0, TAU);
    ctx.fill();
  }

  // Sol
  const gg = ctx.createLinearGradient(0, GROUND, 0, H);
  gg.addColorStop(0, '#8f7cff');
  gg.addColorStop(1, '#3a2a8a');
  ctx.fillStyle = gg;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(0, GROUND, W, 3);
}

function draw(now) {
  if (state === 'menu') {
    ui.panels.forEach((_, i) => drawPreview(i));
    return;
  }
  drawBackground(now);
  fighters.forEach((f) => f.draw());
  drawParticles();

  drawBar(20, fighters[0], 'left');
  drawBar(W - 400, fighters[1], 'right');
  centerText(String(Math.ceil(timeLeft)), 48, 38);

  if (state === 'ko') centerText(koText, H / 2, 76, '#ffd9f5');
}

function update(dt) {
  updateParticles(dt);
  if (state === 'fight') {
    fighters[0].update(dt, fighters[1], false);
    fighters[1].update(dt, fighters[0], false);
    timeLeft -= dt / 60;
    if (fighters[0].hp <= 0 || fighters[1].hp <= 0 || timeLeft <= 0) endRound();
  } else if (state === 'ko') {
    fighters[0].update(dt, fighters[1], true);
    fighters[1].update(dt, fighters[0], true);
    koTimer -= dt;
    if (koTimer <= 0) showResult();
  }
}

// Boucle de jeu : vitesse identique quel que soit l'écran (60 Hz, 144 Hz...)
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / (1000 / 60), 3);
  last = now;
  update(dt);
  draw(now);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------
modeBtns.forEach((b) => b.addEventListener('click', () => {
  settings.mode = b.dataset.mode;
  refreshMenu();
}));
$('playBtn').addEventListener('click', tryStart);
$('resumeBtn').addEventListener('click', resume);
$('restartBtn').addEventListener('click', () => { fighters.forEach((f) => { f.wins = 0; }); startRound(); });
$('pauseMenuBtn').addEventListener('click', showMenu);
$('rematchBtn').addEventListener('click', startRound);
$('overMenuBtn').addEventListener('click', showMenu);
$('pauseBtn').addEventListener('click', pause);
$('quitBtn').addEventListener('click', showMenu);
// Évite qu'un bouton garde le focus (sinon Entrée/Espace le re-déclenche)
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) b.blur();
});

loadSettings();
buildPanels();
showMenu();
requestAnimationFrame(loop);
