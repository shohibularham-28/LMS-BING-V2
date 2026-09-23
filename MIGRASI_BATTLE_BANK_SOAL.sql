-- =========================================================
-- Fitur: Battle Kelas — Bank Soal
-- Guru bisa menyimpan satu set/paket soal supaya bisa dipakai lagi
-- untuk battle-battle berikutnya, tanpa perlu ketik ulang atau
-- import ulang file Word setiap kali.
--
-- Format kolom `soal` sama persis dengan battle_sesi.soal:
--   [{prompt, options:[{key,text}], correct:"A"}, ...]
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BATTLE.sql (perlu fungsi public.is_guru() dari situ).
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

create table if not exists public.battle_bank_paket (
  id uuid primary key default gen_random_uuid(),
  guru_id uuid not null references public.profiles(id) on delete cascade,
  nama text not null,
  soal jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_battle_bank_paket_guru on public.battle_bank_paket (guru_id);

alter table public.battle_bank_paket enable row level security;

drop policy if exists "battle_bank_paket_select_own" on public.battle_bank_paket;
drop policy if exists "battle_bank_paket_insert_own" on public.battle_bank_paket;
drop policy if exists "battle_bank_paket_update_own" on public.battle_bank_paket;
drop policy if exists "battle_bank_paket_delete_own" on public.battle_bank_paket;

-- Setiap guru hanya bisa melihat & mengelola paket soal miliknya sendiri.
create policy "battle_bank_paket_select_own" on public.battle_bank_paket
  for select using (guru_id = auth.uid());

create policy "battle_bank_paket_insert_own" on public.battle_bank_paket
  for insert with check (guru_id = auth.uid() and public.is_guru());

create policy "battle_bank_paket_update_own" on public.battle_bank_paket
  for update using (guru_id = auth.uid());

create policy "battle_bank_paket_delete_own" on public.battle_bank_paket
  for delete using (guru_id = auth.uid());
