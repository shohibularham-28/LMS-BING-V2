// Supabase Edge Function: reset-password
// Mengubah password satu akun siswa. Hanya bisa dipanggil oleh user yang
// sudah login DAN profilnya role = 'guru'. Pakai SERVICE ROLE KEY di sini
// (aman, karena ini jalan di server, bukan di browser).
//
// Alasan ini perlu jadi Edge Function terpisah: Supabase Auth menyimpan
// password dalam bentuk hash, jadi password LAMA siswa tidak pernah bisa
// dibaca ulang oleh siapa pun (termasuk guru/admin) — satu-satunya cara
// membantu siswa yang lupa password adalah menggantinya dengan yang baru.
//
// Deploy: supabase functions deploy reset-password
// Body request (JSON):
// { "siswa_id": "uuid-siswa", "password": "passwordBaru123" }

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

    // Admin client (service role) — dipakai untuk cek role & mengubah password
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !profile || profile.role !== "guru") {
      return json({ error: "Hanya guru yang boleh mengubah password siswa." }, 403, corsHeaders);
    }

    const body = await req.json();
    const siswaId: string = (body.siswa_id || "").trim();
    const password: string = body.password || "";

    if (!siswaId || !password) {
      return json({ error: "siswa_id dan password wajib diisi." }, 400, corsHeaders);
    }
    if (password.length < 6) {
      return json({ error: "Password minimal 6 karakter." }, 400, corsHeaders);
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
      return json({ error: "Hanya password akun siswa yang boleh direset lewat menu ini." }, 403, corsHeaders);
    }

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(siswaId, { password });
    if (updateErr) {
      return json({ error: "Gagal mengubah password: " + updateErr.message }, 500, corsHeaders);
    }

    // Simpan salinan plain text-nya juga supaya guru bisa "Lihat Password" tanpa reset ulang.
    await adminClient.from("profiles").update({ password_plain: password }).eq("id", siswaId);

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
