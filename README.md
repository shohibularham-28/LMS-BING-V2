# English Learning Hub — LMS Sederhana

Website LMS statis (login, pengumuman & nilai, materi, worksheet) yang bisa langsung di-hosting gratis lewat **GitHub Pages**.

## Struktur File

```
index.html          -> Halaman login (otomatis jadi halaman utama di GitHub Pages)
pengumuman.html      -> Pengumuman & rekap nilai
materi.html          -> Daftar materi pembelajaran
worksheet.html       -> Daftar worksheet
assets/
  style.css          -> Semua styling (dipakai bersama semua halaman)
  data.js            -> Data akun siswa (USERS) & konten (DATA)
  auth.js            -> Logika login/sesi/logout
  materi-tenses.html       -> Materi interaktif "16 Tenses"
  worksheet-fractured.html -> Worksheet interaktif "Fractured Fairytale"
```

## Cara Upload ke GitHub (lewat browser, tanpa install apa-apa)

1. Buat akun GitHub jika belum punya: https://github.com/join
2. Klik tombol **New repository** (ikon `+` di kanan atas → *New repository*).
3. Isi **Repository name**, misal `english-class-lms`. Pilih **Public**. Klik **Create repository**.
4. Di halaman repo yang baru dibuat, klik **uploading an existing file**.
5. **Drag & drop seluruh isi folder ini** (bukan folder `lms`-nya, tapi isinya: `index.html`, `pengumuman.html`, `materi.html`, `worksheet.html`, dan folder `assets`) ke area upload.
   - Pastikan struktur foldernya tetap terjaga — GitHub akan otomatis membuat folder `assets/` jika kamu drag foldernya langsung.
6. Klik **Commit changes**.

## Mengaktifkan GitHub Pages (supaya website bisa diakses online)

1. Di halaman repo, klik tab **Settings**.
2. Di menu kiri, klik **Pages**.
3. Pada bagian **Build and deployment** → **Source**, pilih **Deploy from a branch**.
4. Pada **Branch**, pilih `main` (atau `master`) dan folder `/ (root)`. Klik **Save**.
5. Tunggu 1–2 menit, lalu refresh halaman. GitHub akan menampilkan URL situs, biasanya:
   ```
   https://<username-github-kamu>.github.io/<nama-repo>/
   ```
6. Buka URL tersebut — halaman login akan langsung muncul.

## Cara Update Konten (nama siswa, nilai, pengumuman, materi, worksheet)

Semua data ada di **`assets/data.js`**:
- `USERS` → daftar akun (username, password, nama, kelas) untuk login.
- `DATA.X` dan `DATA.XI` → berisi `announcements` (pengumuman), `grades` (nilai), `materi`, dan `worksheets` per tingkat kelas.

Edit langsung file `assets/data.js` di GitHub (klik file → ikon pensil ✏️ "Edit this file") lalu **Commit changes**. Perubahan akan otomatis muncul di website setelah GitHub Pages selesai deploy ulang (biasanya < 1 menit).

## Catatan

- Website ini murni statis (HTML/CSS/JS), tidak butuh server backend atau database.
- Sesi login disimpan di `localStorage` browser masing-masing siswa (bukan disinkronkan lintas perangkat).
- Karena password disimpan langsung di `data.js`, **jangan gunakan data sensitif sungguhan** untuk keperluan produksi — cocok untuk kelas internal/latihan, bukan sistem keamanan tinggi.
