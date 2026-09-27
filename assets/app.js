// ===================== AUTH & SHELL BERSAMA (versi Supabase) =====================
// File ini butuh assets/supabaseClient.js sudah dimuat lebih dulu.

// ===================== TEMA: DARK / BRIGHT =====================
// Preferensi disimpan di localStorage supaya konsisten di semua halaman
// (menu siswa, menu guru, materi, worksheet, dst) karena app.js dimuat
// bersama di setiap halaman. Tombol toggle disisipkan otomatis ke topbar
// kalau halaman itu punya elemen .topbar-right.
const THEME_KEY = "lms_theme";
const ICON_MOON = '<svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>';
const ICON_SUN = '<svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; }
  catch (e) { return "light"; }
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-label", t === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap");
    btn.title = t === "dark" ? "Tema terang" : "Tema gelap";
  });
}

// Sisipkan tombol toggle tema ke topbar halaman ini (kalau belum ada) & pasang listener.
function initThemeToggle() {
  applyTheme(getStoredTheme());
  const right = document.querySelector(".topbar-right");
  if (!right || document.querySelector(".theme-toggle-btn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-toggle-btn";
  btn.innerHTML = ICON_MOON + ICON_SUN;
  applyTheme(getStoredTheme());
  right.insertBefore(btn, right.firstChild);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

// Terapkan tema tersimpan sesegera mungkin (app.js dimuat sebelum konten topbar
// dirender oleh script masing-masing halaman, jadi ini mencegah kedipan tema salah).
applyTheme(getStoredTheme());
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeToggle);
} else {
  initThemeToggle();
}

// ===================== PERSONALISASI: TEMA WARNA & MODEL IKON (siswa) =====================
// Preferensi utamanya disimpan di Supabase (profiles.pref_theme_color /
// profiles.pref_icon_style) supaya ikut siswa walau ganti perangkat, tapi
// juga di-cache ke localStorage supaya bisa langsung diterapkan begini profil
// belum selesai dimuat (mencegah kedip balik ke tema default). syncPersonalization()
// dipanggil dari renderShell() dan jadi sumber kebenaran akhir begitu profil siap.
const ACCENT_KEY = "lms_accent";
const ICONSTYLE_KEY = "lms_icon_style";
const VALID_ACCENTS = ["violet", "biru", "hijau", "pink", "oranye", "coklat"];
const VALID_ICON_STYLES = ["outline", "filled", "soft", "emoji"];

// Kumpulan ikon per menu app-drawer siswa, satu set per model ikon.
// "soft" tidak didaftar di sini -- dibuat otomatis dari versi "outline"
// (lihat softenOutlineIcon) supaya bentuknya tetap konsisten satu sama lain.
const ICON_SETS = {
  pengumuman: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="3,9 3,15 6,15 7,20 9,20 8,15 20,19 20,5"/></svg>',
    emoji: '📣',
  },
  materi: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,3 19,21 12,17 5,21"/></svg>',
    emoji: '📚',
  },
  worksheet: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,2 15,2 19,6 19,22 6,22"/><polygon points="15,2 15,6 19,6" opacity="0.55"/></svg>',
    emoji: '📝',
  },
  ujian: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M12 2v6M6 8h12l1.5 12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2L6 8Z"/><path d="M9 14h6M9 18h4"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 18,3 18,21 6,21"/><polygon points="9,1 15,1 15,4 9,4"/></svg>',
    emoji: '📋',
  },
  battle: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/></svg>',
    emoji: '⚔️',
  },
  game: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="13" r="1"/><circle cx="18" cy="11" r="1"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="4,8 18,8 20,10 20,16 18,18 4,18 2,16 2,10"/><circle cx="8" cy="13" r="1.6" fill="#fff" fill-opacity="0.85"/><circle cx="16" cy="13" r="1.6" fill="#fff" fill-opacity="0.85"/></svg>',
    emoji: '🎮',
  },
  obrolan: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="4,4 20,4 20,15 10,15 6,19 6,15 4,15"/></svg>',
    emoji: '💬',
  },
  bintang: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
    emoji: '⭐',
  },
  pengaturan: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 14,5 17,4 17,7 20,8 19,11 22,12 19,13 20,16 17,17 17,20 14,19 12,22 10,19 7,20 7,17 4,16 5,13 2,12 5,11 4,8 7,7 7,4 10,5"/></svg>',
    emoji: '⚙️',
  },
  personalisasi: {
    outline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg>',
    filled: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3" fill="#fff" fill-opacity="0.85"/><circle cx="12" cy="8" r="1.3" fill="#fff" fill-opacity="0.85"/><circle cx="16" cy="10" r="1.3" fill="#fff" fill-opacity="0.85"/><circle cx="9" cy="15" r="1.3" fill="#fff" fill-opacity="0.85"/></svg>',
    emoji: '🎨',
  },
};

function getStoredAccent() {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return VALID_ACCENTS.includes(v) ? v : "violet";
  } catch (e) { return "violet"; }
}

function getStoredIconStyle() {
  try {
    const v = localStorage.getItem(ICONSTYLE_KEY);
    return VALID_ICON_STYLES.includes(v) ? v : "outline";
  } catch (e) { return "outline"; }
}

// Terapkan tema warna aksen (violet/biru/hijau/pink/oranye/coklat) ke seluruh
// halaman lewat atribut data-accent di <html> (dibaca oleh var(--violet) dkk di style.css).
function applyAccent(accent) {
  const a = VALID_ACCENTS.includes(accent) ? accent : "violet";
  if (a === "violet") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", a);
  }
  try { localStorage.setItem(ACCENT_KEY, a); } catch (e) {}
}

// Bikin versi ikon outline jadi lebih "soft" (garis lebih tebal & bulat, tanpa
// perlu gambar ulang tiap ikon) -- dipasangkan dengan wadah bulat (border-radius:50%)
// lewat atribut data-icon-style="soft" di CSS.
function softenOutlineIcon(svgMarkup) {
  return svgMarkup.replace(/stroke-width="1\.8"/g, 'stroke-width="2.6"');
}

// Ganti tampilan ikon menu (app-drawer) siswa sesuai model yang dipilih:
// outline (garis, default) / filled (solid) / soft (garis tebal + wadah bulat) / emoji.
function renderDrawerIcons(style) {
  document.querySelectorAll(".ad-tile[data-icon-key]").forEach((tile) => {
    const set = ICON_SETS[tile.dataset.iconKey];
    const iconEl = tile.querySelector(".ad-icon");
    if (!set || !iconEl) return;
    if (style === "emoji") {
      iconEl.innerHTML = `<span class="ad-icon-emoji">${set.emoji}</span>`;
    } else if (style === "soft") {
      iconEl.innerHTML = softenOutlineIcon(set.outline);
    } else if (style === "filled") {
      iconEl.innerHTML = set.filled;
    } else {
      iconEl.innerHTML = set.outline;
    }
  });
}

// Terapkan model ikon: set atribut (buat CSS wadah bulat/persegi) + render ulang ikonnya.
function applyIconStyle(style) {
  const s = VALID_ICON_STYLES.includes(style) ? style : "outline";
  document.documentElement.setAttribute("data-icon-style", s);
  try { localStorage.setItem(ICONSTYLE_KEY, s); } catch (e) {}
  renderDrawerIcons(s);
}

// Sinkronkan personalisasi dari profil Supabase (sumber kebenaran, ikut akun
// lintas perangkat) -- dipanggil dari renderShell() di tiap halaman siswa.
function syncPersonalization(profile) {
  applyAccent(profile.pref_theme_color || "violet");
  applyIconStyle(profile.pref_icon_style || "outline");
}

// Terapkan cache localStorage duluan (secepat mungkin) supaya tidak kedip
// balik ke default violet/outline selagi profil masih dimuat dari server.
applyAccent(getStoredAccent());
applyIconStyle(getStoredIconStyle());

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
  const kolomDasar = "id, username, nama, role, kelas_id, status, last_seen_updates, last_seen_obrolan, kelas:kelas_id ( id, nama, level )";
  let { data, error } = await supabase
    .from("profiles")
    .select(kolomDasar + ", pref_theme_color, pref_icon_style")
    .eq("id", user.id)
    .single();
  if (error) {
    // Kompatibel dengan project yang belum menjalankan MIGRASI_PERSONALISASI.sql
    // (kolom pref_theme_color / pref_icon_style belum ada) -- supaya login tidak
    // ikut gagal gara-gara itu. Personalisasi cukup kembali ke default (violet/outline).
    const fallback = await supabase.from("profiles").select(kolomDasar).eq("id", user.id).single();
    data = fallback.data;
    error = fallback.error;
  }
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
// Elemen sidebar/topbar dicek dulu (pakai ?.) karena halaman standalone seperti
// battle.html sengaja tidak punya sidebar/topbar aplikasi utama -- renderShell
// tetap dipanggil di sana supaya badge obrolan & data profil lain tetap jalan.
function renderShell(profile, activePage) {
  const kelasNama = profile.kelas ? profile.kelas.nama : "—";
  const level = profile.kelas ? profile.kelas.level : getLevel(kelasNama);

  const topName = document.getElementById("topName");
  const sideName = document.getElementById("sideName");
  const userAvatar = document.getElementById("userAvatar");
  const sideClass = document.getElementById("sideClass");
  const topLevel = document.getElementById("topLevel");
  const topKelasName = document.getElementById("topKelasName");
  const topDate = document.getElementById("topDate");

  if (topName) topName.textContent = profile.nama;
  if (sideName) sideName.textContent = profile.nama;
  if (userAvatar) userAvatar.textContent = profile.nama.charAt(0).toUpperCase();
  if (sideClass) sideClass.textContent = "Kelas " + kelasNama;
  if (topLevel) topLevel.textContent = level;
  if (topKelasName) topKelasName.textContent = kelasNama;
  if (topDate) topDate.textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  document.querySelectorAll(".nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.page === activePage);
  });

  syncPersonalization(profile);

  // Badge "pesan belum dibaca" di menu Obrolan Kelas — jalan di semua
  // halaman siswa (bukan cuma obrolan.html) karena renderShell dipanggil
  // di tiap halaman. Fire-and-forget, tidak menunda render halaman.
  loadChatBadge(profile);
  subscribeChatBadgeRealtime(profile);

  return level;
}

// ===================== BADGE OBROLAN KELAS (siswa) =====================
// Menampilkan titik/angka notifikasi di menu "Obrolan Kelas" (sidebar +
// bottom nav mobile) kalau ada pesan baru dari orang lain di kelasnya
// sejak terakhir dia buka halaman obrolan (profiles.last_seen_obrolan).

let _chatBadgeChannel = null;

function setNavChatBadge(count) {
  const targets = [
    { el: document.querySelector('.sidebar .nav-item[data-page="obrolan"]'), top: '6px', right: '10px' },
    { el: document.querySelector('.mobile-bottom-nav a[data-page="obrolan"]'), top: '0px', right: '16px' },
  ];
  targets.forEach(({ el, top, right }) => {
    if (!el) return;
    let badge = el.querySelector('.nav-chat-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-chat-badge';
        badge.style.cssText = `position:absolute; top:${top}; right:${right}; min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:#ff6b5e; color:#fff; font-size:10px; font-weight:700; line-height:16px; text-align:center; box-shadow:0 0 0 2px #fff;`;
        if (!el.style.position) el.style.position = 'relative';
        el.appendChild(badge);
      }
      badge.textContent = count > 9 ? '9+' : String(count);
    } else if (badge) {
      badge.remove();
    }
  });
}

// Hitung ulang jumlah pesan belum dibaca dari server & update badge.
async function loadChatBadge(profile) {
  if (!profile || !profile.kelas_id) return;
  const since = profile.last_seen_obrolan || '1970-01-01T00:00:00Z';
  const { count, error } = await supabase
    .from('pesan_kelas')
    .select('id', { count: 'exact', head: true })
    .eq('kelas_id', profile.kelas_id)
    .neq('sender_id', profile.id)
    .gt('created_at', since);
  if (error) return;
  setNavChatBadge(count || 0);
}

// Dengarkan pesan baru masuk lewat Supabase Realtime supaya badge muncul
// instan (tanpa nunggu polling halaman lain). Aman kalau Realtime tidak
// aktif di project — badge tetap ke-update saat pindah halaman biasa.
function subscribeChatBadgeRealtime(profile) {
  if (!profile || !profile.kelas_id || !window.supabase) return;
  if (_chatBadgeChannel) return; // sudah ada listener aktif di halaman ini
  _chatBadgeChannel = supabase
    .channel('chat-badge-' + profile.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'pesan_kelas',
      filter: `kelas_id=eq.${profile.kelas_id}`,
    }, (payload) => {
      if (payload.new && payload.new.sender_id === profile.id) return;
      loadChatBadge(profile);
    })
    .subscribe();
}

// Tandai obrolan sudah dibaca (dipanggil dari obrolan.html). Membersihkan
// badge di semua halaman begitu user selesai buka & scroll ke bawah.
async function markObrolanSeen(profile) {
  const now = new Date().toISOString();
  await supabase.from('profiles').update({ last_seen_obrolan: now }).eq('id', profile.id);
  profile.last_seen_obrolan = now;
  setNavChatBadge(0);
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

// ===================== GAME: util Menjodohkan (ronde) =====================
// Normalisasi kolom bank_game.data (jenis 'jodoh') jadi array ronde:
// [{ judul, pasangan:[{kiri,kanan}, ...] }, ...]
// Mendukung format lama (data = array pasangan langsung, tanpa pembungkus ronde)
// supaya materi lama yang sudah dibuat guru tetap bisa dimainkan.
function jodohRondeFromData(data) {
  const arr = Array.isArray(data) ? data : [];
  if (!arr.length) return [];
  const legacyFlat = typeof arr[0].kiri !== 'undefined' && typeof arr[0].pasangan === 'undefined';
  if (legacyFlat) {
    return [{ judul: 'Ronde 1', pasangan: arr.map(d => ({ kiri: d.kiri, kanan: d.kanan })) }];
  }
  return arr.map((r, i) => ({
    judul: (r && r.judul) || `Ronde ${i + 1}`,
    pasangan: ((r && r.pasangan) || []).map(d => ({ kiri: d.kiri, kanan: d.kanan }))
  }));
}

// Total semua pasangan di seluruh ronde (dipakai buat ringkasan & skor maksimal).
function jodohTotalPasangan(rondeList) {
  return (rondeList || []).reduce((sum, r) => sum + ((r.pasangan || []).length), 0);
}

// ===================== GAME: util Cari Kata (word search) =====================
// Bikin papan huruf acak berisi WORDS yang ditempatkan lurus (8 arah: mendatar,
// menurun, diagonal, termasuk terbalik), sisanya diisi huruf acak. Dipakai bareng
// oleh game-cari-kata.html (siswa) & guru-game.html (mode giliran/live guru).
// Return: { size, grid: string[][], placements: [{ kata, cells:[[r,c],...] }] }
function buatGridCariKata(words) {
  const list = (words || [])
    .map(w => String(w || '').toUpperCase().replace(/[^A-Z]/g, ''))
    .filter(Boolean);
  if (!list.length) return { size: 0, grid: [], placements: [] };

  const terpanjang = Math.max(...list.map(w => w.length));
  const size = Math.min(16, Math.max(terpanjang, 8, Math.ceil(Math.sqrt(list.length) * terpanjang * 0.65)));

  const arah8 = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placements = [];

  function cobaTaruh(kata) {
    if (kata.length > size) return false;
    for (let percobaan = 0; percobaan < 150; percobaan++) {
      const [dr, dc] = arah8[Math.floor(Math.random() * arah8.length)];
      const r0 = Math.floor(Math.random() * size);
      const c0 = Math.floor(Math.random() * size);
      const rAkhir = r0 + dr * (kata.length - 1);
      const cAkhir = c0 + dc * (kata.length - 1);
      if (rAkhir < 0 || rAkhir >= size || cAkhir < 0 || cAkhir >= size) continue;

      const cells = [];
      let cocok = true;
      for (let k = 0; k < kata.length; k++) {
        const r = r0 + dr * k, c = c0 + dc * k;
        const isi = grid[r][c];
        if (isi !== null && isi !== kata[k]) { cocok = false; break; }
        cells.push([r, c]);
      }
      if (!cocok) continue;

      cells.forEach(([r, c], k) => { grid[r][c] = kata[k]; });
      placements.push({ kata, cells });
      return true;
    }
    return false;
  }

  // Kata terpanjang ditaruh duluan supaya lebih gampang dapat tempat di papan.
  [...list].sort((a, b) => b.length - a.length).forEach(cobaTaruh);

  const abjad = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) grid[r][c] = abjad[Math.floor(Math.random() * abjad.length)];
    }
  }

  return { size, grid, placements };
}

// Cek apakah jalur seret siswa (array [r,c]) cocok persis dengan salah satu kata
// di papan (boleh diseret dari arah manapun / terbalik) dan belum ditemukan
// sebelumnya. Return placement yang cocok ({kata, cells}) atau null.
function cocokkanJalurCariKata(jalur, placements, ditemukan) {
  if (!jalur || jalur.length < 2) return null;
  const jalurKey = jalur.map(([r, c]) => `${r},${c}`).join('|');
  const jalurTerbalikKey = [...jalur].slice().reverse().map(([r, c]) => `${r},${c}`).join('|');
  return (placements || []).find(p => {
    if (ditemukan && ditemukan.has(p.kata)) return false;
    const key = p.cells.map(([r, c]) => `${r},${c}`).join('|');
    return key === jalurKey || key === jalurTerbalikKey;
  }) || null;
}

// ===================== GAME: util Tim (giliran IPD bisa >1 siswa) =====================
// Cari baris game_peserta yang anggotanya (daftar profile_id) persis sama dengan
// kombinasi siswa yang dipilih guru sekarang — supaya skor giliran yang sama
// (tim yang sama) terus terakumulasi di baris yang sama, bukan bikin baris baru.
function cariPesertaTim(list, profileIds) {
  const target = [...profileIds].sort().join(',');
  return (list || []).find(p => {
    const ids = (p.anggota && p.anggota.length ? p.anggota.map(a => a.profile_id) : [p.profile_id]).sort().join(',');
    return ids === target;
  }) || null;
}

// Gabungkan nama-nama anggota tim jadi satu string tampilan, mis. "Andi & Budi".
function namaTim(anggota) {
  return (anggota || []).map(a => a.nama).join(' & ');
}

// ===================== PRESENCE: SISWA AKTIF DI OBROLAN KELAS =====================
// Dipakai bareng oleh obrolan.html (siswa) & guru.html (menu Obrolan Kelas).
// Menampilkan daftar siswa yang SEDANG BUKA halaman obrolan kelas tertentu,
// lewat fitur Presence Supabase Realtime — bukan status "online umum", dan
// tidak disimpan ke tabel manapun (murni realtime, hilang sendiri begitu
// tab ditutup / koneksi putus).

let _presenceChannel = null;

// kelasId: kelas yang mau dipantau (null/'' untuk berhenti memantau & bersihkan tampilan).
// containerId: id elemen tempat daftar chip nama siswa aktif dirender.
// selfMeta: { id, nama } kalau dipanggil dari sisi SISWA (supaya ikut tercatat aktif),
//           atau null kalau dipanggil dari sisi GURU (cuma menonton, tidak ikut tercatat).
function subscribePresenceKelas(kelasId, containerId, selfMeta) {
  if (_presenceChannel) {
    supabase.removeChannel(_presenceChannel);
    _presenceChannel = null;
  }
  const container = document.getElementById(containerId);
  if (!kelasId) {
    if (container) container.innerHTML = '';
    return;
  }
  if (container) container.innerHTML = '<span class="active-empty">Memuat status aktif…</span>';

  const presenceKey = selfMeta ? selfMeta.id : ('viewer_' + Math.random().toString(36).slice(2));
  const channel = supabase.channel('presence_kelas_' + kelasId, {
    config: { presence: { key: presenceKey } },
  });

  channel.on('presence', { event: 'sync' }, () => {
    renderActiveStudentsBar(channel.presenceState(), containerId);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED' && selfMeta) {
      await channel.track({ nama: selfMeta.nama, role: 'siswa', online_at: new Date().toISOString() });
    }
  });

  _presenceChannel = channel;
}

function renderActiveStudentsBar(state, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const active = [];
  Object.keys(state || {}).forEach((key) => {
    const metas = state[key];
    if (!metas || !metas.length) return;
    const m = metas[metas.length - 1];
    if (m && m.role === 'siswa' && m.nama) active.push(m.nama);
  });
  active.sort((a, b) => a.localeCompare(b, 'id'));
  if (!active.length) {
    container.innerHTML = '<span class="active-empty">Belum ada siswa yang aktif di obrolan ini.</span>';
    return;
  }
  container.innerHTML =
    `<span class="asb-label">🟢 ${active.length} siswa aktif</span>` +
    active.map((nama) => `<span class="active-chip"><span class="dot"></span>${esc(nama)}</span>`).join('');
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

  const [annRes, nilaiRes, bintangRes] = await Promise.all([
    supabase.from('pengumuman').select('id, judul, created_at')
      .or(`kelas_id.eq.${profile.kelas_id},kelas_id.is.null`)
      .gt('created_at', since)
      .order('created_at', { ascending: false }),
    supabase.from('nilai').select('id, jenis, skor, created_at')
      .eq('siswa_id', profile.id)
      .gt('created_at', since)
      .order('created_at', { ascending: false }),
    supabase.from('bintang').select('id, jumlah, guru_nama, created_at')
      .eq('siswa_id', profile.id)
      .gt('created_at', since)
      .order('created_at', { ascending: false }),
  ]);

  const items = [
    ...((annRes.data) || []).map(a => ({ icon: '📣', title: a.judul, desc: 'Pengumuman baru', created_at: a.created_at, href: 'pengumuman.html' })),
    ...((nilaiRes.data) || []).map(n => ({ icon: '📊', title: n.jenis, desc: 'Nilai baru' + (typeof n.skor === 'number' ? ': ' + n.skor : ''), created_at: n.created_at, href: 'pengumuman.html' })),
    ...((bintangRes.data) || []).map(b => ({ icon: '⭐', title: `${b.jumlah} bintang baru`, desc: 'Dari ' + (b.guru_nama || 'Guru'), created_at: b.created_at, href: 'bintang.html' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  setNotifDot(items.length);

  list.innerHTML = items.length ? items.map(it => `
    <a class="notif-item" href="${it.href}">
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
