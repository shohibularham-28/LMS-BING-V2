-- Anti-duplikat pengiriman hasil ujian. Jalankan sekali di Supabase SQL Editor.
-- Kunci unik per pengiriman supaya kirim-ulang otomatis tidak membuat nilai ganda.
alter table public.hasil_ujian_lms add column if not exists submit_key text;
create unique index if not exists hasil_ujian_lms_submit_key_uidx
  on public.hasil_ujian_lms (submit_key);
