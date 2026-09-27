-- =========================================================
-- Draft Worksheet — guru bisa SIMPAN worksheet dulu tanpa langsung
-- terlihat siswa, baru diterbitkan belakangan lewat tombol
-- "🚀 Terbitkan" di menu Kelola Worksheet (guru.html).
--
-- Sebelumnya: begitu worksheet disimpan, langsung muncul di daftar
-- worksheet siswa (kolom "mulai" cuma mengunci kapan bisa DIKERJAKAN,
-- bukan menyembunyikan keberadaannya). Sekarang ada kolom `published`
-- terpisah yang benar-benar menyembunyikan worksheet dari siswa
-- selama masih draft.
--
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- Worksheet lama (yang sudah pernah dibuat sebelum migrasi ini) dianggap
-- sudah terbit, supaya tidak tiba-tiba hilang dari daftar siswa.
alter table public.worksheet add column if not exists published boolean not null default true;

-- Ganti RLS select: siswa cuma boleh lihat worksheet yang published = true
-- (selain harus cocok kelas/tingkatnya juga, seperti sebelumnya). Guru
-- tetap bisa lihat semua (termasuk draft) untuk keperluan Kelola Worksheet.
drop policy if exists "worksheet_select" on public.worksheet;
create policy "worksheet_select" on public.worksheet for select using (
  public.is_guru()
  or (
    published = true
    and (
      kelas_id = (select kelas_id from public.profiles where id = auth.uid())
      or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
    )
  )
);
