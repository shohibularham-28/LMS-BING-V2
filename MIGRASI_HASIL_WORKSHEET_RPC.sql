-- =========================================================
-- Perbaikan pengiriman hasil worksheet (interactive-media & sejenisnya)
--  1. Tambah kolom siswa_id & jawaban di hasil_worksheet (kalau belum ada)
--  2. Hapus SEMUA versi lama fungsi simpan_hasil_worksheet (overload ganda
--     memicu error PGRST203 "Could not choose the best candidate function")
--  3. Buat ulang SATU fungsi saja, upsert berdasarkan p_id
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

alter table public.hasil_worksheet add column if not exists siswa_id uuid;
alter table public.hasil_worksheet add column if not exists jawaban jsonb;

-- Kalau kolom jawaban sebelumnya sudah ada dengan tipe text, ubah ke jsonb
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema='public' and table_name='hasil_worksheet' and column_name='jawaban') = 'text' then
    alter table public.hasil_worksheet
      alter column jawaban type jsonb
      using case when jawaban is null or jawaban = '' then null
                 when left(ltrim(jawaban),1) in ('[','{') then jawaban::jsonb
                 else to_jsonb(jawaban) end;
  end if;
end $$;

-- Hapus semua overload lama, apa pun signature-nya
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'simpan_hasil_worksheet'
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end $$;

create function public.simpan_hasil_worksheet(
  p_id uuid,
  p_slug text,
  p_jenis text,
  p_nama text,
  p_anggota text,
  p_kelas text,
  p_nilai numeric,
  p_nilai_maks numeric,
  p_status text,
  p_jawaban jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hasil_worksheet
    (id, worksheet_slug, jenis, nama, anggota, kelas, nilai, nilai_maks, status, siswa_id, jawaban)
  values
    (p_id, p_slug, p_jenis, p_nama, p_anggota, p_kelas, p_nilai, p_nilai_maks, p_status, auth.uid(), p_jawaban)
  on conflict (id) do update set
    nilai = excluded.nilai,
    nilai_maks = excluded.nilai_maks,
    status = excluded.status,
    anggota = excluded.anggota,
    jawaban = excluded.jawaban,
    updated_at = now()
  where public.hasil_worksheet.worksheet_slug = excluded.worksheet_slug;
end;
$$;

grant execute on function public.simpan_hasil_worksheet(uuid,text,text,text,text,text,numeric,numeric,text,jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
