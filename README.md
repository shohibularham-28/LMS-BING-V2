# LMS BING V2 — Versi Supabase

## 0. Sebelum apa-apa: amankan repo lama
Repo GitHub lama (`LMS-BING-V2`) berisi `assets/data.js` dengan nama & password asli siswa dalam bentuk teks polos, dan itu **publik**. Jadikan repo itu private atau hapus filenya, lalu asumsikan semua password lama sudah bocor. File migrasi di bawah ini sudah otomatis memberi **password baru** untuk semua siswa — jangan pakai password lama lagi.

## 1. Buat project Supabase
1. Daftar/masuk ke https://supabase.com, buat project baru.
2. Buka **SQL Editor**, tempel isi `supabase/schema.sql`, jalankan (Run). Ini membuat semua tabel, RLS, dan 6 kelas awal (X I, X J, X K, XI D1, XI D2, XI E1).
3. Buka **Authentication → Providers → Email**, **matikan** "Confirm email" (karena kita pakai domain palsu `@lms.local`, siswa tidak punya email asli untuk konfirmasi).

## 2. Sambungkan frontend ke project kamu
Buka `assets/supabaseClient.js`, isi:
```js
const SUPABASE_URL = "https://xxxxx.supabase.co";       // dari Project Settings > API
const SUPABASE_ANON_KEY = "eyJhbGciOi...";                // "anon public" key, BUKAN service_role
```

## 3. Deploy Edge Function (untuk fitur "Buat Akun Siswa Massal" & "Reset Password")
Ini **wajib** — tanpa ini, tombol "Buat Semua Akun" di dashboard guru dan tombol "🔑 Reset Password" di menu Daftar Siswa tidak akan bekerja.

```bash
npm install -g supabase
supabase login
supabase link --project-ref xxxxx        # project ref dari URL project kamu
supabase functions deploy create-students
supabase functions deploy reset-password
supabase functions deploy delete-student
```
Edge Function otomatis punya akses ke `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` — tidak perlu di-setting manual, Supabase menyediakannya secara otomatis di environment function.

## 4. Buat akun guru pertama
1. Buka `index.html` di browser (lokal, atau setelah di-deploy ke GitHub Pages/Netlify/dsb), klik tab **Daftar Akun Siswa**, isi nama/username/password kamu sendiri, pilih kelas apa saja (nanti diganti).
2. Di Supabase SQL Editor, jalankan:
   ```sql
   update public.profiles set role = 'guru', kelas_id = null where username = 'USERNAME_KAMU';
   ```
3. Login ulang di `index.html` — sekarang otomatis masuk ke `guru.html`.

## 5. Migrasi data siswa & nilai lama (opsional, tapi disediakan)
- **`MIGRASI_AKUN_SISWA.txt`** — 211 siswa dari `data.js` lama, format siap-tempel ke textarea "Buat Akun Siswa Massal" di dashboard guru, **dengan password baru yang di-generate acak** (bukan password lama yang sudah bocor). Buka file ini, salin isinya, tempel ke textarea, klik "Buat Semua Akun". Kamu perlu bagikan password baru ini ke masing-masing siswa (atau minta mereka daftar ulang sendiri lewat menu Daftar).
- **`MIGRASI_AKUN_SISWA.json`** — isi yang sama dalam format JSON, kalau kamu mau proses/print daftar password per siswa.
- **`MIGRASI_NILAI.sql`** — jalankan di SQL Editor **setelah** akun-akun di atas berhasil dibuat. Ini mengisi ulang riwayat nilai lama (210 dari 213 baris berhasil dicocokkan by nama; 3 sisanya perlu dicek manual karena ada selisih penulisan nama antara data USERS dan data grades lama — lihat log saat migrasi).

## 6. Menu di Dashboard Guru
| Menu | Fungsi |
|---|---|
| 📊 Rekap Nilai | Lihat rekap nilai per kelas & jenis penilaian, hapus nilai per siswa, download rekap sebagai CSV |
| 👥 Daftar Siswa | Lihat daftar siswa per kelas beserta username; reset password siswa yang lupa password |
| 🏫 Kelola Kelas | Tambah/hapus kelas |
| 👥 Buat Akun Siswa | Buat banyak akun siswa sekaligus (format: `Nama, username, password, Kelas` per baris) |
| ✍️ Input Nilai Massal | Pilih kelas + jenis penilaian → isi skor semua siswa sekaligus |
| 📝 Kelola Worksheet | Tambah worksheet (judul + URL + kelas + deadline opsional), otomatis muncul di siswa kelas terkait |

Siswa juga bisa daftar sendiri lewat tab **Daftar Akun Siswa** di halaman login — tidak wajib dibuatkan guru.

## 7. Materi & konten interaktif (tenses, irregular verbs, worksheet fractured)
File `assets/materi-tenses.html`, `assets/materi-irregular-verbs.html`, dan `assets/worksheet-fractured.html` disalin apa adanya dari project lama (tidak berubah). Untuk memunculkannya di menu **Materi** siswa, tambahkan baris manual lewat Supabase Table Editor ke tabel `materi`, isi kolom `url` dengan `assets/materi-tenses.html` dst. (CRUD materi lewat dashboard guru belum dibuat di versi ini — bisa ditambahkan kalau diperlukan.)

## 8. Siswa ganti password sendiri
Siswa yang sudah login bisa ganti password sendiri lewat menu **⚙️ Pengaturan** di sidebar (`pengaturan.html`) — tidak perlu minta guru reset lagi. Password baru otomatis ikut tersimpan di kolom `password_plain`, jadi tetap konsisten dengan fitur "Lihat Password" di dashboard guru.

## 9. Perbaikan: dropdown "Kelas" kosong di halaman Daftar Akun
Kalau project Supabase kamu dibuat **sebelum** perbaikan ini dan dropdown kelas di tab "Daftar Akun Siswa" kosong/"Belum ada kelas tersedia", jalankan `MIGRASI_KELAS_PUBLIC.sql` sekali di SQL Editor. Penyebabnya: policy lama cuma izinkan baca tabel `kelas` untuk yang sudah login, padahal orang yang baru mau daftar akun belum punya sesi login sama sekali. Project baru yang pakai `supabase/schema.sql` versi ini sudah otomatis benar, tidak perlu migrasi tambahan.

## 11. Persetujuan akun siswa yang daftar mandiri
Siswa yang daftar sendiri lewat tombol "Daftar Akun Siswa" sekarang berstatus **menunggu persetujuan** dan belum bisa login sampai disetujui guru. Guru mengelola ini lewat menu baru **🆕 Persetujuan Akun** di dashboard (ada badge merah kalau ada yang menunggu) — bisa klik "✅ Setujui" per siswa, "✅ Setujui Semua" untuk semuanya sekaligus, atau "🗑️ Tolak" untuk menghapus pendaftaran yang tidak valid. Akun yang dibuat guru lewat menu "Buat Akun Siswa Massal" tetap langsung aktif (tidak perlu persetujuan).

Kalau project Supabase kamu sudah jalan duluan, jalankan `MIGRASI_PERSETUJUAN_AKUN.sql` sekali di SQL Editor. Project baru yang pakai `supabase/schema.sql` versi ini sudah otomatis benar.

## 13. Notifikasi lonceng 🔔
- **Siswa**: lonceng di topbar (halaman Pengumuman, Materi, Worksheet, Pengaturan) menampilkan titik merah kalau ada pengumuman atau nilai baru sejak terakhir dia buka menu **Pengumuman & Nilai**. Klik lonceng untuk lihat daftar singkatnya; titik merah otomatis hilang begitu siswa membuka halaman Pengumuman & Nilai.
- **Guru**: lonceng di topbar dashboard menampilkan jumlah akun siswa yang baru daftar mandiri dan menunggu persetujuan (sinkron dengan badge di menu 🆕 Persetujuan Akun). Klik salah satu item di dropdown untuk langsung lompat ke menu Persetujuan Akun.

Kalau project Supabase kamu sudah jalan duluan, jalankan `MIGRASI_NOTIFIKASI.sql` sekali di SQL Editor (menambah kolom `last_seen_updates` di tabel `profiles`). Project baru yang pakai `supabase/schema.sql` versi ini sudah otomatis benar.

## 14. Deploy
Karena ini masih situs statis (HTML+JS) yang manggil Supabase langsung dari browser, kamu bisa deploy persis seperti sebelumnya: GitHub Pages, Netlify, Vercel, dsb. Cukup push semua file (kecuali folder `supabase/functions`, yang di-deploy terpisah lewat Supabase CLI di langkah 3).

## Yang disederhanakan dari versi lama
- Pengumuman "remedial otomatis" berdasarkan nilai (di `auth.js` lama) dihapus — sekarang guru cukup posting pengumuman biasa. Bisa ditambahkan lagi kalau perlu.
- Worksheet dengan jadwal buka per-kelas (`jadwalKelas`) disederhanakan jadi satu `deadline` per worksheet, bukan tanggal buka berbeda per kelas.
