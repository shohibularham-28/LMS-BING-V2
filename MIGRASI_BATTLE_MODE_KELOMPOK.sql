-- =========================================================
-- Fitur: Battle Kelas — tambahan Mode "Kelompok" (Tim)
-- Guru membuat daftar kelompok saat setup sesi; siswa memilih sendiri
-- kelompok mana yang mau diikuti setelah join dengan kode. Skor tetap
-- dihitung per-siswa (benar + kecepatan) seperti mode Leaderboard, lalu
-- diakumulasi jadi skor tim di papan peringkat.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BATTLE.sql. Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.battle_sesi
  add column if not exists mode text not null default 'leaderboard'
  check (mode in ('leaderboard','kelompok'));

-- Daftar kelompok yang dibuat guru: [{ "key": "tim_1", "nama": "Tim Elang" }, ...]
alter table public.battle_sesi
  add column if not exists tim jsonb not null default '[]'::jsonb;

-- Kelompok yang dipilih siswa sendiri (null = belum memilih / mode leaderboard).
alter table public.battle_peserta
  add column if not exists tim_key text;

create index if not exists idx_battle_peserta_tim on public.battle_peserta (sesi_id, tim_key);
