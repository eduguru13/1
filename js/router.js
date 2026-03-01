// ============================================================
// EduGuru — SPA Hash Router
// ============================================================
import { AuthState } from './auth.js';

const routes = {};
let currentRoute = null;
let currentParams = {};
let _navId = 0; // incremented on each navigation; stale renders bail out early

export const Router = {
  register(name, handler) {
    routes[name] = handler;
  },

  async navigate(route, params = {}, replace = false) {
    const paramStr = typeof params === 'object'
      ? Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : params;

    const hash = paramStr ? `${route}?${paramStr}` : route;

    if (replace) {
      history.replaceState({ route, params }, '', `#${hash}`);
    } else {
      history.pushState({ route, params }, '', `#${hash}`);
    }

    await this._render(route, params);
  },

  async _render(route, params = {}) {
    const handler = routes[route];
    if (!handler) {
      console.warn(`[Router] No handler for: ${route}`);
      await this._render('home');
      return;
    }

    currentRoute  = route;
    currentParams = params;

    // Guard: auth required?
    if (handler.requiresAuth && !AuthState.isLoggedIn) {
      await this._render('auth');
      return;
    }

    // Guard: role required?
    if (handler.requiresRole && AuthState.role !== handler.requiresRole) {
      toast('Access denied', 'error');
      await this._render('home');
      return;
    }

    const content = document.getElementById('page-content');
    if (!content) return;

    // Navigation guard — cancel if a newer navigation started while we awaited
    const myNavId = ++_navId;
    const stale = () => myNavId !== _navId;

    // Progress bar — start
    const bar = document.getElementById('page-loader-bar');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '0%';
      bar.style.opacity = '1';
      requestAnimationFrame(() => {
        bar.style.transition = 'width 0.5s ease';
        bar.style.width = '70%';
      });
    }

    // Fade out
    content.style.opacity = '0';
    content.style.transform = 'translateY(8px)';

    try {
      await handler.render(params);
    } catch (err) {
      console.error('[Router] render error:', err);
      content.innerHTML = `
        <div style="padding:40px 24px;text-align:center">
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <h2 style="font-weight:700;margin-bottom:8px">Something went wrong</h2>
          <p style="color:#6B7280;font-size:14px;margin-bottom:20px">${err.message || 'Page failed to load'}</p>
          <button class="btn btn-primary" onclick="App.navigate('home')">Go Home</button>
        </div>`;
    }

    // If a newer navigation fired while we were loading, silently discard this render
    if (stale()) return;

    // Progress bar — finish
    if (bar) {
      bar.style.transition = 'width 0.2s ease';
      bar.style.width = '100%';
      setTimeout(() => {
        bar.style.transition = 'opacity 0.4s ease';
        bar.style.opacity = '0';
      }, 250);
    }

    // Fade in
    requestAnimationFrame(() => {
      content.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
      // ⚠️ Clear transform after animation — transform on #page-content breaks
      // position:fixed modals (creates new stacking context, confines fixed children)
      setTimeout(() => { content.style.transform = 'none'; }, 320);
    });

    // Scroll to top
    content.scrollTop = 0;

    // Update nav bar active state
    updateNavActive(route);

    // Fire route change event
    window.dispatchEvent(new CustomEvent('route:changed', { detail: { route, params } }));
  },

  get current() { return currentRoute; },
  get params()  { return currentParams; },

  init() {
    // Parse initial hash
    window.addEventListener('popstate', () => {
      const { route, params } = parseHash();
      this._render(route, params);
    });

    const { route, params } = parseHash();
    this._render(route, params);
  },

  back() { history.back(); },
};

function parseHash() {
  const hash = window.location.hash.slice(1) || 'home';
  const [route, queryStr] = hash.split('?');
  const params = {};
  if (queryStr) {
    queryStr.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  return { route, params };
}

function updateNavActive(route) {
  const map = {
    home:    'nav-home',
    browse:  'nav-menu',
    menu:    'nav-menu',
    chat:    'nav-menu',
    contact: 'nav-menu',
    about:   'nav-menu',
    create:  'nav-create',
    courses: 'nav-courses',
    profile: 'nav-profile',
    admin:   'nav-profile',
  };

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const activeId = map[route] || map[route.split('/')[0]];
  if (activeId) {
    document.getElementById(activeId)?.classList.add('active');
  }
}
