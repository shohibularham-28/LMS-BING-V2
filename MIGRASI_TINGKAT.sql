-- =========================================================
-- MIGRASI: Worksheet & Materi ditarget per TINGKAT (X/XI/XII), bukan per kelas
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- pada project yang sudah punya tabel materi & worksheet lama.
-- Aman dijalankan berulang (pakai IF NOT EXISTS / OR REPLACE).
-- Data materi/worksheet lama yang masih pakai kelas_id TETAP muncul
-- seperti biasa untuk siswa di kelas itu (tidak hilang).
-- =========================================================

-- ---------- 1) Tambah kolom level ----------
alter table public.materi add column if not exists level text check (level in ('X','XI','XII'));
alter table public.worksheet add column if not exists level text check (level in ('X','XI','XII'));

-- ---------- 2) Worksheet sekarang boleh tidak punya kelas_id spesifik (ditarget via level) ----------
alter table public.worksheet alter column kelas_id drop not null;

-- ---------- 3) Update RLS: materi_select ----------
drop policy if exists "materi_select" on public.materi;
create policy "materi_select" on public.materi for select using (
  (kelas_id is null and level is null)
  or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
  or public.is_guru()
);

-- ---------- 4) Update RLS: worksheet_select ----------
drop policy if exists "worksheet_select" on public.worksheet;
create policy "worksheet_select" on public.worksheet for select using (
  kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
  or public.is_guru()
);
