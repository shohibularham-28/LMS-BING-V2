-- =========================================================
-- FITUR: Upload Gambar untuk Soal & Opsi Jawaban (Bank Soal)
-- ---------------------------------------------------------
-- Menyiapkan bucket Supabase Storage bernama "soal-images"
-- tempat gambar referensi soal & gambar opsi jawaban disimpan
-- saat guru mengedit Bank Soal (menu "Susun Soal" > Edit Soal).
-- URL publik gambar itu lalu disimpan di kolom bank_soal.data
-- (field `image` per soal, `img` per opsi jawaban) — tidak ada
-- tabel baru yang diperlukan.
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman
-- dijalankan berkali-kali (idempotent).
-- =========================================================

-- Bucket publik (read) supaya gambar bisa langsung ditampilkan
-- ke siswa di halaman ujian tanpa perlu proses auth tambahan.
insert into storage.buckets (id, name, public)
values ('soal-images', 'soal-images', true)
on conflict (id) do update set public = true;

-- Siapa saja (termasuk siswa yang belum login) boleh MELIHAT gambar
-- di bucket ini — perlu supaya gambar tampil di halaman ujian.
drop policy if exists "soal_images_select_public" on storage.objects;
create policy "soal_images_select_public" on storage.objects
  for select using (bucket_id = 'soal-images');

-- Hanya guru yang boleh mengunggah, mengubah, atau menghapus gambar soal.
drop policy if exists "soal_images_insert_guru" on storage.objects;
create policy "soal_images_insert_guru" on storage.objects
  for insert with check (bucket_id = 'soal-images' and public.is_guru());

drop policy if exists "soal_images_update_guru" on storage.objects;
create policy "soal_images_update_guru" on storage.objects
  for update using (bucket_id = 'soal-images' and public.is_guru());

drop policy if exists "soal_images_delete_guru" on storage.objects;
create policy "soal_images_delete_guru" on storage.objects
  for delete using (bucket_id = 'soal-images' and public.is_guru());
