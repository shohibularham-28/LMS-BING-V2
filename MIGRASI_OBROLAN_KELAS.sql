-- =========================================================
-- Obrolan Kelas — room chat per kelas antara guru & siswa.
--   - Siswa hanya bisa melihat & mengirim pesan di room kelasnya sendiri.
--   - Guru bisa melihat & mengirim pesan ke room kelas manapun (dipilih
--     lewat dropdown di dashboard guru).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

create table if not exists public.pesan_kelas (
  id uuid primary key default gen_random_uuid(),
  kelas_id uuid not null references public.kelas(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_nama text not null,          -- disalin dari profiles.nama saat kirim (arsip, tetap tampil walau akun dihapus)
  sender_role text not null check (sender_role in ('guru', 'siswa')),
  isi text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pesan_kelas_kelas_created
  on public.pesan_kelas (kelas_id, created_at);

alter table public.pesan_kelas enable row level security;

drop policy if exists "pesan_kelas_select" on public.pesan_kelas;
drop policy if exists "pesan_kelas_insert" on public.pesan_kelas;
drop policy if exists "pesan_kelas_delete_guru" on public.pesan_kelas;

-- Siswa cuma boleh baca pesan di room kelasnya sendiri; guru boleh baca semua room.
create policy "pesan_kelas_select" on public.pesan_kelas
  for select using (
    public.is_guru()
    or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
  );

-- Siswa cuma boleh kirim pesan atas namanya sendiri, ke room kelasnya sendiri.
-- Guru boleh kirim ke room kelas manapun (masih atas namanya sendiri).
create policy "pesan_kelas_insert" on public.pesan_kelas
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_guru()
      or kelas_id = (select kelas_id from public.profiles where id = auth.uid())
    )
  );

-- Cuma guru yang boleh menghapus pesan (moderasi konten tidak pantas dsb).
create policy "pesan_kelas_delete_guru" on public.pesan_kelas
  for delete using (public.is_guru());

-- Opsional: aktifkan Supabase Realtime untuk room ini supaya pesan baru
-- muncul instan tanpa nunggu polling. Aman diabaikan kalau errornya
-- "already member of publication" — berarti sudah aktif.
do $$
begin
  begin
    alter publication supabase_realtime add table public.pesan_kelas;
  exception when others then
    null; -- publication belum ada / tabel sudah tergabung / realtime tidak dipakai — tidak masalah, chat tetap jalan lewat polling
  end;
end $$;
