// Supabase Edge Function: delete-student
// Menghapus akun siswa secara permanen — termasuk akun login-nya di auth.users
// (bukan cuma baris di tabel profiles), supaya siswa yang dihapus benar-benar
// tidak bisa login lagi. Hanya bisa dipanggil oleh user yang sudah login DAN
// profilnya role = 'guru'. Pakai SERVICE ROLE KEY di sini (aman, jalan di server).
//
// Deploy: supabase functions deploy delete-student
// Body request (JSON):
// { "siswa_id": "uuid-siswa" }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Admin client (service role) — dipakai untuk cek role & menghapus user
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !profile || profile.role !== "guru") {
      return json({ error: "Hanya guru yang boleh menghapus akun siswa." }, 403, corsHeaders);
    }

    const body = await req.json();
    const siswaId: string = (body.siswa_id || "").trim();

    if (!siswaId) {
      return json({ error: "siswa_id wajib diisi." }, 400, corsHeaders);
    }

    // Jangan biarkan guru menghapus dirinya sendiri lewat menu ini,
    // dan pastikan target memang siswa (bukan sembarang user/guru lain).
    const { data: target, error: targetErr } = await adminClient
      .from("profiles")
      .select("id, role, username")
      .eq("id", siswaId)
      .single();

    if (targetErr || !target) {
      return json({ error: "Siswa tidak ditemukan." }, 404, corsHeaders);
    }
    if (target.role !== "siswa") {
      return json({ error: "Hanya akun siswa yang boleh dihapus lewat menu ini." }, 403, corsHeaders);
    }

    // Hapus dari auth.users — baris di public.profiles ikut terhapus otomatis
    // karena foreign key profiles.id -> auth.users.id memakai "on delete cascade".
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(siswaId);
    if (deleteErr) {
      return json({ error: "Gagal menghapus akun: " + deleteErr.message }, 500, corsHeaders);
    }

    return json({ ok: true, username: target.username }, 200, corsHeaders);
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
