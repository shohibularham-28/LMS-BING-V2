-- =========================================================
-- LMS BING V2 — Supabase Schema
-- Jalankan file ini sekali di Supabase Dashboard > SQL Editor
-- =========================================================

-- ---------- KELAS ----------
create table if not exists public.kelas (
  id uuid primary key default gen_random_uuid(),
  nama text unique not null,
  level text not null check (level in ('X','XI','XII')),
  created_at timestamptz default now()
);

-- ---------- PROFILES (siswa & guru) ----------
-- id = auth.users.id. username dipakai sebagai "email palsu" untuk login (lihat assets/app.js)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nama text not null,
  role text not null default 'siswa' check (role in ('siswa','guru')),
  kelas_id uuid references public.kelas(id),
  password_plain text, -- salinan password asli (plain text) khusus siswa, supaya guru bisa "Lihat Password". Diisi otomatis oleh Edge Function create-students & reset-password.
  created_at timestamptz default now()
);

-- Kalau tabel profiles sudah ada dari versi sebelumnya, jalankan baris ini sekali di SQL Editor:
alter table public.profiles add column if not exists password_plain text;

-- ---------- PENGUMUMAN ----------
create table if not exists public.pengumuman (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  isi text not null,
  kelas_id uuid references public.kelas(id), -- null = semua kelas
  created_at timestamptz default now()
);

-- ---------- MATERI ----------
create table if not exists public.materi (
  id uuid primary key default gen_random_uuid(),
  tag text,
  judul text not null,
  deskripsi text,
  url text,
  kelas_id uuid references public.kelas(id), -- legacy: target 1 kelas spesifik (data lama). null = semua kelas
  level text check (level in ('X','XI','XII')), -- target 1 tingkat (semua kelas di tingkat itu). null + kelas_id null = semua tingkat
  created_at timestamptz default now()
);
-- Kalau tabel materi sudah ada dari versi sebelumnya, jalankan baris ini sekali di SQL Editor:
alter table public.materi add column if not exists level text check (level in ('X','XI','XII'));

-- ---------- WORKSHEET ----------
create table if not exists public.worksheet (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  meta text default 'Worksheet interaktif online',
  url text not null,
  kelas_id uuid references public.kelas(id), -- legacy: target 1 kelas spesifik (data lama)
  level text check (level in ('X','XI','XII')), -- target 1 tingkat (semua kelas di tingkat itu)
  mulai timestamptz,       -- tanggal & jam worksheet mulai bisa dibuka (null = langsung terbuka)
  deadline date,
  created_at timestamptz default now()
);
-- Kalau tabel worksheet sudah ada dari versi sebelumnya, jalankan baris-baris ini sekali di SQL Editor:
alter table public.worksheet add column if not exists level text check (level in ('X','XI','XII'));
alter table public.worksheet alter column kelas_id drop not null;

-- ---------- NILAI ----------
create table if not exists public.nilai (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.profiles(id) on delete cascade,
  jenis text not null,
  skor numeric,
  skor_asli numeric,
  predikat text,
  keterangan text,
  created_at timestamptz default now()
);

-- =========================================================
-- Helper: cek apakah user yang sedang login adalah guru
-- security definer supaya tidak kena rekursi RLS di tabel profiles
-- =========================================================
create or replace function public.is_guru()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'guru'
  );
$$;

-- =========================================================
-- RLS
-- =========================================================
alter table public.kelas enable row level security;
alter table public.profiles enable row level security;
alter table public.pengumuman enable row level security;
alter table public.materi enable row level security;
alter table public.worksheet enable row level security;
alter table public.nilai enable row level security;

-- KELAS: semua user login boleh baca; hanya guru boleh tulis
create policy "kelas_select" on public.kelas for select using (auth.uid() is not null);
create policy "kelas_insert_guru" on public.kelas for insert with check (public.is_guru());
create policy "kelas_update_guru" on public.kelas for update using (public.is_guru());
create policy "kelas_delete_guru" on public.kelas for delete using (public.is_guru());

-- PROFILES: lihat diri sendiri atau (jika guru) semua orang
create policy "profiles_select" on public.profiles for select using (id = auth.uid() or public.is_guru());
-- daftar sendiri (signup siswa) — role dipaksa 'siswa', tidak boleh klaim jadi guru
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid() and role = 'siswa');
-- guru boleh insert siapa saja (dipakai Edge Function via service role, yang otomatis bypass RLS)
create policy "profiles_update" on public.profiles for update using (id = auth.uid() or public.is_guru());
create policy "profiles_delete_guru" on public.profiles for delete using (public.is_guru());
-- Catatan: penghapusan akun siswa yang sesungguhnya (termasuk akun login di auth.users) dilakukan
-- lewat Edge Function delete-student (pakai service role), bukan lewat delete langsung ke tabel ini,
-- supaya akun auth-nya ikut terhapus dan siswa tidak bisa login lagi.

-- PENGUMUMAN: siswa lihat punya kelasnya (atau yang untuk semua kelas); guru lihat & tulis semua
create policy "pengumuman_select" on public.pengumuman for select using (
  kelas_id is null
  or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  or public.is_guru()
);
create policy "pengumuman_write_guru" on public.pengumuman for insert with check (public.is_guru());
create policy "pengumuman_update_guru" on public.pengumuman for update using (public.is_guru());
create policy "pengumuman_delete_guru" on public.pengumuman for delete using (public.is_guru());

-- MATERI: siswa lihat materi untuk semua tingkat/kelas, tingkatnya, atau kelasnya (data lama); guru lihat & tulis semua
create policy "materi_select" on public.materi for select using (
  (kelas_id is null and level is null)
  or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
  or public.is_guru()
);
create policy "materi_write_guru" on public.materi for insert with check (public.is_guru());
create policy "materi_update_guru" on public.materi for update using (public.is_guru());
create policy "materi_delete_guru" on public.materi for delete using (public.is_guru());

-- WORKSHEET: siswa lihat worksheet untuk tingkatnya, atau kelasnya (data lama); guru lihat & tulis semua
create policy "worksheet_select" on public.worksheet for select using (
  kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
  or public.is_guru()
);
create policy "worksheet_write_guru" on public.worksheet for insert with check (public.is_guru());
create policy "worksheet_update_guru" on public.worksheet for update using (public.is_guru());
create policy "worksheet_delete_guru" on public.worksheet for delete using (public.is_guru());

-- NILAI: siswa lihat nilainya sendiri; guru lihat & tulis semua (post nilai massal)
create policy "nilai_select" on public.nilai for select using (
  siswa_id = auth.uid() or public.is_guru()
);
create policy "nilai_write_guru" on public.nilai for insert with check (public.is_guru());
create policy "nilai_update_guru" on public.nilai for update using (public.is_guru());
create policy "nilai_delete_guru" on public.nilai for delete using (public.is_guru());

-- =========================================================
-- Seed kelas awal (silakan sesuaikan / tambah lewat dashboard guru nanti)
-- =========================================================
insert into public.kelas (nama, level) values
  ('X I', 'X'), ('X J', 'X'), ('X K', 'X'),
  ('XI D1', 'XI'), ('XI D2', 'XI'), ('XI E1', 'XI')
on conflict (nama) do nothing;

-- =========================================================
-- CATATAN: Membuat akun guru pertama
-- 1. Daftar dulu lewat form "Daftar" di index.html seperti siswa biasa
--    (nanti otomatis jadi role 'siswa').
-- 2. Lalu jalankan query ini di SQL Editor untuk menaikkan jadi guru:
--    update public.profiles set role = 'guru', kelas_id = null where username = 'USERNAME_KAMU';
-- =========================================================
