-- =========================================================
-- Obrolan Kelas — tambahan: watermark utk badge notifikasi pesan baru.
--
--   - Dipakai untuk menghitung "pesan belum dibaca" per user (siswa
--     lihat badge di menu Obrolan Kelas, guru lihat di lonceng notif).
--   - Kolom terpisah dari last_seen_updates (yang dipakai utk
--     pengumuman & nilai) supaya buka satu tidak ikut menghapus
--     notif yang lain.
--
-- Jalankan setelah migrasi obrolan kelas sebelumnya. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

alter table public.profiles
  add column if not exists last_seen_obrolan timestamptz;
