/**
 * Login Sayfası
 */
const LoginPage = {
  render() {
    return `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
        <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm fade-in">
          <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">📬 Contact API</h1>
            <p class="text-gray-500 text-sm mt-1">Admin Panel Girişi</p>
          </div>
          <form id="login-form">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
              <input type="text" id="login-username" required
                     class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                     placeholder="admin">
            </div>
            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input type="password" id="login-password" required
                     class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                     placeholder="••••••">
            </div>
            <div id="login-error" class="hidden mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm"></div>
            <button type="submit" id="login-btn"
                    class="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    `;
  },

  bind() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const errBox = document.getElementById('login-error');
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;

      btn.disabled = true;
      btn.textContent = 'Giriş yapılıyor...';
      errBox.classList.add('hidden');

      try {
        await Auth.login(username, password);
        Router.navigate('dashboard');
      } catch (err) {
        errBox.textContent = err.message;
        errBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Giriş Yap';
      }
    });
  }
};
