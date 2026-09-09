-- =========================================================
-- Tabel sesi_ujian — dipakai untuk fitur "Sedang Ujian" di
-- dashboard guru: menampilkan siapa saja yang SEDANG mengerjakan
-- soal dari Bank Soal secara live (bukan cuma yang sudah submit).
--
-- Cara kerja singkat:
-- 1) Saat siswa mulai/melanjutkan mengerjakan soal di soal.html,
--    baris di sini dibuat/diupdate dengan status 'mengerjakan'.
-- 2) Selama mengerjakan, soal.html mengirim "ping" tiap ~20 detik
--    untuk update kolom last_ping_at (tanda siswa masih aktif).
-- 3) Saat siswa submit jawaban, status diubah jadi 'selesai'.
-- 4) Guru dashboard membaca tabel ini dan otomatis refresh berkala
--    (polling) untuk menampilkan siapa saja yang sedang mengerjakan.
--    Kalau last_ping_at sudah lama (misal >1 menit) padahal status
--    masih 'mengerjakan', dashboard menandainya "Tidak Merespon"
--    (kemungkinan siswa menutup tab tanpa submit).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- (Butuh function public.is_guru() — sudah ada dari schema.sql utama.)
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

create table if not exists public.sesi_ujian (
  id uuid primary key default gen_random_uuid(),
  bank_soal_id uuid not null references public.bank_soal(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nama text not null,
  kelas text not null,
  status text not null default 'mengerjakan' check (status in ('mengerjakan', 'selesai')),
  pelanggaran integer not null default 0,
  started_at timestamptz not null default now(),
  last_ping_at timestamptz not null default now(),
  unique (bank_soal_id, profile_id)
);

alter table public.sesi_ujian enable row level security;

drop policy if exists "sesi_ujian_insert_own" on public.sesi_ujian;
drop policy if exists "sesi_ujian_update_own_or_guru" on public.sesi_ujian;
drop policy if exists "sesi_ujian_select_own_or_guru" on public.sesi_ujian;
drop policy if exists "sesi_ujian_delete_guru" on public.sesi_ujian;

-- Siswa hanya boleh membuat sesi atas namanya sendiri (profile_id = akunnya).
create policy "sesi_ujian_insert_own" on public.sesi_ujian
  for insert with check (profile_id = auth.uid());

-- Siswa boleh update sesinya sendiri (buat heartbeat/ping & tandai selesai);
-- guru juga boleh update (misal untuk keperluan admin/cleanup manual).
create policy "sesi_ujian_update_own_or_guru" on public.sesi_ujian
  for update using (profile_id = auth.uid() or public.is_guru())
  with check (profile_id = auth.uid() or public.is_guru());

-- Siswa hanya boleh lihat sesinya sendiri; guru boleh lihat semua sesi.
create policy "sesi_ujian_select_own_or_guru" on public.sesi_ujian
  for select using (profile_id = auth.uid() or public.is_guru());

-- Cuma guru yang boleh menghapus (mis. bersihkan sesi lama).
create policy "sesi_ujian_delete_guru" on public.sesi_ujian
  for delete using (public.is_guru());
