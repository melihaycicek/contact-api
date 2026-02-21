/**
 * Submissions Sayfası – Filtreleme, liste, detay, export
 */
const SubmissionsPage = {
  channels: [],
  currentFilters: {},

  render() {
    return UI.layout('submissions', `
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Gönderiler</h2>
        <button id="btn-export" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          📥 CSV Export
        </button>
      </div>

      <!-- Filtreler -->
      <div class="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Kanal</label>
            <select id="f-channel" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Tümü</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Başlangıç</label>
            <input type="date" id="f-from" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Bitiş</label>
            <input type="date" id="f-to" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Bildirim Durumu</label>
            <select id="f-notified" class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <option value="">Tümü</option>
              <option value="0">Bildirilmemiş</option>
              <option value="1">Bildirilmiş</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Anahtar Kelime</label>
            <div class="flex gap-2">
              <input type="text" id="f-keyword" placeholder="Ara..." class="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <button id="btn-filter" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm">Filtrele</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tablo -->
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div id="submissions-table" class="overflow-x-auto">
          <div class="p-8 text-center text-gray-400">Yükleniyor...</div>
        </div>
      </div>

      <!-- Sayfalama -->
      <div id="pagination" class="flex items-center justify-between mt-4"></div>
    `);
  },

  async bind() {
    UI.bindLayoutEvents();

    // Kanalları yükle (filtre dropdown)
    try {
      this.channels = await API.get('/channels');
      const select = document.getElementById('f-channel');
      this.channels.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.name || `Channel #${ch.id}`;
        select.appendChild(opt);
      });
    } catch {}

    // Filter butonu
    document.getElementById('btn-filter').addEventListener('click', () => this.applyFilters());

    // Enter ile filtreleme
    document.getElementById('f-keyword').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyFilters();
    });

    // Export
    document.getElementById('btn-export').addEventListener('click', () => this.exportCsv());

    // İlk yükleme
    await this.loadSubmissions();
  },

  getFilters(page = 1) {
    return {
      channel_id: document.getElementById('f-channel').value,
      from: document.getElementById('f-from').value,
      to: document.getElementById('f-to').value,
      notified: document.getElementById('f-notified').value,
      keyword: document.getElementById('f-keyword').value,
      page,
      limit: 25
    };
  },

  async applyFilters(page = 1) {
    await this.loadSubmissions(page);
  },

  async loadSubmissions(page = 1) {
    const filters = this.getFilters(page);
    this.currentFilters = filters;

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    try {
      const result = await API.get('/submissions?' + params.toString());
      this.renderTable(result.data, result.pagination);
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  },

  renderTable(data, pagination) {
    const container = document.getElementById('submissions-table');

    if (data.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-gray-400">Kayıt bulunamadı.</div>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = `
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">ID</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Kanal</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Ad</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Email</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Mesaj</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">IP</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Bildirim</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Tarih</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">İşlem</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${data.map(row => `
            <tr class="hover:bg-gray-50">
              <td class="p-4 text-sm text-gray-600">${row.id}</td>
              <td class="p-4 text-sm">${UI.badge(row.channel_name || '#' + row.channel_id, 'indigo')}</td>
              <td class="p-4 text-sm text-gray-800">${this.esc(row.name)}</td>
              <td class="p-4 text-sm text-gray-600">${this.esc(row.email)}</td>
              <td class="p-4 text-sm text-gray-600 max-w-xs truncate" title="${this.esc(row.message)}">${this.esc(row.message).substring(0, 50)}${row.message && row.message.length > 50 ? '...' : ''}</td>
              <td class="p-4 text-sm text-gray-500 font-mono text-xs">${row.ip_address || '-'}</td>
              <td class="p-4 text-sm">
                ${row.notified ? UI.badge('Bildirildi', 'green') : UI.badge('Bekliyor', 'yellow')}
              </td>
              <td class="p-4 text-sm text-gray-600">${UI.formatDate(row.created_at)}</td>
              <td class="p-4 text-sm">
                <div class="flex gap-2">
                  <button class="sub-detail text-indigo-600 hover:text-indigo-800 text-xs font-medium" data-id="${row.id}">Detay</button>
                  ${!row.notified ? `<button class="sub-notify text-green-600 hover:text-green-800 text-xs font-medium" data-id="${row.id}">✓ Bildir</button>` : ''}
                  <button class="sub-delete text-red-600 hover:text-red-800 text-xs font-medium" data-id="${row.id}">Sil</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Sayfalama
    this.renderPagination(pagination);
    this.bindTableEvents();
  },

  renderPagination(p) {
    const container = document.getElementById('pagination');
    if (p.totalPages <= 1) {
      container.innerHTML = `<span class="text-sm text-gray-500">Toplam ${p.total} kayıt</span>`;
      return;
    }

    let pages = '';
    for (let i = 1; i <= p.totalPages; i++) {
      pages += `<button class="pag-btn px-3 py-1 rounded text-sm ${i === p.page ? 'bg-indigo-600 text-white' : 'bg-white border hover:bg-gray-50'}" data-page="${i}">${i}</button>`;
    }

    container.innerHTML = `
      <span class="text-sm text-gray-500">Toplam ${p.total} kayıt (Sayfa ${p.page}/${p.totalPages})</span>
      <div class="flex gap-1">${pages}</div>
    `;

    container.querySelectorAll('.pag-btn').forEach(btn => {
      btn.addEventListener('click', () => this.applyFilters(parseInt(btn.dataset.page)));
    });
  },

  bindTableEvents() {
    // Detay
    document.querySelectorAll('.sub-detail').forEach(btn => {
      btn.addEventListener('click', () => this.showDetail(btn.dataset.id));
    });

    // Bildir (notified=1)
    document.querySelectorAll('.sub-notify').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await API.put(`/submissions/${btn.dataset.id}/notify`);
          UI.toast('Bildirim durumu güncellendi.');
          await this.loadSubmissions(this.currentFilters.page || 1);
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });

    // Sil
    document.querySelectorAll('.sub-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
        try {
          await API.delete(`/submissions/${btn.dataset.id}`);
          UI.toast('Kayıt silindi.');
          await this.loadSubmissions(this.currentFilters.page || 1);
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });
  },

  async showDetail(id) {
    try {
      const sub = await API.get(`/submissions/${id}`);
      const formData = sub.form_data || {};

      const fieldsHtml = Object.entries(formData).map(([key, val]) =>
        `<tr class="border-b">
          <td class="py-2 pr-4 text-sm font-medium text-gray-600">${this.esc(key)}</td>
          <td class="py-2 text-sm text-gray-800">${this.esc(String(val))}</td>
        </tr>`
      ).join('');

      UI.showModal(`Gönderim #${sub.id}`, `
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div><span class="text-gray-500">Kanal:</span> <strong>${sub.channel_name || '#' + sub.channel_id}</strong></div>
            <div><span class="text-gray-500">IP:</span> <code class="bg-gray-100 px-1 rounded">${sub.ip_address}</code></div>
            <div><span class="text-gray-500">Tarih:</span> ${UI.formatDate(sub.created_at)}</div>
            <div><span class="text-gray-500">Bildirim:</span> ${sub.notified ? UI.badge('Bildirildi', 'green') : UI.badge('Bekliyor', 'yellow')}</div>
            ${sub.notified_at ? `<div><span class="text-gray-500">Bildirim Tarihi:</span> ${UI.formatDate(sub.notified_at)}</div>` : ''}
          </div>
          <hr>
          <h4 class="font-medium text-gray-700">Form Verileri</h4>
          <table class="w-full">${fieldsHtml}</table>
          <hr>
          <details>
            <summary class="text-xs text-gray-500 cursor-pointer">Ham JSON</summary>
            <pre class="mt-2 bg-gray-50 p-3 rounded text-xs overflow-auto max-h-48">${JSON.stringify(formData, null, 2)}</pre>
          </details>
        </div>
      `);

    } catch (err) {
      UI.toast(err.message, 'error');
    }
  },

  async exportCsv() {
    const filters = this.getFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && k !== 'page' && k !== 'limit') params.set(k, v);
    });

    try {
      await API.exportCsv('?' + params.toString());
      UI.toast('CSV dosyası indiriliyor...');
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  },

  esc(text) {
    const div = document.createElement('div');
    div.textContent = text || '-';
    return div.innerHTML;
  }
};
