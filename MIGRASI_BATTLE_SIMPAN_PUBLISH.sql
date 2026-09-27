-- =========================================================
-- Fitur: Battle Kelas — SIMPAN battle & PUBLISH ke kelas
--
-- Sebelumnya: guru menyusun battle lalu klik "Buat & Mulai" ->
-- langsung jadi sesi live, dan susunannya (mode, tim, durasi, soal)
-- hilang begitu selesai. Cuma soal yang bisa disimpan (Bank Soal).
--
-- Sekarang:
--  1) Guru menyusun SATU PAKET battle lengkap (judul, mode, daftar
--     tim, durasi, metode rilis, soal) lalu DISIMPAN ke tabel
--     `battle_rencana`. Tabel ini hanya bisa dibaca guru pemiliknya,
--     jadi siswa tidak bisa melihat soal/kunci jawaban sebelum publish.
--  2) Saat mau dipakai, guru klik PUBLISH dan memilih kelas. Tiap kelas
--     yang dipilih mendapat satu sesi `battle_sesi` sendiri (kode &
--     papan peringkat terpisah). Battle yang sama bisa dipublish lagi
--     ke kelas lain kapan saja.
--  3) Sesi yang dipublish muncul otomatis di halaman Battle Kelas siswa
--     dari kelas tersebut, dan hanya siswa kelas itu yang boleh join.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BATTLE.sql (+ migrasi battle lainnya).
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- 1) BATTLE TERSIMPAN (rencana) — milik guru, belum terlihat siswa
create table if not exists public.battle_rencana (
  id uuid primary key default gen_random_uuid(),
  guru_id uuid not null references public.profiles(id) on delete cascade,
  judul text not null default 'Battle Kelas',
  mode text not null default 'leaderboard' check (mode in ('leaderboard','kelompok','grup_cup')),
  tim jsonb not null default '[]'::jsonb,        -- [{key, nama, warna}, ...] (mode kelompok / grup_cup)
  soal jsonb not null default '[]'::jsonb,       -- [{prompt, options:[{key,text}], correct:"A"}, ...]
  durasi_soal_detik integer not null default 20,
  rilis_mode text not null default 'manual' check (rilis_mode in ('manual','otomatis')),
  jeda_hasil_detik integer not null default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_battle_rencana_guru on public.battle_rencana (guru_id, updated_at desc);

alter table public.battle_rencana enable row level security;

drop policy if exists "battle_rencana_select_own" on public.battle_rencana;
drop policy if exists "battle_rencana_insert_own" on public.battle_rencana;
drop policy if exists "battle_rencana_update_own" on public.battle_rencana;
drop policy if exists "battle_rencana_delete_own" on public.battle_rencana;

-- Setiap guru hanya bisa melihat & mengelola battle tersimpan miliknya sendiri.
create policy "battle_rencana_select_own" on public.battle_rencana
  for select using (guru_id = auth.uid());
create policy "battle_rencana_insert_own" on public.battle_rencana
  for insert with check (guru_id = auth.uid() and public.is_guru());
create policy "battle_rencana_update_own" on public.battle_rencana
  for update using (guru_id = auth.uid());
create policy "battle_rencana_delete_own" on public.battle_rencana
  for delete using (guru_id = auth.uid());

-- 2) Tandai sesi yang berasal dari publish
--    rencana_id : battle tersimpan asalnya (null kalau dibuat lewat "Buat & Mulai Sekarang")
--    publish_at : terisi = tampil di daftar "Battle untuk kelasmu" milik siswa.
--                 Sesi lama / sesi "Buat & Mulai Sekarang" (null) tetap khusus lewat kode.
alter table public.battle_sesi
  add column if not exists rencana_id uuid references public.battle_rencana(id) on delete set null;
alter table public.battle_sesi
  add column if not exists publish_at timestamptz;

create index if not exists idx_battle_sesi_rencana on public.battle_sesi (rencana_id, kelas_id);
create index if not exists idx_battle_sesi_publish on public.battle_sesi (publish_at) where publish_at is not null;

-- 3) Batasi akses per kelas.
--    Sebelumnya semua siswa yang login bisa membaca SEMUA sesi (kelas_id hanya hiasan).
--    Sekarang: guru melihat semua; siswa hanya melihat sesi kelasnya sendiri
--    atau sesi yang kelas_id-nya kosong (= terbuka untuk semua kelas, seperti sebelumnya).
drop policy if exists "battle_sesi_select" on public.battle_sesi;
create policy "battle_sesi_select" on public.battle_sesi
  for select using (
    public.is_guru()
    or kelas_id is null
    or kelas_id = (select p.kelas_id from public.profiles p where p.id = auth.uid())
  );

-- Siswa hanya boleh mendaftar sebagai peserta di sesi yang memang boleh ia lihat
-- (subquery ke battle_sesi ikut kena policy di atas).
drop policy if exists "battle_peserta_insert_self" on public.battle_peserta;
create policy "battle_peserta_insert_self" on public.battle_peserta
  for insert with check (
    profile_id = auth.uid()
    and exists (select 1 from public.battle_sesi s where s.id = battle_peserta.sesi_id)
  );
