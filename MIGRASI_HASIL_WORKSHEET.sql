-- =========================================================
-- Tabel hasil_worksheet — menampung Jenis/Nama/Anggota/Kelas/Nilai/Status
-- dari worksheet HTML mandiri (siswa TIDAK perlu login LMS, cukup isi
-- Jenis Pengerjaan (Individu/Kelompok), Nama, dan Kelas di halaman worksheet).
-- Dipakai oleh guru.html bagian "Hasil Worksheet".
-- Aman dijalankan berkali-kali (idempotent) — tidak akan error kalau
-- tabel/policy sudah pernah dibuat sebelumnya.
-- (Butuh function public.is_guru() — sudah ada dari schema.sql utama.)
-- =========================================================

create table if not exists public.hasil_worksheet (
  id uuid primary key default gen_random_uuid(),
  worksheet_slug text not null,   -- pengenal worksheet, mis. 'past-continuous-tense'
  jenis text not null check (jenis in ('individu','kelompok')),
  nama text not null,             -- nama siswa (individu) atau nama kelompok
  anggota text,                   -- daftar nama anggota (khusus kelompok), pisahkan koma
  kelas text not null,
  nilai numeric,
  nilai_maks numeric,
  status text not null default 'selesai',  -- 'selesai' / 'belum'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.hasil_worksheet enable row level security;

-- Hapus dulu kalau sudah ada, supaya bisa dibuat ulang tanpa error.
drop policy if exists "hasil_worksheet_insert_public" on public.hasil_worksheet;
drop policy if exists "hasil_worksheet_select_guru" on public.hasil_worksheet;
drop policy if exists "hasil_worksheet_delete_guru" on public.hasil_worksheet;

-- Siapa saja (termasuk yang belum login) boleh KIRIM hasil,
-- karena worksheet ini dibuka tanpa login LMS.
create policy "hasil_worksheet_insert_public" on public.hasil_worksheet
  for insert with check (true);

-- Cuma guru yang login yang boleh MELIHAT & MENGHAPUS.
create policy "hasil_worksheet_select_guru" on public.hasil_worksheet
  for select using (public.is_guru());

create policy "hasil_worksheet_delete_guru" on public.hasil_worksheet
  for delete using (public.is_guru());
