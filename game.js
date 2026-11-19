'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pastel blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const startOverlay = document.getElementById('start-overlay');
const playBtn = document.getElementById('play-btn');
const startRecordsBody = document.getElementById('start-records');
const startStatsEl = document.getElementById('start-stats');
const gameoverRecords = document.getElementById('gameover-records');
const gameoverRecordsBody = document.getElementById('gameover-records-body');
const gameoverStatsEl = document.getElementById('gameover-stats');
const newRecordMsg = document.getElementById('new-record-msg');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const resetRecordsBtns = document.querySelectorAll('.reset-records-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// combo = piezas consecutivas que limpian ≥1 línea; maxCombo = mejor combo de la partida
let combo = 0, maxCombo = 0;
let started = false;

// ---- Records locales (localStorage) ----
const HS_KEY = 'tetris.highscores';
const STATS_KEY = 'tetris.stats';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Jugador';

// Todo acceso a localStorage va en try/catch: si falla, se funciona sin persistencia.
// Devuelve undefined si localStorage no es accesible, null si la clave no existe o no es JSON válido.
function readJSON(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return undefined;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin persistencia: se mantiene solo en memoria
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignorar
  }
}

const toInt = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

// Lee los records guardados; si localStorage no es accesible conserva los de memoria
function loadRecords(current = []) {
  const data = readJSON(HS_KEY);
  if (data === undefined) return current;
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      name: (typeof r.name === 'string' ? r.name.trim().slice(0, NAME_MAX) : '') || DEFAULT_NAME,
      score: toInt(r.score),
      lines: toInt(r.lines),
      maxCombo: toInt(r.maxCombo),
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function loadStats(current = { bestCombo: 0, maxLines: 0, lastName: '' }) {
  const data = readJSON(STATS_KEY);
  if (data === undefined) return current;
  const obj = data && typeof data === 'object' ? data : {};
  return {
    bestCombo: toInt(obj.bestCombo),
    maxLines: toInt(obj.maxLines),
    lastName: typeof obj.lastName === 'string' ? obj.lastName.slice(0, NAME_MAX) : '',
  };
}

let records = loadRecords();
let stats = loadStats();
let pendingEntry = null; // datos de la partida pendiente de guardar con nombre
let focusTimer = null;
nameInput.maxLength = NAME_MAX;

// ¿La puntuación entra en el top 5?
function qualifies(s) {
  if (s <= 0) return false;
  if (records.length < MAX_RECORDS) return true;
  return s > records[records.length - 1].score;
}

// Inserta la entrada ordenada (tras las de igual puntuación) y devuelve su índice
function addRecord(entry) {
  // releer antes de escribir para no pisar records guardados desde otra pestaña
  records = loadRecords(records);
  let idx = records.findIndex(r => entry.score > r.score);
  if (idx === -1) idx = records.length;
  records.splice(idx, 0, entry);
  records = records.slice(0, MAX_RECORDS);
  saveJSON(HS_KEY, records);
  return idx < MAX_RECORDS ? idx : -1;
}

function renderRecords(tbody, highlightIdx = -1) {
  tbody.replaceChildren();
  if (!records.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty';
    td.textContent = 'Sin records todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIdx) tr.className = 'highlight';
    // textContent: los nombres nunca se interpretan como HTML
    for (const text of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.maxCombo]) {
      const td = document.createElement('td');
      td.textContent = String(text);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
}

function renderStats(el) {
  el.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máximas: ${stats.maxLines}`;
}

function renderAllRecords(highlightIdx = -1) {
  renderRecords(startRecordsBody);
  renderRecords(gameoverRecordsBody, highlightIdx);
  renderStats(startStatsEl);
  renderStats(gameoverStatsEl);
}

function hideNameForm() {
  nameInput.blur();
  nameForm.classList.add('hidden');
}

// Actualiza las estadísticas históricas con la partida actual
function recordGameStats() {
  stats = loadStats(stats);
  stats.bestCombo = Math.max(stats.bestCombo, maxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveJSON(STATS_KEY, stats);
}

// Guarda el record pendiente con el nombre del input; devuelve el índice de la fila
function commitPending() {
  if (!pendingEntry) return -1;
  const name = nameInput.value.trim().slice(0, NAME_MAX) || DEFAULT_NAME;
  const idx = addRecord({ ...pendingEntry, name });
  pendingEntry = null;
  stats = loadStats(stats);
  stats.lastName = name;
  saveJSON(STATS_KEY, stats);
  hideNameForm();
  return idx;
}

function saveName(e) {
  e.preventDefault();
  if (!pendingEntry) return;
  renderAllRecords(commitPending());
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los records?')) return;
  records = [];
  stats = { bestCombo: 0, maxLines: 0, lastName: stats.lastName };
  removeKey(HS_KEY);
  saveJSON(STATS_KEY, stats);
  // una partida pendiente de guardar se descarta junto con los records
  pendingEntry = null;
  hideNameForm();
  newRecordMsg.classList.add('hidden');
  renderAllRecords();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  // combo: sube si la pieza limpia líneas, se resetea si no
  if (clearLines() > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw(); // pintar estado final del tablero
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo máx.: ${maxCombo}`;

  // estadísticas históricas (independientes de entrar en el top 5)
  recordGameStats();
  records = loadRecords(records);

  const isRecord = qualifies(score);
  pendingEntry = isRecord
    ? { name: '', score, lines, maxCombo, date: new Date().toISOString() }
    : null;
  newRecordMsg.classList.toggle('hidden', !isRecord);
  nameForm.classList.toggle('hidden', !isRecord);
  gameoverRecords.classList.remove('hidden');
  renderAllRecords();
  overlay.classList.remove('hidden');
  if (isRecord) {
    nameInput.value = stats.lastName || DEFAULT_NAME;
    // foco con retardo para que las teclas de juego que se sigan pulsando
    // (Space, flechas, X) no sobrescriban el nombre
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => {
      if (pendingEntry && gameOver) {
        nameInput.focus();
        nameInput.select();
      }
    }, 600);
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    gameoverRecords.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede ejecutarse dentro de este frame (lockPiece → spawn → endGame);
  // su cancelAnimationFrame no detiene el frame actual, así que no re-agendar.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  // reiniciar sin pulsar Guardar: se guarda el record con el nombre escrito (o el por defecto)
  if (pendingEntry) commitPending();
  // partida abandonada (reinicio desde pausa): contabilizar sus estadísticas
  if (started && !gameOver) recordGameStats();
  clearTimeout(focusTimer);
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  started = true;
  pendingEntry = null;
  hideNameForm();
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  startOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // mientras se escribe el nombre no se procesan teclas de juego (ni P)
  if (e.target === nameInput) return;
  // antes de pulsar Jugar no hay partida
  if (!started) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

// quitar el foco del botón para que Space/Enter no reinicien a mitad de partida
const startGame = e => { e.currentTarget.blur(); init(); renderAllRecords(); };
restartBtn.addEventListener('click', startGame);
playBtn.addEventListener('click', startGame);
nameForm.addEventListener('submit', saveName);
resetRecordsBtns.forEach(btn => btn.addEventListener('click', resetRecords));

// Pantalla de inicio: el juego no arranca hasta pulsar Jugar
renderAllRecords();
