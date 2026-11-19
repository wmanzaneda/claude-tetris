'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins / temas visuales ----
// Cada skin define su paleta (índices 1–7, null en 0), color de la rejilla,
// fondo del canvas y su propia función de dibujo de bloques.

const SKIN_STORAGE_KEY = 'tetris.skin';
const DEFAULT_SKIN = 'retro';

// Traza un rectángulo con esquinas redondeadas (usa roundRect si existe).
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  // Retro: bloques cuadrados y colores planos (aspecto original)
  retro: {
    name: 'Retro',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - amarillo
      '#ba68c8', // T - morado
      '#81c784', // S - verde
      '#e57373', // Z - rojo
      '#90caf9', // J - azul pastel
      '#ffb74d', // L - naranja
    ],
    grid: '#22222e',
    bg: '#1a1a25',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      // brillo superior
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },

  // Neon: fondo negro y resplandor con shadowBlur
  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00f0ff', // I
      '#fff700', // O
      '#d400ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#2979ff', // J
      '#ff9100', // L
    ],
    grid: '#111118',
    bg: '#000000',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const color = this.colors[colorIndex];
      const px = x * size + 3;
      const py = y * size + 3;
      const s = size - 6;
      context.shadowColor = color;
      context.shadowBlur = Math.round(size * 0.45);
      if ((alpha ?? 1) < 1) {
        // ghost: solo contorno brillante, algo más visible que el alpha pedido
        context.globalAlpha = Math.min(0.6, alpha * 2.5);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(px, py, s, s);
      } else {
        context.globalAlpha = 1;
        context.fillStyle = color;
        context.fillRect(px, py, s, s);
        context.shadowBlur = 0;
        // núcleo oscuro para efecto "tubo de neón"
        context.fillStyle = 'rgba(0,0,0,0.45)';
        context.fillRect(px + 4, py + 4, s - 8, s - 8);
      }
      // resetear sombra para no contaminar grid/ghost/otros bloques
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.globalAlpha = 1;
    },
  },

  // Pastel: colores suaves y esquinas redondeadas
  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#9ee3ec', // I
      '#fbe8a0', // O
      '#d9b8ea', // T
      '#b5e3b5', // S
      '#f6b5b5', // Z
      '#b5d0f6', // J
      '#fcd2a4', // L
    ],
    grid: '#e9e0ef',
    bg: '#f8f3fb',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const px = x * size + 2;
      const py = y * size + 2;
      const s = size - 4;
      const r = Math.max(2, Math.round(size * 0.22));
      if ((alpha ?? 1) < 1) {
        // ghost: sobre fondo claro el alpha bajo no se ve; contorno más oscuro
        roundRectPath(context, px, py, s, s, r);
        context.globalAlpha = Math.min(1, alpha * 2.5);
        context.fillStyle = this.colors[colorIndex];
        context.fill();
        context.strokeStyle = 'rgba(90,70,110,0.55)';
        context.lineWidth = 1.5;
        context.stroke();
        context.globalAlpha = 1;
        return;
      }
      context.globalAlpha = 1;
      roundRectPath(context, px, py, s, s, r);
      context.fillStyle = this.colors[colorIndex];
      context.fill();
      context.strokeStyle = 'rgba(90,70,110,0.25)';
      context.lineWidth = 1;
      context.stroke();
      // brillo suave superior
      roundRectPath(context, px + 3, py + 3, s - 6, Math.round(s * 0.3), Math.max(1, r - 2));
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
      context.globalAlpha = 1;
    },
  },

  // Pixel art: bisel claro/oscuro y textura de sub-píxeles
  pixel: {
    name: 'Pixel art',
    colors: [
      null,
      '#3cbcfc', // I
      '#f8d878', // O
      '#b853f8', // T
      '#58d854', // S
      '#f83800', // Z
      '#0078f8', // J
      '#fca044', // L
    ],
    grid: '#1c1c28',
    bg: '#101018',
    drawBlock(context, x, y, colorIndex, size, alpha) {
      const p = Math.max(1, Math.floor(size / 10)); // tamaño del "píxel"
      const px = x * size;
      const py = y * size;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = this.colors[colorIndex];
      context.fillRect(px, py, size, size);
      // bisel: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size - p, p);
      context.fillRect(px, py, p, size - p);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + p, py + size - p, size - p, p);
      context.fillRect(px + size - p, py + p, p, size - p);
      // textura: sub-píxeles en rejilla dentro del bloque
      const cells = Math.floor((size - 4 * p) / p);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < cells; i++)
        for (let j = 0; j < cells; j++)
          if ((i * 2 + j) % 5 === 0)
            context.fillRect(px + 2 * p + i * p, py + 2 * p + j * p, p, p);
      // destello en la esquina superior izquierda
      context.fillStyle = 'rgba(255,255,255,0.7)';
      context.fillRect(px + 2 * p, py + 2 * p, p, p);
      context.globalAlpha = 1;
    },
  },
};

// Skin activo y su paleta (COLORS se mantiene apuntando a la paleta activa)
let activeSkin = SKINS[DEFAULT_SKIN];
let COLORS = activeSkin.colors;

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
  clearLines();
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
  // delega en la función de dibujo del skin activo; save/restore evita que
  // alpha, sombras o trazos de un skin contaminen la rejilla u otros bloques
  context.save();
  activeSkin.drawBlock(context, x, y, colorIndex, size, alpha);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = activeSkin.grid;
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
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
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
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Gestión de skins ----

function loadSkinId() {
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY); // applySkin valida el id
  } catch (_) {
    return DEFAULT_SKIN; // localStorage no disponible
  }
}

function saveSkinId(id) {
  try {
    localStorage.setItem(SKIN_STORAGE_KEY, id);
  } catch (_) { /* localStorage no disponible */ }
}

// Aplica un skin sin recargar: paleta, fondo, clase de página y redibujo inmediato
function applySkin(id) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, id)) id = DEFAULT_SKIN;
  activeSkin = SKINS[id];
  COLORS = activeSkin.colors;
  for (const key of Object.keys(SKINS)) document.body.classList.remove(`skin-${key}`);
  document.body.classList.add(`skin-${id}`);
  document.documentElement.style.setProperty('--canvas-bg', activeSkin.bg);
  skinSelect.value = id;
  // redibujar también si está en pausa o en game over
  if (board && current) draw();
  if (next) drawNext();
}

const skinSelect = document.getElementById('skin-select');
for (const [id, skin] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = skin.name;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  saveSkinId(skinSelect.value); // applySkin ya dejó un id válido en el select
  // quitar el foco para que las flechas no cambien el skin durante la partida
  skinSelect.blur();
});
applySkin(loadSkinId());

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyX', 'Space']);

document.addEventListener('keydown', e => {
  // si el selector de skin conserva el foco, las teclas del juego no deben
  // cambiar la skin: se quita el foco y la tecla va al juego.
  // (en pausa o game over el select sigue usable con teclado, salvo P)
  if (e.target === skinSelect) {
    const playing = !paused && !gameOver;
    if (e.code === 'KeyP' || (playing && GAME_KEYS.has(e.code))) {
      e.preventDefault();
      skinSelect.blur();
    } else {
      return;
    }
  }
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

restartBtn.addEventListener('click', init);

init();
