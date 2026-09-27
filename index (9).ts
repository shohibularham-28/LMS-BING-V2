// Supabase Edge Function: update-student
// Mengubah nama & username satu akun siswa. Hanya bisa dipanggil oleh user
// yang sudah login DAN profilnya role = 'guru'. Pakai SERVICE ROLE KEY di sini
// (aman, karena ini jalan di server, bukan di browser).
//
// Alasan ini perlu jadi Edge Function terpisah (bukan langsung update tabel
// profiles dari browser): username dipakai sebagai "email palsu" untuk login
// (lihat assets/app.js / create-students), jadi begitu username diganti,
// email di auth.users milik siswa itu WAJIB ikut diganti juga lewat Admin API
// supaya siswa masih bisa login pakai username barunya. Kalau cuma update
// tabel profiles tanpa ini, siswa akan langsung tidak bisa login lagi.
//
// Deploy: supabase functions deploy update-student
// Body request (JSON):
// { "siswa_id": "uuid-siswa", "nama": "Nama Baru", "username": "usernameBaru" }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_DOMAIN = "lms.local"; // domain palsu untuk login berbasis username (samakan dengan create-students)

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

    // Admin client (service role) — dipakai untuk cek role & mengubah data siswa
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !profile || profile.role !== "guru") {
      return json({ error: "Hanya guru yang boleh mengubah data siswa." }, 403, corsHeaders);
    }

    const body = await req.json();
    const siswaId: string = (body.siswa_id || "").trim();
    const nama: string = (body.nama || "").trim();
    const username: string = (body.username || "").trim().toLowerCase();

    if (!siswaId || !nama || !username) {
      return json({ error: "siswa_id, nama, dan username wajib diisi." }, 400, corsHeaders);
    }
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return json({ error: "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip (tanpa spasi)." }, 400, corsHeaders);
    }

    // Pastikan target memang siswa (bukan sembarang user/guru lain)
    const { data: target, error: targetErr } = await adminClient
      .from("profiles")
      .select("id, role, username")
      .eq("id", siswaId)
      .single();

    if (targetErr || !target) {
      return json({ error: "Siswa tidak ditemukan." }, 404, corsHeaders);
    }
    if (target.role !== "siswa") {
      return json({ error: "Hanya data akun siswa yang boleh diubah lewat menu ini." }, 403, corsHeaders);
    }

    const usernameBerubah = username !== target.username;

    // Kalau username diganti, pastikan tidak bentrok dengan siswa/akun lain
    if (usernameBerubah) {
      const { data: dupe } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", siswaId)
        .maybeSingle();
      if (dupe) {
        return json({ error: `Username "${username}" sudah dipakai akun lain.` }, 400, corsHeaders);
      }

      // Ganti email di auth.users supaya login pakai username baru tetap jalan
      const { error: authErr } = await adminClient.auth.admin.updateUserById(siswaId, {
        email: `${username}@${EMAIL_DOMAIN}`,
        email_confirm: true,
      });
      if (authErr) {
        return json({ error: "Gagal mengubah username (akun login): " + authErr.message }, 500, corsHeaders);
      }
    }

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ nama, username })
      .eq("id", siswaId);

    if (updateErr) {
      return json({ error: "Gagal menyimpan perubahan data: " + updateErr.message }, 500, corsHeaders);
    }

    return json({ ok: true, nama, username }, 200, corsHeaders);
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
