/* ==========================================================================
   1. DATA & CONSTANTS (15 KATA BENDA 4 HURUF DENGAN EMOJI JELAS)
   ========================================================================== */
const WORD_BANK = [
  { word: 'sapi', emoji: '🐄' },
  { word: 'bola', emoji: '⚽' },
  { word: 'mata', emoji: '👁️' },
  { word: 'susu', emoji: '🥛' },
  { word: 'kuda', emoji: '🐴' },
  { word: 'buku', emoji: '📖' },
  { word: 'kaki', emoji: '🦶' },
  { word: 'roti', emoji: '🍞' },
  { word: 'topi', emoji: '🧢' },
  { word: 'baju', emoji: '👕' },
  { word: 'pita', emoji: '🎀' },
  { word: 'gigi', emoji: '🦷' },
  { word: 'ikan', emoji: '🐟' },
  { word: 'apel', emoji: '🍎' },
  { word: 'dadu', emoji: '🎲' }
];

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Game State
let currentWordIndex = 0;
let currentSlotIndex = 0;
let isGameRunning = false;
let isCelebrating = false;
let mapLetters = []; // Strictly maintains 5 letters on map with normalized (u, v) positions
let celebrationParticles = []; // Confetti & hearts
let pickupSparkles = [];       // Sparkles on pickup

// Capybara Character (Stored with normalized position u, v: 0.0 - 1.0)
const capybara = {
  u: 0.5, // 0.0 - 1.0 (proportion of arena width)
  v: 0.5, // 0.0 - 1.0 (proportion of arena height)
  vx: 0,
  vy: 0,
  facing: 1, // 1 = right, -1 = left
  isWalking: false,
  walkTimer: 0,
  walkFrame: 0,
  hopY: 0,
  hopTimer: 0,
  // Idle blinking & breathing
  blinkTimer: 0,
  isBlinking: false
};

/* ==========================================================================
   2. AUDIO ENGINE (Web Audio API & Web Speech API)
   ========================================================================== */
let audioCtx = null;
let stepSoundTimer = null;
let isStepPlaying = false;
let speechActiveToken = 0; // Token to cancel pending chained speech

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Procedural Footstep Sound (Web Audio API soft thud)
function playSingleStepSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);

    gain.gain.setValueAtTime(0.16, now);
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

// "CLINK" Sound Effect: 2 rapid rising bright bell/chime tones (~0.25s)
function playClinkSound() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;

    // Tone 1: High crisp bell note (C6 ~ 1046 Hz)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now);

    gain1.gain.setValueAtTime(0.22, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // Tone 2: Rapid rising higher note (E6 ~ 1318.5 Hz / G6 ~ 1568 Hz)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1567.98, now + 0.07);

    gain2.gain.setValueAtTime(0.24, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.3);
  } catch (e) {
    console.error(e);
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

    gain.gain.setValueAtTime(0.22, startTime);
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
 * Full Audio Sequence on Pickup:
 * 1. Clink sound (Web Audio)
 * 2. Bunyi huruf yang baru dipungut
 * 3. (Jika huruf terkumpul >= 2) Ejaan huruf-huruf terkumpul satu per satu
 * 4. Gabungan bunyinya
 */
async function playProgressiveLetterSequence(pickedChar, collectedWordSoFar) {
  cancelAllSpeech();
  const currentToken = speechActiveToken;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // 1. Bunyi clink dimainkan secara instan di Web Audio
  playClinkSound();

  // Tunggu sejenak agar efek clink terdengar jernih
  await wait(240);
  if (currentToken !== speechActiveToken) return;

  // 2. Bunyi huruf itu dulu
  await speakText(pickedChar.toUpperCase(), 0.85, 1.15);
  if (currentToken !== speechActiveToken) return;

  // 3. Jika huruf terkumpul >= 2, eja huruf lalu sebutkan bunyinya
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
   3. CANVAS, ARENA & PROPORTIONAL SIZING
   ========================================================================== */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvas-wrapper');

let arenaWidth = 480;
let arenaHeight = 420;
let arenaShortest = 420;

function resizeArena() {
  const rect = canvasWrapper.getBoundingClientRect();
  arenaWidth = Math.max(280, rect.width);
  arenaHeight = Math.max(240, rect.height);
  arenaShortest = Math.min(arenaWidth, arenaHeight);

  // HiDPI / Retina Crisp Pixel Art
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(arenaWidth * dpr);
  canvas.height = Math.round(arenaHeight * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', resizeArena);

/* ==========================================================================
   4. SPAWNER: RESET PENUH TIAP PUNGUT (5 HURUF DI MAP)
   ========================================================================== */
function getRandomDistractor(targetLetter, existingChars) {
  const candidates = ALPHABET.filter(c => c !== targetLetter && !existingChars.includes(c));
  return candidates[Math.floor(Math.random() * candidates.length)] || 'z';
}

/**
 * Reset penuh seluruh huruf di map setiap kali ada huruf yang dipungut
 * Menghasilkan: 1 target berikutnya + 4 pengecoh acak (total tepat 5).
 * Posisi disimpan sebagai proporsi u, v (0.0 s.d. 1.0)
 */
function resetAllMapLetters() {
  mapLetters = [];
  const currentWordObj = WORD_BANK[currentWordIndex];
  const targetChar = (currentSlotIndex < 4) ? currentWordObj.word[currentSlotIndex] : '';

  // Huruf yang akan di-spawn:
  const lettersToSpawn = [];
  if (targetChar) {
    lettersToSpawn.push({ char: targetChar, isTarget: true });
  }

  // Lengkapi dengan pengecoh sampai tepat 5 huruf
  const usedChars = targetChar ? [targetChar] : [];
  while (lettersToSpawn.length < 5) {
    const distChar = getRandomDistractor(targetChar, usedChars);
    usedChars.push(distChar);
    lettersToSpawn.push({ char: distChar, isTarget: false });
  }

  // Cari 5 posisi acak yang aman dan tidak bertumpuk
  // Batas aman: u dalam [0.10, 0.90], v dalam [0.12, 0.88]
  const minDistance = 0.16; // minimal 16% jarak antar huruf
  const minCapyDistance = 0.20; // minimal 20% jarak dari kapibara

  lettersToSpawn.forEach(item => {
    let bestU = 0.5;
    let bestV = 0.5;
    let found = false;

    for (let attempt = 0; attempt < 120; attempt++) {
      const u = 0.10 + Math.random() * 0.80;
      const v = 0.12 + Math.random() * 0.76;

      // Jarak ke kapibara
      const distToCapy = Math.hypot(u - capybara.u, v - capybara.v);
      if (distToCapy < minCapyDistance) continue;

      // Jarak ke huruf lain
      const tooCloseToOther = mapLetters.some(other => Math.hypot(u - other.u, v - other.v) < minDistance);
      if (!tooCloseToOther) {
        bestU = u;
        bestV = v;
        found = true;
        break;
      }
    }

    if (!found) {
      bestU = 0.10 + Math.random() * 0.80;
      bestV = 0.12 + Math.random() * 0.76;
    }

    mapLetters.push({
      char: item.char,
      isTarget: item.isTarget,
      u: bestU,
      v: bestV,
      bobOffset: Math.random() * Math.PI * 2
    });
  });
}

/* ==========================================================================
   5. INPUT HANDLING (Keyboard & Touch D-Pad)
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
  if (!btn) return;

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
   6. GAME LOGIC & COLLISION
   ========================================================================== */
function updateGame(deltaTime) {
  if (!isGameRunning) return;

  // Gerakan Kapibara Proporsional
  let dx = 0;
  let dy = 0;
  if (keysPressed.up) dy -= 1;
  if (keysPressed.down) dy += 1;
  if (keysPressed.left) dx -= 1;
  if (keysPressed.right) dx += 1;

  if (dx !== 0 && dy !== 0) {
    dx *= 0.7071;
    dy *= 0.7071;
  }

  // Kecepatan dihitung proporsional terhadap ukuran arena (~44% shortest side per detik)
  const speedInPixels = arenaShortest * 0.44;
  const moveX = dx * speedInPixels * deltaTime;
  const moveY = dy * speedInPixels * deltaTime;

  capybara.u += moveX / arenaWidth;
  capybara.v += moveY / arenaHeight;

  if (dx < 0) capybara.facing = -1;
  if (dx > 0) capybara.facing = 1;

  // Batas arena aman
  capybara.u = Math.max(0.06, Math.min(0.94, capybara.u));
  capybara.v = Math.max(0.08, Math.min(0.92, capybara.v));

  // Animasi Jalan & Suara Langkah
  const moving = (dx !== 0 || dy !== 0);
  capybara.isWalking = moving;

  if (moving) {
    startFootstepLoop();
    capybara.walkTimer += deltaTime * 8;
  } else {
    stopFootstepLoop();
    capybara.walkTimer = 0;
  }

  // Idle Blinking (berkedip tiap 3.5 - 5 detik)
  capybara.blinkTimer += deltaTime;
  if (capybara.blinkTimer > 3.8) {
    capybara.isBlinking = true;
    if (capybara.blinkTimer > 4.0) {
      capybara.isBlinking = false;
      capybara.blinkTimer = Math.random() * 0.5;
    }
  }

  // Hop Animasi Saat Pungut
  if (capybara.hopTimer > 0) {
    capybara.hopTimer -= deltaTime;
    capybara.hopY = Math.sin((1 - capybara.hopTimer / 0.35) * Math.PI) * -16;
  } else {
    capybara.hopY = 0;
  }

  // Update Sparkles Pungut Huruf
  pickupSparkles.forEach(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.alpha -= deltaTime * 2.2;
    s.size *= 0.96;
  });
  pickupSparkles = pickupSparkles.filter(s => s.alpha > 0.05);

  // Update Confetti & Hearts Selesai Kata
  if (isCelebrating) {
    celebrationParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.rotation += p.vRot;
    });
    celebrationParticles = celebrationParticles.filter(p => p.y < arenaHeight + 30);
    // Lompat tinggi saat perayaan kata
    capybara.hopY = Math.abs(Math.sin(Date.now() * 0.012)) * -24;
  }

  // Deteksi Tabrakan dengan Huruf
  if (!isCelebrating && currentSlotIndex < 4) {
    const currentWordObj = WORD_BANK[currentWordIndex];
    const neededChar = currentWordObj.word[currentSlotIndex];

    const capyPixelX = capybara.u * arenaWidth;
    const capyPixelY = capybara.v * arenaHeight;
    const letterRadius = arenaShortest * 0.072; // 14.4% diameter
    const hitDistance = letterRadius * 1.55;

    for (let i = 0; i < mapLetters.length; i++) {
      const item = mapLetters[i];
      const itemPixelX = item.u * arenaWidth;
      const itemPixelY = item.v * arenaHeight;

      const dist = Math.hypot(capyPixelX - itemPixelX, capyPixelY - itemPixelY);

      if (dist < hitDistance) {
        if (item.char === neededChar) {
          // HURUF BENAR DIPUNGUT!
          onCorrectLetterCollected(item.char);
          break;
        }
        // HURUF PENGECOH: Diam, tanpa suara apa pun (gentle learning)
      }
    }
  }
}

function onCorrectLetterCollected(collectedChar) {
  const currentWordObj = WORD_BANK[currentWordIndex];

  // Efek lompat kecil & sparkle
  capybara.hopTimer = 0.35;
  spawnPickupSparkles(capybara.u * arenaWidth, capybara.v * arenaHeight);

  // Isi Slot UI
  const slotEl = document.getElementById(`slot-${currentSlotIndex}`);
  slotEl.textContent = collectedChar.toUpperCase();
  slotEl.classList.remove('active-target');
  slotEl.classList.add('filled');

  currentSlotIndex++;

  // Kata yang terkumpul sejauh ini
  const collectedSoFar = currentWordObj.word.substring(0, currentSlotIndex);

  // Mainkan urutan suara: Clink -> Huruf -> Ejaan -> Gabungan
  playProgressiveLetterSequence(collectedChar, collectedSoFar);

  // ATURAN 1: RESET PENUH SELURUH HURUF DI MAP
  resetAllMapLetters();

  // Cek apakah kata sudah selesai (4 huruf)
  if (currentSlotIndex >= 4) {
    triggerWordCelebration();
  } else {
    updateActiveSlotHighlight();
  }
}

function spawnPickupSparkles(x, y) {
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 4;
    pickupSparkles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 1,
      size: 5 + Math.random() * 5,
      alpha: 1.0,
      color: Math.random() > 0.4 ? '#ffea00' : '#ffffff'
    });
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

  // Confetti dan hati beterbangan
  celebrationParticles = [];
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#ff70a6', '#ffffff'];
  for (let i = 0; i < 48; i++) {
    celebrationParticles.push({
      x: arenaWidth / 2 + (Math.random() - 0.5) * arenaWidth * 0.4,
      y: arenaHeight / 2 - 20,
      vx: (Math.random() - 0.5) * 8,
      vy: -5 - Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 7 + Math.random() * 7,
      rotation: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 0.25,
      isHeart: i % 4 === 0
    });
  }

  // Transisi ke kata berikutnya setelah 3.5 detik (memberi waktu bagi ejaan selesai diucapkan)
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

  const currentObj = WORD_BANK[currentWordIndex];

  // Update UI Header dengan Emoji
  document.getElementById('word-emoji').textContent = currentObj.emoji;
  document.getElementById('current-target-name').textContent = currentObj.word.toUpperCase();
  document.getElementById('level-indicator').textContent = `Kata ${currentWordIndex + 1} dari ${WORD_BANK.length}`;

  // Reset Slots
  for (let i = 0; i < 4; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    slotEl.textContent = '';
    slotEl.className = 'letter-slot';
  }
  updateActiveSlotHighlight();

  // Reset Map Letters (5 huruf baru di posisi acak)
  resetAllMapLetters();
}

function showVictoryScreen() {
  isGameRunning = false;
  stopFootstepLoop();
  document.getElementById('victory-overlay').classList.remove('hidden');
  speakText('Hebat sekali! Kamu berhasil membaca semua kata!', 0.9, 1.2);
}

/* ==========================================================================
   7. CHIBI GEMOY CAPYBARA PIXEL ART RENDERING
   ========================================================================== */
function drawChibiCapybara(ctx, x, y, size, facing, isWalking, walkTimer, hopY, isBlinking) {
  ctx.save();
  ctx.translate(x, y + hopY);
  ctx.scale(facing, 1);

  // Skala dasar berdasarkan proporsi arena
  const scale = size / 54;
  ctx.scale(scale, scale);

  // Waddle & Squash-and-stretch
  let squashX = 1;
  let squashY = 1;
  let waddleAngle = 0;

  if (isWalking) {
    const bounce = Math.sin(walkTimer);
    squashX = 1 + bounce * 0.06;
    squashY = 1 - bounce * 0.06;
    waddleAngle = Math.sin(walkTimer * 0.5) * 0.08;
  } else {
    // Breathing idle pelan
    const breath = Math.sin(Date.now() * 0.003) * 0.03;
    squashY = 1 + breath;
  }

  ctx.rotate(waddleAngle);
  ctx.scale(squashX, squashY);

  // 1. Bayangan Lembut di Bawah
  ctx.fillStyle = 'rgba(20, 35, 10, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 24 * squashX, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Kaki Mungil Gemuk
  ctx.fillStyle = '#5c3818';
  const legSwing = isWalking ? Math.sin(walkTimer) * 5 : 0;
  // Kaki belakang kiri & kanan
  ctx.fillRect(-16 + legSwing, 14, 8, 9);
  ctx.fillRect(-6 - legSwing, 14, 8, 9);
  // Kaki depan kiri & kanan
  ctx.fillRect(8 + legSwing, 14, 8, 9);
  ctx.fillRect(18 - legSwing, 14, 8, 9);

  // 3. Badan Gemuk Pendek Bulat (Torso)
  ctx.fillStyle = '#9b6332';
  ctx.beginPath();
  ctx.ellipse(-2, 4, 25, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Perut lembut / highlight hangat
  ctx.fillStyle = '#b3783e';
  ctx.beginPath();
  ctx.ellipse(-2, 6, 21, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Kepala Bulat Besar Menggemaskan
  ctx.fillStyle = '#9b6332';
  ctx.beginPath();
  ctx.ellipse(14, -8, 19, 17, 0, 0, Math.PI * 2);
  ctx.fill();

  // Moncong / Pipi chubby
  ctx.fillStyle = '#855125';
  ctx.beginPath();
  ctx.ellipse(22, -4, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // 5. Telinga Bulat Kecil
  ctx.fillStyle = '#6e3e15';
  ctx.beginPath();
  ctx.ellipse(8, -23, 5, 6, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9999';
  ctx.beginPath();
  ctx.ellipse(8, -23, 2.5, 3.5, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // 6. Mata Besar Hitam dengan Pantulan Binar Putih (Kawaii Chibi Eye)
  if (!isBlinking) {
    ctx.fillStyle = '#140c06';
    ctx.beginPath();
    ctx.arc(17, -10, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Pantulan binar putih besar & kecil
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(18.2, -11.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Mata berkedip: garis lengkung senang ^_^
    ctx.strokeStyle = '#140c06';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(17, -8, 4, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }

  // 7. Pipi Pink Merona (Blush)
  ctx.fillStyle = 'rgba(255, 120, 150, 0.65)';
  ctx.beginPath();
  ctx.ellipse(14, -2, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 8. Hidung & Senyum Kecil Imut
  ctx.fillStyle = '#3a200a';
  ctx.fillRect(30, -6, 3, 3);

  ctx.strokeStyle = '#3a200a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(28, -2, 2.8, 0, Math.PI * 0.85);
  ctx.stroke();

  // 9. Jeruk Yuzu Mini di Kepala 🍊
  ctx.fillStyle = '#ff7b00';
  ctx.beginPath();
  ctx.arc(14, -26, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb300';
  ctx.beginPath();
  ctx.arc(12.5, -27.5, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Daun jeruk
  ctx.fillStyle = '#43a047';
  ctx.beginPath();
  ctx.ellipse(17, -31, 3.5, 1.8, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ==========================================================================
   8. RENDERING ENGINE
   ========================================================================== */
function renderGame() {
  // Clear Background Padang Rumput
  ctx.fillStyle = '#5bb344';
  ctx.fillRect(0, 0, arenaWidth, arenaHeight);

  // Ornamen Rumput Pixel
  ctx.fillStyle = '#4fa338';
  const gridStep = Math.max(40, arenaShortest * 0.14);
  for (let x = 20; x < arenaWidth; x += gridStep) {
    for (let y = 20; y < arenaHeight; y += gridStep) {
      ctx.fillRect(x, y, 4, 3);
      ctx.fillRect(x + 2, y - 2, 3, 3);
    }
  }

  // 1. Gambar 5 Huruf Koin di Map (Diameter 13% - 15% dari S)
  const letterRadius = arenaShortest * 0.072;
  const now = Date.now() * 0.0035;

  mapLetters.forEach(item => {
    const px = item.u * arenaWidth;
    const py = item.v * arenaHeight;
    const floatY = py + Math.sin(now + item.bobOffset) * 4;

    // Bayangan Koin
    ctx.fillStyle = 'rgba(20, 40, 10, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + letterRadius * 0.9, letterRadius * 0.95, letterRadius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lingkaran Luar Koin (Golden Retro Coin)
    ctx.fillStyle = '#4a2f14';
    ctx.beginPath();
    ctx.arc(px, floatY, letterRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffcf33';
    ctx.beginPath();
    ctx.arc(px, floatY - 2, letterRadius * 0.92, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff4cc';
    ctx.beginPath();
    ctx.arc(px, floatY - 3, letterRadius * 0.78, 0, Math.PI * 2);
    ctx.fill();

    // Huruf Tebal & Jelas
    ctx.fillStyle = '#3a200a';
    ctx.font = `900 ${Math.round(letterRadius * 1.15)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.char.toUpperCase(), px, floatY - 2);
  });

  // 2. Gambar Karakter Kapibara Chibi (Ukuran 16% - 18% dari S)
  const capyPixelX = capybara.u * arenaWidth;
  const capyPixelY = capybara.v * arenaHeight;
  const capySize = arenaShortest * 0.17;

  drawChibiCapybara(
    ctx,
    capyPixelX,
    capyPixelY,
    capySize,
    capybara.facing,
    capybara.isWalking,
    capybara.walkTimer,
    capybara.hopY,
    capybara.isBlinking
  );

  // 3. Gambar Sparkle Pungut Huruf
  pickupSparkles.forEach(s => {
    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = s.color;
    // Bintang 4 titik
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.size);
    ctx.lineTo(s.x + s.size * 0.35, s.y);
    ctx.lineTo(s.x, s.y + s.size);
    ctx.lineTo(s.x - s.size * 0.35, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // 4. Gambar Confetti & Hati Perayaan Kata
  celebrationParticles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.isHeart) {
      // Gambar Hati Kecil Merah Muda
      ctx.fillStyle = '#ff4d6d';
      ctx.font = `${Math.round(p.size * 1.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', 0, 0);
    } else {
      // Confetti Kotak Pixel Art
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }
    ctx.restore();
  });
}

/* ==========================================================================
   9. MAIN GAME LOOP
   ========================================================================== */
let lastTime = performance.now();
function gameLoop(time) {
  const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  updateGame(deltaTime);
  renderGame();

  requestAnimationFrame(gameLoop);
}

/* ==========================================================================
   10. INITIALIZATION & BUTTONS
   ========================================================================== */
document.getElementById('start-btn').addEventListener('click', () => {
  initAudio();
  cancelAllSpeech();
  document.getElementById('start-overlay').classList.add('hidden');
  resizeArena();
  loadWord(0);
  isGameRunning = true;
  // Suara panduan awal
  speakText('Ayo cari kata ' + WORD_BANK[0].word, 0.9, 1.1);
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('victory-overlay').classList.add('hidden');
  loadWord(0);
  isGameRunning = true;
});

// Jalankan penyesuaian ukuran awal dan game loop
resizeArena();
requestAnimationFrame(gameLoop);
