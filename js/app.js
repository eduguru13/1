// ============================================================
// EduGuru — Main App Entry Point
// ============================================================
import { initAuth, AuthState, refreshProfile } from './auth.js';
import { Router } from './router.js';
import { Notifications } from './supabase.js';
import { toast, timeAgo, escapeHTML } from './utils.js';

// Page renderers
import { renderHomePage, initHomePage }           from './pages/home.js';
import { renderBrowsePage, initBrowsePage }       from './pages/browse.js';
import { renderCourseDetail, initCourseDetail }   from './pages/course.js';
import { renderPaymentPage, initPaymentPage }     from './pages/payment.js';
import { renderStudentDashboard }                 from './pages/student-dashboard.js';
import { renderTeacherDashboard }                 from './pages/teacher-dashboard.js';
import { renderCourseCreate, initCourseCreate }   from './pages/course-create.js';
import { renderAdminPanel }                       from './pages/admin.js';
import { renderProfilePage, initProfilePage }     from './pages/profile.js';
import { renderChatPage, initChatPage }           from './pages/chat.js';
import { renderCourseDashboard, initCourseDashboard } from './pages/course-dashboard.js';
import { renderMenuPage }                         from './pages/menu.js';
import { renderContactPage }                      from './pages/contact.js';
import { renderAuthPage, authStyles, initAuthController } from './auth.js';

// ── APP SHELL ─────────────────────────────────────────────────
function renderAppShell() {
  document.getElementById('app').innerHTML = `
    <!-- PAGE LOADER BAR -->
    <div id="page-loader" style="position:fixed;top:0;left:0;right:0;z-index:99999;height:3px;pointer-events:none">
      <div id="page-loader-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#6A11CB,#2575FC);border-radius:0 2px 2px 0;box-shadow:0 0 8px #6A11CB80"></div>
    </div>

    <!-- SVG Defs (gradients for icons) -->
    <svg width="0" height="0" style="position:absolute">
      <defs>
        <linearGradient id="navGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#6A11CB"/>
          <stop offset="100%" stop-color="#2575FC"/>
        </linearGradient>
        <linearGradient id="halfGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="50%" stop-color="#F59E0B"/>
          <stop offset="50%" stop-color="#E5E7EB"/>
        </linearGradient>
      </defs>
    </svg>

    <!-- TOP BAR -->
    <header class="top-bar" id="top-bar">
      <div class="top-bar__brand" id="brand-logo" onclick="App.navigate('home')">
        <div class="top-bar__logo">
          <img src="assets/icons/icon-512.png" alt="EduGuru" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">
        </div>
        <span class="top-bar__name">EduGuru</span>
      </div>
      <div class="top-bar__actions">
        <button class="icon-btn" id="btn-notification" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notification-badge hidden" id="notif-badge"></span>
        </button>
      </div>
    </header>

    <!-- NOTIFICATION PANEL -->
    <div class="notif-panel" id="notif-panel">
      <div class="notif-panel__header">
        <span class="notif-panel__title">Notifications</span>
        <button class="btn btn--sm btn-ghost" id="btn-mark-read">Mark all read</button>
      </div>
      <div id="notif-list">
        <div class="empty-state" style="padding:24px">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <p class="text-gray text-sm">No notifications yet</p>
        </div>
      </div>
    </div>

    <!-- PAGE CONTENT -->
    <main id="page-content"></main>

    <!-- BOTTOM NAV -->
    <nav class="bottom-nav" id="bottom-nav">
      <div class="nav-item active" id="nav-home" onclick="App.navigate('home')">
        <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
        <span>Home</span>
      </div>
      <div class="nav-item" id="nav-menu" onclick="App.navigate('menu')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <span>Menu</span>
      </div>
      <div class="nav-item nav-item--create hidden" id="nav-create">
        <div class="nav-create-btn" onclick="App.navigate('create')">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span>Create</span>
      </div>
      <div class="nav-item" id="nav-courses" onclick="App.navigate('courses')">
        <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span>My Courses</span>
      </div>
      <div class="nav-item" id="nav-profile" onclick="App.navigate('profile')">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </div>
    </nav>

    <!-- TOAST CONTAINER -->
    <div class="toast-container" id="toast-container"></div>
  `;
}

// ── PAGE CONTENT HELPER ───────────────────────────────────────
function setPageContent(html) {
  document.getElementById('page-content').innerHTML = html;
}

// ── ROUTE HANDLERS ────────────────────────────────────────────
function registerRoutes() {
  Router.register('home', {
    async render() {
      setPageContent(renderHomePage());
      await initHomePage();
    },
  });

  Router.register('auth', {
    async render() {
      // Inject auth styles
      if (!document.getElementById('auth-styles')) {
        const style = document.createElement('style');
        style.id = 'auth-styles';
        style.textContent = authStyles + spinStyle;
        document.head.appendChild(style);
      }
      setPageContent(renderAuthPage());
      initAuthController(() => App.navigate('home', {}, true));
    },
  });

  Router.register('browse', {
    async render(params) {
      setPageContent(renderBrowsePage());
      await initBrowsePage(params);
    },
  });

  Router.register('course', {
    async render(params) {
      const id = params.id || Object.values(params)[0];
      if (!id) { App.navigate('browse'); return; }
      setPageContent(renderCourseDetail());
      await initCourseDetail(id);
    },
  });

  Router.register('payment', {
    requiresAuth: true,
    async render(params) {
      const courseId = params.courseId || params.id;
      if (!courseId) { App.navigate('browse'); return; }
      setPageContent(renderPaymentPage());
      await initPaymentPage(courseId);
    },
  });

  Router.register('courses', {
    requiresAuth: true,
    async render() {
      if (AuthState.isAdmin) {
        App.navigate('admin');
      } else if (AuthState.isTeacher) {
        setPageContent(renderTeacherDashboard());
        const { initTeacherDashboard } = await import('./pages/teacher-dashboard.js');
        await initTeacherDashboard();
      } else {
        setPageContent(renderStudentDashboard());
        const { initStudentDashboard } = await import('./pages/student-dashboard.js');
        await initStudentDashboard();
      }
    },
  });

  Router.register('create', {
    requiresAuth: true,
    async render(params) {
      if (!AuthState.isTeacher && !AuthState.isAdmin) {
        toast('Only teachers can create courses', 'error');
        App.navigate('home');
        return;
      }
      setPageContent(renderCourseCreate());
      await initCourseCreate(params.id || null);
    },
  });

  Router.register('admin', {
    requiresAuth: true,
    async render(params) {
      if (!AuthState.isAdmin) {
        App.navigate('home');
        return;
      }
      setPageContent(renderAdminPanel());
      const { initAdminPanel } = await import('./pages/admin.js');
      await initAdminPanel(params.tab || 'overview');
    },
  });

  Router.register('profile', {
    requiresAuth: true,
    async render(params) {
      setPageContent(renderProfilePage());
      await initProfilePage(params.id || null);
    },
  });

  Router.register('chat', {
    requiresAuth: true,
    async render(params) {
      const courseId = params.courseId || params.id;
      if (!courseId) { App.navigate('courses'); return; }
      setPageContent(renderChatPage());
      await initChatPage(courseId);
    },
  });

  Router.register('menu', {
    async render() {
      setPageContent(renderMenuPage());
    },
  });

  Router.register('contact', {
    async render() {
      setPageContent(renderContactPage());
    },
  });

  Router.register('course-dashboard', {
    requiresAuth: true,
    async render(params) {
      const batchId = params.batchId || params.id;
      if (!batchId) { App.navigate('courses'); return; }
      setPageContent(renderCourseDashboard());
      await initCourseDashboard(batchId);
    },
  });

  Router.register('about', {
    async render() {
      setPageContent(renderAboutPage());
    },
  });
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
async function initNotifications() {
  if (!AuthState.isLoggedIn) return;

  const userId = AuthState.user.id;
  const count  = await Notifications.getUnreadCount(userId);
  updateBadge(count);

  // Realtime subscription
  Notifications.subscribeToUser(userId, notif => {
    updateBadge(1, true);
    toast(notif.title, notif.type === 'success' ? 'success' : 'info');
    prependNotification(notif);
  });

  // Load initial notifications
  const notifs = await Notifications.get(userId);
  renderNotifications(notifs);
}

function updateBadge(count, increment = false) {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const current = parseInt(badge.dataset.count || 0);
  const next = increment ? current + count : count;
  badge.dataset.count = next;
  badge.classList.toggle('hidden', next === 0);
}

function renderNotifications(notifs) {
  const list = document.getElementById('notif-list');
  if (!list) return;

  if (!notifs || notifs.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <p class="text-gray text-sm">No notifications yet</p>
      </div>`;
    return;
  }

  list.innerHTML = notifs.map(n => notifItemHTML(n)).join('');
}

function prependNotification(notif) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const emptyState = list.querySelector('.empty-state');
  if (emptyState) list.innerHTML = '';
  list.insertAdjacentHTML('afterbegin', notifItemHTML(notif));
}

function notifItemHTML(n) {
  const icons = {
    success:          `<polyline points="20 6 9 17 4 12"/>`,
    enrollment:       `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`,
    payment:          `<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
    warning:          `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    info:             `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    withdrawal_paid:  `<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>`,
  };
  const icon = icons[n.type] || icons.info;

  // Special handling for withdrawal_paid: show WhatsApp check button
  const EDUGURU_WA = '94789929233';
  const extraAction = n.type === 'withdrawal_paid' ? `
    <a href="https://wa.me/${EDUGURU_WA}" target="_blank"
      style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:5px 12px;
        background:#25D366;color:#fff;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none">
      📱 Check on WhatsApp
    </a>` : '';

  return `
    <div class="notif-item ${n.is_read ? '' : 'unread'}">
      <div class="notif-icon" style="${n.type === 'withdrawal_paid' ? 'background:linear-gradient(135deg,#059669,#10B981);color:#fff' : ''}">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2">${icon}</svg>
      </div>
      <div class="notif-content">
        <div class="notif-title">${escapeHTML(n.title)}</div>
        <div class="notif-msg">${escapeHTML(n.message)}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
        ${extraAction}
      </div>
    </div>`;
}

// ── UI UPDATES BASED ON AUTH STATE ────────────────────────────
function updateUIForRole(profile) {
  const createNavItem = document.getElementById('nav-create');
  const coursesNav    = document.getElementById('nav-courses');

  // Always reset nav-courses to default first
  if (coursesNav) {
    coursesNav.setAttribute('onclick', "App.navigate('courses')");
    const span = coursesNav.querySelector('span');
    if (span) span.textContent = 'My Courses';
  }

  if (!profile) {
    if (createNavItem) createNavItem.classList.add('hidden');
    return;
  }

  // Show "Create" nav for teachers only
  if (createNavItem) {
    createNavItem.classList.toggle('hidden', profile.role !== 'teacher');
  }

  // Admin — show admin shortcut in courses nav
  if (profile.role === 'admin') {
    coursesNav?.setAttribute('onclick', "App.navigate('admin')");
    const span = coursesNav?.querySelector('span');
    if (span) span.textContent = 'Admin';
  }
}

// ── GLOBAL APP OBJECT ─────────────────────────────────────────
window.App = {
  navigate(route, params = {}, replace = false) {
    // Support shorthand: App.navigate('course', 'COURSE_ID')
    if (typeof params === 'string') {
      params = { id: params };
    }
    Router.navigate(route, params, replace);
  },

  async signOut() {
    const { Auth } = await import('./supabase.js');
    await Auth.signOut();
    App.navigate('home', {}, true);
  },

  get user()    { return AuthState.user; },
  get profile() { return AuthState.profile; },
  get role()    { return AuthState.role; },
};

// ── ABOUT PAGE ────────────────────────────────────────────────
function renderAboutPage() {
  return `
    <div class="page" id="about-page" style="padding-bottom:32px">
      <div style="padding:20px 16px 4px;display:flex;align-items:center;gap:12px">
        <button class="icon-btn" onclick="App.navigate('menu')">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 style="font-family:var(--font-display);font-weight:800;font-size:22px">About EduGuru</h1>
      </div>

      <!-- Hero -->
      <div style="margin:16px;padding:28px 20px;text-align:center;background:var(--gradient);border-radius:24px;color:white">
        <div style="width:64px;height:64px;background:rgba(255,255,255,0.2);border-radius:18px;
             margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="white" stroke-width="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:24px;margin-bottom:8px">EduGuru</div>
        <div style="opacity:0.9;font-size:14px;line-height:1.6">Sri Lanka's premier education marketplace connecting passionate teachers with eager learners.</div>
      </div>

      <!-- Mission -->
      <div class="glass-card--flat" style="margin:0 16px 12px;padding:18px">
        <h3 style="font-weight:700;font-size:16px;margin-bottom:8px">Our Mission</h3>
        <p style="font-size:14px;color:var(--gray-500);line-height:1.7">
          To democratize quality education in Sri Lanka by creating a platform where the best teachers can reach students across the island, and where every student has access to affordable, high-quality learning.
        </p>
      </div>

      <!-- How It Works -->
      <div class="glass-card--flat" style="margin:0 16px 12px;padding:18px">
        <h3 style="font-weight:700;font-size:16px;margin-bottom:14px">How It Works</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${[
            ['1', 'Browse Courses', 'Explore hundreds of courses from verified Sri Lankan teachers across all subjects and skill levels.'],
            ['2', 'Enroll & Pay', 'Simple bank transfer payment — no credit card needed. Instant WhatsApp confirmation.'],
            ['3', 'Learn', 'Access course materials, join live classes via Google Meet, and connect with classmates.'],
          ].map(([n, title, desc]) => `
            <div style="display:flex;gap:12px">
              <div style="width:32px;height:32px;border-radius:50%;background:var(--gradient);
                   color:white;display:flex;align-items:center;justify-content:center;
                   font-weight:800;font-size:14px;flex-shrink:0">${n}</div>
              <div>
                <div style="font-weight:700;font-size:14px;margin-bottom:3px">${title}</div>
                <div style="font-size:13px;color:var(--gray-500);line-height:1.5">${desc}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Stats -->
      <div style="margin:0 16px 12px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['📚', 'Growing', 'Course Library'],
          ['👥', 'Active', 'Community'],
          ['⭐', 'Verified', 'Teachers'],
          ['🇱🇰', 'Sri Lanka', 'Based & Built'],
        ].map(([icon, val, label]) => `
          <div class="glass-card--flat" style="padding:14px;text-align:center">
            <div style="font-size:22px;margin-bottom:4px">${icon}</div>
            <div style="font-weight:800;font-size:15px;color:var(--purple-start)">${val}</div>
            <div style="font-size:11px;color:var(--gray-400)">${label}</div>
          </div>`).join('')}
      </div>

      <!-- CTA -->
      <div style="margin:0 16px;display:flex;gap:10px">
        <button class="btn btn-primary flex-1" onclick="App.navigate('browse')">Explore Courses</button>
        <button class="btn btn-outline flex-1" onclick="App.navigate('contact')">Contact Us</button>
      </div>

      <div style="padding:24px 16px 8px;text-align:center">
        <div style="font-size:12px;color:var(--gray-400)">EduGuru v1.0 · Made with ❤ in Sri Lanka</div>
      </div>
    </div>`;
}

// ── SPIN ANIMATION ────────────────────────────────────────────
const spinStyle = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin { animation: spin 0.8s linear infinite; }
`;

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  // Inject spin style
  const style = document.createElement('style');
  style.textContent = spinStyle;
  document.head.appendChild(style);

  // Render shell
  renderAppShell();

  // Init auth
  const { user, profile } = await initAuth();

  // Update UI
  updateUIForRole(profile);

  // Register routes
  registerRoutes();

  // Notification panel toggle
  document.getElementById('btn-notification')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const panel = document.getElementById('notif-panel');
    panel.classList.toggle('show');

    if (panel.classList.contains('show') && AuthState.isLoggedIn) {
      await Notifications.markRead(AuthState.user.id);
      updateBadge(0);
    }
  });

  document.addEventListener('click', e => {
    const panel = document.getElementById('notif-panel');
    if (panel?.classList.contains('show') && !panel.contains(e.target) &&
        !document.getElementById('btn-notification')?.contains(e.target)) {
      panel.classList.remove('show');
    }
  });

  document.getElementById('btn-mark-read')?.addEventListener('click', async () => {
    if (!AuthState.isLoggedIn) return;
    await Notifications.markRead(AuthState.user.id);
    updateBadge(0);
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
  });

  // Auth state changes
  window.addEventListener('auth:changed', async e => {
    const { profile } = e.detail;
    updateUIForRole(profile);
    if (profile) {
      await initNotifications();
    }
  });

  // Init notifications if logged in
  if (user) {
    await initNotifications();
  }

  // Start router
  Router.init();
}

document.addEventListener('DOMContentLoaded', init);
