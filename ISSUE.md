# ISSUE: Pengembangan Game Edukasi "Kapibara Cari Huruf" (Single-File HTML5)

## 📌 Ringkasan Proyek
Mengembangkan game edukasi web berbasis **Pixel Art** untuk membantu anak TK (Naqiyya) belajar membaca kata secara interaktif dan menyenangkan. 

Output akhir berupa **satu file statis tunggal (`index.html`)** yang menggabungkan HTML, CSS, dan JavaScript tanpa framework eksternal, tanpa dependensi build step (bundler/npm), dan siap langsung di-host di **GitHub Pages**.

---

## 🎯 Target Pengguna & Karakteristik UX
- **Target Pemain**: Anak usia taman kanak-kanak (TK).
- **Target Perangkat**: Ponsel dan Tablet (layar sentuh) dalam orientasi layar yang nyaman (responsif/portrait & landscape friendly).
- **Filosofi Belajar (Gentle Learning)**: 
  - Tidak ada sistem *game over*, penalti skor, atau efek suara "salah/mengejek" yang membuat anak minder.
  - Interaksi positif dan perayaan keberhasilan yang ceria.
  - Elemen kontrol sentuh berukuran besar dan ramah jari anak kecil.
- **Gaya Visual**: 8-bit retro pixel art, warna cerah ceria, font bergaya pixel/rounded yang jelas dibaca anak.

---

## 🛑 Aturan Domain & Batasan Ketat (Non-Negotiable)

1. **Whitelist Huruf Naqiyya (Strict Alphabet Whitelist)**:
   - Huruf yang boleh muncul di game (baik sebagai target kata maupun pengecoh di map) **HANYA**:
     - **Vokal**: `a`, `i`, `u`, `e`, `o`
     - **Konsonan**: `m`, `s`, `t`, `b`, `l`, `n`, `d`, `g`, `c`, `z`
   - ⚠️ **DILARANG KERAS** memunculkan huruf di luar daftar di atas (misal: *k, p, r, w, y, f, v, j, h, q, x*).

2. **Daftar Kata Target**:
   - Kata target harus tersusun **hanya** dari kombinasi huruf whitelist di atas.
   - Panjang kata: **2 huruf** (tingkat awal) lalu meningkat ke **4 huruf** (tingkat lanjut).
   - Rekomendasi bank kata terkurasi yang valid:
     - *2 Huruf*: `di`, `es`, `om`, `ma`, `mi`
     - *4 Huruf*: `susu`, `mata`, `sate`, `bola`, `batu`, `gigi`, `tali`, `dadu`, `bisa`, `bela`, `dasi`, `lima`, `madu`, `nasi`, `satu`, `tamu`, `zona`

3. **Mekanisme Suara Tanpa File Aset Eksternal**:
   - **Web Audio API**: Digunakan untuk mensintesis efek suara langkah kaki kapibara (procedural audio oscillator/noise pendek berulang) dan jingle perayaan.
   - **Web Speech API (`window.speechSynthesis`)**: Digunakan untuk suara fonik huruf dan pembacaan ejaan bahasa Indonesia (`id-ID`). Tidak menggunakan file audio rekaman `.mp3`/`.wav`.

4. **Keseimbangan Pool Huruf di Peta (Constant 5 Letters)**:
   - Jumlah huruf aktif di arena permainan **selalu dijaga persis 5 huruf**:
     - **1 huruf target** berikutnya yang sedang dibutuhkan dalam kata.
     - **4 huruf pengecoh** acak yang diambil dari whitelist.
   - Setiap kali huruf target berhasil dipungut:
     - Huruf tersebut dihapus dari map dan mengisi slot kata di atas.
     - Satu huruf pengganti di-spawn di map agar jumlah kembali menjadi 5.

5. **Logika Suara Ejaan Bertahap (Progressive Spelling Queue)**:
   - Saat kapibara memungut huruf target yang benar:
     - Langkah A: Bunyikan nama huruf itu sendiri terlebih dahulu (contoh: huruf `"t"` dibunyikan *"T"*).
     - Langkah B: Jika huruf yang terkumpul sejauh ini $\ge 2$ huruf, lanjutkan dengan mengeja huruf-huruf yang sudah terkumpul satu per satu, kemudian gabungan bunyinya (contoh jika mengumpulkan kata `m-a-t-a`, setelah memungut `t`: suarakan *"T"*, lalu jeda, lalu eja *"M... A... T"*, lalu sebut suku kata/potongan *"MAT"*).

6. **Toleransi Huruf Salah**:
   - Jika kapibara menabrak huruf yang bukan urutan berikutnya:
     - Huruf tetap di tempatnya (tidak terambil).
     - Tidak ada suara buzzer/tetot atau tanda silang merah.
     - Kapibara cukup berjalan melewatinya seolah tidak ada peristiwa negatif.

---

## 🏗️ Arsitektur Teknis (Single-File Architecture)

Semua komponen disatukan dalam satu file `index.html`:
```text
index.html
├── <head>
│   ├── Meta viewport responsif (disable accidental pinch-zoom pada touch controller)
│   └── <style> : CSS Reset, Pixel Art rendering rule, Grid Layout, Touch D-Pad styling
├── <body>
│   ├── Header UI : Slot Kata Target & Indikator Level ("Kata ke-X dari Y")
│   ├── Game Canvas / Play Area : Arena pergerakan kapibara & huruf-huruf
│   └── Controller UI : Tombol D-Pad sentuh on-screen berukuran besar
└── <script> : Seluruh logika JavaScript modular
    ├── Configuration & Constants (Whitelist huruf, bank kata)
    ├── Audio Engine (Web Audio API procedural sound synthesizer)
    ├── Speech Synthesis Service (Web Speech API id-ID queue manager)
    ├── Game State & Logic (Urutan kata, slot aktif, level progress)
    ├── Spawner & Grid/Collision Manager (Menjaga 5 huruf di map)
    ├── Entity: Kapibara (Posisi, sprite pixel procedural/SVG/Canvas, animasi jalan)
    ├── Input Handler (Keyboard arrow keys + Touch event listeners dengan preventDefault)
    └── Main Game Loop (requestAnimationFrame)
```

---

## 📋 Tahapan Pengerjaan Step-by-Step (Untuk Eksekusi AI)

Instruksi ini disusun berurutan agar dapat diimplementasikan dan diuji langkah demi langkah:

### Tahap 1: Kerangka HTML, Viewport & Styling Pixel Art
- Buat file `index.html` dengan struktur dasar.
- Konfigurasi viewport mobile (`user-scalable=no`, `viewport-fit=cover`).
- Terapkan CSS reset dan aturan rendering pixel art (`image-rendering: pixelated`).
- Siapkan layout 3 bagian:
  1. Baris atas: Header info level dan kotak slot kata target.
  2. Area tengah: Canvas game 2D (rasio responsif yang pas di layar HP/tablet).
  3. Baris bawah: Kontrol sentuh D-Pad 4 arah berukuran besar (minimal tombol 64px–72px).

### Tahap 2: Manajemen Data & Whitelist Validator
- Definisikan array whitelist huruf: `['a', 'i', 'u', 'e', 'o', 'm', 's', 't', 'b', 'l', 'n', 'd', 'g', 'c', 'z']`.
- Definisikan daftar kata target terurut (mulai dari 2 huruf, lalu 4 huruf).
- Buat fungsi pembantu:
  - Generator huruf pengecoh acak (hanya mengambil dari array whitelist selain huruf target saat ini).
  - Validasi kata agar tidak ada kata yang lolos jika mengandung huruf non-whitelist.

### Tahap 3: Karakter Kapibara & Game Loop
- Buat entitas Kapibara pada Canvas (bisa digambar menggunakan pixel drawing 2D canvas sederhana atau data matrix sprite retro).
- Implementasikan game loop (`requestAnimationFrame`) dengan kalkulasi delta-time.
- Tambahkan properti posisi `(x, y)`, arah hadap (kiri/kanan), dan state berjalan (idle vs walking).
- Buat animasi kaki melangkah sederhana (flip frame kaki saat state walking).

### Tahap 4: Sistem Kontrol (Keyboard & Touch D-Pad)
- Tambahkan listener keyboard (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, serta `WASD`).
- Tambahkan listener touch event (`touchstart`, `touchend`, `touchcancel`) pada tombol D-Pad on-screen:
  - Gunakan `e.preventDefault()` untuk mencegah double-tap zoom atau scrolling layar browser.
  - Pastikan tombol mendukung penahanan jari (continuous movement selama tombol disentuh).

### Tahap 5: Efek Suara Langkah (Web Audio API)
- Inisialisasi `AudioContext` pada interaksi pertama pengguna (mengatasi autoplay policy browser).
- Buat sintesis suara langkah kaki pendek (misal: noise burst atau nada frekuensi rendah 100-150Hz berdurasi 0.05-0.08 detik).
- Sambungkan dengan state berjalan kapibara:
  - Suara dimainkan berulang dengan interval teratur (~200ms) saat bergerak.
  - Suara langsung berhenti seketika saat kapibara berhenti/idle.

### Tahap 6: Spawner Huruf & Mekanisme Pengambilan (Collision)
- Tempatkan huruf-huruf pixel di canvas pada koordinat acak yang tidak bertabrakan dengan kapibara atau tepi layar.
- Pastikan di map selalu ada tepat **5 huruf**:
  - 1 huruf target yang dibutuhkan sesuai slot aktif kata.
  - 4 huruf pengecoh dari whitelist.
- Logika Tabrakan (Bounding Box / Radius check):
  - **Jika menyentuh huruf benar**:
    - Huruf terangkat masuk ke slot target di atas.
    - Slot kata terisi dan ter-highlight.
    - Hapus huruf dari map.
    - Spawn 1 huruf baru di map (huruf target berikutnya jika kata belum selesai, atau huruf pengecoh baru) sehingga total tetap 5.
  - **Jika menyentuh huruf salah**:
    - Tidak ada aksi apa pun (huruf tidak bergerak, tidak ada suara penalti).

### Tahap 7: Integrasi Web Speech API (Suara Fonik & Ejaan Indonesia)
- Buat speech queue manager menggunakan `window.speechSynthesis` dan `SpeechSynthesisUtterance`:
  - Pilih voice dengan `lang: 'id-ID'`.
  - Atur pitch dan rate agar ramah untuk anak-anak (rate ~0.85-0.9).
- Logika suara saat huruf terambil:
  1. Suarakan nama huruf yang baru diambil (contoh: *"B"*).
  2. Jika jumlah huruf yang sudah terkumpul $\ge 2$:
     - Antrekan suara ejaan satu per satu huruf yang terkumpul (contoh: *"B... O"*).
     - Antrekan pengucapan gabungannya (contoh: *"BO"*).
  3. Pastikan antrean audio tidak tumpang tindih (handle event `onend` atau antrean rapi).

### Tahap 8: Alur Selesai Kata, Perayaan & Transisi Level
- Saat seluruh huruf dalam kata target berhasil dikumpulkan:
  - Mainkan suara pembacaan kata lengkap secara utuh (contoh: *"BOLA"*).
  - Tampilkan animasi perayaan singkat (efek pixel confetti berhamburan atau kapibara melompat gembira).
  - Mainkan jingle sukses pendek via Web Audio API.
  - Jeda 1.5 - 2 detik, lalu lanjut ke kata berikutnya secara otomatis.
- Update tampilan progress di pojok layar: `"Kata ke-[Current] dari [Total]"`.
- Jika seluruh kata dalam bank kata selesai, tampilkan layar kemenangan ceria ("Hebat, Naqiyya Pintar!") dengan tombol untuk mengulang dari awal.

### Tahap 9: Elemen Rintangan Sederhana (Opsional/Pemanis)
- Tambahkan 1-2 objek rintangan statis di arena (misal: batu pixel atau batang pohon).
- Objek ini hanya menghalangi jalan (solid collision), memaksa kapibara memutar rintangan tanpa memberi penalti apa pun.

### Tahap 10: Uji Coba & Deployment GitHub Pages
- Buka file secara lokal di browser Chrome/Safari desktop dan mobile.
- Validasi fungsionalitas:
  - Kontrol sentuh responsif tanpa lag.
  - Audio Web Audio dan Speech Synthesis berjalan mulus di mobile.
  - Tidak ada huruf di luar whitelist yang pernah muncul.
- Siapkan branch `main` pada git repository dan aktifkan GitHub Pages pada pengaturan repositori.

---

## ✅ Kriteria Keberhasilan (Acceptance Criteria)
1. **Zero External Assets**: Game dapat dibuka offline langsung dari satu file `index.html` tanpa memerlukan internet untuk download gambar atau audio.
2. **Kepatuhan Whitelist 100%**: Tidak ada huruf selain `a, i, u, e, o, m, s, t, b, l, n, d, g, c, z` yang pernah terlihat di layar.
3. **UX Ramah Balita**: Tombol sentuh mudah ditekan anak kecil, tidak ada rasa frustrasi saat menabrak huruf salah.
4. **Audio Lengkap**:
   - Suara langkah kaki berbunyi saat jalan dan hening saat diam.
   - Suara pembacaan huruf dan ejaan jelas terdengar dalam bahasa Indonesia.
5. **Responsif**: Tampilan rapi dan proporsional di layar HP, tablet, maupun layar laptop.
