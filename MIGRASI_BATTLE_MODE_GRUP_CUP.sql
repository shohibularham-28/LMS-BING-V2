-- =========================================================
-- Fitur: Battle Kelas — Mode Baru "Grup Cup" (Turnamen Bracket)
--
-- Tim (minimal 4, idealnya kelipatan 4/2) diadu single-elimination.
-- Tiap babak = 3 soal. Sebelum tiap soal dirilis, KEDUA tim yang
-- sedang bertanding wajib pilih 1 perwakilan buat soal itu (jadi
-- total 3 perwakilan berbeda per tim per babak, boleh sama juga).
-- Cuma perwakilan yang terpilih yang boleh submit jawaban; siswa
-- lain & guru tetap bisa lihat soal + jawaban benarnya lewat siaran
-- yang sama seperti mode lain. Skor 3 soal diakumulasi per match,
-- tim skor lebih tinggi maju ke babak berikutnya (single elimination).
--
-- Jalankan sekali di Supabase Dashboard > SQL Editor, SETELAH
-- MIGRASI_BATTLE.sql dan MIGRASI_BATTLE_MODE_KELOMPOK.sql.
-- Aman dijalankan berkali-kali (idempotent).
-- =========================================================

-- 1) Tambah 'grup_cup' ke pilihan mode battle_sesi
do $$
begin
  alter table public.battle_sesi drop constraint if exists battle_sesi_mode_check;
  alter table public.battle_sesi
    add constraint battle_sesi_mode_check check (mode in ('leaderboard','kelompok','grup_cup'));
exception when others then null;
end $$;

-- Babak (ronde) yang sedang berjalan sekarang & total babak turnamen ini.
alter table public.battle_sesi add column if not exists babak_saat_ini integer not null default 1;
alter table public.battle_sesi add column if not exists total_babak integer not null default 1;

-- 2) BAGAN TURNAMEN — satu baris = satu match (tim A vs tim B) di satu babak/slot.
create table if not exists public.battle_cup_bracket (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.battle_sesi(id) on delete cascade,
  ronde integer not null,               -- 1 = babak pertama (paling banyak match), makin besar makin dekat final
  slot integer not null,                -- posisi match dalam ronde tsb (0-based), dipakai buat mapping ke ronde berikutnya
  tim_a_key text,
  tim_b_key text,
  skor_a integer not null default 0,
  skor_b integer not null default 0,
  pemenang_key text,
  status text not null default 'menunggu' check (status in ('menunggu','berjalan','selesai')),
  created_at timestamptz default now(),
  unique (sesi_id, ronde, slot)
);

create index if not exists idx_cup_bracket_sesi on public.battle_cup_bracket (sesi_id, ronde);

-- 3) PERWAKILAN — siapa yang mewakili tim untuk 1 soal tertentu dalam babak itu.
create table if not exists public.battle_cup_perwakilan (
  id uuid primary key default gen_random_uuid(),
  sesi_id uuid not null references public.battle_sesi(id) on delete cascade,
  match_id uuid not null references public.battle_cup_bracket(id) on delete cascade,
  tim_key text not null,
  soal_ke integer not null check (soal_ke in (0,1,2)), -- soal ke berapa dalam babak ini (0,1,2 = 3 soal per babak)
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nama text not null,
  created_at timestamptz default now(),
  unique (match_id, tim_key, soal_ke)
);

create index if not exists idx_cup_perwakilan_match on public.battle_cup_perwakilan (match_id, tim_key);

alter table public.battle_cup_bracket enable row level security;
alter table public.battle_cup_perwakilan enable row level security;

drop policy if exists "cup_bracket_select" on public.battle_cup_bracket;
drop policy if exists "cup_bracket_write_guru" on public.battle_cup_bracket;
create policy "cup_bracket_select" on public.battle_cup_bracket
  for select using (auth.uid() is not null);
create policy "cup_bracket_write_guru" on public.battle_cup_bracket
  for all using (public.is_guru()) with check (public.is_guru());

drop policy if exists "cup_perwakilan_select" on public.battle_cup_perwakilan;
drop policy if exists "cup_perwakilan_write_tim" on public.battle_cup_perwakilan;
create policy "cup_perwakilan_select" on public.battle_cup_perwakilan
  for select using (auth.uid() is not null);

-- Anggota tim (siapa saja di tim itu, dicek dari battle_peserta) boleh menunjuk
-- siapa pun anggota tim yang sama (termasuk dirinya sendiri) jadi perwakilan.
create policy "cup_perwakilan_write_tim" on public.battle_cup_perwakilan
  for all using (
    public.is_guru()
    or exists (
      select 1 from public.battle_peserta bp
      where bp.sesi_id = battle_cup_perwakilan.sesi_id
        and bp.profile_id = auth.uid()
        and bp.tim_key = battle_cup_perwakilan.tim_key
    )
  )
  with check (
    public.is_guru()
    or (
      exists (
        select 1 from public.battle_peserta bp
        where bp.sesi_id = battle_cup_perwakilan.sesi_id
          and bp.profile_id = auth.uid()
          and bp.tim_key = battle_cup_perwakilan.tim_key
      )
      and exists (
        select 1 from public.battle_peserta bp2
        where bp2.sesi_id = battle_cup_perwakilan.sesi_id
          and bp2.profile_id = battle_cup_perwakilan.profile_id
          and bp2.tim_key = battle_cup_perwakilan.tim_key
      )
    )
  );

-- 4) Kunci battle_jawaban di mode Grup Cup: cuma perwakilan tim yang lagi
--    "gilirannya" (match berjalan + sudah ditunjuk buat soal_ke ini) yang
--    boleh submit jawaban. Mode lain (leaderboard/kelompok) tidak berubah.
create or replace function public.battle_is_cup_rep_turn(p_sesi uuid, p_soal_index integer, p_profile uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tim text;
  v_match uuid;
  v_ronde integer;
  v_soal_ke integer;
begin
  v_ronde := (p_soal_index / 3) + 1;
  v_soal_ke := p_soal_index % 3;

  select tim_key into v_tim from public.battle_peserta
    where sesi_id = p_sesi and profile_id = p_profile;
  if v_tim is null then return false; end if;

  select id into v_match from public.battle_cup_bracket
    where sesi_id = p_sesi and ronde = v_ronde and status = 'berjalan'
      and (tim_a_key = v_tim or tim_b_key = v_tim)
    limit 1;
  if v_match is null then return false; end if;

  return exists (
    select 1 from public.battle_cup_perwakilan
    where match_id = v_match and tim_key = v_tim and soal_ke = v_soal_ke and profile_id = p_profile
  );
end;
$$;

drop policy if exists "battle_jawaban_insert_self" on public.battle_jawaban;
create policy "battle_jawaban_insert_self" on public.battle_jawaban
  for insert with check (
    profile_id = auth.uid()
    and (
      not exists (select 1 from public.battle_sesi s where s.id = battle_jawaban.sesi_id and s.mode = 'grup_cup')
      or public.battle_is_cup_rep_turn(battle_jawaban.sesi_id, battle_jawaban.soal_index, auth.uid())
    )
  );

-- 5) Realtime supaya bagan & status perwakilan update live tanpa polling.
do $$
begin
  begin
    alter publication supabase_realtime add table public.battle_cup_bracket;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.battle_cup_perwakilan;
  exception when others then null;
  end;
end $$;
