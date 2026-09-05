-- =========================================================
-- Tabel hasil_ujian — menampung Nama, Kelas, Nilai dari soal
-- ujian HTML mandiri (siswa TIDAK perlu login LMS untuk isi ini,
-- cuma isi Nama & Kelas manual di halaman soal).
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- (Butuh function public.is_guru() — sudah ada dari schema.sql utama.)
-- =========================================================

create table if not exists public.hasil_ujian (
  id uuid primary key default gen_random_uuid(),
  ujian_slug text not null,   -- pengenal soal, mis. 'procedure-text' — buat filter di dashboard guru
  nama text not null,
  kelas text not null,
  nilai numeric not null,
  created_at timestamptz default now()
);

alter table public.hasil_ujian enable row level security;

-- Siapa saja (termasuk yang belum login) boleh KIRIM hasil,
-- karena soal ini dibuka tanpa login LMS.
create policy "hasil_ujian_insert_public" on public.hasil_ujian
  for insert with check (true);

-- Cuma guru yang login yang boleh MELIHAT & MENGHAPUS.
create policy "hasil_ujian_select_guru" on public.hasil_ujian
  for select using (public.is_guru());

create policy "hasil_ujian_delete_guru" on public.hasil_ujian
  for delete using (public.is_guru());
