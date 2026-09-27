-- =========================================================
-- Fitur Personalisasi Siswa 🎨
--
--   - Siswa punya menu baru "Personalisasi" (personalisasi.html) untuk
--     memilih tema warna aksen (violet/biru/hijau/pink/oranye/coklat) dan
--     model ikon menu utama (outline/filled/soft/emoji).
--   - Preferensi disimpan di kolom profiles.pref_theme_color &
--     profiles.pref_icon_style supaya ikut siswa walau ganti perangkat
--     (dibaca oleh app.js lewat getProfile(), diterapkan lewat
--     syncPersonalization()).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan
-- berkali-kali (idempotent).
-- =========================================================

alter table public.profiles
  add column if not exists pref_theme_color text not null default 'violet',
  add column if not exists pref_icon_style text not null default 'outline';

alter table public.profiles
  drop constraint if exists profiles_pref_theme_color_check;
alter table public.profiles
  add constraint profiles_pref_theme_color_check
  check (pref_theme_color in ('violet','biru','hijau','pink','oranye','coklat'));

alter table public.profiles
  drop constraint if exists profiles_pref_icon_style_check;
alter table public.profiles
  add constraint profiles_pref_icon_style_check
  check (pref_icon_style in ('outline','filled','soft','emoji'));

-- Tidak perlu policy RLS baru: tabel profiles sudah punya policy
-- "profiles_update" (for update using (id = auth.uid() or public.is_guru()))
-- yang mengizinkan siswa mengubah kolom apapun di baris miliknya sendiri,
-- termasuk dua kolom baru ini.
