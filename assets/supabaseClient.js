// ISI DENGAN URL & ANON KEY PROJECT SUPABASE KAMU
// (Dashboard Supabase > Project Settings > API)
const SUPABASE_URL = "https://sviftypadyorgalehzxh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nJt3-cCaD-ejip456YgBbQ_KTZ2FjRC";

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Domain palsu dipakai supaya siswa bisa login pakai "username" biasa
// (Supabase Auth secara teknis tetap butuh format email).
const EMAIL_DOMAIN = "lms.local";
function usernameToEmail(username) {
  return `${(username || "").trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}
