/**
 * ============================================================================
 * API CLIENT — pola gas-pro-api & gas-instant-ux-pro
 * - GET  : fetch biasa, dengan cache ringan di localStorage (SWR sederhana).
 * - POST : WAJIB Content-Type text/plain agar tidak memicu CORS preflight.
 * ============================================================================
 */
// [PERBAIKAN — audit lapangan] GAS_URL placeholder yang belum diganti adalah
// penyebab paling umum "fitur tidak berfungsi sama sekali" tanpa pesan jelas.
// Deteksi ini SEKALI di awal dan beri pesan yang jujur, bukan error jaringan generik.
function cekKonfigurasiGasUrl_() {
  if (!GAS_URL || GAS_URL.indexOf('GANTI_DENGAN') !== -1) {
    return 'js/config.js belum diisi dengan URL Web App Apps Script yang sebenarnya (masih berisi teks placeholder "GANTI_DENGAN_DEPLOYMENT_ID_ANDA"). Fitur apa pun yang memanggil backend TIDAK AKAN berfungsi sampai ini diperbaiki.';
  }
  return null;
}

const Api = {
  async get(action, params = {}) {
    const errKonfig = cekKonfigurasiGasUrl_();
    if (errKonfig) { console.error('[Api.get]', errKonfig); return { success: false, message: errKonfig }; }
    const qs = new URLSearchParams({ action, ...params }).toString();
    const cacheKey = 'cache_' + action + '_' + qs;
    const cached = localStorage.getItem(cacheKey);
    // SWR: tampilkan data lama dulu (dipanggil oleh caller), lalu refresh di background.
    try {
      const res = await fetch(`${GAS_URL}?${qs}`, { redirect: 'follow' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.success) console.error('[Api.get]', action, json.message);
      if (json.success) localStorage.setItem(cacheKey, JSON.stringify({ data: json.data, t: Date.now() }));
      return json;
    } catch (err) {
      console.error('[Api.get] gagal memanggil action="' + action + '":', err);
      if (cached) return { success: true, data: JSON.parse(cached).data, stale: true };
      return { success: false, message: 'Tidak dapat terhubung ke server (' + err.message + '). Periksa konsol browser (F12) untuk detail, dan pastikan GAS_URL di js/config.js benar & Web App sudah di-deploy ulang.' };
    }
  },

  getCached(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const cached = localStorage.getItem('cache_' + action + '_' + qs);
    return cached ? JSON.parse(cached).data : null;
  },

  async post(action, data = {}) {
    const errKonfig = cekKonfigurasiGasUrl_();
    if (errKonfig) { console.error('[Api.post]', errKonfig); return { success: false, message: errKonfig }; }
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // wajib, lihat gas-pro-api
        body: JSON.stringify({ action, token: Auth.getToken(), ...data })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.success) console.error('[Api.post]', action, json.message);
      return json;
    } catch (err) {
      console.error('[Api.post] gagal memanggil action="' + action + '":', err);
      return { success: false, message: 'Gagal mengirim data (' + err.message + '). Periksa konsol browser (F12) untuk detail, dan pastikan GAS_URL di js/config.js benar & Web App sudah di-deploy ulang dengan versi terbaru.' };
    }
  }
};

const Auth = {
  getToken() { return localStorage.getItem('dkm_token') || ''; },
  getUser() { try { return JSON.parse(localStorage.getItem('dkm_user') || 'null'); } catch (e) { return null; } },
  setSession(token, user) {
    localStorage.setItem('dkm_token', token);
    localStorage.setItem('dkm_user', JSON.stringify(user));
  },
  logout() { localStorage.removeItem('dkm_token'); localStorage.removeItem('dkm_user'); },
  isLoggedIn() { return !!this.getToken(); }
};

// Catat kunjungan halaman (ringan, tidak memblokir render — Prinsip A gas-scale-turbo).
function catatKunjunganHalaman(nama) {
  Api.post('catatKunjungan', { halaman: nama }).catch(() => {});
}

function formatTanggalIndo(iso) {
  if (!iso) return '';
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${d.getDate()} ${bln[d.getMonth()]} ${d.getFullYear()}`;
}
