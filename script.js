(function() {
  const canvas = document.getElementById('tetrisCanvas');
  const ctx = canvas.getContext('2d');
  const scoreSpan = document.getElementById('scoreValue');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn'); // New Restart Button
  const statusLed = document.getElementById('statusLed');
  const statusMsg = document.getElementById('statusMessage');

  const COLS = 12;
  const ROWS = 20;
  const CELL_SIZE = 30;     
  const BASE_SPEED = 500;   
  const MIN_SPEED = 100; 

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1],[0,0,0]],
    S: [[0,1,1],[1,1,0],[0,0,0]],
    Z: [[1,1,0],[0,1,1],[0,0,0]],
    L: [[1,0,0],[1,0,0],[1,1,0]],
    J: [[0,0,1],[0,0,1],[0,1,1]]
  };

  const COLOR_MAP = [
    null,
    '#2bd2ff', 
    '#f5dd42', 
    '#c55ef0', 
    '#4cd964', 
    '#ff7e5e', 
    '#f9a43c', 
    '#5f8eff'  
  ];

  const PIECE_IDS = { I:1, O:2, T:3, S:4, Z:5, L:6, J:7 };

  let arena = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  let currentPiece = null;      
  let piecePos = { x: 3, y: 0 };
  let score = 0;
  let active = true;            
  let gameOver = false;
  let dropInterval = BASE_SPEED;
  let lastTimestamp = 0;
  let accumulator = 0;
  let animFrame = null;

  function updateUI() {
    scoreSpan.innerText = score;
    let level = Math.floor(score / 200);
    let newSpeed = BASE_SPEED - (level * 40); 
    dropInterval = Math.max(MIN_SPEED, newSpeed);
  }

  function updateStatusUI() {
    if (gameOver) {
      statusLed.className = 'status-led gameover';
      statusMsg.innerText = 'GAME OVER';
    } else if (!active) {
      statusLed.className = 'status-led paused';
      statusMsg.innerText = 'PAUSED';
    } else {
      statusLed.className = 'status-led';
      statusMsg.innerText = 'PLAYING';
    }
  }

  function randomPiece() {
    const types = ['I','O','T','S','Z','L','J'];
    const type = types[Math.floor(Math.random() * types.length)];
    const raw = SHAPES[type];
    const id = PIECE_IDS[type];
    const matrix = raw.map(row => row.map(v => v === 1 ? id : 0));
    return { matrix, typeId: id };
  }

  function collide(arenaMat, pieceMat, offX, offY) {
    for (let r = 0; r < pieceMat.length; r++) {
      for (let c = 0; c < pieceMat[0].length; c++) {
        if (pieceMat[r][c] !== 0) {
          const x = offX + c;
          const y = offY + r;
          if (x < 0 || x >= COLS || y >= ROWS || y < 0) return true;
          if (y >= 0 && arenaMat[y][x] !== 0) return true;
        }
      }
    }
    return false;
  }

  function mergePiece() {
    for (let r = 0; r < currentPiece.matrix.length; r++) {
      for (let c = 0; c < currentPiece.matrix[0].length; c++) {
        const val = currentPiece.matrix[r][c];
        if (val !== 0) {
          const y = piecePos.y + r;
          const x = piecePos.x + c;
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
            arena[y][x] = val;
          }
        }
      }
    }
  }

  function clearLines() {
    let linesCleared = 0;
    for (let row = ROWS-1; row >= 0; ) {
      let full = true;
      for (let col = 0; col < COLS; col++) {
        if (arena[row][col] === 0) { full = false; break; }
      }
      if (full) {
        for (let r = row; r > 0; r--) arena[r] = arena[r-1].slice();
        arena[0] = Array(COLS).fill(0);
        linesCleared++;
      } else {
        row--;
      }
    }

    if (linesCleared > 0) {
      const points = {1:100, 2:300, 3:600, 4:1000};
      const add = points[linesCleared] || 100 * linesCleared;
      score += add;
      updateUI();
    }
  }

  function spawnNewPiece() {
    currentPiece = randomPiece();
    const startX = Math.floor((COLS - currentPiece.matrix[0].length) / 2);
    piecePos = { x: startX, y: 0 };
    if (collide(arena, currentPiece.matrix, piecePos.x, piecePos.y)) {
      gameOver = true;
      active = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = null;
      updateStatusUI();
      draw();
      return false;
    }
    return true;
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    const success = spawnNewPiece();
    draw();
    if (!success) updateStatusUI();
  }

  function move(dx, dy) {
    if (!active || gameOver) return false;
    const newX = piecePos.x + dx;
    const newY = piecePos.y + dy;
    if (!collide(arena, currentPiece.matrix, newX, newY)) {
      piecePos.x = newX;
      piecePos.y = newY;
      draw();
      return true;
    } else if (dy === 1) {
      lockPiece();
      draw();
      return false;
    }
    return false;
  }

  function rotatePiece() {
    if (!active || gameOver) return;
    const matrix = currentPiece.matrix;
    const rotated = matrix[0].map((_, idx) => matrix.map(row => row[idx]).reverse());
    const original = currentPiece.matrix;
    currentPiece.matrix = rotated;
    if (!collide(arena, currentPiece.matrix, piecePos.x, piecePos.y)) {
      draw();
    } else {
      for (let shift of [-1, 1, -2, 2]) {
        const newX = piecePos.x + shift;
        if (!collide(arena, currentPiece.matrix, newX, piecePos.y)) {
          piecePos.x = newX;
          draw();
          return;
        }
      }
      currentPiece.matrix = original; 
    }
  }

  function hardDrop() {
    if (!active || gameOver) return;
    while (!collide(arena, currentPiece.matrix, piecePos.x, piecePos.y + 1)) {
      piecePos.y++;
    }
    lockPiece();
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.2)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
    }

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const val = arena[row][col];
        if (val !== 0) {
          ctx.fillStyle = COLOR_MAP[val];
          ctx.shadowBlur = 3;
          ctx.shadowColor = 'rgba(0,200,255,0.5)';
          ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE-0.8, CELL_SIZE-0.8);
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(col * CELL_SIZE + 2, row * CELL_SIZE + 2, CELL_SIZE-5, 4);
        }
      }
    }

    if (currentPiece && !gameOver) {
      const mat = currentPiece.matrix;
      for (let r = 0; r < mat.length; r++) {
        for (let c = 0; c < mat[0].length; c++) {
          const val = mat[r][c];
          if (val !== 0) {
            const x = (piecePos.x + c) * CELL_SIZE;
            const y = (piecePos.y + r) * CELL_SIZE;
            ctx.fillStyle = COLOR_MAP[val];
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#0ff';
            ctx.fillRect(x, y, CELL_SIZE-0.8, CELL_SIZE-0.8);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,250,0.4)';
            ctx.fillRect(x+2, y+2, CELL_SIZE-5, 4);
          }
        }
      }
    }

    if (gameOver) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#01040e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 24px "Inter", system-ui';
      ctx.fillStyle = '#ffbe76';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 20);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#99ccff';
      ctx.fillText('Press RESTART', canvas.width/2, canvas.height/2 + 30);
      ctx.textAlign = 'left';
    } else if (!active && !gameOver) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#030a18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 22px system-ui';
      ctx.fillStyle = '#aaffff';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
      ctx.textAlign = 'left';
    }
  }

  function gameLoop(now) {
    if (!active || gameOver) {
      draw();
      animFrame = requestAnimationFrame(gameLoop);
      return;
    }
    if (!lastTimestamp) {
      lastTimestamp = now;
      animFrame = requestAnimationFrame(gameLoop);
      return;
    }
    let delta = Math.min(100, now - lastTimestamp);
    lastTimestamp = now;
    accumulator += delta;
    if (accumulator >= dropInterval) {
      while (accumulator >= dropInterval) {
        if (!collide(arena, currentPiece.matrix, piecePos.x, piecePos.y + 1)) {
          piecePos.y++;
        } else {
          lockPiece();
        }
        accumulator -= dropInterval;
      }
      draw();
    }
    draw();
    animFrame = requestAnimationFrame(gameLoop);
  }

  function fullReset() {
    arena = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    score = 0;
    gameOver = false;
    active = true;
    dropInterval = BASE_SPEED;
    accumulator = 0;
    lastTimestamp = 0;
    updateUI();
    spawnNewPiece();
    updateStatusUI();
    draw();
  }

  function pauseGame() {
    if (gameOver) return;
    if (active) {
      active = false;
      updateStatusUI();
      draw();
    }
  }

  function resumeOrStart() {
    if (gameOver) {
      fullReset();
    } else if (!active) {
      active = true;
      lastTimestamp = performance.now();
      accumulator = 0;
      updateStatusUI();
      draw();
    }
  }

  function onKeyDown(e) {
    const key = e.key;
    
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      if (gameOver) fullReset();
      else if (active) pauseGame();
      else resumeOrStart();
      return;
    }

    if (gameOver) {
      if (key === 'Enter') {
        e.preventDefault();
        fullReset();
      }
      return;
    }
    
    if (!active) return;
    
    switch (key) {
      case 'ArrowLeft': e.preventDefault(); move(-1,0); break;
      case 'ArrowRight': e.preventDefault(); move(1,0); break;
      case 'ArrowDown': e.preventDefault(); move(0,1); break;
      case 'ArrowUp': e.preventDefault(); rotatePiece(); break;
      case 'Enter': e.preventDefault(); hardDrop(); break; 
      default: break;
    }
  }

  function bindMobileButtons() {
    const btnLeft = document.getElementById('mLeft');
    const btnRight = document.getElementById('mRight');
    const btnDown = document.getElementById('mDown');
    const btnRotate = document.getElementById('mRotate');
    const btnDrop = document.getElementById('mDrop');

    const triggerAction = (action) => {
      if (!active || gameOver) return;
      action();
    };

    btnLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAction(() => move(-1,0)); });
    btnRight.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAction(() => move(1,0)); });
    btnDown.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAction(() => move(0,1)); });
    btnRotate.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAction(() => rotatePiece()); });
    btnDrop.addEventListener('pointerdown', (e) => { e.preventDefault(); triggerAction(() => hardDrop()); });
  }

  function init() {
    fullReset();
    window.addEventListener('keydown', onKeyDown);
    playBtn.addEventListener('click', () => { resumeOrStart(); playBtn.blur(); });
    pauseBtn.addEventListener('click', () => { pauseGame(); pauseBtn.blur(); });
    restartBtn.addEventListener('click', () => { fullReset(); restartBtn.blur(); }); // Restart Action
    bindMobileButtons(); 
    animFrame = requestAnimationFrame(gameLoop);
  }

  init();
})();