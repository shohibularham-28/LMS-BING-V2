-- =========================================================
-- MIGRASI: Persetujuan akun siswa yang daftar mandiri
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- Aman dijalankan berulang (pakai IF NOT EXISTS / OR REPLACE).
-- =========================================================
--
-- Setelah migrasi ini, siswa yang daftar sendiri lewat tombol "Daftar Akun
-- Siswa" di index.html akan berstatus 'pending' dan TIDAK BISA login sampai
-- disetujui guru lewat menu baru "🆕 Persetujuan Akun" di dashboard guru.
-- Akun yang sudah ada sekarang (dan akun yang dibuat guru lewat "Buat Akun
-- Siswa Massal") otomatis berstatus 'approved', jadi tidak terpengaruh.
-- =========================================================

-- ---------- 1) Tambah kolom status ----------
alter table public.profiles add column if not exists status text not null default 'approved' check (status in ('pending','approved'));

-- ---------- 2) Update policy insert: siswa daftar mandiri wajib berstatus pending ----------
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid() and role = 'siswa' and status = 'pending');
