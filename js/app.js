/**
 * Logic khusus halaman Beranda (index.html).
 * Mengambil satu bundle gabungan (action=beranda) agar hemat panggilan API
 * sesuai mitigasi kuota GAS di PRD Bagian 6.
 */
const NAMA_SALAT = { subuh: 'Subuh', zuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const URUTAN_SALAT = ['subuh', 'zuhur', 'ashar', 'maghrib', 'isya']; // 5 waktu wajib — dasar perhitungan countdown
// [REDESIGN v6] Label & ikon untuk SEMUA 8 slot waktu (termasuk imsak/terbit/dhuha
// yang hanya informatif, tidak ikut dihitung countdown waktu wajib di atas).
const URUTAN_TAMPIL_SALAT = ['imsak', 'subuh', 'terbit', 'dhuha', 'zuhur', 'ashar', 'maghrib', 'isya'];
const NAMA_SALAT_LENGKAP = { imsak: 'Imsak', subuh: 'Subuh', terbit: 'Terbit', dhuha: 'Dhuha', zuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const IKON_SALAT = { imsak: '🌙', subuh: '🌅', terbit: '🌄', dhuha: '🔆', zuhur: '☀️', ashar: '🌤️', maghrib: '🌇', isya: '🌌' };
let JADWAL_SALAT_AKTIF = null; // disimpan agar countdown bisa diperbarui tiap detik tanpa fetch ulang
let TIMER_COUNTDOWN_SALAT = null;

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();
  initMobileNav();
  catatKunjunganHalaman('beranda');

  // Tampilkan cache dulu (instan), lalu render ulang setelah data segar datang (SWR).
  const cached = Api.getCached('beranda');
  if (cached) renderBeranda(cached);

  const res = await Api.get('beranda');
  if (res.success) {
    renderBeranda(res.data);
  } else if (!cached) {
    document.querySelectorAll('[data-skeleton]').forEach(el => {
      el.innerHTML = `<div class="empty-state">${res.message || 'Data belum tersedia. Pastikan GAS_URL sudah diisi di js/config.js.'}</div>`;
    });
  }
});

function renderBeranda(data) {
  if (data.jadwalSalatHariIni) renderJadwalSalat(data.jadwalSalatHariIni);
  if (data.jadwalSalatInfo) renderInfoSinkronJadwal(data.jadwalSalatInfo); // [ADDITIVE v2 — Modul 03]
  if (data.berita) renderBerita(data.berita);
  if (data.agenda) renderAgenda(data.agenda);
  if (data.program) renderProgram(data.program);
  if (data.galeri) renderGaleri(data.galeri);
  if (data.pengumuman) renderPengumuman(data.pengumuman);
  if (data.pengaturan) renderPengaturan(data.pengaturan);
}

function renderPengaturan(list) {
  terapkanPengaturanUmum_(list); // [ADDITIVE v2 — Modul 05] logika logo/data-setting kini terpusat di shared.js
}

/**
 * [REDESIGN v6] Render kartu jadwal — SEMUA 8 slot waktu (imsak..isya) sekali
 * render, lalu serahkan countdown & highlight ke perbaruiHighlightCountdown_()
 * yang di-tick tiap detik via setInterval (Live Prayer Countdown, zona waktu
 * mengikuti jam perangkat pengunjung; data jadwal sendiri sudah dalam WIB).
 */
function renderJadwalSalat(jadwal) {
  const wrap = document.getElementById('jadwal-salat-list');
  if (!wrap) return;
  JADWAL_SALAT_AKTIF = jadwal;

  const tgl = document.getElementById('tanggal-hari-ini');
  if (tgl) {
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
    tgl.textContent = `${hari}, ${formatTanggalIndo(new Date().toISOString())}`;
  }

  const slotTersedia = URUTAN_TAMPIL_SALAT.filter(k => jadwal[k]);
  if (!slotTersedia.length) { wrap.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Jadwal salat belum tersedia. Administrator perlu menjalankan sinkronisasi di Pengaturan Situs.</div>'; return; }

  wrap.innerHTML = slotTersedia.map(k => `
    <div class="prayer-row ${URUTAN_SALAT.includes(k) ? 'utama' : ''}" data-key="${k}">
      <span class="ic" aria-hidden="true">${IKON_SALAT[k] || ''}</span>
      <span class="nama">${NAMA_SALAT_LENGKAP[k]}</span>
      <span class="time">${jadwal[k]}</span>
    </div>`).join('');

  const hijriahEl = document.getElementById('jadwal-hijriah');
  if (hijriahEl) hijriahEl.textContent = jadwal.hijriah ? ('📆 ' + jadwal.hijriah) : '📆 Tanggal Hijriah belum tersedia (menunggu sinkronisasi pertama).';

  perbaruiHighlightCountdown_(); // render pertama langsung, tidak menunggu tick 1 detik
  if (TIMER_COUNTDOWN_SALAT) clearInterval(TIMER_COUNTDOWN_SALAT);
  TIMER_COUNTDOWN_SALAT = setInterval(perbaruiHighlightCountdown_, 1000);
}

/**
 * [REDESIGN v6 — Live Prayer Countdown & Dynamic Highlight] Dipanggil tiap
 * detik. TIDAK fetch ulang data — murni menghitung ulang dari jam perangkat
 * saat ini terhadap JADWAL_SALAT_AKTIF yang sudah tersimpan di memori.
 */
function perbaruiHighlightCountdown_() {
  if (!JADWAL_SALAT_AKTIF) return;
  const jadwal = JADWAL_SALAT_AKTIF;
  const sekarang = new Date();
  const detikSekarang = sekarang.getHours() * 3600 + sekarang.getMinutes() * 60 + sekarang.getSeconds();

  let waktuNext = null, selisihDetik = Infinity;
  URUTAN_SALAT.forEach(key => {
    if (!jadwal[key]) return;
    const [h, m] = String(jadwal[key]).split(':').map(Number);
    let delta = (h * 3600 + m * 60) - detikSekarang;
    if (delta <= 0) delta += 24 * 3600; // sudah lewat hari ini -> hitung ke besok
    if (delta < selisihDetik) { selisihDetik = delta; waktuNext = key; }
  });

  document.querySelectorAll('#jadwal-salat-list .prayer-row').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-key') === waktuNext);
  });

  const countdown = document.getElementById('prayer-countdown');
  if (!countdown) return;
  if (!waktuNext) { countdown.textContent = 'Jadwal waktu wajib belum lengkap untuk hari ini.'; return; }
  const jam = Math.floor(selisihDetik / 3600);
  const menit = Math.floor((selisihDetik % 3600) / 60);
  const detik = selisihDetik % 60;
  countdown.textContent = `🕐 Menuju ${NAMA_SALAT[waktuNext]} • ${String(jam).padStart(2,'0')}:${String(menit).padStart(2,'0')}:${String(detik).padStart(2,'0')}`;
}

function renderInfoSinkronJadwal(info) {
  const el = document.getElementById('jadwal-sinkron-info');
  if (!el) return;
  // [REDESIGN v6] Kejujuran status WAJIB dijaga: tidak pernah menampilkan kesan
  // "berhasil" jika percobaan sinkron terakhir sebenarnya gagal.
  const gagal = !!info.sinkronGagalTerakhir;
  el.classList.toggle('gagal', gagal);
  let teks;
  if (info.sinkronTerakhir) {
    teks = 'Data Kemenag via myquran.com • sinkron terakhir: ' + formatTanggalIndo(info.sinkronTerakhir);
  } else {
    teks = 'Jadwal belum pernah disinkronkan otomatis — hubungi Administrator.';
  }
  if (gagal) teks += ' ⚠️ Percobaan sinkron terbaru sempat gagal, menampilkan data valid terakhir.';
  el.innerHTML = `<span class="dot"></span><span>${teks}</span>`;
}

function renderBerita(list) {
  const wrap = document.getElementById('berita-list');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">Belum ada berita.</div>'; return; }
  wrap.innerHTML = list.map(b => `
    <a class="card" href="berita-detail.html?slug=${encodeURIComponent(b.slug || '')}">
      <div class="media-frame media-frame--16x9 media-frame--crop">${renderMediaFrame_(b.gambar)}</div>
      <div class="card-body">
        <span class="tag">${b.kategori || 'Berita'}</span>
        <h3>${b.judul}</h3>
        <p class="meta">${formatTanggalIndo(b.tanggal)}</p>
      </div>
    </a>`).join('');
}

function renderAgenda(list) {
  const wrap = document.getElementById('agenda-list');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">Belum ada agenda mendatang.</div>'; return; }
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  wrap.innerHTML = list.map(a => {
    const d = new Date(a.tgl_mulai);
    return `
    <div class="agenda-card">
      <div class="agenda-date"><span class="d">${d.getDate() || '-'}</span><span class="m">${bln[d.getMonth()] || ''}</span></div>
      <div>
        <span class="tag">${a.kategori || 'Agenda'}</span>
        <h3 style="font-size:15px;margin:.2rem 0;">${a.judul}</h3>
        <p class="meta" style="margin:0;">${a.lokasi || ''}</p>
      </div>
    </div>`;
  }).join('');
}

function renderProgram(list) {
  const wrap = document.getElementById('program-list');
  if (!wrap) return;
  wrap.innerHTML = list.map(p => `
    <div class="quick-item" style="text-align:left;">
      <strong>${p.nama}</strong>
      <small>${(p.deskripsi || '').slice(0, 50)}${(p.deskripsi || '').length > 50 ? '…' : ''}</small>
    </div>`).join('');
}

function renderGaleri(list) {
  const wrap = document.getElementById('galeri-grid');
  if (!wrap) return;
  // [ADDITIVE v2 — koreksi audit] thumbnail video Drive TIDAK bisa dipakai sebagai <video src>
  // (lihat catatan Media.gs) — thumbnail mini di Beranda untuk video cukup kotak gelap + ikon
  // putar yang mengarah ke halaman Galeri lengkap (di sana videonya diputar lewat iframe resmi).
  wrap.innerHTML = list.map(g => `
    <a class="g-item media-frame media-frame--1x1 media-frame--crop" href="galeri.html" style="position:relative;${g.jenis==='video' ? 'background:var(--primary-dark);' : ''}">
      ${g.jenis === 'video' ? `<span class="media-play-badge" style="position:static;background:none;font-size:22px;">▶</span>` : `<img src="${g.tautan||''}" alt="${g.judul||''}" loading="lazy">`}
      <span style="position:absolute;bottom:6px;left:8px;color:#fff;font-size:11px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.6);">${g.judul||''}</span>
    </a>`).join('');
}

function renderPengumuman(list) {
  const wrap = document.getElementById('pengumuman-banner');
  if (!wrap || !list.length) return;
  wrap.innerHTML = list.map(p => `<div class="badge">${p.judul}</div>`).join(' ');
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('theme', cur);
  });
}

function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}
