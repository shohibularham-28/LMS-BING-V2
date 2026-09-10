-- =========================================================
-- Fitur Koleksi Bintang ⭐
--
--   - Guru punya menu baru "⭐ Kirim Bintang" di dashboard: pilih kelas,
--     centang satu/banyak siswa, isi jumlah bintang + alasan (opsional),
--     lalu kirim. Tiap pengiriman tersimpan sebagai 1 baris per siswa
--     penerima di tabel "bintang".
--   - Siswa punya menu baru "⭐ Koleksi Bintang" (bintang.html) yang
--     menampilkan total bintang yang sudah dikumpulkan beserta riwayat
--     kapan & dari guru mana dia dapat bintang itu.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

-- ---------- BINTANG: 1 baris = 1x guru mengirim N bintang ke 1 siswa ----------
create table if not exists public.bintang (
  id uuid primary key default gen_random_uuid(),
  siswa_id uuid not null references public.profiles(id) on delete cascade,
  guru_id uuid references public.profiles(id) on delete set null,
  guru_nama text, -- disalin dari profiles.nama guru saat mengirim (arsip, tetap ada walau akun guru dihapus)
  jumlah integer not null default 1 check (jumlah > 0 and jumlah <= 100),
  alasan text, -- pesan/alasan opsional dari guru, mis. "Aktif menjawab di kelas"
  created_at timestamptz not null default now()
);

create index if not exists idx_bintang_siswa_created on public.bintang (siswa_id, created_at desc);

-- =========================================================
-- RLS
-- =========================================================
alter table public.bintang enable row level security;

drop policy if exists "bintang_select" on public.bintang;
drop policy if exists "bintang_insert_guru" on public.bintang;
drop policy if exists "bintang_delete_guru" on public.bintang;

-- Siswa lihat bintang miliknya sendiri; guru lihat semua (untuk riwayat pengiriman).
create policy "bintang_select" on public.bintang
  for select using (
    siswa_id = auth.uid() or public.is_guru()
  );

-- Cuma guru yang boleh mengirim bintang.
create policy "bintang_insert_guru" on public.bintang
  for insert with check (public.is_guru());

-- Cuma guru yang boleh menghapus (mis. salah kirim / testing).
create policy "bintang_delete_guru" on public.bintang
  for delete using (public.is_guru());

-- =========================================================
-- Realtime (opsional) — supaya koleksi bintang siswa ikut update instan
-- tanpa perlu reload halaman. Aman diabaikan kalau errornya
-- "already member of publication".
-- =========================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.bintang;
  exception when others then null;
  end;
end $$;
