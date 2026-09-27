-- =========================================================
-- Perbaikan: soal_dirilis_at di battle_sesi sekarang dicatat pakai
-- JAM SERVER database, bukan jam device guru lagi.
--
-- Sebelumnya battle-guru.html mengirim soal_dirilis_at = jam laptop/HP
-- guru saat tombol "Rilis Soal Berikutnya" diklik -- diambil SEBELUM
-- request-nya bahkan terkirim ke server. Kalau koneksi guru lambat,
-- waktu tempuh request itu ikut "termakan" dari hitung mundur siswa,
-- padahal soalnya belum sempat disiarkan ke siapa pun. Jam laptop guru
-- yang tidak presisi juga langsung bikin semua siswa melenceng waktunya.
--
-- Dengan trigger ini, kolom soal_dirilis_at OTOMATIS diisi ulang oleh
-- database dengan now() setiap kali soal_aktif_index berubah -- apa pun
-- yang dikirim dari browser guru akan ditimpa. Tidak perlu ubah kode
-- battle-guru.html sama sekali, karena kolom ini memang selalu ditimpa.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

create or replace function public.battle_set_soal_dirilis_at_server()
returns trigger
language plpgsql
as $$
begin
  if new.soal_aktif_index is distinct from old.soal_aktif_index then
    new.soal_dirilis_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_battle_sesi_soal_dirilis_at on public.battle_sesi;
create trigger trg_battle_sesi_soal_dirilis_at
  before update on public.battle_sesi
  for each row
  execute function public.battle_set_soal_dirilis_at_server();
