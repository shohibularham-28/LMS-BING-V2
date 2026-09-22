# Struktur folder Materi / Worksheet

Semua file materi & worksheet (termasuk game dan latihan, karena sifatnya
sama-sama tugas/latihan siswa) yang sebelumnya tercecer di root repo — dan
sebagian duplikat di `assets/` — sekarang dikumpulkan jadi 2 kategori saja,
tanpa subfolder per topik:

```
materi/
  materi-fractured-fairytale.html
  materi-irregular-verbs.html
  materi-tenses.html

worksheet/
  worksheet-fractured.html
  worksheet-past-continuous.html
  worksheet-recount-text.html
  materi-worksheet-descriptive-text.html
  game-recount-text.html
  game-tenses-30-soal.html
  game-grammar-kelas-xi.html
  latihan-tenses.html
  recount-text-v1-arsip.html            <- draft lama, dulu assets/recount-text.html
  recount-master-lms-draft-arsip.html   <- draft lama, dulu assets/recount_master_lms.html
```

Duplikat byte-identik yang sebelumnya ada di `assets/` (copy dari root) sudah
dihapus — cuma ada satu salinan resmi per file, di folder kategorinya.
`assets/` sekarang cuma isi file inti aplikasi: `app.js`, `style.css`,
`supabaseClient.js`, `soal-import.js`.

Link relatif di dalam tiap file (`index.html`, `assets/app.js`,
`assets/supabaseClient.js`) sudah disesuaikan jadi `../...` supaya tetap
jalan dari lokasi barunya (1 level di bawah root).

## ⚠️ PENTING — URL di menu "Kelola Materi" / "Kelola Worksheet" guru.html

Materi & worksheet yang guru tambahkan lewat dashboard (`guru.html`)
disimpan sebagai **URL manual** di tabel Supabase (`materi.url`,
`worksheet.url`), bukan dibaca otomatis dari struktur folder repo. Karena
file-file ini pindah lokasi, link lama yang masih mengarah ke root
(`.../materi-tenses.html`) akan **404**.

Update tiap entri lama ke path baru, misalnya:

| Lama (root)                              | Baru                                   |
|-------------------------------------------|------------------------------------------|
| `materi-tenses.html`                      | `materi/materi-tenses.html`               |
| `materi-fractured-fairytale.html`         | `materi/materi-fractured-fairytale.html`  |
| `materi-irregular-verbs.html`             | `materi/materi-irregular-verbs.html`      |
| `worksheet-fractured.html`                | `worksheet/worksheet-fractured.html`      |
| `worksheet-past-continuous.html`          | `worksheet/worksheet-past-continuous.html`|
| `worksheet-recount-text.html`             | `worksheet/worksheet-recount-text.html`   |
| `materi-worksheet-descriptive-text.html`  | `worksheet/materi-worksheet-descriptive-text.html` |
| `game-recount-text.html`                  | `worksheet/game-recount-text.html`        |
| `game-tenses-30-soal.html`                | `worksheet/game-tenses-30-soal.html`      |
| `game-grammar-kelas-xi.html`              | `worksheet/game-grammar-kelas-xi.html`    |
| `latihan-tenses.html`                     | `worksheet/latihan-tenses.html`           |

(ganti bagian domain/host sesuai tempat hosting — hanya path setelah domain
yang berubah)
