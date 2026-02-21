/**
 * Basit hash router – SPA sayfa yönetimi
 */
const Router = {
  currentPage: null,

  pages: {
    login: LoginPage,
    dashboard: DashboardPage,
    channels: ChannelsPage,
    submissions: SubmissionsPage
  },

  navigate(page) {
    if (!this.pages[page]) page = 'dashboard';

    // Auth kontrolü
    if (page !== 'login' && !API.isLoggedIn()) {
      page = 'login';
    }

    this.currentPage = page;
    window.location.hash = page;

    const app = document.getElementById('app');
    const pageObj = this.pages[page];

    app.innerHTML = pageObj.render();
    if (pageObj.bind) pageObj.bind();
  },

  init() {
    // Hash değişikliğini dinle
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.replace('#', '') || 'dashboard';
      if (page !== this.currentPage) {
        this.navigate(page);
      }
    });

    // İlk yükleme
    const initialPage = window.location.hash.replace('#', '') || 'dashboard';
    this.navigate(initialPage);
  }
};
