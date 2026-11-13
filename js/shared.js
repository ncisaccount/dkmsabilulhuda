/**
 * Fungsi UI bersama untuk semua halaman publik (selain Beranda yang punya app.js sendiri).
 */
function initThemeToggleShared() {
  const btn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('theme', cur);
  });
}

function initMobileNavShared() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

// Terapkan tema tersimpan sesegera mungkin (hindari kedip saat load).
(function () {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

/**
 * [ADDITIVE v2 — Modul 05] Terapkan Pengaturan Situs (termasuk Logo) ke navbar
 * & elemen [data-setting] pada SEMUA halaman publik selain Beranda (Beranda
 * sudah punya jalurnya sendiri lewat renderPengaturan() di app.js — fungsi
 * ini sengaja dibuat terpisah agar tidak menduplikasi/mengubah app.js).
 */
function terapkanPengaturanUmum_(list) {
  const map = {};
  (list || []).forEach(r => map[r.key] = r.value);
  document.querySelectorAll('[data-setting]').forEach(el => {
    const key = el.getAttribute('data-setting');
    if (map[key]) el.textContent = map[key];
  });
  const logoImg = document.getElementById('site-logo-img');
  const logoFallback = document.getElementById('site-logo-fallback');
  if (logoImg && map.logo_utama) {
    logoImg.src = map.logo_utama;
    logoImg.style.display = 'block';
    if (logoFallback) logoFallback.style.display = 'none';
  }
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon && map.favicon) favicon.href = map.favicon;
}

/**
 * [ADDITIVE v2 — perbaikan audit internal] Render satu URL media (foto ATAU
 * video) dengan cara yang benar: foto sebagai <img>, video Google Drive
 * sebagai <iframe> (format /preview resmi Drive — <video src="..."> TIDAK
 * andal untuk file Drive, lihat catatan di backend/Media.gs), video YouTube
 * tetap sebagai <iframe> embed biasa.
 */
function renderMediaFrame_(url) {
  if (!url) return '';
  // [PERBAIKAN v5] Proxy video milik Apps Script sendiri (dipakai sebagai cadangan saat
  // sharing Drive ditolak kebijakan organisasi — lihat Media.gs). Video asli, bisa
  // diputar native, hanya TANPA dukungan seek/buffer sebaik iframe Drive resmi.
  if (/[?&]action=media/.test(url) && /[?&]tipe=video/.test(url)) {
    return `<video controls preload="metadata" style="width:100%;height:100%;background:#000;"><source src="${url}">Video tidak dapat diputar di browser ini.</video>`;
  }
  // Iframe /preview resmi Drive (pengalaman terbaik, butuh sharing publik aktif).
  if (/drive\.google\.com\/file\/.+\/preview/.test(url)) {
    return `<iframe src="${url}" style="width:100%;height:100%;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  }
  // YouTube — terima link watch, youtu.be, maupun yang sudah berformat embed.
  if (/youtube\.com|youtu\.be/.test(url)) {
    const embedUrl = normalisasiUrlYoutube_(url);
    return `<iframe src="${embedUrl}" style="width:100%;height:100%;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  }
  // Tautan Drive mentah yang DITEMPEL MANUAL oleh admin (bukan hasil upload) —
  // ".../file/d/ID/view" atau ".../open?id=ID" — otomatis dikonversi ke /preview
  // agar tetap bisa tampil sebagai embed, bukan link mati.
  const idDriveManual = ekstrakIdDrive_(url);
  if (idDriveManual) {
    return `<iframe src="https://drive.google.com/file/d/${idDriveManual}/preview" style="width:100%;height:100%;border:0;" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
  }
  // Default: gambar biasa (proxy gambar milik sendiri, thumbnail Drive, atau URL gambar umum lain).
  return `<img src="${url}" alt="" loading="lazy">`;
}

// [ADDITIVE v5] Ubah berbagai bentuk link Drive (view/open/edit) jadi link /preview
// yang bisa disematkan via <iframe>. Dipakai untuk link yang DITEMPEL MANUAL, karena
// hasil upload kita sendiri SUDAH otomatis dalam format yang benar (lihat Media.gs).
function ekstrakIdDrive_(url) {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]{15,})/);
  return m ? m[1] : null;
}

function normalisasiUrlYoutube_(url) {
  if (url.indexOf('embed/') !== -1) return url;
  const mWatch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (mWatch) return 'https://www.youtube.com/embed/' + mWatch[1];
  const mShort = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (mShort) return 'https://www.youtube.com/embed/' + mShort[1];
  return url;
}

/**
 * [ADDITIVE v2 — Modul 04, perbaikan audit internal] Isi berita kini bisa
 * berasal dari dua sumber yang HARUS ditangani berbeda:
 *  - Manual (form Tambah Konten lama) -> teks polos, baris baru = paragraf baru.
 *  - Google Docs (Modul 04, hasil sinkronBeritaDariDocs_) -> HTML siap pakai
 *    (<p>, <h2>, <ul>, <img>, dst.) -> TIDAK BOLEH dibungkus <p> lagi, atau
 *    tag akan rusak bersarang/double-escaped.
 * Deteksi sederhana: jika isi sudah mengandung tag HTML, tampilkan apa adanya.
 */
function formatIsiBerita_(isi) {
  if (!isi) return '';
  const sudahHtml = /<\/?(p|h[1-6]|ul|ol|li|img|b|i)[ >]/i.test(isi);
  if (sudahHtml) return isi;
  return isi.split('\n').filter(x => x.trim()).map(p => `<p>${p}</p>`).join('');
}

async function muatPengaturanSitusGlobal_() {
  try {
    const res = await Api.get('pengaturan');
    if (res.success) terapkanPengaturanUmum_(res.data);
  } catch (e) { /* biarkan fallback teks statis tampil */ }
}
