/**
 * engage.js — Blog Etkileşim Widget'ı
 * Kullanım:
 *   <div id="blog-engage"
 *        data-api="https://api.siteniz.com"
 *        data-key="ch_abc123"
 *        data-slug="makale-slug">
 *   </div>
 *   <script src="https://api.siteniz.com/widget/engage.js" defer></script>
 */
(function () {
  'use strict';

  const WIDGET_CSS_URL = (document.currentScript && document.currentScript.src)
    ? document.currentScript.src.replace('engage.js', 'engage.css')
    : '/widget/engage.css';

  // CSS'i head'e yükle (bir kez)
  if (!document.querySelector('link[data-engage-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = WIDGET_CSS_URL;
    link.setAttribute('data-engage-css', '1');
    document.head.appendChild(link);
  }

  // Avatar URL yardımcısı
  function avatarUrl(baseApi, avatarId) {
    if (!avatarId) return baseApi + '/widget/avatars/default.svg';
    return `${baseApi}/widget/avatars/avatar-${avatarId}.svg`;
  }

  // Tarihi Türkçe biçimlendir
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // XSS güvenli metin
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // API çağrı yardımcısı
  async function api(baseApi, path, options = {}) {
    const res = await fetch(baseApi + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    return res.json();
  }

  // ---- Reactions bileşeni ----
  async function renderReactions(container, { baseApi, apiKey, slug }) {
    const data = await api(baseApi, `/api/reactions/${encodeURIComponent(slug)}?api_key=${apiKey}`);
    const claps = data.reactions?.clap || 0;
    const yourClaps = data.user_reaction?.clap || 0;
    const maxClaps = 50;

    const wrapper = document.createElement('div');
    wrapper.className = 'eg-reactions';
    wrapper.innerHTML = `
      <button class="eg-clap-btn" title="Alkışla" aria-label="Alkışla">
        <span class="eg-clap-icon">👏</span>
        <span class="eg-clap-total">${claps}</span>
      </button>
      <span class="eg-clap-hint">${yourClaps > 0 ? `Senin: ${yourClaps}` : 'Alkışlamak için tıkla'}</span>
    `;
    container.appendChild(wrapper);

    let pendingClaps = 0;
    let debounceTimer = null;
    const btn = wrapper.querySelector('.eg-clap-btn');
    const totalEl = wrapper.querySelector('.eg-clap-total');
    const hintEl = wrapper.querySelector('.eg-clap-hint');

    async function flushClaps() {
      if (pendingClaps === 0) return;
      const amount = pendingClaps;
      pendingClaps = 0;
      try {
        const result = await api(baseApi, '/api/reactions', {
          method: 'POST',
          body: JSON.stringify({ api_key: apiKey, article_slug: slug, reaction_type: 'clap', count: amount })
        });
        const key = Object.keys(result).find(k => k.startsWith('total_'));
        const yourKey = Object.keys(result).find(k => k.startsWith('your_'));
        if (key) totalEl.textContent = result[key];
        if (yourKey) hintEl.textContent = `Senin: ${result[yourKey]}`;
      } catch (e) { /* sessiz hata */ }
    }

    btn.addEventListener('click', () => {
      const currentTotal = parseInt(totalEl.textContent) || 0;
      if (yourClaps + pendingClaps >= maxClaps) {
        hintEl.textContent = `Maksimum ${maxClaps} alkış`;
        return;
      }
      pendingClaps = Math.min(pendingClaps + 1, 10);
      totalEl.textContent = currentTotal + 1;
      btn.classList.add('eg-clap-active');
      setTimeout(() => btn.classList.remove('eg-clap-active'), 200);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flushClaps, 800);
    });
  }

  // ---- Comments bileşeni ----
  async function renderComments(container, { baseApi, apiKey, slug }) {
    const data = await api(baseApi, `/api/comments/${encodeURIComponent(slug)}?api_key=${apiKey}`);
    const comments = data.comments || [];

    const section = document.createElement('div');
    section.className = 'eg-comments';

    // Yorum listesi
    const listEl = document.createElement('div');
    listEl.className = 'eg-comment-list';

    if (comments.length === 0) {
      listEl.innerHTML = '<p class="eg-empty">Henüz yorum yok. İlk yorumu sen bırak!</p>';
    } else {
      section.innerHTML = `<h3 class="eg-section-title">💬 ${comments.length} Yorum</h3>`;
      comments.forEach(c => {
        const item = document.createElement('div');
        item.className = 'eg-comment-item';
        item.innerHTML = `
          <img class="eg-avatar" src="${esc(avatarUrl(baseApi, c.avatar_id))}" alt="avatar" width="40" height="40">
          <div class="eg-comment-body">
            <span class="eg-author">${esc(c.author_name)}</span>
            <span class="eg-date">${formatDate(c.created_at)}</span>
            <p class="eg-content">${esc(c.content)}</p>
          </div>
        `;
        listEl.appendChild(item);
      });
    }
    section.appendChild(listEl);

    // Yorum formu
    section.appendChild(buildCommentForm(baseApi, apiKey, slug, listEl));

    container.appendChild(section);
  }

  // ---- Yorum formu ----
  function buildCommentForm(baseApi, apiKey, slug, listEl) {
    const form = document.createElement('form');
    form.className = 'eg-comment-form';
    form.noValidate = true;

    // Avatar seçici (1-8)
    const avatarGrid = Array.from({ length: 8 }, (_, i) => i + 1).map(n => `
      <label class="eg-av-option">
        <input type="radio" name="avatar_id" value="${n}" ${n === 1 ? 'checked' : ''}>
        <img src="${baseApi}/widget/avatars/avatar-${n}.svg" alt="Avatar ${n}" width="36" height="36">
      </label>
    `).join('');

    form.innerHTML = `
      <h3 class="eg-section-title">Yorum Bırak</h3>
      <div class="eg-avatar-picker">
        <span class="eg-av-label">Avatar seç:</span>
        <div class="eg-av-grid">${avatarGrid}</div>
      </div>
      <div class="eg-form-row">
        <input type="text" name="author_name" placeholder="Takma adın (isteğe bağlı)" maxlength="100">
      </div>
      <div class="eg-form-row">
        <input type="email" name="author_email" placeholder="E-posta (gizli, bildirim için)">
      </div>
      <div class="eg-form-row">
        <textarea name="content" placeholder="Yorumun..." rows="4" maxlength="2000" required></textarea>
      </div>
      <input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off">
      <div class="eg-form-row eg-form-footer">
        <span class="eg-char-count">0 / 2000</span>
        <button type="submit" class="eg-submit-btn">Yorum Gönder</button>
      </div>
      <div class="eg-form-msg" role="alert" aria-live="polite"></div>
    `;

    const textarea = form.querySelector('textarea[name="content"]');
    const charCount = form.querySelector('.eg-char-count');
    const msgEl = form.querySelector('.eg-form-msg');
    const submitBtn = form.querySelector('.eg-submit-btn');

    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length} / 2000`;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      msgEl.className = 'eg-form-msg';

      const content = textarea.value.trim();
      if (content.length < 10) {
        msgEl.textContent = 'Yorum en az 10 karakter olmalıdır.';
        msgEl.classList.add('eg-msg-error');
        return;
      }

      const selectedAvatar = form.querySelector('input[name="avatar_id"]:checked');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Gönderiliyor...';

      try {
        const result = await api(baseApi, '/api/comments', {
          method: 'POST',
          body: JSON.stringify({
            api_key: apiKey,
            article_slug: slug,
            data: {
              author_name: form.querySelector('[name="author_name"]').value.trim() || 'Anonim',
              author_email: form.querySelector('[name="author_email"]').value.trim() || null,
              content,
              avatar_id: selectedAvatar ? parseInt(selectedAvatar.value) : null,
              _hp: form.querySelector('[name="_hp"]').value
            }
          })
        });

        if (result.success) {
          msgEl.textContent = result.success;
          msgEl.classList.add('eg-msg-success');
          form.reset();
          charCount.textContent = '0 / 2000';
        } else {
          msgEl.textContent = result.error || 'Bir hata oluştu.';
          msgEl.classList.add('eg-msg-error');
        }
      } catch (err) {
        msgEl.textContent = 'Bağlantı hatası. Lütfen tekrar deneyin.';
        msgEl.classList.add('eg-msg-error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Yorum Gönder';
      }
    });

    return form;
  }

  // ---- Newsletter bileşeni ----
  function renderSubscribe(container, { baseApi, apiKey, slug }) {
    const section = document.createElement('div');
    section.className = 'eg-subscribe';
    section.innerHTML = `
      <div class="eg-subscribe-inner">
        <p class="eg-subscribe-cta">Yeni yazılardan haberdar ol</p>
        <form class="eg-subscribe-form">
          <input type="email" name="email" placeholder="E-posta adresin" required>
          <button type="submit">Abone Ol</button>
          <div class="eg-subscribe-msg" role="alert" aria-live="polite"></div>
        </form>
      </div>
    `;
    container.appendChild(section);

    const form = section.querySelector('.eg-subscribe-form');
    const msgEl = section.querySelector('.eg-subscribe-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      const email = form.querySelector('[name="email"]').value.trim();
      const btn = form.querySelector('button');
      btn.disabled = true;

      try {
        const result = await api(baseApi, '/api/subscribe', {
          method: 'POST',
          body: JSON.stringify({ api_key: apiKey, email, source_slug: slug })
        });
        msgEl.textContent = result.success || result.error || 'İşlem tamamlandı.';
        msgEl.style.color = result.success ? 'green' : 'red';
        if (result.success) form.reset();
      } catch (err) {
        msgEl.textContent = 'Bağlantı hatası.';
        msgEl.style.color = 'red';
      } finally {
        btn.disabled = false;
      }
    });
  }

  // ---- Ana init ----
  async function initWidget(el) {
    const baseApi = (el.dataset.api || '').replace(/\/$/, '');
    const apiKey = el.dataset.key || '';
    const slug = el.dataset.slug || '';

    if (!baseApi || !apiKey || !slug) {
      el.innerHTML = '<p style="color:red">engage.js: data-api, data-key ve data-slug gerekli.</p>';
      return;
    }

    el.innerHTML = '';
    el.classList.add('eg-root');

    try {
      await renderReactions(el, { baseApi, apiKey, slug });
      await renderComments(el, { baseApi, apiKey, slug });
      renderSubscribe(el, { baseApi, apiKey, slug });
    } catch (err) {
      console.error('engage.js init error:', err);
    }
  }

  function init() {
    document.querySelectorAll('#blog-engage, [data-engage]').forEach(initWidget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
