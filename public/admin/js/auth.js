/**
 * Basit auth state yönetimi
 */
const Auth = {
  getUsername() {
    return localStorage.getItem('admin_username') || 'Admin';
  },

  async login(username, password) {
    const data = await API.post('/auth/login', { username, password });
    API.setToken(data.token);
    localStorage.setItem('admin_username', data.username);
    return data;
  }
};
