'use strict';

/* ------------------------------------------------------------------
   Settings: tweak the look and feel here
------------------------------------------------------------------- */
const CONFIG = {
  mobileBreakpoint: 700,        // px: at or below this width, one column
  columnMinWidth: 800,          // px of screen width per extra column
  rowHeight: 160,               // px of screen height per verse in a column
  minRows: 2,
  maxRows: 5,

  baseFontSize: { mobile: 14, desktop: 18 },
  lineHeight: 1.65,
  maxTextWidth: { mobile: 400, desktop: 540 },
  columnFill: 0.86,             // share of a column a verse may use
  edgeMargin: 14,
  spawnGap: 3,                  // gap above the column, in font sizes

  speed: { min: 0.42, range: 0.3 },
  opacity: { min: 0.5, range: 0.22 },
  drift: { min: 5, range: 5 },
  swayRate: 0.008,
  hitPadding: { x: 12, y: 10 },

  sizeSteps: [0.8, 0.9, 1, 1.15, 1.3],
  speedSteps: [0.4, 0.7, 1, 1.5, 2],
  defaultStep: 2,

  storageKey: 'bardfall-settings',
  fontFamily: '"Playfair Display", Georgia, serif',
};

/* ------------------------------------------------------------------
   Elements and state
------------------------------------------------------------------- */
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const modal = document.getElementById('modal');
const modalCard = modal.querySelector('.modal-card');
const quoteText = document.getElementById('quoteText');
const quoteCharacter = document.getElementById('quoteCharacter');
const quoteSource = document.getElementById('quoteSource');
const buttons = {
  pause: document.getElementById('pauseBtn'),
  sizeDown: document.getElementById('sizeDown'),
  sizeUp: document.getElementById('sizeUp'),
  speedDown: document.getElementById('speedDown'),
  speedUp: document.getElementById('speedUp'),
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const state = {
  width: 0,
  height: 0,
  cols: 1,
  rows: CONFIG.maxRows,
  particles: [],
  paused: reducedMotion.matches,   // start paused if the person asked for less motion
  pausedBeforeModal: false,
  sizeIndex: CONFIG.defaultStep,
  speedIndex: CONFIG.defaultStep,
  lastTime: 0,
  lastFocus: null,
};

/* ------------------------------------------------------------------
   Small helpers
------------------------------------------------------------------- */
const isMobile = () => matchMedia(`(max-width: ${CONFIG.mobileBreakpoint}px)`).matches;
const isModalOpen = () => modal.classList.contains('active');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const randomIn = ({ min, range }) => min + Math.random() * range;

const fontSize = () =>
  CONFIG.baseFontSize[isMobile() ? 'mobile' : 'desktop'] * CONFIG.sizeSteps[state.sizeIndex];
const fontFor = (size) => `${size}px ${CONFIG.fontFamily}`;
const speedFactor = () => CONFIG.speedSteps[state.speedIndex];

/* ------------------------------------------------------------------
   Saved settings (size and speed survive a page reload)
------------------------------------------------------------------- */
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey));
    const valid = (index, steps) => Number.isInteger(index) && index >= 0 && index < steps.length;
    if (saved && valid(saved.sizeIndex, CONFIG.sizeSteps)) state.sizeIndex = saved.sizeIndex;
    if (saved && valid(saved.speedIndex, CONFIG.speedSteps)) state.speedIndex = saved.speedIndex;
  } catch (error) {
    /* Storage unavailable or corrupted: keep the defaults. */
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      CONFIG.storageKey,
      JSON.stringify({ sizeIndex: state.sizeIndex, speedIndex: state.speedIndex })
    );
  } catch (error) {
    /* Private mode or blocked storage: nothing to do. */
  }
}

/* ------------------------------------------------------------------
   Layout: columns, rows and verse text blocks
------------------------------------------------------------------- */
function columnCount() {
  if (isMobile()) return 1;
  return Math.max(2, Math.floor(state.width / CONFIG.columnMinWidth));
}

function rowCount() {
  return clamp(Math.floor(state.height / CONFIG.rowHeight), CONFIG.minRows, CONFIG.maxRows);
}

function wrapText(text, maxWidth, size) {
  ctx.font = fontFor(size);
  const words = `“${text}”`.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* Works out the wrapped lines, size and x position of a verse.
   Used on creation, when the size changes and when the window resizes. */
function layoutParticle(p) {
  const size = fontSize();
  const columnWidth = state.width / state.cols;
  const maxWidth = Math.min(
    columnWidth * CONFIG.columnFill,
    CONFIG.maxTextWidth[isMobile() ? 'mobile' : 'desktop']
  );

  p.size = size;
  p.lines = wrapText(p.quote.text, maxWidth, size);
  p.lineHeight = size * CONFIG.lineHeight;
  p.blockHeight = p.lines.length * p.lineHeight;

  ctx.font = fontFor(size);
  p.blockWidth = Math.max(...p.lines.map((line) => ctx.measureText(line).width));

  const centered = p.col * columnWidth + (columnWidth - p.blockWidth) / 2;
  p.x = clamp(centered, CONFIG.edgeMargin, state.width - p.blockWidth - CONFIG.edgeMargin);
}

/* ------------------------------------------------------------------
   Verses (particles)
------------------------------------------------------------------- */
function pickQuote(except) {
  const inUse = new Set(state.particles.filter((p) => p !== except).map((p) => p.quote));
  const available = QUOTES.filter((quote) => !inUse.has(quote));
  const pool = available.length ? available : QUOTES;   // very large screens: allow repeats
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomizeMotion(p) {
  p.speed = randomIn(CONFIG.speed);
  p.opacity = randomIn(CONFIG.opacity);
  p.drift = randomIn(CONFIG.drift);
  p.phase = Math.random() * Math.PI * 2;
}

function createParticle(index) {
  const p = { col: index % state.cols, hover: false };
  const row = Math.floor(index / state.cols);

  p.quote = pickQuote(null);
  randomizeMotion(p);
  layoutParticle(p);
  // Stagger the starting positions so the screen is filled right away.
  p.y = state.height * ((row + p.col / state.cols) / state.rows) - p.blockHeight;
  return p;
}

/* Sends a verse that left the screen back above its column. */
function respawn(p) {
  p.quote = pickQuote(p);
  randomizeMotion(p);
  layoutParticle(p);

  let top = 0;
  for (const other of state.particles) {
    if (other !== p && other.col === p.col) top = Math.min(top, other.y);
  }
  p.y = top - p.size * CONFIG.spawnGap - p.blockHeight;
}

function initParticles() {
  state.particles = [];
  const count = state.cols * state.rows;
  for (let i = 0; i < count; i++) state.particles.push(createParticle(i));
}

/* ------------------------------------------------------------------
   Resize
------------------------------------------------------------------- */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.round(state.width * dpr);
  canvas.height = Math.round(state.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cols = columnCount();
  const rows = rowCount();
  const gridChanged = cols !== state.cols || rows !== state.rows || !state.particles.length;
  state.cols = cols;
  state.rows = rows;

  if (gridChanged) {
    initParticles();
  } else {
    // Same grid (for example the mobile address bar showed or hid): keep the verses.
    state.particles.forEach(layoutParticle);
  }
}

/* ------------------------------------------------------------------
   Drawing and animation
------------------------------------------------------------------- */
function sway(p) {
  return p.x + Math.sin(p.phase) * p.drift;
}

function drawParticle(p) {
  ctx.save();
  ctx.font = fontFor(p.size);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = p.hover ? 'rgba(236,212,154,.98)' : `rgba(247,232,216,${p.opacity})`;
  ctx.shadowColor = p.hover ? 'rgba(214,179,95,.8)' : 'rgba(20,8,25,.55)';
  ctx.shadowBlur = p.hover ? 15 : 5;

  const x = sway(p);
  p.lines.forEach((line, i) => ctx.fillText(line, x, p.y + i * p.lineHeight));
  ctx.restore();
}

function animate(time = 0) {
  const delta = Math.min((time - state.lastTime || 16.67) / 16.67, 2);
  state.lastTime = time;
  ctx.clearRect(0, 0, state.width, state.height);

  if (!state.paused) {
    for (const p of state.particles) {
      p.y += p.speed * speedFactor() * delta;
      p.phase += CONFIG.swayRate * delta;
      if (p.y > state.height + 40) respawn(p);
    }
  }

  state.particles.forEach(drawParticle);
  requestAnimationFrame(animate);
}

/* ------------------------------------------------------------------
   Pointer: hover and click on verses
------------------------------------------------------------------- */
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function isOverParticle(p, x, y) {
  const left = sway(p);
  return (
    x >= left - CONFIG.hitPadding.x &&
    x <= left + p.blockWidth + CONFIG.hitPadding.x &&
    y >= p.y - CONFIG.hitPadding.y &&
    y <= p.y + p.blockHeight + CONFIG.hitPadding.y
  );
}

/* The verse drawn last is on top, so search from the end. */
function particleAt(x, y) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    if (isOverParticle(state.particles[i], x, y)) return state.particles[i];
  }
  return null;
}

canvas.addEventListener('click', (event) => {
  if (isModalOpen()) return;
  const { x, y } = pointerPosition(event);
  const hit = particleAt(x, y);
  if (hit) openModal(hit.quote);
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  const { x, y } = pointerPosition(event);
  const hit = particleAt(x, y);
  state.particles.forEach((p) => { p.hover = p === hit; });
  canvas.style.cursor = hit ? 'pointer' : 'default';
});

/* ------------------------------------------------------------------
   Modal
------------------------------------------------------------------- */
function openModal(quote) {
  state.pausedBeforeModal = state.paused;
  state.lastFocus = document.activeElement;
  setPaused(true);

  quoteText.textContent = `“${quote.text}”`;
  quoteCharacter.textContent = quote.character;
  quoteSource.textContent = `${quote.play} · ${quote.act}`;
  modal.classList.add('active');
  modalCard.focus({ preventScroll: true });
}

function closeModal() {
  modal.classList.remove('active');
  setPaused(state.pausedBeforeModal);   // resume only if it was running before
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

modal.addEventListener('click', closeModal);

/* ------------------------------------------------------------------
   Controls: Pause, Size - +, Speed - +
------------------------------------------------------------------- */
function setPaused(value) {
  state.paused = value;
  buttons.pause.textContent = value ? 'Resume' : 'Pause';
  buttons.pause.setAttribute('aria-pressed', String(value));
}

function updateStepButtons() {
  buttons.sizeDown.disabled = state.sizeIndex === 0;
  buttons.sizeUp.disabled = state.sizeIndex === CONFIG.sizeSteps.length - 1;
  buttons.speedDown.disabled = state.speedIndex === 0;
  buttons.speedUp.disabled = state.speedIndex === CONFIG.speedSteps.length - 1;
}

function changeSize(direction) {
  const next = clamp(state.sizeIndex + direction, 0, CONFIG.sizeSteps.length - 1);
  if (next === state.sizeIndex) return;
  state.sizeIndex = next;
  state.particles.forEach(layoutParticle);   // re-wrap in place: no restart
  updateStepButtons();
  saveSettings();
}

function changeSpeed(direction) {
  const next = clamp(state.speedIndex + direction, 0, CONFIG.speedSteps.length - 1);
  if (next === state.speedIndex) return;
  state.speedIndex = next;
  updateStepButtons();
  saveSettings();
}

buttons.pause.addEventListener('click', () => setPaused(!state.paused));
buttons.sizeDown.addEventListener('click', () => changeSize(-1));
buttons.sizeUp.addEventListener('click', () => changeSize(1));
buttons.speedDown.addEventListener('click', () => changeSpeed(-1));
buttons.speedUp.addEventListener('click', () => changeSpeed(1));

/* ------------------------------------------------------------------
   Keyboard: Esc closes the verse; Space pauses; + / - size; arrows speed
------------------------------------------------------------------- */
document.addEventListener('keydown', (event) => {
  if (isModalOpen()) {
    if (event.key === 'Escape') closeModal();
    return;
  }

  const onButton = event.target.tagName === 'BUTTON';
  if (event.code === 'Space' && !onButton) {
    event.preventDefault();
    setPaused(!state.paused);
  } else if (event.key === '+' || event.key === '=') {
    changeSize(1);
  } else if (event.key === '-' || event.key === '_') {
    changeSize(-1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    changeSpeed(1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    changeSpeed(-1);
  }
});

/* ------------------------------------------------------------------
   Start: wait for the verse font, otherwise the first measurements
   would use a fallback font.
------------------------------------------------------------------- */
function start() {
  loadSettings();
  updateStepButtons();
  setPaused(state.paused);
  resize();
  requestAnimationFrame(animate);
}

window.addEventListener('resize', resize);

const verseFont = fontFor(CONFIG.baseFontSize.desktop);
Promise.all([document.fonts.load(verseFont), document.fonts.ready])
  .catch(() => {})   // fonts blocked or offline: start with the fallback font
  .then(start);
