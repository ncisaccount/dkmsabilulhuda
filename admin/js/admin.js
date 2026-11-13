/**
 * Fungsi bersama seluruh halaman Dashboard Admin/Operator.
 * Dimuat setelah ../../js/config.js dan ../../js/api.js.
 */

// Proteksi halaman: redirect ke login jika belum ada sesi (R12 gas-rahasia: batasi akses).
function guardAdmin_() {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; return null; }
  cekKoneksiBackendDanPeringatkan_(); // [ADDITIVE — audit lapangan] deteksi backend tidak terhubung sedini mungkin
  return Auth.getUser();
}

/**
 * [ADDITIVE — audit lapangan] Banner peringatan yang JELAS dan TERLIHAT (bukan
 * cuma di console) kapan pun backend tidak terhubung — baik karena GAS_URL
 * masih placeholder, atau Web App belum di-deploy ulang dengan versi terbaru,
 * atau sesi kedaluwarsa. Ini sering jadi akar "fitur tidak berfungsi" yang
 * sebenarnya adalah masalah konfigurasi/deployment, bukan bug kode.
 */
async function cekKoneksiBackendDanPeringatkan_() {
  const errKonfig = cekKonfigurasiGasUrl_();
  if (errKonfig) { tampilkanBannerKoneksi_(errKonfig); return; }
  const res = await Api.get('pengaturan'); // action publik ringan, cukup untuk tes konektivitas
  if (!res.success && !res.stale) {
    tampilkanBannerKoneksi_('Tidak dapat terhubung ke backend Apps Script. Pastikan: (1) URL di js/config.js benar, (2) Web App sudah di-"Deploy" ulang (Manage deployments → Edit → New version) setelah perubahan kode terbaru, (3) akses "Anyone" masih aktif. Detail teknis ada di konsol browser (tekan F12).');
  }
}
function tampilkanBannerKoneksi_(pesan) {
  if (document.getElementById('banner-koneksi')) return;
  const el = document.createElement('div');
  el.id = 'banner-koneksi';
  el.style.cssText = 'background:#BA1A1A;color:#fff;padding:10px 20px;font-size:13px;position:sticky;top:0;z-index:999;';
  el.innerHTML = '⚠️ <strong>Backend tidak terhubung:</strong> ' + pesan;
  document.body.prepend(el);
}

const MENU_ADMIN = [
  { href: 'index.html', label: 'Dashboard', icon: '📊' },
  { href: 'konten.html?modul=berita', label: 'Berita & Artikel', icon: '📰' },
  { href: 'konten.html?modul=agenda', label: 'Agenda & Event', icon: '📆' },
  { href: 'konten.html?modul=kajian', label: 'Kajian Mingguan', icon: '📖' },
  { href: 'konten.html?modul=pengumuman', label: 'Pengumuman', icon: '📢' },
  { href: 'konten.html?modul=galeri', label: 'Galeri Media', icon: '🖼' },
  { href: 'konten.html?modul=program', label: 'Program Masjid', icon: '🗂' },
  { href: 'konten.html?modul=pengurus', label: 'Pengurus', icon: '👥' },
  { href: 'konten.html?modul=imam', label: 'Imam & Penceramah', icon: '🕌' },
];
const MENU_ADMIN_ONLY = [
  { href: 'pengguna.html', label: 'Pengguna & Hak Akses', icon: '🔐' },
  { href: 'profil-website.html', label: 'Edit Profil Website', icon: '📝' },
  { href: 'pengaturan.html', label: 'Pengaturan Situs', icon: '⚙️' },
];
// [ADDITIVE v2 — Modul 06] tersedia untuk Admin maupun Operator (profil milik sendiri).
const MENU_SEMUA_PERAN = [
  { href: 'profil-saya.html', label: 'Edit Profil Saya', icon: '👤' },
];

// [ADDITIVE v2 — Modul 05] Terapkan logo dashboard admin jika sudah diatur.
async function terapkanLogoDashboard_() {
  const res = await Api.get('pengaturan');
  if (!res.success) return;
  const map = {}; res.data.forEach(r => map[r.key] = r.value);
  const img = document.getElementById('admin-logo-img');
  const txt = document.getElementById('admin-logo-text');
  if (img && map.logo_dashboard) { img.src = map.logo_dashboard; img.style.display = 'block'; if (txt) txt.style.display = 'none'; }
}

function renderSidebar_(activeHref) {
  terapkanLogoDashboard_();
  const user = Auth.getUser();
  const nav = document.getElementById('admin-nav');
  if (!nav || !user) return;
  let html = MENU_ADMIN.map(m => `<a href="${m.href}" class="${activeHref.indexOf(m.href.split('?')[0])===0 && activeHref.includes(m.href.split('modul=')[1]||'___')?'active':''}">${m.icon} ${m.label}</a>`).join('');
  if (user.peran === 'admin') {
    html += `<div class="group-label">Khusus Administrator</div>`;
    html += MENU_ADMIN_ONLY.map(m => `<a href="${m.href}" class="${activeHref===m.href?'active':''}">${m.icon} ${m.label}</a>`).join('');
  }
  html += `<div class="group-label">Akun Saya</div>`;
  html += MENU_SEMUA_PERAN.map(m => `<a href="${m.href}" class="${activeHref===m.href?'active':''}">${m.icon} ${m.label}</a>`).join('');
  nav.innerHTML = html;

  const userBox = document.getElementById('admin-user-box');
  if (userBox) {
    userBox.innerHTML = `
      <div class="avatar">${user.nama.charAt(0)}</div>
      <div><strong>${user.nama}</strong><div style="color:var(--text-muted);text-transform:capitalize;">${user.peran}</div></div>
      <button class="icon-btn" id="btn-logout" title="Keluar">⎋</button>`;
    document.getElementById('btn-logout').addEventListener('click', () => { Auth.logout(); window.location.href = 'login.html'; });
  }
}

function labelStatus(status) {
  const map = { draf: 'Draf', terbit: 'Terbit', ditolak: 'Ditolak', aktif: 'Aktif', nonaktif: 'Nonaktif' };
  return `<span class="badge-status badge-${status}">${map[status] || status || '-'}</span>`;
}

function tampilkanToast(msg, sukses = true) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:10px;color:#fff;z-index:500;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.2);';
    document.body.appendChild(t);
  }
  t.style.background = sukses ? '#1C5B4B' : '#BA1A1A';
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = 'none', 3000);
}
