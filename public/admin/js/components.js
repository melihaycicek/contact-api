/**
 * Yeniden kullanılabilir UI bileşenleri
 */
const UI = {
  /** Bildirim toast göster */
  toast(message, type = 'success') {
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };

    const el = document.createElement('div');
    el.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white shadow-lg fade-in ${colors[type] || colors.info}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  /** Ana layout (sidebar + content) */
  layout(activePage, content) {
    const menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: '📊' },
      { id: 'channels', label: 'Kanallar', icon: '📡' },
      { id: 'submissions', label: 'Gönderiler', icon: '📨' }
    ];

    return `
      <div class="flex h-screen">
        <!-- Sidebar -->
        <aside class="w-64 bg-indigo-700 text-white flex flex-col flex-shrink-0">
          <div class="p-6">
            <h1 class="text-xl font-bold">📬 Contact API</h1>
            <p class="text-indigo-200 text-sm mt-1">Admin Panel</p>
          </div>
          <nav class="flex-1 px-3">
            ${menuItems.map(item => `
              <a href="#" data-page="${item.id}"
                 class="flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors
                        ${activePage === item.id ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-600 hover:text-white'}">
                <span>${item.icon}</span>
                <span>${item.label}</span>
              </a>
            `).join('')}
          </nav>
          <div class="p-4 border-t border-indigo-600">
            <div class="flex items-center justify-between">
              <span class="text-sm text-indigo-200">👤 ${Auth.getUsername()}</span>
              <button id="btn-logout" class="text-xs text-indigo-300 hover:text-white">Çıkış</button>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 overflow-auto">
          <div class="p-8">
            ${content}
          </div>
        </main>
      </div>
    `;
  },

  /** Bind layout events */
  bindLayoutEvents() {
    // Sidebar navigation
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        Router.navigate(el.dataset.page);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => API.logout());
    }
  },

  /** Modal */
  showModal(title, bodyHtml, footerHtml = '') {
    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-40 fade-in';
    overlay.innerHTML = `
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between p-6 border-b">
          <h3 class="text-lg font-semibold">${title}</h3>
          <button id="modal-close" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div class="p-6 overflow-auto flex-1">${bodyHtml}</div>
        ${footerHtml ? `<div class="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">${footerHtml}</div>` : ''}
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    return overlay;
  },

  closeModal() {
    const m = document.getElementById('modal-overlay');
    if (m) m.remove();
  },

  /** Tarih formatlama */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  },

  /** Badge */
  badge(text, color = 'gray') {
    const colors = {
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      gray: 'bg-gray-100 text-gray-700',
      blue: 'bg-blue-100 text-blue-700',
      indigo: 'bg-indigo-100 text-indigo-700'
    };
    return `<span class="px-2 py-1 rounded-full text-xs font-medium ${colors[color] || colors.gray}">${text}</span>`;
  },

  /** Kopyala butonu */
  copyButton(text, label = 'Kopyala') {
    return `<button class="copy-btn text-xs text-indigo-600 hover:text-indigo-800" data-copy="${text}">${label}</button>`;
  },

  bindCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.copy).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ Kopyalandı';
          setTimeout(() => btn.textContent = orig, 1500);
        });
      });
    });
  }
};
