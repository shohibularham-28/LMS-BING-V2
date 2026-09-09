-- =========================================================
-- Kontrol Ujian oleh Guru — menambah kemampuan guru untuk:
--   1) Menjeda (pause) waktu pengerjaan siswa tertentu, dari jarak jauh.
--   2) Mengeluarkan (kick) siswa yang sedang mengerjakan ujian, dari
--      jarak jauh — begitu dikeluarkan, layar siswa otomatis berhenti
--      dan diarahkan keluar dari halaman soal.
--   3) Siswa yang keluar dari halaman soal TANPA submit (baik lewat
--      tombol "Keluar (Tanpa Kirim Jawaban)", menutup tab, atau
--      berpindah halaman) otomatis hilang dari daftar "Sedang Ujian"
--      di dashboard guru (status berubah jadi 'keluar', bukan lagi
--      'mengerjakan').
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- menjalankan MIGRASI_SESI_UJIAN.sql. Aman dijalankan berkali-kali
-- (idempotent).
-- =========================================================

-- Kolom baru: status pause & perintah keluarkan dari guru.
alter table public.sesi_ujian add column if not exists paused boolean not null default false;
alter table public.sesi_ujian add column if not exists force_exit boolean not null default false;

-- Perluas daftar status yang diizinkan: tambah 'keluar' (siswa keluar
-- tanpa submit / dikeluarkan guru), selain 'mengerjakan' & 'selesai'.
alter table public.sesi_ujian drop constraint if exists sesi_ujian_status_check;
alter table public.sesi_ujian add constraint sesi_ujian_status_check
  check (status in ('mengerjakan', 'selesai', 'keluar'));

-- Catatan RLS: policy update yang sudah ada di MIGRASI_SESI_UJIAN.sql
-- ("sesi_ujian_update_own_or_guru") sudah cukup — guru boleh update
-- kolom paused/force_exit pada baris siapa saja, dan siswa boleh
-- update status baris miliknya sendiri jadi 'keluar'. Tidak perlu
-- policy tambahan.
