/**
 * ============================================================================
 * API CLIENT — pola gas-pro-api & gas-instant-ux-pro
 * - GET  : fetch biasa, dengan cache ringan di localStorage (SWR sederhana).
 * - POST : WAJIB Content-Type text/plain agar tidak memicu CORS preflight.
 * ============================================================================
 */
const Api = {
  async get(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const cacheKey = 'cache_' + action + '_' + qs;
    const cached = localStorage.getItem(cacheKey);
    // SWR: tampilkan data lama dulu (dipanggil oleh caller), lalu refresh di background.
    try {
      const res = await fetch(`${GAS_URL}?${qs}`, { redirect: 'follow' });
      const json = await res.json();
      if (json.success) localStorage.setItem(cacheKey, JSON.stringify({ data: json.data, t: Date.now() }));
      return json;
    } catch (err) {
      if (cached) return { success: true, data: JSON.parse(cached).data, stale: true };
      return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' };
    }
  },

  getCached(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const cached = localStorage.getItem('cache_' + action + '_' + qs);
    return cached ? JSON.parse(cached).data : null;
  },

  async post(action, data = {}) {
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // wajib, lihat gas-pro-api
        body: JSON.stringify({ action, token: Auth.getToken(), ...data })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: 'Gagal mengirim data. Periksa koneksi internet Anda.' };
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
