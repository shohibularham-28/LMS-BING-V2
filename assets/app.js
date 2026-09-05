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
    .select("id, username, nama, role, kelas_id, status, last_seen_updates, kelas:kelas_id ( id, nama, level )")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return data;
}

// Panggil di halaman siswa. Redirect ke index.html kalau belum login / bukan siswa /
// akunnya masih menunggu persetujuan guru.
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
  if (profile.status === "pending") {
    await supabase.auth.signOut();
    window.location.href = "index.html";
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

// ===================== SIDEBAR: COLLAPSE (desktop) & DRAWER (mobile) =====================
// Satu tombol (#navToggle) dipakai untuk dua perilaku berbeda tergantung lebar layar:
// - Desktop (>900px): collapse/expand sidebar jadi mode ikon saja, preferensinya disimpan
//   di localStorage supaya tetap sama tiap buka halaman baru.
// - Mobile/tablet (<=900px): sidebar jadi drawer yang slide-in dari kiri, dengan backdrop
//   yang bisa diklik untuk menutup.
const NAV_COLLAPSE_KEY = "lms_nav_collapsed";
const NAV_BREAKPOINT = 900;

function applyNavState() {
  const shell = document.querySelector(".shell");
  if (!shell) return;
  if (window.innerWidth <= NAV_BREAKPOINT) {
    shell.classList.remove("nav-collapsed");
  } else {
    shell.classList.remove("nav-mobile-open");
    const collapsed = localStorage.getItem(NAV_COLLAPSE_KEY) === "1";
    shell.classList.toggle("nav-collapsed", collapsed);
  }
}

function initSidebarToggle() {
  const shell = document.querySelector(".shell");
  const toggleBtn = document.getElementById("navToggle");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!shell || !toggleBtn) return;

  applyNavState();

  toggleBtn.addEventListener("click", () => {
    if (window.innerWidth <= NAV_BREAKPOINT) {
      shell.classList.toggle("nav-mobile-open");
    } else {
      const collapsed = shell.classList.toggle("nav-collapsed");
      localStorage.setItem(NAV_COLLAPSE_KEY, collapsed ? "1" : "0");
    }
  });

  if (backdrop) {
    backdrop.addEventListener("click", () => shell.classList.remove("nav-mobile-open"));
  }

  // Menutup drawer otomatis begitu salah satu menu diklik di layar kecil.
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= NAV_BREAKPOINT) shell.classList.remove("nav-mobile-open");
    });
  });

  window.addEventListener("resize", applyNavState);
}

// ===================== TOGGLE LIHAT/SEMBUNYIKAN PASSWORD =====================
// Dipakai bareng oleh semua field password yang dibungkus <div class="pw-wrap">
// berisi <input> dan <button class="pw-toggle">.
const EYE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function initPasswordToggles(root) {
  const scope = root || document;
  scope.querySelectorAll(".pw-toggle").forEach((btn) => {
    if (btn.dataset.pwBound) return;
    btn.dataset.pwBound = "1";
    btn.innerHTML = EYE_ICON;
    btn.setAttribute("aria-label", "Tampilkan password");
    btn.addEventListener("click", () => {
      const wrap = btn.closest(".pw-wrap");
      const input = wrap ? wrap.querySelector("input") : null;
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
      btn.setAttribute("aria-label", showing ? "Tampilkan password" : "Sembunyikan password");
    });
  });
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

// ===================== NOTIFIKASI (bell di topbar) =====================
// Dipakai bareng oleh halaman siswa & guru.html. Butuh markup:
// <button id="notifBell"><span id="notifDot"></span></button>
// <div id="notifDropdown"><div id="notifList"></div></div>

// Pasang toggle buka/tutup dropdown notifikasi. Panggil sekali per halaman.
function initNotifDropdown() {
  const bell = document.getElementById('notifBell');
  const dropdown = document.getElementById('notifDropdown');
  if (!bell || !dropdown) return;
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (dropdown.classList.contains('open') && !dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove('open');
    }
  });
}

function setNotifDot(count) {
  const dot = document.getElementById('notifDot');
  if (!dot) return;
  if (count > 0) {
    dot.textContent = count > 9 ? '9+' : String(count);
    dot.style.display = '';
  } else {
    dot.style.display = 'none';
  }
}

// Untuk siswa: hitung & tampilkan pengumuman + nilai baru sejak terakhir dia
// buka halaman Pengumuman & Nilai (profile.last_seen_updates).
async function loadStudentNotifications(profile) {
  const list = document.getElementById('notifList');
  if (!list) return;
  const since = profile.last_seen_updates || '1970-01-01T00:00:00Z';

  const [annRes, nilaiRes] = await Promise.all([
    supabase.from('pengumuman').select('id, judul, created_at')
      .or(`kelas_id.eq.${profile.kelas_id},kelas_id.is.null`)
      .gt('created_at', since)
      .order('created_at', { ascending: false }),
    supabase.from('nilai').select('id, jenis, skor, created_at')
      .eq('siswa_id', profile.id)
      .gt('created_at', since)
      .order('created_at', { ascending: false }),
  ]);

  const items = [
    ...((annRes.data) || []).map(a => ({ icon: '📣', title: a.judul, desc: 'Pengumuman baru', created_at: a.created_at })),
    ...((nilaiRes.data) || []).map(n => ({ icon: '📊', title: n.jenis, desc: 'Nilai baru' + (typeof n.skor === 'number' ? ': ' + n.skor : ''), created_at: n.created_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  setNotifDot(items.length);

  list.innerHTML = items.length ? items.map(it => `
    <a class="notif-item" href="pengumuman.html">
      <div class="t">${it.icon} ${esc(it.title)}</div>
      <div class="d">${esc(it.desc)} · ${new Date(it.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</div>
    </a>
  `).join('') : '<div class="notif-empty">Tidak ada notifikasi baru</div>';
}

// Tandai pengumuman & nilai sudah dilihat. Panggil di pengumuman.html setelah
// datanya selesai dimuat, supaya lonceng notifikasi bersih lagi.
async function markUpdatesSeen(profile) {
  const now = new Date().toISOString();
  await supabase.from('profiles').update({ last_seen_updates: now }).eq('id', profile.id);
  profile.last_seen_updates = now;
  setNotifDot(0);
  const list = document.getElementById('notifList');
  if (list) list.innerHTML = '<div class="notif-empty">Tidak ada notifikasi baru</div>';
}
