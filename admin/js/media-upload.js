/**
 * ============================================================================
 * MEDIA-UPLOAD.JS — Komponen Upload Media Universal  [ADDITIVE, BARU]
 * ----------------------------------------------------------------------------
 * Satu komponen dipakai ulang di semua form Tambah/Edit Konten agar mekanisme
 * upload selalu konsisten (Modul 01.D — Universal Media Component).
 *
 * Pemakaian:
 *   <div id="upload-xxx"></div>
 *   <script>
 *     const widget = initMediaUpload('upload-xxx', { kategori: 'berita', multiple: false, accept: 'image/*' });
 *     // ambil hasil saat submit form:
 *     const urlTerpilih = widget.getValue(); // string URL, atau array jika multiple:true
 *     widget.setValue('https://...'); // untuk mode edit (tampilkan media yang sudah ada)
 *   </script>
 * ============================================================================
 */
// Duplikasi kecil yang disengaja dari frontend/js/shared.js (konteks admin
// terpisah dari frontend publik, lebih aman daripada membuat admin.js
// bergantung ke folder publik). Logikanya harus selalu sama persis — lihat
// shared.js untuk komentar lengkap soal kenapa tiap cabang ada.
function renderMediaFrame_(url) {
  if (!url) return '';
  if (/[?&]action=media/.test(url) && /[?&]tipe=video/.test(url)) {
    return `<video controls preload="metadata" style="width:100%;height:100%;background:#000;"><source src="${url}"></video>`;
  }
  if (/drive\.google\.com\/file\/.+\/preview/.test(url)) {
    return `<iframe src="${url}" style="width:100%;height:100%;border:0;" allow="autoplay" allowfullscreen></iframe>`;
  }
  if (/youtube\.com|youtu\.be/.test(url)) {
    const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) || url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    const embedUrl = m ? 'https://www.youtube.com/embed/' + m[1] : url;
    return `<iframe src="${embedUrl}" style="width:100%;height:100%;border:0;" allow="autoplay" allowfullscreen></iframe>`;
  }
  const idDrive = (url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]{15,})/) || [])[1];
  if (idDrive) return `<iframe src="https://drive.google.com/file/d/${idDrive}/preview" style="width:100%;height:100%;border:0;" allow="autoplay" allowfullscreen></iframe>`;
  return `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
}

function initMediaUpload(containerId, opts) {
  opts = Object.assign({ kategori: 'lainnya', multiple: false, accept: 'image/*,video/mp4,video/webm' }, opts || {});
  const root = document.getElementById(containerId);
  if (!root) return null;

  let items = []; // { url, jenis, mediaId, namaFile, uploading, progress, error }

  root.innerHTML = `
    <div class="mu-dropzone" tabindex="0">
      <div class="mu-dropzone-label">📤 <strong>Upload Foto/Video</strong><br><span style="font-size:12px;color:var(--text-muted);">Klik atau seret berkas ke sini (JPG, PNG, WEBP, MP4 — maks 25MB)</span></div>
      <input type="file" class="mu-input" accept="${opts.accept}" ${opts.multiple ? 'multiple' : ''} style="display:none;">
    </div>
    <div class="mu-preview-list"></div>
    <div class="mu-manual-url"><label style="font-size:12px;">Atau tempel URL media secara manual:</label><input type="url" class="mu-manual-input" placeholder="https://..."></div>
  `;

  const dropzone = root.querySelector('.mu-dropzone');
  const input = root.querySelector('.mu-input');
  const previewList = root.querySelector('.mu-preview-list');
  const manualInput = root.querySelector('.mu-manual-input');

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault(); dropzone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', (e) => handleFiles(e.target.files));
  manualInput.addEventListener('input', () => {
    if (manualInput.value) { items = [{ url: manualInput.value, jenis: 'manual' }]; renderPreview(); }
  });

  function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!opts.multiple) items = []; // mode tunggal: ganti yang lama
    files.forEach(uploadSatuFile);
  }

  function uploadSatuFile(file) {
    if (file.size > 25 * 1024 * 1024) { tampilkanToast('Berkas "' + file.name + '" melebihi 25MB.', false); return; }
    const itemIdx = items.length;
    const item = { url: '', jenis: file.type.startsWith('video/') ? 'video' : 'gambar', namaFile: file.name, uploading: true, progress: 10, previewLocal: URL.createObjectURL(file) };
    items.push(item);
    renderPreview();

    const reader = new FileReader();
    reader.onprogress = (e) => { if (e.lengthComputable) { item.progress = Math.round((e.loaded / e.total) * 60); renderPreview(); } };
    reader.onload = async () => {
      item.progress = 70; renderPreview();
      const base64 = reader.result.split(',')[1];
      const res = await Api.post('uploadMedia', {
        namaFileAsli: file.name, mimeType: file.type, base64Data: base64, kategori: opts.kategori
      });
      if (res.success) {
        item.url = res.data.displayUrl || res.data.driveUrl;
        item.mediaId = res.data.mediaId;
        item.uploading = false; item.progress = 100;
        if (!res.data.publikDapatMelihat) item.peringatan = 'Berkas tersimpan, namun berbagi publik mungkin dibatasi kebijakan Drive organisasi Anda.';
        tampilkanToast('✅ "' + file.name + '" berhasil diunggah.', true);
      } else {
        item.uploading = false; item.error = res.message;
        tampilkanToast('⚠️ Upload "' + file.name + '" gagal: ' + res.message, false);
      }
      renderPreview();
    };
    reader.onerror = () => { item.uploading = false; item.error = 'Gagal membaca berkas.'; renderPreview(); };
    reader.readAsDataURL(file);
  }

  function hapusItem(idx) {
    const item = items[idx];
    if (item.mediaId) Api.post('hapusMedia', { mediaId: item.mediaId }).catch(() => {});
    items.splice(idx, 1);
    renderPreview();
  }

  function renderPreview() {
    if (!items.length) { previewList.innerHTML = ''; return; }
    previewList.innerHTML = items.map((it, i) => `
      <div class="mu-preview-item">
        ${it.previewLocal
          ? (it.jenis === 'video' ? `<video src="${it.previewLocal}" muted></video>` : `<img src="${it.previewLocal}" alt="">`)
          // Berkas yang SUDAH tersimpan di Drive: video pakai iframe /preview resmi
          // (lihat catatan Media.gs), bukan <video src> yang tidak andal untuk Drive.
          : `<div style="width:100%;height:70px;">${renderMediaFrame_(it.url)}</div>`}
        <div class="mu-preview-info">
          <span style="font-size:12px;">${it.namaFile || it.url || ''}</span>
          ${it.uploading ? `<div class="mu-progress"><div class="mu-progress-bar" style="width:${it.progress}%;"></div></div>` : ''}
          ${it.error ? `<span style="color:var(--error);font-size:11px;">⚠️ ${it.error}</span>` : ''}
          ${it.peringatan ? `<span style="color:#9A7528;font-size:11px;">⚠️ ${it.peringatan}</span>` : ''}
        </div>
        <button type="button" class="mu-remove" data-i="${i}">✕</button>
      </div>`).join('');
    previewList.querySelectorAll('.mu-remove').forEach(btn => btn.addEventListener('click', () => hapusItem(Number(btn.getAttribute('data-i')))));
  }

  return {
    getValue() {
      const urls = items.filter(it => it.url).map(it => it.url);
      return opts.multiple ? urls : (urls[0] || '');
    },
    setValue(urlAwal) {
      if (!urlAwal) return;
      // [PERBAIKAN BUG — audit lapangan] deteksi berbasis ekstensi file gagal untuk
      // URL video Drive (`.../preview`, tanpa ekstensi sama sekali) — tambahkan
      // deteksi pola URL preview Drive sebagai video juga.
      const adalahVideo = /\.(mp4|webm|mov)(\?|$)/i.test(urlAwal) || /drive\.google\.com\/file\/.+\/preview/.test(urlAwal) || (/[?&]action=media/.test(urlAwal) && /[?&]tipe=video/.test(urlAwal));
      items = [{ url: urlAwal, jenis: adalahVideo ? 'video' : 'gambar' }];
      renderPreview();
    },
    isUploading() { return items.some(it => it.uploading); }
  };
}
