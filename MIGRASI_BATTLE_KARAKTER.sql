-- =========================================================
-- Fitur: Pilih Karakter sebelum Battle
-- Siswa memilih karakter lucu (emoji) tiap kali join battle,
-- lalu karakter itu muncul di semua tampilan (leaderboard
-- siswa & guru, badge di ruang battle).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.battle_peserta
  add column if not exists karakter text;

-- (opsional) kalau mau peserta lama otomatis dapat karakter default:
-- update public.battle_peserta set karakter = 'kucing' where karakter is null;
