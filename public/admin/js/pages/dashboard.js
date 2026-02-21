/**
 * Dashboard Sayfası
 */
const DashboardPage = {
  render() {
    return UI.layout('dashboard', `
      <h2 class="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      <div id="stats-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
          <div class="h-8 bg-gray-200 rounded w-16 mb-2"></div>
          <div class="h-4 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    `);
  },

  async bind() {
    UI.bindLayoutEvents();

    try {
      const stats = await API.get('/submissions/stats/overview');
      document.getElementById('stats-grid').innerHTML = `
        <div class="bg-white rounded-xl p-6 shadow-sm border fade-in">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-3xl font-bold text-gray-800">${stats.totalSubmissions}</p>
              <p class="text-sm text-gray-500 mt-1">Toplam Gönderim</p>
            </div>
            <div class="text-3xl">📨</div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border fade-in">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-3xl font-bold text-yellow-600">${stats.unnotifiedSubmissions}</p>
              <p class="text-sm text-gray-500 mt-1">Bildirim Bekleyen</p>
            </div>
            <div class="text-3xl">🔔</div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border fade-in">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-3xl font-bold text-green-600">${stats.todaySubmissions}</p>
              <p class="text-sm text-gray-500 mt-1">Bugün</p>
            </div>
            <div class="text-3xl">📅</div>
          </div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border fade-in">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-3xl font-bold text-indigo-600">${stats.activeChannels}</p>
              <p class="text-sm text-gray-500 mt-1">Aktif Kanal</p>
            </div>
            <div class="text-3xl">📡</div>
          </div>
        </div>
      `;
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }
};
