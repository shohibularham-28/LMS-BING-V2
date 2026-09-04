-- =========================================================
-- MIGRASI: Perbaikan dropdown "Kelas" kosong di halaman Daftar Akun Siswa
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- =========================================================
--
-- PENYEBAB:
-- Policy lama "kelas_select" cuma mengizinkan baca tabel kelas kalau
-- auth.uid() is not null (artinya harus sudah login). Padahal orang yang
-- baru mau Daftar Akun di index.html belum punya sesi login sama sekali,
-- jadi query daftar kelas selalu ditolak RLS dan dropdown-nya kosong/
-- "Belum ada kelas tersedia".
--
-- PERBAIKAN:
-- Izinkan siapa saja (termasuk yang belum login) membaca tabel kelas.
-- Ini aman karena tabel kelas cuma berisi nama & tingkat kelas (X I, XI D1,
-- dst), bukan data pribadi siswa. Guru tetap satu-satunya yang boleh
-- tambah/ubah/hapus kelas.
-- =========================================================

drop policy if exists "kelas_select" on public.kelas;
create policy "kelas_select" on public.kelas for select using (true);
