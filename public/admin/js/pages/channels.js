/**
 * Channels Yönetim Sayfası
 */
const ChannelsPage = {
  channels: [],

  render() {
    return UI.layout('channels', `
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Kanallar</h2>
        <button id="btn-add-channel" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          + Yeni Kanal
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div id="channels-table" class="overflow-x-auto">
          <div class="p-8 text-center text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    `);
  },

  async bind() {
    UI.bindLayoutEvents();

    document.getElementById('btn-add-channel').addEventListener('click', () => this.showAddModal());

    await this.loadChannels();
  },

  async loadChannels() {
    try {
      this.channels = await API.get('/channels');
      this.renderTable();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  },

  renderTable() {
    const container = document.getElementById('channels-table');

    if (this.channels.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-gray-400">Henüz kanal eklenmemiş.</div>';
      return;
    }

    container.innerHTML = `
      <table class="w-full">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">ID</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Ad</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Domain</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">API Key</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Durum</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Bildirim Email</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">Oluşturulma</th>
            <th class="text-left p-4 text-xs font-medium text-gray-500 uppercase">İşlemler</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          ${this.channels.map(ch => `
            <tr class="hover:bg-gray-50">
              <td class="p-4 text-sm text-gray-600">${ch.id}</td>
              <td class="p-4 text-sm font-medium text-gray-800">${ch.name || '-'}</td>
              <td class="p-4 text-sm text-gray-600">${ch.domain || '-'}</td>
              <td class="p-4 text-sm">
                <code class="bg-gray-100 px-2 py-1 rounded text-xs">${ch.api_key ? ch.api_key.substring(0, 16) + '...' : '-'}</code>
                ${UI.copyButton(ch.api_key)}
              </td>
              <td class="p-4 text-sm">
                ${ch.status === 'active' ? UI.badge('Aktif', 'green') : UI.badge('Devre Dışı', 'red')}
              </td>
              <td class="p-4 text-sm text-gray-600">${ch.notification_email || '-'}</td>
              <td class="p-4 text-sm text-gray-600">${UI.formatDate(ch.created_at)}</td>
              <td class="p-4 text-sm">
                <div class="flex gap-2">
                  <button class="ch-edit text-indigo-600 hover:text-indigo-800 text-xs font-medium" data-id="${ch.id}">Düzenle</button>
                  <button class="ch-regen text-yellow-600 hover:text-yellow-800 text-xs font-medium" data-id="${ch.id}">Key Yenile</button>
                  <button class="ch-toggle text-xs font-medium ${ch.status === 'active' ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}"
                          data-id="${ch.id}" data-status="${ch.status}">
                    ${ch.status === 'active' ? 'Devre Dışı' : 'Etkinleştir'}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    UI.bindCopyButtons();
    this.bindTableEvents();
  },

  bindTableEvents() {
    // Edit
    document.querySelectorAll('.ch-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = this.channels.find(c => c.id == btn.dataset.id);
        if (ch) this.showEditModal(ch);
      });
    });

    // Regenerate key
    document.querySelectorAll('.ch-regen').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('API key yenilenecek. Mevcut entegrasyonlar çalışmaz olur. Devam?')) return;
        try {
          const result = await API.post(`/channels/${btn.dataset.id}/regenerate-key`);
          UI.toast('API key yenilendi: ' + result.api_key.substring(0, 20) + '...');
          await this.loadChannels();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });

    // Toggle status
    document.querySelectorAll('.ch-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status === 'active' ? 'inactive' : 'active';
        try {
          await API.put(`/channels/${btn.dataset.id}`, { status: newStatus });
          UI.toast('Kanal durumu güncellendi.');
          await this.loadChannels();
        } catch (err) {
          UI.toast(err.message, 'error');
        }
      });
    });
  },

  showAddModal() {
    const modal = UI.showModal('Yeni Kanal Ekle', `
      <form id="channel-form">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Kanal Adı *</label>
          <input type="text" id="ch-name" required class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Kişisel Site">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Domain</label>
          <input type="text" id="ch-domain" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="example.com">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Bildirim Email</label>
          <input type="email" id="ch-email" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="admin@example.com">
        </div>
      </form>
    `, `
      <button id="ch-cancel" class="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm">İptal</button>
      <button id="ch-save" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Kaydet</button>
    `);

    modal.querySelector('#ch-cancel').addEventListener('click', () => UI.closeModal());
    modal.querySelector('#ch-save').addEventListener('click', async () => {
      const name = modal.querySelector('#ch-name').value;
      const domain = modal.querySelector('#ch-domain').value;
      const notification_email = modal.querySelector('#ch-email').value;

      if (!name) return UI.toast('Kanal adı gerekli.', 'error');

      try {
        const result = await API.post('/channels', { name, domain, notification_email });
        UI.closeModal();
        UI.toast(`Kanal oluşturuldu. API Key: ${result.api_key.substring(0, 20)}...`);
        await this.loadChannels();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  },

  showEditModal(ch) {
    const modal = UI.showModal('Kanal Düzenle', `
      <form id="channel-edit-form">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Kanal Adı</label>
          <input type="text" id="che-name" value="${ch.name || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Domain</label>
          <input type="text" id="che-domain" value="${ch.domain || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Bildirim Email</label>
          <input type="email" id="che-email" value="${ch.notification_email || ''}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
        </div>
      </form>
    `, `
      <button id="che-cancel" class="px-4 py-2 border rounded-lg hover:bg-gray-100 text-sm">İptal</button>
      <button id="che-save" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">Güncelle</button>
    `);

    modal.querySelector('#che-cancel').addEventListener('click', () => UI.closeModal());
    modal.querySelector('#che-save').addEventListener('click', async () => {
      try {
        await API.put(`/channels/${ch.id}`, {
          name: modal.querySelector('#che-name').value,
          domain: modal.querySelector('#che-domain').value,
          notification_email: modal.querySelector('#che-email').value
        });
        UI.closeModal();
        UI.toast('Kanal güncellendi.');
        await this.loadChannels();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    });
  }
};
