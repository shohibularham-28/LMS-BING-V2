-- =========================================================
-- Update fitur Game Kelas (menyusul MIGRASI_GAME.sql):
--
-- 1) Menjodohkan sekarang bisa dibuat BEBERAPA RONDE, masing-masing
--    ronde punya beberapa pasangan sendiri — tidak lagi cuma satu
--    papan yang dijodohkan sekali selesai. Setiap kali ada giliran
--    baru (mode IPD), papan yang tampil akan bergantian dari satu
--    ronde ke ronde berikutnya (mirip cara "Susun Kata" bergantian
--    soal). Ini murni perubahan STRUKTUR JSON di kolom
--    bank_game.data, jadi TIDAK butuh migrasi kolom untuk bagian ini
--    (materi lama yang formatnya masih flat otomatis dianggap 1 ronde).
--
-- 2) Mode IPD (giliran maju) — baik Susun Kata maupun Menjodohkan —
--    sekarang guru bisa menunjuk LEBIH DARI SATU siswa untuk maju
--    bersama dalam satu giliran (kerja tim), dan keduanya mendapat
--    skor yang sama. Untuk ini game_peserta perlu kolom baru
--    "anggota" yang menyimpan daftar siswa dalam giliran tsb.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.game_peserta
  add column if not exists anggota jsonb not null default '[]'::jsonb;
  -- anggota: [{ "profile_id": "...", "nama": "..." }, ...] — siswa yang maju
  -- bersama dalam satu giliran IPD (bisa 1 orang, bisa lebih untuk kerja tim).
  -- Baris lama (sebelum fitur ini) akan tetap [] dan dianggap 1 orang sesuai
  -- kolom profile_id/nama yang sudah ada sebelumnya.

comment on column public.game_peserta.anggota is
  'Daftar siswa yang maju bersama dalam satu giliran IPD (kerja tim, skor sama untuk semua anggota).';
