-- =========================================================
-- Obrolan Kelas — tambahan: hapus pesan sendiri, kirim anonim.
--
--   - Setiap user (siswa/guru) bisa menghapus pesannya sendiri.
--   - Guru tetap bisa menghapus pesan siapapun / semua pesan di
--     kelas manapun (kebijakan "pesan_kelas_delete_guru" sudah ada
--     dari migrasi sebelumnya, tidak perlu diubah).
--   - Siswa bisa memilih kirim sebagai nama asli atau anonim.
--     Saat anonim, nama yang disimpan & ditampilkan adalah "Anonim"
--     (identitas asli tidak pernah dikirim ke klien lain).
--
-- Jalankan setelah MIGRASI_OBROLAN_KELAS.sql. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

-- Kolom penanda pesan anonim.
alter table public.pesan_kelas
  add column if not exists is_anonim boolean not null default false;

-- Setiap user boleh menghapus pesan miliknya sendiri (siswa maupun guru).
-- Kebijakan ini digabung (OR) dengan "pesan_kelas_delete_guru" yang sudah
-- ada, jadi guru tetap bisa menghapus pesan siapa saja / semua pesan.
drop policy if exists "pesan_kelas_delete_own" on public.pesan_kelas;
create policy "pesan_kelas_delete_own" on public.pesan_kelas
  for delete using (sender_id = auth.uid());
