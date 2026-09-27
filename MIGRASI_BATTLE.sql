-- =========================================================
-- Fitur: Battle Kelas — Mode 1 "Leaderboard"
-- Semua siswa di kelas mengerjakan soal yang sama secara live,
-- guru merilis soal satu per satu, skor dihitung dari
-- (benar/salah + kecepatan jawab). Dibangun di atas Supabase
-- Realtime (pola sama seperti pesan_kelas di obrolan.html).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- 1) SESI BATTLE — satu baris = satu "ruangan" battle yang dibuat guru
create table if not exists public.battle_sesi (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,                 -- kode singkat (mis. "BTL-7F3K") buat siswa join
  judul text not null default 'Battle Kelas',
  guru_id uuid references public.profiles(id) on delete set null,
  kelas_id uuid references public.kelas(id) on delete set null, -- null = terbuka untuk semua kelas
  status text not null default 'lobi' check (status in ('lobi','berjalan','jeda','selesai')),
  soal jsonb not null default '[]'::jsonb,   -- array soal: [{prompt, options:[{key,text}], correct:"A"}, ...]
  soal_aktif_index integer not null default -1, -- -1 = belum ada soal dirilis
  soal_dirilis_at timestamptz,               -- kapan soal aktif saat ini dirilis (dasar hitung kecepatan)
  durasi_soal_detik integer not null default 20,
  created_at timestamptz default now()
);

-- 2) PESERTA — siswa yang join room (dipakai untuk daftar hadir + nama tampilan)
create table if not exists public.battle_peserta (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.battle_sesi(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nama text not null,
  skor_total integer not null default 0,
  streak integer not null default 0,          -- jawaban benar beruntun (dipakai bonus gamifikasi)
  joined_at timestamptz default now(),
  unique (sesi_id, profile_id)
);

-- 3) JAWABAN — satu baris per (sesi, soal, siswa)
create table if not exists public.battle_jawaban (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.battle_sesi(id) on delete cascade,
  soal_index integer not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  jawaban text,
  benar boolean not null default false,
  waktu_ms integer not null default 0,        -- lama jawab sejak soal dirilis
  skor_didapat integer not null default 0,
  created_at timestamptz default now(),
  unique (sesi_id, soal_index, profile_id)
);

create index if not exists idx_battle_jawaban_sesi on public.battle_jawaban (sesi_id, soal_index);
create index if not exists idx_battle_peserta_sesi on public.battle_peserta (sesi_id);

alter table public.battle_sesi enable row level security;
alter table public.battle_peserta enable row level security;
alter table public.battle_jawaban enable row level security;

drop policy if exists "battle_sesi_select" on public.battle_sesi;
drop policy if exists "battle_sesi_insert_guru" on public.battle_sesi;
drop policy if exists "battle_sesi_update_guru" on public.battle_sesi;
drop policy if exists "battle_sesi_delete_guru" on public.battle_sesi;

-- Siapa saja yang sudah login boleh lihat sesi (perlu untuk join pakai kode / lihat leaderboard).
create policy "battle_sesi_select" on public.battle_sesi
  for select using (auth.uid() is not null);

-- Hanya guru yang boleh membuat & mengubah sesi (rilis soal, ubah status, dst).
create policy "battle_sesi_insert_guru" on public.battle_sesi
  for insert with check (public.is_guru());
create policy "battle_sesi_update_guru" on public.battle_sesi
  for update using (public.is_guru());
create policy "battle_sesi_delete_guru" on public.battle_sesi
  for delete using (public.is_guru());

drop policy if exists "battle_peserta_select" on public.battle_peserta;
drop policy if exists "battle_peserta_insert_self" on public.battle_peserta;
drop policy if exists "battle_peserta_update_self_or_guru" on public.battle_peserta;

create policy "battle_peserta_select" on public.battle_peserta
  for select using (auth.uid() is not null);

-- Siswa cuma boleh daftar dirinya sendiri sebagai peserta.
create policy "battle_peserta_insert_self" on public.battle_peserta
  for insert with check (profile_id = auth.uid());

-- Skor di-update lewat proses jawab (oleh siswa itu sendiri) atau oleh guru (reset dsb).
create policy "battle_peserta_update_self_or_guru" on public.battle_peserta
  for update using (profile_id = auth.uid() or public.is_guru());

drop policy if exists "battle_jawaban_select" on public.battle_jawaban;
drop policy if exists "battle_jawaban_insert_self" on public.battle_jawaban;

create policy "battle_jawaban_select" on public.battle_jawaban
  for select using (auth.uid() is not null);

-- Siswa cuma boleh submit jawaban atas namanya sendiri.
create policy "battle_jawaban_insert_self" on public.battle_jawaban
  for insert with check (profile_id = auth.uid());

-- Aktifkan Supabase Realtime supaya soal baru & leaderboard update live tanpa polling.
do $$
begin
  begin
    alter publication supabase_realtime add table public.battle_sesi;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_jawaban;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_peserta;
  exception when others then null;
  end;
end $$;
