-- =========================================================
-- Presensi / Kehadiran lewat Obrolan Kelas
--
--   - Guru klik "📋 Kirim Daftar Hadir" di Obrolan Kelas (pilih kelas dulu).
--     Ini membuat 1 baris "sesi_hadir" baru utk kelas itu, lalu mengirim
--     1 pesan spesial ke room obrolan kelas tersebut (kolom pesan_kelas.tipe
--     = 'hadir', terhubung ke sesi_hadir.id). Pesan ini dirender di
--     frontend sebagai IKON (bukan teks link biasa) yang berisi link ke
--     sesi presensi itu (unik per kelas & per pengiriman).
--   - Siswa di kelas tsb klik ikon → muncul konfirmasi kehadiran → klik
--     "Ya, saya hadir" → tercatat di tabel "kehadiran" (1 baris per siswa
--     per sesi, tidak bisa dobel).
--   - Guru lihat rekapnya di menu baru "🧾 Rekap Kehadiran" di dashboard.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (idempotent). Butuh MIGRASI_OBROLAN_KELAS.sql sudah pernah
-- dijalankan lebih dulu (tabel pesan_kelas harus sudah ada).
-- =========================================================

-- ---------- SESI_HADIR: 1 baris = 1x guru kirim "daftar hadir" ke kelas tertentu ----------
create table if not exists public.sesi_hadir (
  id uuid primary key default gen_random_uuid(),
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  guru_id uuid references public.profiles(id) on delete set null,
  guru_nama text,
  judul text not null default 'Presensi Kehadiran',
  created_at timestamptz not null default now()
);

create index if not exists idx_sesi_hadir_kelas_created
  on public.sesi_hadir (kelas_id, created_at desc);

-- ---------- KEHADIRAN: 1 baris = 1 siswa konfirmasi hadir di 1 sesi ----------
create table if not exists public.kehadiran (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.sesi_hadir(id) on delete cascade,
  siswa_id uuid not null references public.profiles(id) on delete cascade,
  siswa_nama text not null, -- disalin dari profiles.nama saat konfirmasi (arsip)
  waktu_konfirmasi timestamptz not null default now(),
  unique (sesi_id, siswa_id) -- 1 siswa cuma bisa konfirmasi 1x per sesi
);

create index if not exists idx_kehadiran_sesi on public.kehadiran (sesi_id);

-- ---------- PESAN_KELAS: tandai pesan "kartu presensi" + link ke sesi_hadir ----------
alter table public.pesan_kelas add column if not exists tipe text not null default 'teks';
alter table public.pesan_kelas drop constraint if exists pesan_kelas_tipe_check;
alter table public.pesan_kelas add constraint pesan_kelas_tipe_check check (tipe in ('teks', 'hadir'));
alter table public.pesan_kelas add column if not exists sesi_hadir_id uuid references public.sesi_hadir(id) on delete set null;

-- =========================================================
-- RLS
-- =========================================================
alter table public.sesi_hadir enable row level security;
alter table public.kehadiran enable row level security;

drop policy if exists "sesi_hadir_select" on public.sesi_hadir;
drop policy if exists "sesi_hadir_insert_guru" on public.sesi_hadir;
drop policy if exists "sesi_hadir_delete_guru" on public.sesi_hadir;

-- Siswa boleh lihat sesi presensi di kelasnya sendiri (perlu ini utk render
-- kartu di chat & cek status "sudah/belum konfirmasi"); guru lihat semua.
create policy "sesi_hadir_select" on public.sesi_hadir
  for select using (
    public.is_guru()
    or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  );

-- Cuma guru yang boleh membuat sesi presensi (mengirim daftar hadir ke chat).
create policy "sesi_hadir_insert_guru" on public.sesi_hadir
  for insert with check (public.is_guru());

-- Cuma guru yang boleh menghapus sesi presensi (mis. sesi salah kirim / testing).
create policy "sesi_hadir_delete_guru" on public.sesi_hadir
  for delete using (public.is_guru());

drop policy if exists "kehadiran_select" on public.kehadiran;
drop policy if exists "kehadiran_insert_self" on public.kehadiran;
drop policy if exists "kehadiran_delete_guru" on public.kehadiran;

-- Siswa lihat konfirmasi kehadirannya sendiri; guru lihat semua (utk rekap).
create policy "kehadiran_select" on public.kehadiran
  for select using (
    siswa_id = auth.uid() or public.is_guru()
  );

-- Siswa cuma boleh konfirmasi kehadiran atas namanya sendiri, dan hanya utk
-- sesi presensi yang memang dikirim ke kelasnya sendiri.
create policy "kehadiran_insert_self" on public.kehadiran
  for insert with check (
    siswa_id = auth.uid()
    and exists (
      select 1 from public.sesi_hadir sh
      where sh.id = sesi_id
        and sh.kelas_id = (select kelas_id from public.profiles where id = auth.uid())
    )
  );

-- Guru boleh menghapus data kehadiran (mis. sekalian saat menghapus sesi salah kirim).
create policy "kehadiran_delete_guru" on public.kehadiran
  for delete using (public.is_guru());

-- =========================================================
-- Realtime (opsional) — supaya rekap & badge kehadiran ikut update instan.
-- Aman diabaikan kalau errornya "already member of publication".
-- =========================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.sesi_hadir;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.kehadiran;
  exception when others then null;
  end;
end $$;
