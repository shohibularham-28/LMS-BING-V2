// Supabase Edge Function: create-students
// Membuat banyak akun siswa sekaligus. Hanya bisa dipanggil oleh user yang
// sudah login DAN profilnya role = 'guru'. Pakai SERVICE ROLE KEY di sini
// (aman, karena ini jalan di server, bukan di browser).
//
// Deploy: supabase functions deploy create-students
// Body request (JSON):
// {
//   "siswa": [
//     { "nama": "Budi Santoso", "username": "budi123", "password": "rahasia1", "kelas": "X I" },
//     ...
//   ]
// }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_DOMAIN = "lms.local"; // domain palsu untuk login berbasis username

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Tidak ada token autentikasi." }, 401, corsHeaders);
    }
    const jwt = authHeader.replace("Bearer ", "");

    // Client biasa (anon key + JWT pemanggil) — dipakai untuk verifikasi siapa yang memanggil
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ error: "Token tidak valid." }, 401, corsHeaders);
    }

    // Admin client (service role) — dipakai untuk cek role & membuat user baru
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !profile || profile.role !== "guru") {
      return json({ error: "Hanya guru yang boleh membuat akun siswa." }, 403, corsHeaders);
    }

    const body = await req.json();
    const siswaList: { nama: string; username: string; password: string; kelas: string }[] = body.siswa || [];

    if (!Array.isArray(siswaList) || siswaList.length === 0) {
      return json({ error: "Daftar siswa kosong." }, 400, corsHeaders);
    }

    // Ambil daftar kelas sekali saja untuk mapping nama -> id
    const { data: kelasRows } = await adminClient.from("kelas").select("id, nama");
    const kelasMap = new Map((kelasRows || []).map((k) => [k.nama.trim().toLowerCase(), k.id]));

    const results: { username: string; status: "ok" | "gagal"; pesan?: string }[] = [];

    for (const s of siswaList) {
      const nama = (s.nama || "").trim();
      const username = (s.username || "").trim().toLowerCase();
      const password = s.password || "";
      const kelasNama = (s.kelas || "").trim();

      if (!nama || !username || !password || !kelasNama) {
        results.push({ username: username || "(kosong)", status: "gagal", pesan: "Data tidak lengkap." });
        continue;
      }
      const kelasId = kelasMap.get(kelasNama.toLowerCase());
      if (!kelasId) {
        results.push({ username, status: "gagal", pesan: `Kelas "${kelasNama}" tidak ditemukan.` });
        continue;
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: `${username}@${EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
      });

      if (createErr || !created?.user) {
        results.push({ username, status: "gagal", pesan: createErr?.message || "Gagal membuat akun." });
        continue;
      }

      const { error: insertErr } = await adminClient.from("profiles").insert({
        id: created.user.id,
        username,
        nama,
        role: "siswa",
        kelas_id: kelasId,
        password_plain: password,
      });

      if (insertErr) {
        results.push({ username, status: "gagal", pesan: "Akun dibuat tapi profil gagal disimpan: " + insertErr.message });
        continue;
      }

      results.push({ username, status: "ok" });
    }

    return json({ results }, 200, corsHeaders);
  } catch (e) {
    return json({ error: String(e) }, 500, corsHeaders);
  }
});

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
