// ===================== AUTH & SHELL BERSAMA (versi Supabase) =====================
// File ini butuh assets/supabaseClient.js sudah dimuat lebih dulu.

function getLevel(kelasNama) {
  const n = (kelasNama || "").trim().toUpperCase();
  if (n.startsWith("XII")) return "XII";
  if (n.startsWith("XI")) return "XI";
  return "X";
}

// Ambil profil user yang sedang login (join ke tabel kelas).
// Return null kalau belum login.
async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, nama, role, kelas_id, kelas:kelas_id ( id, nama, level )")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return data;
}

// Panggil di halaman siswa. Redirect ke index.html kalau belum login / bukan siswa.
async function requireLogin() {
  const profile = await getProfile();
  if (!profile) {
    window.location.href = "index.html";
    return null;
  }
  if (profile.role === "guru") {
    window.location.href = "guru.html";
    return null;
  }
  return profile;
}

// Panggil di guru.html. Redirect kalau belum login / bukan guru.
async function requireTeacherLogin() {
  const profile = await getProfile();
  if (!profile || profile.role !== "guru") {
    window.location.href = "index.html";
    return null;
  }
  return profile;
}

async function doLogout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// Render sidebar/topbar siswa. activePage: 'pengumuman' | 'materi' | 'worksheet'
function renderShell(profile, activePage) {
  const kelasNama = profile.kelas ? profile.kelas.nama : "—";
  const level = profile.kelas ? profile.kelas.level : getLevel(kelasNama);

  document.getElementById("topName").textContent = profile.nama;
  document.getElementById("sideName").textContent = profile.nama;
  document.getElementById("userAvatar").textContent = profile.nama.charAt(0).toUpperCase();
  document.getElementById("sideClass").textContent = "Kelas " + kelasNama;
  document.getElementById("topLevel").textContent = level;
  document.getElementById("topKelasName").textContent = kelasNama;
  document.getElementById("topDate").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.page === activePage);
  });

  return level;
}

function emptyState(title, desc, icon) {
  return `
    <div class="empty-state">
      <div class="icon">${icon || "🗂️"}</div>
      <div class="title">${title}</div>
      <div class="desc">${desc}</div>
    </div>
  `;
}

// Escape teks user sebelum ditaruh di innerHTML, cegah XSS dari input guru/siswa.
function esc(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Escape teks lalu ubah URL (http://, https://, atau www.) jadi link <a> yang bisa diklik.
// Tetap aman dari XSS karena escaping dilakukan lebih dulu, baru <a> ditambahkan di atas hasil escape.
function linkify(str) {
  const escaped = esc(str);
  const urlPattern = /(\bhttps?:\/\/[^\s<]+|\bwww\.[^\s<]+)/gi;
  return escaped.replace(urlPattern, (match) => {
    // Pisahkan tanda baca penutup (. , ) ] > dll) di ujung URL biar tidak ikut ke dalam link
    const trailingPunct = /[.,!?:;)\]"'’”]+$/;
    let cleanUrl = match;
    let trail = "";
    const m = match.match(trailingPunct);
    if (m) {
      trail = m[0];
      cleanUrl = match.slice(0, match.length - trail.length);
    }
    const href = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : "https://" + cleanUrl;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trail}`;
  });
}
