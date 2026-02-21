/**
 * API Client – Token yönetimi ve HTTP çağrıları
 */
const API = {
  baseUrl: '/admin/api',
  token: localStorage.getItem('admin_token') || null,

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('admin_token', token);
    } else {
      localStorage.removeItem('admin_token');
    }
  },

  isLoggedIn() {
    return !!this.token;
  },

  logout() {
    this.setToken(null);
    localStorage.removeItem('admin_username');
    Router.navigate('login');
  },

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (this.token) {
      opts.headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (body) {
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(this.baseUrl + path, opts);

    if (res.status === 401) {
      this.logout();
      throw new Error('Oturum süresi doldu.');
    }

    // CSV export gibi durumlar
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return res.blob();
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bir hata oluştu.');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // CSV export - blob olarak indir
  async exportCsv(queryString) {
    const res = await fetch(this.baseUrl + '/submissions/export' + queryString, {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    if (!res.ok) throw new Error('Export başarısız.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submissions_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
};
