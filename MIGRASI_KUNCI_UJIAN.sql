-- =========================================================
-- Kunci Ujian Otomatis — saat siswa pindah tab/aplikasi, keluar dari
-- fullscreen, atau meninggalkan layar ujian, ujian OTOMATIS TERKUNCI:
--   - Siswa tidak bisa melanjutkan mengerjakan (semua jawaban dikunci,
--     timer berhenti) sampai dibuka kembali.
--   - HANYA guru yang bisa membuka kunci, lewat dashboard guru
--     (menu "Sedang Ujian" > tombol "🔓 Buka Kunci").
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- menjalankan MIGRASI_SESI_UJIAN.sql dan MIGRASI_KONTROL_UJIAN.sql.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.sesi_ujian add column if not exists locked boolean not null default false;
alter table public.sesi_ujian add column if not exists locked_reason text;

-- Catatan RLS: policy "sesi_ujian_update_own_or_guru" yang sudah ada
-- di MIGRASI_SESI_UJIAN.sql sudah cukup — siswa boleh update baris
-- miliknya sendiri (untuk set locked=true begitu terdeteksi
-- pelanggaran), dan guru boleh update baris siapa saja (untuk
-- membuka kunci lewat dashboard). Tidak perlu policy tambahan.
