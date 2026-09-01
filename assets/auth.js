// ===================== AUTH & SHELL BERSAMA (dipakai semua halaman) =====================
// File ini membutuhkan data.js (USERS, DATA) sudah dimuat lebih dulu.

function getLevel(kelas){ return kelas.startsWith("XI") ? "XI" : "X"; }

const REMEDIAL_KELAS = ["XI D1", "XI D2", "XI E1"];
const REMEDIAL_LINK = "https://shohibularham-28.github.io/LMS-READING/";

function getRemedialAnnouncement(account){
  if(!account || !REMEDIAL_KELAS.includes(account.kelas)) return null;
  const level = getLevel(account.kelas);
  const d = DATA[level];
  if(!d) return null;
  const nilai = d.grades.find(g => g.siswa === account.nama);
  if(!nilai || typeof nilai.skor !== 'number' || nilai.skor >= 75) return null;

  return {
    date: new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' }),
    title: "Remedial " + nilai.jenis,
    body: `Kamu belum mencapai nilai KKM pada <strong>${nilai.jenis}</strong> (skor: ${nilai.skor}). Silakan kerjakan remedial melalui link berikut: <a href="${REMEDIAL_LINK}" target="_blank" rel="noopener">${REMEDIAL_LINK}</a>. Token remedial: <strong>remed</strong>`
  };
}

// ---------- Session ----------
function saveSession(username, password, kelas){
  localStorage.setItem('lms_session', JSON.stringify({ username, password, kelas }));
}

function clearSession(){
  localStorage.removeItem('lms_session');
}

function getSessionAccount(){
  try{
    const raw = localStorage.getItem('lms_session');
    if(!raw) return null;
    const s = JSON.parse(raw);
    const account = USERS.find(u => u.username === (s.username||'').toLowerCase() && u.password === s.password && u.kelas === s.kelas);
    if(!account){ clearSession(); return null; }
    return account;
  }catch(e){
    clearSession();
    return null;
  }
}

// Panggil di awal setiap halaman (selain index.html) untuk memastikan user sudah login.
// Mengembalikan objek account jika berhasil, atau langsung redirect ke index.html jika belum login.
function requireLogin(){
  const account = getSessionAccount();
  if(!account){
    window.location.href = 'index.html';
    return null;
  }
  return account;
}

function doLogout(){
  clearSession();
  window.location.href = 'index.html';
}

// ---------- Render shell (sidebar + topbar) yang sama di semua halaman ----------
// activePage: 'pengumuman' | 'materi' | 'worksheet'
function renderShell(account, activePage){
  const level = getLevel(account.kelas);

  document.getElementById('topName').textContent = account.nama;
  document.getElementById('sideName').textContent = account.nama;
  document.getElementById('userAvatar').textContent = account.nama.charAt(0).toUpperCase();
  document.getElementById('sideClass').textContent = "Kelas " + account.kelas;
  document.getElementById('topLevel').textContent = level;
  document.getElementById('topKelasName').textContent = account.kelas;
  document.getElementById('topDate').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === activePage);
  });

  return level;
}

function emptyState(title, desc, icon){
  return `
    <div class="empty-state">
      <div class="icon">${icon || '🗂️'}</div>
      <div class="title">${title}</div>
      <div class="desc">${desc}</div>
    </div>
  `;
}
