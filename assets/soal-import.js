/* =========================================================
   Import Soal dari file Word (.docx) -> format DATA soal.html
   Pakai mammoth.js (client-side, tidak perlu server) untuk
   mengambil teks polos dari .docx, lalu diparse berdasarkan
   format penanda baris (lihat Template_Soal.docx).
   ========================================================= */

/* ---------- 1) Ambil teks polos dari file .docx ---------- */
function readDocxAsRawText(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = function(e){
      mammoth.extractRawText({ arrayBuffer: e.target.result })
        .then(result => resolve(result.value))
        .catch(reject);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ---------- 2) Parser format penanda -> array DATA ----------
   Format yang didukung (lihat Template_Soal.docx untuk contoh lengkap):

   === TEKS 1 ===
   JUDUL: <judul bacaan>
   KETERANGAN: <deskripsi singkat, opsional>
   BACAAN:
   <paragraf 1>
   <paragraf 2>

   --- SOAL 1 (PILIHAN GANDA) ---
   PERTANYAAN: <teks pertanyaan>
   A) <opsi A>
   B) <opsi B>
   C) <opsi C> [BENAR]
   D) <opsi D>

   --- SOAL 2 (PILIHAN GANDA GANDA) ---
   PETUNJUK: Pilih 2 jawaban yang benar!
   PERTANYAAN: <teks pertanyaan>
   A) <opsi A> [BENAR]
   B) <opsi B> [BENAR]
   C) <opsi C>

   --- SOAL 3 (KLASIFIKASI) ---
   PERTANYAAN: <teks pertanyaan>
   KOLOM: <Kolom1> | <Kolom2>
   <pernyataan 1> = <Kolom1>
   <pernyataan 2> = <Kolom2>
*/
function parseSoalDocx(rawText){
  const errors = [];
  const warnings = [];
  const DATA = [];
  const letters = ['A','B','C','D','E','F'];

  let section = null;
  let question = null;
  let mode = 'none'; // 'passage' | 'statements'
  let qCounter = 0;

  const lines = rawText.split(/\r?\n/).map(l=>l.trim());

  function pushQuestion(){
    if(question){
      if(question.type==='single' && !question.correct){
        errors.push(`Soal No.${question.no}: belum ada opsi yang ditandai [BENAR].`);
      }
      if(question.type==='multi' && (!question.correct || question.correct.length===0)){
        errors.push(`Soal No.${question.no}: belum ada opsi yang ditandai [BENAR].`);
      }
      if(question.type==='matrix' && (!question.statements || question.statements.length===0)){
        errors.push(`Soal No.${question.no}: belum ada baris pernyataan (format "pernyataan = kolom").`);
      }
      section.questions.push(question);
    }
    question = null;
    mode = 'none';
  }
  function pushSection(){
    pushQuestion();
    if(section){
      if(section.questions.length===0){
        warnings.push(`"${section.title}" tidak punya soal sama sekali — dilewati.`);
      } else {
        DATA.push(section);
      }
    }
    section = null;
  }

  const colorPairs = [
    ['var(--t1)','var(--t1-bg)'], ['var(--t2)','var(--t2-bg)'],
    ['var(--t3)','var(--t3-bg)'], ['var(--t4)','var(--t4-bg)']
  ];

  for(let raw of lines){
    const line = raw;
    if(line === '') continue;

    // === TEKS n ===
    const secMatch = line.match(/^=+\s*TEKS\s*(\d*)\s*=+$/i);
    if(secMatch){
      pushSection();
      const idx = DATA.length;
      const cp = colorPairs[idx % colorPairs.length];
      section = {
        id: 'text'+(idx+1), tag: 'TEKS '+(idx+1),
        color: cp[0], bg: cp[1],
        title: '', meta: '', passage: [], questions: []
      };
      mode = 'none';
      continue;
    }
    if(!section){
      // Belum ada header "=== TEKS n ===" — buat section default supaya
      // file yang lupa menulis header TEKS tetap bisa diproses.
      section = { id:'text1', tag:'TEKS 1', color:colorPairs[0][0], bg:colorPairs[0][1], title:'', meta:'', passage:[], questions:[] };
    }

    const judulMatch = line.match(/^JUDUL\s*:\s*(.+)$/i);
    if(judulMatch){ section.title = judulMatch[1].trim(); mode='none'; continue; }

    const ketMatch = line.match(/^KETERANGAN\s*:\s*(.+)$/i);
    if(ketMatch){ section.meta = ketMatch[1].trim(); mode='none'; continue; }

    if(/^BACAAN\s*:?\s*$/i.test(line)){ mode = 'passage'; continue; }

    // --- SOAL n (TIPE) ---
    const soalMatch = line.match(/^-*\s*SOAL\s*(\d*)\s*\(([^)]*)\)\s*-*$/i);
    if(soalMatch){
      pushQuestion();
      qCounter++;
      const tipeRaw = soalMatch[2].toUpperCase();
      let type = 'single';
      if(tipeRaw.includes('KLASIFIKASI') || tipeRaw.includes('MATRIX')) type = 'matrix';
      else if(tipeRaw.includes('GANDA GANDA') || tipeRaw.includes('LEBIH DARI 1') || tipeRaw.includes('MULTI')) type = 'multi';
      question = {
        id: 'q'+qCounter, no: qCounter, type,
        prompt: '', options: [], correct: type==='multi' ? [] : null,
        cols: null, statements: []
      };
      mode = 'none';
      continue;
    }

    const petunjukMatch = line.match(/^PETUNJUK\s*:\s*(.+)$/i);
    if(petunjukMatch && question){ question.hint = petunjukMatch[1].trim(); continue; }

    const pertanyaanMatch = line.match(/^PERTANYAAN\s*:\s*(.+)$/i);
    if(pertanyaanMatch && question){ question.prompt = pertanyaanMatch[1].trim(); continue; }

    const kolomMatch = line.match(/^KOLOM\s*:\s*(.+)\|\s*(.+)$/i);
    if(kolomMatch && question){
      question.cols = [kolomMatch[1].trim(), kolomMatch[2].trim()];
      mode = 'statements';
      continue;
    }

    // Opsi jawaban: "A) teks" atau "A. teks", dengan/ tanpa [BENAR]
    const optMatch = line.match(/^([A-F])[\).]\s*(.+)$/);
    if(optMatch && question && (question.type==='single' || question.type==='multi')){
      let text = optMatch[2].trim();
      const isCorrect = /\[?\(?\s*BENAR\s*\)?\]?\s*$/i.test(text) && /BENAR/i.test(text);
      if(isCorrect){
        text = text.replace(/\[?\(?\s*BENAR\s*\)?\]?\s*$/i, '').trim();
      }
      const key = optMatch[1].toUpperCase();
      question.options.push({ k: key, t: text });
      if(isCorrect){
        if(question.type==='single') question.correct = key;
        else question.correct.push(key);
      }
      continue;
    }

    // Baris pernyataan klasifikasi: "pernyataan = Kolom"
    const stmtMatch = line.match(/^(.+?)\s*=\s*(.+)$/);
    if(mode==='statements' && question && stmtMatch){
      question.statements.push({ t: stmtMatch[1].trim(), correct: stmtMatch[2].trim() });
      continue;
    }

    // Kalau tidak cocok penanda apapun tapi mode=passage -> anggap paragraf bacaan
    if(mode==='passage'){
      section.passage.push(line);
      continue;
    }

    // Baris tak dikenali di luar semua mode -> abaikan tapi catat sebagai warning
    if(!/^\s*$/.test(line)){
      warnings.push(`Baris tidak dikenali dan diabaikan: "${line.slice(0,60)}"`);
    }
  }
  pushSection();

  // Validasi tambahan: kolom matrix harus konsisten dengan nilai "correct" tiap pernyataan
  DATA.forEach(sec=>{
    sec.questions.forEach(q=>{
      if(q.type==='matrix' && q.cols){
        q.statements.forEach(s=>{
          if(!q.cols.includes(s.correct)){
            errors.push(`Soal No.${q.no}: pernyataan "${s.t}" punya kolom "${s.correct}" yang tidak ada di KOLOM (${q.cols.join(' / ')}).`);
          }
        });
      }
    });
  });

  return { data: DATA, errors, warnings };
}

/* ---------- 3) Render pratinjau hasil parsing (dipakai guru.html) ---------- */
function renderSoalPreviewHtml(parsed){
  const { data, errors, warnings } = parsed;
  let html = '';
  if(errors.length){
    html += `<div class="login-error" style="display:block;"><b>${errors.length} masalah ditemukan — perbaiki file Word lalu upload ulang:</b><ul>` +
      errors.map(e=>`<li>${escSoal(e)}</li>`).join('') + '</ul></div>';
  }
  if(warnings.length){
    html += `<div class="hint"><b>Peringatan (tidak menghalangi simpan):</b><ul>` +
      warnings.map(w=>`<li>${escSoal(w)}</li>`).join('') + '</ul></div>';
  }
  let totalQ = 0;
  data.forEach(sec=>{ totalQ += sec.questions.length; });
  html += `<div class="hint">Ditemukan <b>${data.length} teks bacaan</b> dan <b>${totalQ} soal</b>.</div>`;
  data.forEach(sec=>{
    html += `<div style="border:1px solid #e2e2e2;border-radius:10px;padding:12px;margin-top:10px;">
      <div style="font-weight:700;">${escSoal(sec.tag)} — ${escSoal(sec.title||'(judul kosong)')}</div>
      <div style="font-size:12.5px;color:#777;margin-bottom:6px;">${escSoal(sec.meta||'')}</div>
      <ol style="margin:0;padding-left:18px;">` +
      sec.questions.map(q=>{
        let tipeLabel = q.type==='single' ? 'Pilihan Ganda' : q.type==='multi' ? 'Pilihan Ganda (>1 jawaban)' : 'Klasifikasi';
        return `<li style="margin-bottom:4px;"><b>[${tipeLabel}]</b> ${escSoal(q.prompt||'(pertanyaan kosong)')}</li>`;
      }).join('') +
      `</ol></div>`;
  });
  return html;
}

function escSoal(str){
  return String(str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- 4) Simpan ke Supabase: bank_soal + worksheet ----------
   Dipanggil dari guru.html setelah guru menekan tombol "Simpan & Terbitkan".
   `supabase` di sini adalah client global yang sama dari assets/supabaseClient.js. */
async function simpanBankSoalDanWorksheet({ judul, tingkat, durasiMenit, penaltiAktif, poinPenalti, acakSoal, tampilkanNilaiLangsung, data, guruId, namaFile }){
  const { data: bankRow, error: err1 } = await supabase
    .from('bank_soal')
    .insert({
      judul, guru_id: guruId, durasi_menit: durasiMenit || 90,
      penalti_aktif: penaltiAktif !== false,
      poin_penalti: (poinPenalti===0 || poinPenalti) ? poinPenalti : 2,
      acak_soal: acakSoal === true,
      tampilkan_nilai_langsung: tampilkanNilaiLangsung !== false,
      data, sumber_file: namaFile || null
    })
    .select('id')
    .single();
  if(err1) throw err1;

  const { data: wsRow, error: err2 } = await supabase
    .from('worksheet')
    .insert({
      judul, level: tingkat, kelas_id: null,
      url: 'soal.html?id=' + bankRow.id
    })
    .select('id')
    .single();
  if(err2) throw err2;

  // Kaitkan balik bank_soal.worksheet_id supaya soal.html tahu ke worksheet mana
  // hasil ujiannya harus dicatat.
  await supabase.from('bank_soal').update({ worksheet_id: wsRow.id }).eq('id', bankRow.id);

  return { bankSoalId: bankRow.id, worksheetId: wsRow.id };
}
