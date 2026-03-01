// ============================================================
// EduGuru — Menu Page
// ============================================================
import { AuthState } from '../auth.js';
import { escapeHTML } from '../utils.js';

export function renderMenuPage() {
  const isLoggedIn = AuthState.isLoggedIn;
  const profile    = AuthState.profile;
  const role       = AuthState.role || 'student';

  return `
    <style>
      .menu-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 12px;
        border: none;
        background: transparent;
        border-radius: 14px;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s;
      }
      .menu-item:hover, .menu-item:active { background: var(--gradient-soft); }
      .menu-icon {
        width: 42px;
        height: 42px;
        border-radius: 13px;
        background: var(--gradient-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: var(--purple-start);
        transition: transform 0.15s;
      }
      .menu-item:hover .menu-icon { transform: scale(1.05); }
      .menu-label { flex: 1; font-size: 15px; font-weight: 500; color: var(--text-primary); }
      .menu-icon--red { background: #FFF1F2; color: #FF416C; }
      .menu-icon--green { background: #ECFDF5; color: #059669; }
      .menu-icon--amber { background: #FFFBEB; color: #D97706; }
      .menu-divider { height: 1px; background: var(--gray-100); margin: 6px 0; }
    </style>

    <div class="page" id="menu-page" style="padding-bottom:32px">
      <!-- Header -->
      <div style="padding:20px 16px 8px">
        <h1 style="font-family:var(--font-display);font-weight:800;font-size:24px">Menu</h1>
      </div>

      <!-- Profile Card -->
      ${isLoggedIn && profile ? `
        <div class="glass-card--flat" style="margin:0 16px 20px;padding:16px;display:flex;align-items:center;gap:12px">
          <div class="avatar avatar-lg" style="background:var(--gradient);color:white;font-size:18px;font-weight:700;flex-shrink:0">
            ${profile.profile_picture
              ? `<img src="${escapeHTML(profile.profile_picture)}"
                   style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">`
              : (profile.full_name || 'U').charAt(0).toUpperCase()
            }
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${escapeHTML(profile.full_name || 'User')}
            </div>
            <div style="font-size:13px;color:var(--gray-500);text-transform:capitalize">${role}</div>
          </div>
          <button class="btn btn--sm btn-outline" onclick="App.navigate('profile')">Edit</button>
        </div>
      ` : `
        <div class="glass-card--flat" style="margin:0 16px 20px;padding:16px;text-align:center">
          <p style="color:var(--gray-500);font-size:14px;margin-bottom:12px">
            Sign in to access all features
          </p>
          <button class="btn btn-primary btn--full" onclick="App.navigate('auth')">
            Login / Register
          </button>
        </div>
      `}

      <!-- Menu Items -->
      <div style="padding:0 8px">

        <!-- Navigation -->
        <button class="menu-item" onclick="App.navigate('home')">
          <div class="menu-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
          </div>
          <span class="menu-label">Home</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="menu-item" onclick="App.navigate('courses')">
          <div class="menu-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </div>
          <span class="menu-label">My Courses</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="menu-item" onclick="App.navigate('browse')">
          <div class="menu-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <span class="menu-label">Browse Courses</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="menu-item" onclick="App.navigate('browse', {tab:'categories'})">
          <div class="menu-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </div>
          <span class="menu-label">Categories</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <div class="menu-divider"></div>

        <!-- Support -->
        <button class="menu-item" onclick="App.navigate('payment')">
          <div class="menu-icon menu-icon--amber">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <span class="menu-label">Payment Portal</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="menu-item" onclick="App.navigate('contact')">
          <div class="menu-icon menu-icon--green">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.6 4.38 2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.72 17z"/>
            </svg>
          </div>
          <span class="menu-label">Contact Us</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="menu-item" onclick="App.navigate('about')">
          <div class="menu-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <span class="menu-label">About EduGuru</span>
          <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        ${AuthState.isAdmin ? `
          <div class="menu-divider"></div>
          <button class="menu-item" onclick="App.navigate('admin')">
            <div class="menu-icon" style="background:#F3E8FF;color:#7C3AED">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span class="menu-label">Admin Panel</span>
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="var(--gray-300)" fill="none" stroke-width="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ` : ''}

        ${isLoggedIn ? `
          <div class="menu-divider"></div>
          <button class="menu-item" onclick="App.signOut()">
            <div class="menu-icon menu-icon--red">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <span class="menu-label" style="color:#FF416C">Logout</span>
            <div></div>
          </button>
        ` : ''}
      </div>

      <!-- Footer -->
      <div style="padding:28px 16px 8px;text-align:center">
        <div style="font-size:12px;color:var(--gray-400)">EduGuru v1.0</div>
        <div style="font-size:11px;color:var(--gray-300);margin-top:3px">
          © 2025 EduGuru · Sri Lanka's Education Marketplace
        </div>
      </div>
    </div>`;
}
