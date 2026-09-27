-- =========================================================
-- Fitur: JADWAL UJIAN terpisah dari BANK SOAL
--
-- Sebelumnya: upload soal .docx langsung membuat baris `worksheet`
-- juga -> otomatis "terbit" ke siswa saat itu juga.
--
-- Sekarang:
--  1) Upload soal .docx HANYA menyimpan ke `bank_soal` (judul + isi
--     soal saja). BELUM terbit ke siapapun.
--  2) Menu baru "Jadwal Ujian" (tabel `jadwal_ujian`) dipakai guru
--     untuk benar-benar MENERBITKAN ujian: pilih soal dari Bank
--     Soal, atur judul, tanggal mulai/deadline, durasi, tingkat,
--     target semua kelas / kelas tertentu (tabel bantu
--     `jadwal_ujian_kelas`), poin penalti, checkbox potong nilai,
--     acak soal, dan tampilkan nilai.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BANK_SOAL.sql, MIGRASI_SESI_UJIAN.sql, dan
-- MIGRASI_KONTROL_UJIAN.sql sudah pernah dijalankan.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- ---------- 1) Tabel jadwal_ujian ----------
create table if not exists public.jadwal_ujian (
  id uuid primary key default gen_random_uuid(),
  judul text not null,
  bank_soal_id uuid references public.bank_soal(id) on delete set null,
  guru_id uuid references public.profiles(id) on delete set null,
  tingkat text not null check (tingkat in ('X','XI','XII')),
  target_tipe text not null default 'semua' check (target_tipe in ('semua','tertentu')), -- 'semua' = semua kelas di tingkat ini, 'tertentu' = lihat jadwal_ujian_kelas
  durasi_menit integer not null default 90,
  penalti_aktif boolean not null default true,     -- centang "potong nilai" kalau siswa pindah tab/keluar fullscreen
  poin_penalti numeric not null default 2,
  acak_soal boolean not null default false,
  tampilkan_nilai_langsung boolean not null default true,
  mulai timestamptz,      -- kapan bisa mulai dibuka (null = langsung terbuka begitu disimpan)
  deadline date,          -- batas akhir pengerjaan (null = tanpa batas)
  created_at timestamptz default now()
);

-- ---------- 2) Target kelas tertentu (hanya dipakai kalau target_tipe = 'tertentu') ----------
create table if not exists public.jadwal_ujian_kelas (
  id uuid primary key default gen_random_uuid(),
  jadwal_ujian_id uuid not null references public.jadwal_ujian(id) on delete cascade,
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  unique (jadwal_ujian_id, kelas_id)
);

-- ---------- 3) Hubungkan hasil ujian & sesi ujian ke jadwal_ujian ----------
alter table public.hasil_ujian_lms add column if not exists jadwal_ujian_id uuid references public.jadwal_ujian(id) on delete set null;
alter table public.sesi_ujian add column if not exists jadwal_ujian_id uuid references public.jadwal_ujian(id) on delete cascade;

-- bank_soal_id di sesi_ujian sekarang cuma dipakai untuk data lama (sebelum fitur ini
-- ada) — sesi baru selalu memakai jadwal_ujian_id. Longgarkan not-null-nya supaya
-- baris baru boleh diisi tanpa bank_soal_id secara langsung kalau perlu.
alter table public.sesi_ujian alter column bank_soal_id drop not null;

-- Unique constraint lama (bank_soal_id, profile_id) diganti index unik baru berbasis
-- jadwal_ujian_id supaya 1 siswa cuma boleh py 1 sesi aktif per JADWAL UJIAN (bukan
-- per bank soal mentah lagi — 1 bank soal sekarang bisa dipakai oleh beberapa jadwal).
alter table public.sesi_ujian drop constraint if exists sesi_ujian_bank_soal_id_profile_id_key;
create unique index if not exists sesi_ujian_jadwal_profile_uidx
  on public.sesi_ujian (jadwal_ujian_id, profile_id) where jadwal_ujian_id is not null;

-- Supaya link lama (soal.html?id=<bank_soal_id>) yang sudah pernah dibagikan ke siswa
-- tetap jalan, kita simpan referensi "jadwal_ujian hasil migrasi otomatis" di bank_soal.
alter table public.bank_soal add column if not exists legacy_jadwal_ujian_id uuid references public.jadwal_ujian(id) on delete set null;

-- ---------- 4) Backfill: ujian lama (bank_soal + worksheet yang dibuat otomatis
--    lewat cara upload versi sebelumnya) dijadikan baris jadwal_ujian juga, supaya
--    tetap tampil & bisa dikerjakan siswa seperti biasa. ----------
insert into public.jadwal_ujian (
  judul, bank_soal_id, guru_id, tingkat, target_tipe, durasi_menit,
  penalti_aktif, poin_penalti, acak_soal, tampilkan_nilai_langsung,
  mulai, deadline, created_at
)
select
  bs.judul, bs.id, bs.guru_id, coalesce(ws.level, 'X'), 'semua',
  coalesce(bs.durasi_menit, 90), coalesce(bs.penalti_aktif, true),
  coalesce(bs.poin_penalti, 2), coalesce(bs.acak_soal, false),
  coalesce(bs.tampilkan_nilai_langsung, true),
  ws.mulai, ws.deadline, bs.created_at
from public.bank_soal bs
join public.worksheet ws on ws.id = bs.worksheet_id
where bs.worksheet_id is not null
  and bs.legacy_jadwal_ujian_id is null;

-- Kaitkan balik bank_soal.legacy_jadwal_ujian_id ke baris jadwal_ujian yang baru
-- dibuat di atas (dicocokkan lewat bank_soal_id, aman dijalankan berkali-kali karena
-- filter "legacy_jadwal_ujian_id is null" di atas mencegah duplikasi).
update public.bank_soal bs
set legacy_jadwal_ujian_id = ju.id
from public.jadwal_ujian ju
where ju.bank_soal_id = bs.id
  and bs.legacy_jadwal_ujian_id is null
  and bs.worksheet_id is not null;

-- =========================================================
-- Helper RLS: apakah siswa yang sedang login boleh melihat/mengerjakan
-- baris jadwal_ujian tertentu (security definer, hindari rekursi RLS).
-- =========================================================
create or replace function public.ujian_terlihat_untukku(p_jadwal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.jadwal_ujian ju
    join public.profiles p on p.id = auth.uid()
    left join public.kelas k on k.id = p.kelas_id
    where ju.id = p_jadwal_id
      and (
        (ju.target_tipe = 'semua' and k.level = ju.tingkat)
        or (ju.target_tipe = 'tertentu' and exists (
              select 1 from public.jadwal_ujian_kelas juk
              where juk.jadwal_ujian_id = ju.id and juk.kelas_id = p.kelas_id
            ))
      )
  );
$$;

-- =========================================================
-- RLS
-- =========================================================
alter table public.jadwal_ujian enable row level security;
alter table public.jadwal_ujian_kelas enable row level security;

drop policy if exists "jadwal_ujian_select" on public.jadwal_ujian;
drop policy if exists "jadwal_ujian_insert_guru" on public.jadwal_ujian;
drop policy if exists "jadwal_ujian_update_guru" on public.jadwal_ujian;
drop policy if exists "jadwal_ujian_delete_guru" on public.jadwal_ujian;

-- Siswa hanya lihat jadwal ujian yang menyasar tingkat/kelasnya; guru lihat semua.
create policy "jadwal_ujian_select" on public.jadwal_ujian
  for select using (public.is_guru() or public.ujian_terlihat_untukku(id));
create policy "jadwal_ujian_insert_guru" on public.jadwal_ujian
  for insert with check (public.is_guru());
create policy "jadwal_ujian_update_guru" on public.jadwal_ujian
  for update using (public.is_guru());
create policy "jadwal_ujian_delete_guru" on public.jadwal_ujian
  for delete using (public.is_guru());

drop policy if exists "jadwal_ujian_kelas_all_guru" on public.jadwal_ujian_kelas;
-- Tabel penghubung ini cuma perlu diakses guru (RLS jadwal_ujian di atas sudah
-- memakai fungsi security definer, jadi siswa tidak perlu baca tabel ini langsung).
create policy "jadwal_ujian_kelas_all_guru" on public.jadwal_ujian_kelas
  for all using (public.is_guru()) with check (public.is_guru());

-- =========================================================
-- CATATAN:
-- - bank_soal TIDAK lagi otomatis membuat worksheet saat upload; kolom
--   durasi_menit/penalti_aktif/poin_penalti/acak_soal/tampilkan_nilai_langsung
--   di bank_soal dibiarkan ada (tidak dihapus) tapi tidak lagi dipakai —
--   pengaturan ujian yang berlaku sekarang selalu dari jadwal_ujian.
-- - worksheet.html menampilkan gabungan `worksheet` (materi/latihan biasa)
--   dan `jadwal_ujian` (ujian terjadwal) dalam satu daftar.
-- =========================================================
