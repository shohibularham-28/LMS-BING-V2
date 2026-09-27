-- =========================================================
-- Fitur: Upload Soal dari Word (.docx) -> soal.html
-- Beda dengan hasil_ujian/hasil_worksheet lama: soal ini dibuka
-- SETELAH siswa login LMS (lewat menu Worksheet), jadi Nama & Kelas
-- diambil otomatis dari akun (profiles), TIDAK diketik manual, dan
-- hasilnya terikat ke profile_id siswa yang sebenarnya.
-- Jalankan sekali di Supabase Dashboard > SQL Editor.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- 1) Bank soal: menyimpan hasil parsing file .docx yang di-upload guru
create table if not exists public.bank_soal (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  guru_id uuid references public.profiles(id) on delete set null,
  worksheet_id uuid references public.worksheet(id) on delete set null,
  durasi_menit integer not null default 90,
  penalti_aktif boolean not null default true,      -- fullscreen & deteksi pelanggaran SELALU aktif; ini hanya mengatur apakah nilai dipotong
  poin_penalti numeric not null default 2,          -- poin dikurangi per pelanggaran (dipakai kalau penalti_aktif = true)
  data jsonb not null,              -- array DATA (lihat format di soal.html / template docx)
  sumber_file text,                 -- nama file .docx asli, buat referensi guru
  created_at timestamptz default now()
);

-- Kalau tabel sudah pernah dibuat sebelum kolom ini ada, tambahkan sekarang
-- (aman dijalankan berkali-kali).
alter table public.bank_soal add column if not exists penalti_aktif boolean not null default true;
alter table public.bank_soal add column if not exists poin_penalti numeric not null default 2;

-- Pengaturan tambahan: acak urutan soal per siswa, dan apakah nilai langsung
-- ditampilkan ke siswa begitu selesai mengerjakan atau ditahan dulu sampai
-- guru "mengumumkan" (lihat Dashboard Guru > Hasil Bank Soal).
alter table public.bank_soal add column if not exists acak_soal boolean not null default false;
alter table public.bank_soal add column if not exists tampilkan_nilai_langsung boolean not null default true;

-- Kalau kamu sempat menjalankan versi migrasi SEBELUMNYA yang memakai nama
-- kolom "pengawasan_aktif" (versi awal fitur ini), pindahkan datanya lalu
-- hapus kolom lama dengan menjalankan 2 baris di bawah ini SEKALI SAJA
-- (hapus tanda komentar -- di depannya dulu):
-- update public.bank_soal set penalti_aktif = pengawasan_aktif;
-- alter table public.bank_soal drop column if exists pengawasan_aktif;

alter table public.bank_soal enable row level security;

drop policy if exists "bank_soal_select_all_logged_in" on public.bank_soal;
drop policy if exists "bank_soal_insert_guru" on public.bank_soal;
drop policy if exists "bank_soal_update_guru" on public.bank_soal;
drop policy if exists "bank_soal_delete_guru" on public.bank_soal;

-- Siswa & guru yang sudah login boleh MEMBACA soal (perlu untuk soal.html).
create policy "bank_soal_select_all_logged_in" on public.bank_soal
  for select using (auth.uid() is not null);

-- Cuma guru yang boleh membuat/mengubah/menghapus bank soal.
create policy "bank_soal_insert_guru" on public.bank_soal
  for insert with check (public.is_guru());
create policy "bank_soal_update_guru" on public.bank_soal
  for update using (public.is_guru());
create policy "bank_soal_delete_guru" on public.bank_soal
  for delete using (public.is_guru());


-- 2) Hasil ujian dari soal.html, terikat ke akun siswa asli (profile_id)
create table if not exists public.hasil_ujian_lms (
  id uuid primary key default gen_random_uuid(),
  bank_soal_id uuid references public.bank_soal(id) on delete cascade,
  worksheet_id uuid references public.worksheet(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  nama text not null,               -- disalin dari profiles.nama saat submit (arsip)
  kelas text not null,               -- disalin dari kelas.nama saat submit (arsip)
  nilai numeric not null,
  skor_mentah numeric,
  skor_total numeric,
  penalti numeric default 0,
  pelanggaran integer default 0,
  jawaban text,                     -- laporan jawaban per nomor, untuk ditinjau guru
  dipublikasikan boolean not null default true, -- apakah nilai ini sudah boleh dilihat siswa di akunnya
  created_at timestamptz default now()
);

alter table public.hasil_ujian_lms add column if not exists dipublikasikan boolean not null default true;

alter table public.hasil_ujian_lms enable row level security;

drop policy if exists "hasil_ujian_lms_insert_own" on public.hasil_ujian_lms;
drop policy if exists "hasil_ujian_lms_select_own_or_guru" on public.hasil_ujian_lms;
drop policy if exists "hasil_ujian_lms_update_guru" on public.hasil_ujian_lms;
drop policy if exists "hasil_ujian_lms_delete_guru" on public.hasil_ujian_lms;

-- Siswa hanya boleh mengirim hasil atas namanya sendiri (profile_id = akunnya).
create policy "hasil_ujian_lms_insert_own" on public.hasil_ujian_lms
  for insert with check (profile_id = auth.uid());

-- Siswa boleh melihat hasil miliknya sendiri (RLS di sini tidak menyembunyikan
-- kolom "dipublikasikan" — sembunyikan nilai yang belum dipublikasikan di sisi
-- tampilan/JavaScript, lihat pengumuman.html); guru boleh melihat semua.
create policy "hasil_ujian_lms_select_own_or_guru" on public.hasil_ujian_lms
  for select using (profile_id = auth.uid() or public.is_guru());

-- Cuma guru yang boleh mengubah (dipakai untuk tombol "Terbitkan Nilai").
create policy "hasil_ujian_lms_update_guru" on public.hasil_ujian_lms
  for update using (public.is_guru());

-- Cuma guru yang boleh menghapus (mis. kalau ada percobaan curang / perlu reset).
create policy "hasil_ujian_lms_delete_guru" on public.hasil_ujian_lms
  for delete using (public.is_guru());
