-- =========================================================
-- MIGRASI: Materi "Khusus Guru" (hanya bisa dilihat guru)
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berulang.
-- =========================================================

-- 1) Kolom penanda materi khusus guru
alter table public.materi
  add column if not exists khusus_guru boolean not null default false;

-- 2) RLS: siswa TIDAK boleh melihat materi khusus guru.
--    Guru tetap bisa melihat semua materi.
drop policy if exists "materi_select" on public.materi;
create policy "materi_select" on public.materi for select using (
  public.is_guru()
  or (
    khusus_guru = false
    and (
      (kelas_id is null and level is null)
      or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
      or level = (select k.level from public.profiles p join public.kelas k on k.id = p.kelas_id where p.id = auth.uid())
    )
  )
);
