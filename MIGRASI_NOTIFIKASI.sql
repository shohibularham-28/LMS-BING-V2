-- =========================================================
-- MIGRASI: Notifikasi pengumuman & nilai baru untuk siswa
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (pakai IF NOT EXISTS).
-- =========================================================
--
-- Menambah kolom last_seen_updates di tabel profiles: dipakai untuk menghitung
-- berapa pengumuman & nilai baru yang belum dilihat siswa sejak terakhir kali
-- dia membuka halaman "Pengumuman & Nilai". Default now() supaya konten lama
-- yang sudah ada tidak dianggap "baru" begitu migrasi ini dijalankan.
-- =========================================================

alter table public.profiles add column if not exists last_seen_updates timestamptz not null default now();
