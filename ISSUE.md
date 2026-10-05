# ISSUE: Pengembangan Game Edukasi "Kapibara Cari Huruf"

## 📌 Ringkasan Proyek
Mengembangkan game edukasi web berbasis **Pixel Art Chibi** untuk membantu anak TK belajar membaca kata secara interaktif, ramah anak, dan menyenangkan. 

Output berupa **tiga file statis di root folder**:
1. `index.html` (struktur dan layout semantik)
2. `style.css` (tampilan retro pixel art dan sistem responsif `100dvh`)
3. `script.js` (logika game, audio sintetis, kontrol, dan visual canvas)

Dapat langsung dibuka di browser tanpa framework eksternal, tanpa dependensi build step (*zero build*), dan siap di-deploy ke **GitHub Pages**.

---

## 🎯 Target Pengguna & Karakteristik UX
- **Target Pemain**: Anak usia taman kanak-kanak (TK).
- **Target Perangkat**: Ponsel (portrait), Tablet, dan Laptop/Desktop (landscape/layar lebar) tanpa scroll (`100dvh`).
- **Filosofi Belajar (Gentle Learning)**: 
  - Tidak ada sistem *game over*, penalti waktu, atau efek suara salah yang membuat anak minder.
  - Menabrak huruf pengecoh tidak memicu penalti atau suara negatif apa pun (*silent ignore*).
  - Interaksi positif dengan perayaan ceria, efek lonceng clink, bintang sparkle, dan hati.
- **Gaya Visual**: Pixel art retro ala chibi yang ceria, menggemaskan (*gemoy*), dan ramah anak.

---

## 🛑 Aturan Domain & Mekanisme Permainan

1. **Cakupan Huruf Lengkap (A sampai Z)**:
   - Huruf yang boleh muncul di arena (huruf target maupun pengecoh) mencakup seluruh alfabet A sampai Z (`a` s.d. `z`).

2. **Bank Kata & Pengacakan Target (Randomized Without Duplicates)**:
   - Terdiri dari 15 kata benda konkret 4 huruf yang akrab bagi anak TK dengan padanan emoji jelas:
     `sapi` (🐄), `bola` (⚽), `mata` (👁️), `susu` (🥛), `kuda` (🐴), `buku` (📖), `kaki` (🦶), `roti` (🍞), `topi` (🧢), `baju` (👕), `pita` (🎀), `gigi` (🦷), `ikan` (🐟), `apel` (🍎), `dadu` (🎲).
   - **Urutan Kata Acak**: Seluruh 15 kata dikocok (Fisher-Yates) di awal permainan sehingga urutan kemunculan tidak pernah monoton (kata pertama juga acak).
   - Tidak ada kata yang muncul dua kali dalam satu putaran 15 kata.
   - **Saat MAIN LAGI**: Bank kata dikocok ulang dengan jaminan kata pertama di putaran baru tidak sama dengan kata terakhir putaran sebelumnya.
   - Emoji pendamping selalu tampil mendampingi tulisan "BENTUK KATA" agar anak mengenali artinya.

3. **Reset Huruf Penuh Tiap Pungut (Strict 5 Letters on Map)**:
   - Jumlah huruf di map **selalu persis 5 huruf**:
     - **1 huruf target** berikutnya yang sedang dicari.
     - **4 huruf pengecoh** acak dari alfabet A–Z.
   - **Aturan Pengecoh**: Huruf pengecoh tidak boleh sama dengan huruf target dan tidak boleh kembar satu sama lain.
   - **Mekanisme Reset**: Setiap kali satu huruf benar berhasil dipungut, **SEMUA huruf di map dihapus** lalu dimunculkan 5 huruf baru di posisi acak yang aman (tidak menempel di kapibara, tidak bertumpuk, tidak terlalu dekat tepi).
   - **Tampilan Huruf Netral**: Semua 5 koin huruf berpenampilan sama (tidak ada glow atau pembeda pada huruf target) sehingga anak aktif mencarinya sendiri.

4. **Sistem Suara & Urutan Fonik (Web Audio & Web Speech API)**:
   - **Tanpa Aset File Eksternal**:
     - **Web Audio API**:
       - *Langkah Kaki*: Ketukan lembut prosedural berulang selama kapibara berjalan dan langsung hening saat diam.
       - *Efek Clink*: Suara lonceng kecil ceria (dua nada naik cepat 0.2–0.3 detik) saat huruf benar dipungut.
       - *Jingle Sukses*: Arpeggio ceria saat kata selesai.
     - **Web Speech API (`id-ID`)**:
       - Pembacaan fonik huruf dan ejaan dalam bahasa Indonesia.
       - Mekanisme anti-tumpuk (`speechSynthesis.cancel()`).
   - **Urutan Suara Lengkap Pasca Pungut**:
     1. Bunyi efek lonceng **"Clink"** seketika.
     2. Bunyi nama huruf yang baru dipungut (misal: *"P"*).
     3. Jika huruf terkumpul $\ge 2$: eja satu per satu huruf yang telah terkumpul (misal: *"S... A... P"*).
     4. Bunyi kata/suku kata gabungannya (misal: *"SAP"*).

5. **Popup Lanjut Pasca Kata Selesai (Pemberhentian Total Game)**:
   - Setelah 4 huruf terkumpul, animasi perayaan selesai, dan pembacaan kata selesai, tampil popup modal di tengah layar.
   - Konten popup:
     - Emoji kata berukuran besar.
     - Nama kata lengkap dalam huruf besar tebal.
     - Tombol **"🔊 DENGAR LAGI"** (memutar ulang bunyi kata).
     - Tombol **"LANJUT ▶"** (beralih ke kata berikutnya) atau **"MAIN LAGI ▶"** pada kata terakhir ke-15.
   - **Aturan Ketat Popup**:
     - Game **BERHENTI TOTAL**: kapibara diam tidak bisa digerakkan, huruf di map tidak bisa dipungut, suara langkah kaki mati, dan **tidak ada auto-pindah kata**.
     - Popup **TIDAK BISA** ditutup dengan menyentuh backdrop luar.
     - Tombol berukuran besar (tinggi minimal 64px) yang ramah sentuhan jari anak TK serta dapat ditekan lewat tombol `Enter` atau `Spasi` keyboard.
     - Status tombol arah yang sedang ditekan di-reset saat popup muncul, mencegah kapibara jalan sendiri setelah popup ditutup.
     - Setelah tombol "LANJUT ▶" ditekan, popup tertutup, kata baru muncul, 5 huruf baru di-spawn, dan kapibara kembali ke posisi tengah arena.

6. **Karakter Kapibara Chibi Gemoy**:
   - Kepala bulat besar, badan gemuk pendek, kaki mungil, pipi merah muda (*blush*), mata besar berkilau, telinga bulat, serta jeruk yuzu mini di atas kepala 🍊.
   - Animasi dinamis:
     - *Jalan*: Bergoyang lucu (*waddle*) dengan efek lentur (*squash and stretch*) dan bayangan dinamis.
     - *Diam (Idle)*: Bernapas halus dan berkedip berkala.
     - *Pungut Huruf*: Melompat kecil diiringi semburan bintang sparkle.
     - *Selesai Kata*: Melompat tinggi gembira diiringi hujan hati (*hearts*) dan confetti.
     - *Hadap*: Berbalik arah kiri dan kanan mengikuti tombol arah.

7. **Desain Responsif Fleksibel (HP, Tablet, Laptop)**:
   - Tidak ada scrollbar di semua perangkat (`100dvh`).
   - Di HP tampil portrait kompak; di tablet dan laptop arena membesar mengisi layar (tidak berupa kolom sempit).
   - Seluruh elemen berukuran proporsional terhadap sisi terpendek arena:
     - Diameter koin huruf: 13% – 15% dari sisi terpendek.
     - Ukuran kapibara: 15% – 18% dari sisi terpendek.
     - Posisi disimpan dalam rasio normalisasi ($u, v \in [0.0, 1.0]$) sehingga tetap akurat saat rotasi layar atau resize.
   - Kontrol D-Pad on-screen hanya muncul pada perangkat layar sentuh (`@media (pointer: coarse)`). Pada laptop/desktop dengan mouse, D-Pad disembunyikan dan berganti instruksi keyboard (*"Pakai tombol panah atau WASD"*).
   - Rendering pixel art tajam menggunakan `image-rendering: pixelated` dan kompensasi `window.devicePixelRatio`.

---

## 🏗️ Struktur File

```text
/
├── index.html   # Struktur halaman, header status, canvas arena, popup lanjut, dan D-Pad/hint
├── style.css    # Desain pixel art, tema cerah, layout 100dvh, styling popup, responsive media queries
├── script.js    # Logika game, Web Audio, Web Speech, pengacakan kata, popup modal, rendering chibi
└── ISSUE.md     # Dokumentasi spesifikasi dan perencanaan proyek
```

---

## 📋 Checklist Fungsionalitas
- [x] Layar awal dengan tombol besar "▶ MULAI" untuk otorisasi audio.
- [x] Urutan kata target diacak tanpa pengulangan (kata pertama acak).
- [x] Reset penuh 5 huruf tiap kali huruf benar dipungut.
- [x] Pengecoh tidak sama dengan huruf target dan tidak duplikat.
- [x] Efek suara clink lonceng ceria sebelum fonik huruf.
- [x] Urutan suara bertahap: clink -> huruf -> ejaan per huruf -> kata gabungan.
- [x] Suara langkah kaki mati saat kapibara berhenti.
- [x] Kapibara chibi gemoy dengan animasi waddle, kedip, hop, sparkle, dan hati.
- [x] Tampilan 15 emoji pendamping kata target.
- [x] Popup modal pasca kata selesai dengan tombol "🔊 DENGAR LAGI" dan "LANJUT ▶" (min 64px).
- [x] Game berhenti total selama popup tampil (tidak ada auto-pindah).
- [x] Pada kata ke-15, tombol popup berganti "MAIN LAGI ▶" dengan kocokan baru.
- [x] Layout responsif 100dvh (D-Pad sentuh vs panduan keyboard laptop).
- [x] Huruf target tidak dibedakan warnanya di arena (anak mencari sendiri).
