/* ==========================================================================
   1. DATA & CONSTANTS
   ========================================================================== */
const WORD_BANK = [
  'sapi', 'bola', 'mata', 'susu', 'kuda',
  'buku', 'kaki', 'roti', 'topi', 'meja',
  'baju', 'pita', 'gigi', 'tali', 'dadu'
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Game State
let currentWordIndex = 0;
let currentSlotIndex = 0;
let isGameRunning = false;
let isCelebrating = false;
let mapLetters = []; // Always maintains exactly 5 items
let celebrationParticles = [];

/* ==========================================================================
   2. AUDIO ENGINE (Web Audio API & Web Speech API)
   ========================================================================== */
let audioCtx = null;
let stepSoundTimer = null;
let isStepPlaying = false;
let speechActiveToken = 0; // Token to cancel pending chained speeches

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Footstep Sound Generator (Procedural pop/thump)
function playSingleStepSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch (e) {
    console.error(e);
  }
}

function startFootstepLoop() {
  if (isStepPlaying) return;
  isStepPlaying = true;
  playSingleStepSound();
  stepSoundTimer = setInterval(() => {
    playSingleStepSound();
  }, 210);
}

function stopFootstepLoop() {
  if (!isStepPlaying) return;
  isStepPlaying = false;
  if (stepSoundTimer) {
    clearInterval(stepSoundTimer);
    stepSoundTimer = null;
  }
}

// Celebration Jingle (Web Audio arpeggio)
function playSuccessJingle() {
  if (!audioCtx) return;
  const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const startTime = audioCtx.currentTime + idx * 0.12;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.3);
  });
}

// Web Speech API Manager (SpeechSynthesis in id-ID)
function cancelAllSpeech() {
  speechActiveToken++; // Invalidate any asynchronous chain
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function speakText(text, rate = 0.85, pitch = 1.1) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'id-ID';
    utterance.rate = rate;
    utterance.pitch = pitch;

    let finished = false;
    const complete = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    utterance.onend = complete;
    utterance.onerror = complete;

    // Fallback timer if browser fails to trigger onend
    setTimeout(complete, 2500);

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Sequence:
 * 1. Bunyi huruf yang dipungut dulu
 * 2. (Jika huruf terkumpul >= 2) Ejaan huruf-huruf terkumpul satu per satu
 * 3. Gabungan bunyinya
 */
async function playProgressiveLetterSequence(pickedChar, collectedWordSoFar) {
  cancelAllSpeech();
  const currentToken = speechActiveToken;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // 1. Bunyi huruf yang baru dipungut dulu
  await speakText(pickedChar.toUpperCase(), 0.85, 1.15);
  if (currentToken !== speechActiveToken) return;

  // 2. Jika huruf terkumpul >= 2, eja huruf lalu sebutkan bunyinya
  if (collectedWordSoFar.length >= 2) {
    await wait(320);
    if (currentToken !== speechActiveToken) return;

    // Eja huruf terkumpul satu per satu
    for (const ch of collectedWordSoFar) {
      await speakText(ch.toUpperCase(), 0.85, 1.1);
      await wait(220);
      if (currentToken !== speechActiveToken) return;
    }

    await wait(280);
    if (currentToken !== speechActiveToken) return;

    // Sebut gabungan bunyinya
    await speakText(collectedWordSoFar.toLowerCase(), 0.85, 1.05);
  }
}

/* ==========================================================================
   3. GAME ENTITIES & CANVAS
   ========================================================================== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Capybara Character
const capybara = {
  x: 240,
  y: 210,
  width: 44,
  height: 34,
  speed: 3.2,
  vx: 0,
  vy: 0,
  facing: 1, // 1 = right, -1 = left
  isWalking: false,
  walkFrameTimer: 0,
  walkFrame: 0,
  bounceY: 0
};

// Responsive Canvas Resize
function resizeCanvas() {
  const wrapper = document.getElementById('canvas-wrapper');
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
  // Clamp capybara within canvas
  capybara.x = Math.max(30, Math.min(canvas.width - 30, capybara.x));
  capybara.y = Math.max(30, Math.min(canvas.height - 30, capybara.y));
}

window.addEventListener('resize', resizeCanvas);

// Letter Spawner (Maintains EXACTLY 5 letters on map)
function getRandomDistractor(targetLetter, existingChars) {
  const candidates = ALPHABET.filter(c => c !== targetLetter && !existingChars.includes(c));
  return candidates[Math.floor(Math.random() * candidates.length)] || 'z';
}

function getSafeSpawnCoords() {
  const padding = 42;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = padding + Math.random() * (canvas.width - padding * 2);
    const y = padding + Math.random() * (canvas.height - padding * 2);

    // Don't spawn on top of capybara
    const distToCapy = Math.hypot(x - capybara.x, y - capybara.y);
    if (distToCapy < 65) continue;

    // Don't spawn on top of existing letters
    const tooClose = mapLetters.some(item => Math.hypot(item.x - x, item.y - y) < 48);
    if (!tooClose) {
      return { x, y };
    }
  }
  return {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2)
  };
}

function initMapLettersForWord() {
  mapLetters = [];
  const currentWord = WORD_BANK[currentWordIndex];
  const targetChar = currentWord[currentSlotIndex];

  // 1 target letter
  const targetPos = getSafeSpawnCoords();
  mapLetters.push({
    char: targetChar,
    isTarget: true,
    x: targetPos.x,
    y: targetPos.y,
    bobOffset: Math.random() * Math.PI * 2
  });

  // 4 distinct distractors (not equal to targetChar)
  const usedChars = [targetChar];
  for (let i = 0; i < 4; i++) {
    const distChar = getRandomDistractor(targetChar, usedChars);
    usedChars.push(distChar);
    const pos = getSafeSpawnCoords();
    mapLetters.push({
      char: distChar,
      isTarget: false,
      x: pos.x,
      y: pos.y,
      bobOffset: Math.random() * Math.PI * 2
    });
  }
}

function replenishLetterAfterPickup() {
  const currentWord = WORD_BANK[currentWordIndex];

  // If word not yet completed, next target letter must exist on map
  if (currentSlotIndex < 4) {
    const nextTargetChar = currentWord[currentSlotIndex];

    // Ensure no distractor on map currently matches the new target or duplicates
    const usedChars = [nextTargetChar];
    mapLetters.forEach(item => {
      if (item.char === nextTargetChar || usedChars.includes(item.char)) {
        item.char = getRandomDistractor(nextTargetChar, usedChars);
      }
      usedChars.push(item.char);
    });

    // Spawn the new target letter
    const pos = getSafeSpawnCoords();
    mapLetters.push({
      char: nextTargetChar,
      isTarget: true,
      x: pos.x,
      y: pos.y,
      bobOffset: Math.random() * Math.PI * 2
    });
  } else {
    // Word is complete, spawn a temporary distractor so map strictly maintains 5 items
    const pos = getSafeSpawnCoords();
    const distChar = getRandomDistractor('', mapLetters.map(m => m.char));
    mapLetters.push({
      char: distChar,
      isTarget: false,
      x: pos.x,
      y: pos.y,
      bobOffset: Math.random() * Math.PI * 2
    });
  }
}

/* ==========================================================================
   4. INPUT HANDLING (Keyboard & Touch D-Pad)
   ========================================================================== */
const keysPressed = {
  up: false,
  down: false,
  left: false,
  right: false
};

window.addEventListener('keydown', (e) => {
  if (!isGameRunning) return;
  if (['ArrowUp', 'KeyW'].includes(e.code)) keysPressed.up = true;
  if (['ArrowDown', 'KeyS'].includes(e.code)) keysPressed.down = true;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keysPressed.left = true;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keysPressed.right = true;
});

window.addEventListener('keyup', (e) => {
  if (['ArrowUp', 'KeyW'].includes(e.code)) keysPressed.up = false;
  if (['ArrowDown', 'KeyS'].includes(e.code)) keysPressed.down = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keysPressed.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keysPressed.right = false;
});

function setupDpadButton(btnId, directionKey) {
  const btn = document.getElementById(btnId);

  const startPress = (e) => {
    e.preventDefault();
    if (!isGameRunning) return;
    keysPressed[directionKey] = true;
    btn.classList.add('pressed');
  };

  const endPress = (e) => {
    e.preventDefault();
    keysPressed[directionKey] = false;
    btn.classList.remove('pressed');
  };

  btn.addEventListener('touchstart', startPress, { passive: false });
  btn.addEventListener('touchend', endPress, { passive: false });
  btn.addEventListener('touchcancel', endPress, { passive: false });
  btn.addEventListener('mousedown', startPress);
  btn.addEventListener('mouseup', endPress);
  btn.addEventListener('mouseleave', endPress);
}

setupDpadButton('btn-up', 'up');
setupDpadButton('btn-down', 'down');
setupDpadButton('btn-left', 'left');
setupDpadButton('btn-right', 'right');

/* ==========================================================================
   5. GAME LOGIC & COLLISION
   ========================================================================== */
function updateGame(deltaTime) {
  if (!isGameRunning) return;

  // Handle Capybara Movement
  let dx = 0;
  let dy = 0;
  if (keysPressed.up) dy -= 1;
  if (keysPressed.down) dy += 1;
  if (keysPressed.left) dx -= 1;
  if (keysPressed.right) dx += 1;

  // Normalize diagonal speed
  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  capybara.vx = dx * capybara.speed;
  capybara.vy = dy * capybara.speed;

  capybara.x += capybara.vx;
  capybara.y += capybara.vy;

  if (dx < 0) capybara.facing = -1;
  if (dx > 0) capybara.facing = 1;

  // Screen boundary clamping
  const margin = 24;
  capybara.x = Math.max(margin, Math.min(canvas.width - margin, capybara.x));
  capybara.y = Math.max(margin, Math.min(canvas.height - margin, capybara.y));

  // Walking state & Footstep sound trigger
  const moving = (dx !== 0 || dy !== 0);
  capybara.isWalking = moving;

  if (moving) {
    startFootstepLoop();
    capybara.walkFrameTimer += deltaTime;
    if (capybara.walkFrameTimer > 0.14) {
      capybara.walkFrame = (capybara.walkFrame + 1) % 2;
      capybara.walkFrameTimer = 0;
    }
  } else {
    stopFootstepLoop();
    capybara.walkFrame = 0;
  }

  // Check Collision with letters on map
  if (!isCelebrating && currentSlotIndex < 4) {
    const currentWord = WORD_BANK[currentWordIndex];
    const neededChar = currentWord[currentSlotIndex];

    for (let i = 0; i < mapLetters.length; i++) {
      const item = mapLetters[i];
      const dist = Math.hypot(capybara.x - item.x, capybara.y - item.y);

      // Touch radius check
      if (dist < 32) {
        if (item.char === neededChar) {
          // CORRECT LETTER COLLECTED!
          onCorrectLetterCollected(item, i);
          break;
        }
        // WRONG LETTER: Do nothing (gentle learning, no penalty)
      }
    }
  }

  // Update Celebration Particles
  if (isCelebrating) {
    celebrationParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.rotation += p.vRot;
    });
    celebrationParticles = celebrationParticles.filter(p => p.y < canvas.height + 20);

    // Happy bouncing capybara
    capybara.bounceY = Math.abs(Math.sin(Date.now() * 0.01)) * -14;
  } else {
    capybara.bounceY = 0;
  }
}

function onCorrectLetterCollected(letterItem, letterIndex) {
  const currentWord = WORD_BANK[currentWordIndex];
  const collectedChar = letterItem.char;

  // Fill slot UI
  const slotEl = document.getElementById(`slot-${currentSlotIndex}`);
  slotEl.textContent = collectedChar.toUpperCase();
  slotEl.classList.remove('active-target');
  slotEl.classList.add('filled');

  // Remove letter from map
  mapLetters.splice(letterIndex, 1);
  currentSlotIndex++;

  // Word collected so far
  const collectedSoFar = currentWord.substring(0, currentSlotIndex);

  // Trigger Web Speech API progressive spelling sequence
  playProgressiveLetterSequence(collectedChar, collectedSoFar);

  // Check if word complete
  if (currentSlotIndex >= 4) {
    replenishLetterAfterPickup();
    triggerWordCelebration();
  } else {
    // Replenish 1 letter to keep map strictly 5 letters
    replenishLetterAfterPickup();
    updateActiveSlotHighlight();
  }
}

function updateActiveSlotHighlight() {
  for (let i = 0; i < 4; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    if (i === currentSlotIndex && !isCelebrating) {
      slotEl.classList.add('active-target');
    } else {
      slotEl.classList.remove('active-target');
    }
  }
}

function triggerWordCelebration() {
  isCelebrating = true;
  playSuccessJingle();
  updateActiveSlotHighlight();

  // Spawn confetti particles
  celebrationParticles = [];
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ffffff'];
  for (let i = 0; i < 50; i++) {
    celebrationParticles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 160,
      y: canvas.height / 2 - 40,
      vx: (Math.random() - 0.5) * 8,
      vy: -4 - Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }

  // After 3.5s transition to next word (gives enough time for full speech sequence)
  setTimeout(() => {
    advanceToNextWord();
  }, 3500);
}

function advanceToNextWord() {
  isCelebrating = false;
  currentWordIndex++;

  if (currentWordIndex >= WORD_BANK.length) {
    showVictoryScreen();
    return;
  }

  loadWord(currentWordIndex);
}

function loadWord(index) {
  currentWordIndex = index;
  currentSlotIndex = 0;
  isCelebrating = false;

  // Update UI Header
  const targetWord = WORD_BANK[currentWordIndex];
  document.getElementById('current-target-name').textContent = targetWord.toUpperCase();
  document.getElementById('level-indicator').textContent = `Kata ${currentWordIndex + 1} dari ${WORD_BANK.length}`;

  // Reset Slots
  for (let i = 0; i < 4; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    slotEl.textContent = '';
    slotEl.className = 'letter-slot';
  }
  updateActiveSlotHighlight();

  // Reset Map Letters (Always 5: 1 target + 4 distractors)
  initMapLettersForWord();
}

function showVictoryScreen() {
  isGameRunning = false;
  stopFootstepLoop();
  document.getElementById('victory-overlay').classList.remove('hidden');
  speakText('Hebat sekali! Kamu berhasil membaca semua kata!', 0.9, 1.2);
}

/* ==========================================================================
   6. RENDERING ENGINE (Pixel Art Aesthetic)
   ========================================================================== */
function drawPixelArtCapybara(ctx, x, y, facing, isWalking, walkFrame, bounceY) {
  ctx.save();
  ctx.translate(x, y + bounceY);
  ctx.scale(facing, 1);

  // Shadow
  ctx.fillStyle = 'rgba(25, 45, 15, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 20, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Capybara Body (Chunky retro pixel shapes)
  // Feet
  ctx.fillStyle = '#4a2e12';
  const legOffset = (isWalking && walkFrame === 1) ? 3 : 0;
  ctx.fillRect(-14 + legOffset, 10, 6, 8); // Back left leg
  ctx.fillRect(-6 - legOffset, 10, 6, 8);  // Back right leg
  ctx.fillRect(4 + legOffset, 10, 6, 8);   // Front left leg
  ctx.fillRect(12 - legOffset, 10, 6, 8);  // Front right leg

  // Main Torso
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(-18, -4, 34, 18);
  // Highlights/belly
  ctx.fillStyle = '#a26b34';
  ctx.fillRect(-16, -2, 30, 14);

  // Head
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(4, -18, 18, 18);
  // Snout
  ctx.fillStyle = '#5c3a1b';
  ctx.fillRect(14, -12, 10, 12);
  // Nostril
  ctx.fillStyle = '#2d1b0c';
  ctx.fillRect(21, -8, 2, 3);

  // Ear
  ctx.fillStyle = '#5c3a1b';
  ctx.fillRect(6, -21, 5, 5);

  // Eye (Relaxed/Cute Kawaii eye)
  ctx.fillStyle = '#1a1007';
  ctx.fillRect(11, -13, 3, 3);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(12, -13, 1, 1);

  // Iconic Pixel Orange on Head 🍊
  ctx.fillStyle = '#ff7b00';
  ctx.fillRect(8, -26, 7, 6);
  ctx.fillStyle = '#ffa726';
  ctx.fillRect(9, -25, 5, 4);
  // Leaf
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(11, -28, 3, 2);

  ctx.restore();
}

function renderGame() {
  // Clear Background
  ctx.fillStyle = '#5bb344';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grass tufts / decorative pixel flowers
  ctx.fillStyle = '#4fa338';
  for (let i = 20; i < canvas.width; i += 70) {
    for (let j = 25; j < canvas.height; j += 75) {
      ctx.fillRect(i, j, 4, 3);
      ctx.fillRect(i + 2, j - 2, 3, 3);
    }
  }

  // Draw Letters on Map (Exactly 5)
  const now = Date.now() * 0.004;
  mapLetters.forEach(item => {
    const floatY = item.y + Math.sin(now + item.bobOffset) * 3;

    // Tile shadow
    ctx.fillStyle = 'rgba(20, 40, 10, 0.25)';
    ctx.beginPath();
    ctx.ellipse(item.x, item.y + 14, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tile background (Golden wooden token)
    ctx.fillStyle = '#3a2410';
    ctx.beginPath();
    ctx.arc(item.x, floatY, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffeaa7';
    ctx.beginPath();
    ctx.arc(item.x, floatY - 2, 15, 0, Math.PI * 2);
    ctx.fill();

    // Letter text
    ctx.fillStyle = '#3a2410';
    ctx.font = 'bold 20px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.char.toUpperCase(), item.x, floatY - 2);
  });

  // Draw Capybara
  drawPixelArtCapybara(
    ctx,
    capybara.x,
    capybara.y,
    capybara.facing,
    capybara.isWalking,
    capybara.walkFrame,
    capybara.bounceY
  );

  // Draw Confetti
  celebrationParticles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  });
}

/* ==========================================================================
   7. MAIN GAME LOOP
   ========================================================================== */
let lastTime = performance.now();
function gameLoop(time) {
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  updateGame(deltaTime);
  renderGame();

  requestAnimationFrame(gameLoop);
}

/* ==========================================================================
   8. INITIALIZATION & BUTTONS
   ========================================================================== */
document.getElementById('start-btn').addEventListener('click', () => {
  initAudio();
  cancelAllSpeech();
  document.getElementById('start-overlay').classList.add('hidden');
  resizeCanvas();
  loadWord(0);
  isGameRunning = true;
  // Friendly voice intro
  speakText('Ayo cari kata: ' + WORD_BANK[0], 0.9, 1.1);
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('victory-overlay').classList.add('hidden');
  loadWord(0);
  isGameRunning = true;
});

// Start render loop immediately (shows background while in start overlay)
resizeCanvas();
requestAnimationFrame(gameLoop);
