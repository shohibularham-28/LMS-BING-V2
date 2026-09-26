-- =========================================================
-- Fitur: Game Kelas (Susun Kata, TTS, Menjodohkan, Benar/Salah,
-- Cari Kata) — menu-game.html (siswa) & guru-game.html (guru).
--
-- Konsep:
-- 1) bank_game       = "materi/soal" game yang disusun guru,
--                       terpisah dari cara memainkannya.
-- 2) game_sesi        = 1 baris = 1 "sesi live" yang di-launch guru
--                       dari 1 materi bank_game tertentu. Ada 2 mode:
--                         - 'ipd'          : siswa maju bergiliran,
--                            mengerjakan langsung di device/akun guru.
--                         - 'mandiri_live' : siswa mengerjakan di HP/akun
--                            masing-masing dengan kecepatan sendiri,
--                            tapi hasilnya tampil live di layar guru.
-- 3) game_peserta     = siswa yang ikut 1 sesi (baik lewat giliran
--                       IPD maupun join mandiri lewat kode).
-- 4) game_jawaban     = jawaban per soal per peserta dalam 1 sesi.
-- 5) hasil_game_mandiri = riwayat main SENDIRI (tanpa sesi guru sama
--                       sekali), langsung dari menu-game.html.
--
-- Baru jenis 'susun_kata' yang aktif dulu; jenis lain disiapkan
-- kolomnya supaya tinggal dipakai belakangan.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- 1) BANK GAME — materi/soal yang disusun guru
create table if not exists public.bank_game (
  id uuid primary key default gen_random_uuid(),
  jenis text not null default 'susun_kata'
    check (jenis in ('susun_kata','tts','jodoh','benar_salah','cari_kata')),
  judul text not null,
  guru_id uuid references public.profiles(id) on delete set null,
  kelas_id uuid references public.kelas(id) on delete set null, -- null = semua kelas
  level text check (level in ('X','XI','XII')),                 -- null = semua tingkat
  data jsonb not null default '[]'::jsonb,
  -- susun_kata: [{ "kalimat": "I go to school every day" }, ...]
  published boolean not null default true,
  created_at timestamptz default now()
);

-- 2) SESI GAME — 1 sesi live yang di-launch guru dari 1 bank_game
create table if not exists public.game_sesi (
  id uuid primary key default gen_random_uuid(),
  kode text unique not null,                 -- kode singkat, mis. "GM-7F3K"
  jenis text not null default 'susun_kata',
  bank_game_id uuid references public.bank_game(id) on delete set null,
  guru_id uuid references public.profiles(id) on delete set null,
  kelas_id uuid references public.kelas(id) on delete set null, -- null = terbuka semua kelas
  mode text not null default 'mandiri_live' check (mode in ('ipd','mandiri_live')),
  status text not null default 'berjalan' check (status in ('berjalan','selesai')),
  giliran_nama text,        -- khusus mode 'ipd': nama siswa yang lagi maju sekarang
  giliran_soal_index integer not null default 0, -- khusus mode 'ipd': soal ke berapa yang sedang dikerjakan
  created_at timestamptz default now()
);

-- 3) PESERTA — siswa yang ikut sesi (giliran IPD maupun join mandiri via kode)
create table if not exists public.game_peserta (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.game_sesi(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade, -- boleh null (mis. dipilih manual oleh guru dari daftar siswa saat mode IPD)
  nama text not null,
  skor_total integer not null default 0,
  soal_selesai integer not null default 0,
  status text not null default 'main' check (status in ('main','selesai')),
  joined_at timestamptz default now()
);

-- 4) JAWABAN — satu baris per (sesi, peserta, soal)
create table if not exists public.game_jawaban (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.game_sesi(id) on delete cascade,
  peserta_id uuid not null references public.game_peserta(id) on delete cascade,
  soal_index integer not null,
  benar boolean not null default false,
  waktu_ms integer not null default 0,
  skor_didapat integer not null default 0,
  created_at timestamptz default now(),
  unique (peserta_id, soal_index)
);

create index if not exists idx_game_peserta_sesi on public.game_peserta (sesi_id);
create index if not exists idx_game_jawaban_sesi on public.game_jawaban (sesi_id);

-- 5) RIWAYAT MAIN SENDIRI (tanpa sesi guru)
create table if not exists public.hasil_game_mandiri (
  id uuid primary key default gen_random_uuid(),
  bank_game_id uuid references public.bank_game(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  jenis text not null default 'susun_kata',
  skor integer not null default 0,
  total_soal integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_hasil_game_mandiri_profile on public.hasil_game_mandiri (profile_id);

-- ===================== RLS =====================
alter table public.bank_game enable row level security;
alter table public.game_sesi enable row level security;
alter table public.game_peserta enable row level security;
alter table public.game_jawaban enable row level security;
alter table public.hasil_game_mandiri enable row level security;

drop policy if exists "bank_game_select" on public.bank_game;
drop policy if exists "bank_game_insert_guru" on public.bank_game;
drop policy if exists "bank_game_update_guru" on public.bank_game;
drop policy if exists "bank_game_delete_guru" on public.bank_game;

create policy "bank_game_select" on public.bank_game
  for select using (auth.uid() is not null);
create policy "bank_game_insert_guru" on public.bank_game
  for insert with check (public.is_guru());
create policy "bank_game_update_guru" on public.bank_game
  for update using (public.is_guru());
create policy "bank_game_delete_guru" on public.bank_game
  for delete using (public.is_guru());

drop policy if exists "game_sesi_select" on public.game_sesi;
drop policy if exists "game_sesi_insert_guru" on public.game_sesi;
drop policy if exists "game_sesi_update_guru" on public.game_sesi;
drop policy if exists "game_sesi_delete_guru" on public.game_sesi;

create policy "game_sesi_select" on public.game_sesi
  for select using (auth.uid() is not null);
create policy "game_sesi_insert_guru" on public.game_sesi
  for insert with check (public.is_guru());
create policy "game_sesi_update_guru" on public.game_sesi
  for update using (public.is_guru());
create policy "game_sesi_delete_guru" on public.game_sesi
  for delete using (public.is_guru());

drop policy if exists "game_peserta_select" on public.game_peserta;
drop policy if exists "game_peserta_insert" on public.game_peserta;
drop policy if exists "game_peserta_update" on public.game_peserta;

create policy "game_peserta_select" on public.game_peserta
  for select using (auth.uid() is not null);
-- Siswa boleh daftar dirinya sendiri; guru boleh daftar siswa manapun (dipakai mode IPD).
create policy "game_peserta_insert" on public.game_peserta
  for insert with check (profile_id = auth.uid() or public.is_guru());
create policy "game_peserta_update" on public.game_peserta
  for update using (profile_id = auth.uid() or public.is_guru());

drop policy if exists "game_jawaban_select" on public.game_jawaban;
drop policy if exists "game_jawaban_insert" on public.game_jawaban;

create policy "game_jawaban_select" on public.game_jawaban
  for select using (auth.uid() is not null);
create policy "game_jawaban_insert" on public.game_jawaban
  for insert with check (
    exists (
      select 1 from public.game_peserta p
      where p.id = peserta_id and (p.profile_id = auth.uid() or public.is_guru())
    )
  );

drop policy if exists "hasil_game_mandiri_select" on public.hasil_game_mandiri;
drop policy if exists "hasil_game_mandiri_insert_self" on public.hasil_game_mandiri;

create policy "hasil_game_mandiri_select" on public.hasil_game_mandiri
  for select using (profile_id = auth.uid() or public.is_guru());
create policy "hasil_game_mandiri_insert_self" on public.hasil_game_mandiri
  for insert with check (profile_id = auth.uid());

-- Aktifkan Supabase Realtime supaya papan live (guru & siswa) update tanpa polling manual.
do $$
begin
  begin
    alter publication supabase_realtime add table public.game_sesi;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.game_peserta;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.game_jawaban;
  exception when others then null;
  end;
end $$;
