// ===================== AUTH & SHELL BERSAMA (dipakai semua halaman) =====================
// File ini membutuhkan data.js (USERS, DATA) sudah dimuat lebih dulu.

function getLevel(kelas){ return kelas.startsWith("XI") ? "XI" : "X"; }

// ---------- Akun Guru ----------
const TEACHER = { username: "arhamhanif", password: "guruku", nama: "Arham Hanif", role: "guru" };

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

// ---------- Session Guru ----------
function saveTeacherSession(username, password){
  localStorage.setItem('lms_teacher_session', JSON.stringify({ username, password }));
}

function clearTeacherSession(){
  localStorage.removeItem('lms_teacher_session');
}

function getTeacherSessionAccount(){
  try{
    const raw = localStorage.getItem('lms_teacher_session');
    if(!raw) return null;
    const s = JSON.parse(raw);
    const match = TEACHER.username === (s.username||'').toLowerCase() && TEACHER.password === s.password;
    if(!match){ clearTeacherSession(); return null; }
    return TEACHER;
  }catch(e){
    clearTeacherSession();
    return null;
  }
}

// Panggil di awal halaman guru untuk memastikan guru sudah login.
function requireTeacherLogin(){
  const teacher = getTeacherSessionAccount();
  if(!teacher){
    window.location.href = 'index.html';
    return null;
  }
  return teacher;
}

function doTeacherLogout(){
  clearTeacherSession();
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

// ---------- Rekap Nilai (dipakai halaman guru) ----------

// Nama siswa -> kelas, diambil dari USERS (data grades sendiri tidak menyimpan kelas).
function getStudentKelas(namaSiswa){
  const u = USERS.find(x => x.nama === namaSiswa);
  return u ? u.kelas : null;
}

// Daftar kelas unik yang ada untuk suatu level ("X" / "XI"), diurutkan alfabet.
function getKelasListByLevel(level){
  const set = new Set();
  USERS.forEach(u => { if(getLevel(u.kelas) === level) set.add(u.kelas); });
  return Array.from(set).sort();
}

// Semua data nilai (dari DATA[level].grades) milik siswa-siswa di satu kelas tertentu.
function getGradesByKelas(level, kelas){
  const d = DATA[level];
  if(!d) return [];
  return d.grades.filter(g => getStudentKelas(g.siswa) === kelas);
}

// Daftar jenis penilaian yang tersedia untuk suatu kelas, sesuai urutan kemunculan pertama.
function getJenisListForKelas(level, kelas){
  const seen = [];
  getGradesByKelas(level, kelas).forEach(g => { if(!seen.includes(g.jenis)) seen.push(g.jenis); });
  return seen;
}

// Rekap nilai untuk kombinasi level + kelas + jenis: daftar siswa (terurut skor tertinggi)
// beserta ringkasan statistik (rata-rata, tertinggi, terendah, jumlah tuntas/remidi/belum).
function getRekapNilai(level, kelas, jenis){
  const grades = getGradesByKelas(level, kelas).filter(g => g.jenis === jenis);

  const rows = grades.map(g => ({
    nama: g.siswa,
    skor: g.skor,
    skorAsli: typeof g.skorAsli === 'number' ? g.skorAsli : null,
    predikat: g.predikat
  })).sort((a, b) => {
    const av = typeof a.skor === 'number' ? a.skor : -1;
    const bv = typeof b.skor === 'number' ? b.skor : -1;
    return bv - av;
  });

  const numeric = rows.filter(r => typeof r.skor === 'number').map(r => r.skor);
  const summary = {
    jumlahSiswa: rows.length,
    sudahMengerjakan: numeric.length,
    belumMengerjakan: rows.length - numeric.length,
    rataRata: numeric.length ? (numeric.reduce((a, b) => a + b, 0) / numeric.length) : null,
    tertinggi: numeric.length ? Math.max(...numeric) : null,
    terendah: numeric.length ? Math.min(...numeric) : null,
    tuntas: numeric.filter(s => s >= 75).length,
    remidi: numeric.filter(s => s < 75).length
  };

  return { rows, summary };
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
