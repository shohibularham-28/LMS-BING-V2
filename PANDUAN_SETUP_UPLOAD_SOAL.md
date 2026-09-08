# Panduan Setup: Upload Soal dari Word (.docx) ke LMS

Fitur ini menambahkan cara baru bagi guru untuk membuat soal: upload file
**.docx** lewat Dashboard Guru, lalu siswa mengerjakannya **langsung dari
akun LMS mereka sendiri** — tanpa halaman login/isi Nama & Kelas terpisah
seperti soal HTML mandiri (`TKA-PROCEDURE-TEXT`) yang lama.

## Bagaimana alurnya

1. Guru buka **Dashboard Guru → Kelola Worksheet → Upload Soal dari Word**.
2. Guru isi Judul, Tingkat, Durasi, lalu upload file `.docx` yang formatnya
   mengikuti `Template_Soal_Upload_LMS.docx`.
3. Sistem membaca file itu **di browser** (tidak dikirim ke server manapun
   selain Supabase kamu sendiri), parse jadi data soal, tampilkan pratinjau.
4. Guru klik **Simpan & Terbitkan** → soal disimpan ke tabel `bank_soal`,
   dan otomatis dibuatkan baris di tabel `worksheet` dengan
   `url = soal.html?id=<id bank_soal>`.
5. Siswa buka menu **Worksheet** seperti biasa (sudah login), klik
   "Kerjakan" → terbuka `soal.html?id=...` → karena siswa **sudah login**,
   `requireLogin()` langsung mengenali akunnya, Nama & Kelas otomatis
   terisi dari profil, dan siswa langsung masuk ke popup Peraturan Ujian
   lalu mengerjakan soal — tidak ada gate Nama/Kelas manual sama sekali.
6. Nilai dikirim ke tabel `hasil_ujian_lms`, terikat ke `profile_id` siswa
   yang sebenarnya (bukan ketikan manual), jadi datanya konsisten dengan
   akun LMS dan bisa direkap seperti nilai lainnya.

## Langkah instalasi

1. **Jalankan SQL migrasi** — buka Supabase Dashboard → SQL Editor, tempel
   isi `MIGRASI_BANK_SOAL.sql`, klik Run. Ini membuat tabel `bank_soal`
   dan `hasil_ujian_lms` beserta RLS policy-nya.
2. **Salin file ke repo LMS kamu:**
   - `soal.html` → taruh di folder root LMS (sejajar dengan `index.html`,
     `worksheet.html`, dst).
   - `assets/soal-import.js` → taruh di folder `assets/`.
   - `Template_Soal_Upload_LMS.docx` → taruh di folder root LMS (supaya
     link "contoh format template" di Dashboard Guru bisa diunduh guru).
   - `guru.html` → **ganti** file `guru.html` lama kamu dengan yang baru
     ini (sudah berisi seluruh fitur lama + tambahan blok "Upload Soal
     dari Word").
3. **Deploy ulang** seperti biasa (GitHub Pages/Netlify/dsb) — semuanya
   masih situs statis, tidak ada langkah build tambahan.
4. Coba dari akun guru: upload `Template_Soal_Upload_LMS.docx` apa
   adanya dulu (isinya sudah berupa 3 soal contoh) untuk memastikan
   semua jalan, baru buat soal sungguhan.

## Format isi file .docx

Lihat `Template_Soal_Upload_LMS.docx` — ada 3 tipe soal yang didukung:

| Tipe | Penanda | Cara tandai jawaban benar |
|---|---|---|
| Pilihan Ganda | `--- SOAL n (PILIHAN GANDA) ---` | tambahkan `[BENAR]` di akhir baris opsi yang benar |
| Pilihan Ganda >1 jawaban | `--- SOAL n (PILIHAN GANDA GANDA) ---` | tandai `[BENAR]` di 2 opsi atau lebih |
| Klasifikasi (matrix) | `--- SOAL n (KLASIFIKASI) ---` | baris `KOLOM: A \| B`, lalu daftar `pernyataan = A` / `pernyataan = B` |

Setiap bacaan dimulai dengan `=== TEKS n ===`, diikuti `JUDUL:`,
`KETERANGAN:` (opsional), lalu `BACAAN:` dan paragraf-paragrafnya.

Guru **tidak perlu tahu HTML/JSON sama sekali** — cukup ketik di Word
mengikuti format penanda ini. Kalau ada baris yang salah format, halaman
pratinjau di Dashboard Guru akan menunjukkan letak masalahnya sebelum
soal diterbitkan ke siswa.

## Pengaturan Penalti (baru)

**Fullscreen & deteksi pelanggaran (pindah tab/keluar fullscreen) SELALU
aktif untuk semua soal — tidak bisa dimatikan.** Yang bisa diatur guru
per-soal di form upload hanyalah:

- **☑️ Potong nilai kalau siswa pindah tab / keluar fullscreen**
  (default: ON) + **Poin Potongan per Pelanggaran** (default 2).
- Kalau dicentang → setiap pelanggaran yang terdeteksi memotong nilai
  akhir sebesar poin tersebut, sama seperti versi ujian ketat sebelumnya.
- Kalau **tidak dicentang** → pelanggaran tetap terdeteksi, tetap memicu
  alarm + popup peringatan, dan tetap tercatat di laporan jawaban (untuk
  ditinjau guru) — tapi **nilai akhir tidak dipotong sama sekali**.

Tersimpan per-soal di kolom `bank_soal.penalti_aktif` dan
`bank_soal.poin_penalti`, jadi guru bisa punya kombinasi: sebagian soal
nilainya dipotong kalau melanggar (ujian resmi), sebagian lagi tidak
(latihan yang tetap diawasi tapi tanpa konsekuensi nilai).

## Catatan penting (`hasil_ujian`, `hasil_worksheet`, tanpa
  login) **tidak dihapus** — tetap bisa dipakai untuk soal yang memang
  ingin dibagikan ke luar LMS (misalnya link publik untuk latihan bebas).
  Fitur baru ini murni tambahan untuk soal yang sifatnya resmi/dinilai
  dan harus terikat ke akun siswa.
- Jangan lupa: agar tombol "Kerjakan" di halaman Worksheet siswa bisa
  membuka `soal.html` di folder yang sama, jangan pindahkan `soal.html`
  ke folder lain.
- `mammoth.js` (pembaca file .docx) dan pustaka Supabase dimuat dari CDN
  seperti library lain yang sudah kamu pakai — butuh koneksi internet
  saat guru meng-upload, tapi tidak dibutuhkan lagi setelah soal
  tersimpan di Supabase.
