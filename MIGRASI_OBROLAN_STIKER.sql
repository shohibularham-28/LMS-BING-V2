-- =========================================================
-- FITUR: Stiker di Obrolan Kelas
-- ---------------------------------------------------------
-- Menambahkan tipe pesan baru 'stiker' pada pesan_kelas, di
-- samping 'teks' dan 'hadir' yang sudah ada. Isi stiker
-- disimpan sebagai emoji langsung di kolom `isi` (tidak perlu
-- tabel/storage baru), lalu dirender lebih besar tanpa
-- bubble di frontend (obrolan.html & guru.html).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman
-- dijalankan berkali-kali (idempotent). Butuh
-- MIGRASI_OBROLAN_KELAS.sql dan MIGRASI_KEHADIRAN.sql (yang
-- menambahkan kolom `tipe`) sudah pernah dijalankan lebih dulu.
-- =========================================================

alter table public.pesan_kelas drop constraint if exists pesan_kelas_tipe_check;
alter table public.pesan_kelas add constraint pesan_kelas_tipe_check
  check (tipe in ('teks', 'hadir', 'stiker'));
