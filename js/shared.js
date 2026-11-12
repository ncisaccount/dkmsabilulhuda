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

async function muatPengaturanSitusGlobal_() {
  try {
    const res = await Api.get('pengaturan');
    if (res.success) terapkanPengaturanUmum_(res.data);
  } catch (e) { /* biarkan fallback teks statis tampil */ }
}
