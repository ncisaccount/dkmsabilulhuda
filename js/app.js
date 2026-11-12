/**
 * Logic khusus halaman Beranda (index.html).
 * Mengambil satu bundle gabungan (action=beranda) agar hemat panggilan API
 * sesuai mitigasi kuota GAS di PRD Bagian 6.
 */
const NAMA_SALAT = { subuh: 'Subuh', zuhur: 'Dzuhur', ashar: 'Ashar', maghrib: 'Maghrib', isya: 'Isya' };
const URUTAN_SALAT = ['subuh', 'zuhur', 'ashar', 'maghrib', 'isya'];
// [ADDITIVE v2 — Modul 03] waktu tambahan (imsak/terbit/dhuha) ditampilkan terpisah,
// tidak ikut dihitung dalam countdown "menuju waktu salat wajib berikutnya" di atas.
const NAMA_SALAT_TAMBAHAN = { imsak: 'Imsak', terbit: 'Terbit', dhuha: 'Dhuha' };

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

function renderJadwalSalat(jadwal) {
  const wrap = document.getElementById('jadwal-salat-list');
  if (!wrap) return;
  const tgl = document.getElementById('tanggal-hari-ini');
  if (tgl) {
    const hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
    tgl.textContent = `${hari}, ${formatTanggalIndo(new Date().toISOString())}`;
  }
  const sekarang = new Date();
  const menitSekarang = sekarang.getHours() * 60 + sekarang.getMinutes();

  let waktuNext = null, selisihMin = Infinity;
  const rows = URUTAN_SALAT.map(key => {
    const [h, m] = String(jadwal[key] || '00:00').split(':').map(Number);
    const menit = h * 60 + m;
    let delta = menit - menitSekarang;
    if (delta < 0) delta += 24 * 60; // sudah lewat -> hitung ke besok
    if (delta < selisihMin) { selisihMin = delta; waktuNext = key; }
    return { key, label: NAMA_SALAT[key], jam: jadwal[key] };
  });

  wrap.innerHTML = rows.map(r => `
    <div class="prayer-row ${r.key === waktuNext ? 'active' : ''}">
      <span>${r.label}</span>
      <span class="time">${r.jam}</span>
    </div>`).join('');

  const jam = Math.floor(selisihMin / 60), menit = selisihMin % 60;
  const countdown = document.getElementById('prayer-countdown');
  if (countdown) countdown.textContent = `Menuju ${NAMA_SALAT[waktuNext]} ± ${jam}j ${menit}m lagi`;

  // [ADDITIVE v2 — Modul 03] tampilkan Imsak/Terbit/Dhuha (jika sudah tersinkron)
  // dan tanggal Hijriah, TANPA mengubah logika countdown waktu wajib di atas.
  const tambahan = Object.keys(NAMA_SALAT_TAMBAHAN).filter(k => jadwal[k]);
  if (tambahan.length) {
    wrap.insertAdjacentHTML('afterbegin', tambahan.map(k => `
      <div class="prayer-row" style="opacity:.75;font-size:13px;"><span>${NAMA_SALAT_TAMBAHAN[k]}</span><span class="time">${jadwal[k]}</span></div>`).join(''));
  }
  const hijriahEl = document.getElementById('jadwal-hijriah');
  if (hijriahEl && jadwal.hijriah) hijriahEl.textContent = jadwal.hijriah;
}

function renderInfoSinkronJadwal(info) {
  const el = document.getElementById('jadwal-sinkron-info');
  if (!el) return;
  if (info.sinkronTerakhir) {
    el.textContent = 'Data Kemenag via myquran.com • sinkron terakhir: ' + formatTanggalIndo(info.sinkronTerakhir);
  } else {
    el.textContent = 'Jadwal belum pernah disinkronkan otomatis — hubungi Administrator.';
  }
  if (info.sinkronGagalTerakhir) {
    el.textContent += ' ⚠️ Percobaan sinkron terakhir gagal, menampilkan data valid terakhir.';
  }
}

function renderBerita(list) {
  const wrap = document.getElementById('berita-list');
  if (!wrap) return;
  if (!list.length) { wrap.innerHTML = '<div class="empty-state">Belum ada berita.</div>'; return; }
  wrap.innerHTML = list.map(b => `
    <a class="card" href="berita-detail.html?slug=${encodeURIComponent(b.slug || '')}">
      <div class="media-frame media-frame--16x9 media-frame--crop">${b.gambar ? `<img src="${b.gambar}" alt="${b.judul}" loading="lazy">` : ''}</div>
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
  // [ADDITIVE v2 — Modul 02] thumbnail tetap pakai mode crop (sesuai untuk grid galeri),
  // tautan ke halaman Galeri lengkap untuk pemutaran video penuh di dalam frame.
  wrap.innerHTML = list.map(g => `
    <a class="g-item media-frame media-frame--1x1 media-frame--crop" href="galeri.html" style="position:relative;">
      ${g.jenis === 'video' ? `<video src="${g.tautan||''}" muted></video><span class="media-play-badge">▶</span>` : `<img src="${g.tautan||''}" alt="${g.judul||''}" loading="lazy">`}
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
