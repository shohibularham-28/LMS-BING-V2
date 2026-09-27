-- =========================================================
-- Fitur: Battle Kelas — Perilisan Soal 2 Metode
-- Menambahkan pilihan cara merilis soal ke siswa:
--   1) "manual"   — guru klik tombol "Rilis Soal Berikutnya" sendiri
--   2) "otomatis" — soal otomatis lanjut begitu durasi habis, setelah
--                    jeda menampilkan jawaban (jeda_hasil_detik)
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BATTLE.sql (dan MIGRASI_BATTLE_MODE_KELOMPOK.sql kalau ada).
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.battle_sesi
  add column if not exists rilis_mode text not null default 'manual';

alter table public.battle_sesi
  add column if not exists jeda_hasil_detik integer not null default 5;

do $$
begin
  alter table public.battle_sesi
    add constraint battle_sesi_rilis_mode_check check (rilis_mode in ('manual','otomatis'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.battle_sesi
    add constraint battle_sesi_jeda_hasil_check check (jeda_hasil_detik >= 1 and jeda_hasil_detik <= 60);
exception when duplicate_object then null;
end $$;
