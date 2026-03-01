// ============================================================
// EduGuru — Authentication Module
// ============================================================
import { Auth, Users } from './supabase.js';
import { Validate, toast, escapeHTML, sanitizeInput } from './utils.js';

// ── STATE ─────────────────────────────────────────────────────
let _user    = null;
let _profile = null;

export const AuthState = {
  get user()    { return _user; },
  get profile() { return _profile; },
  get isLoggedIn() { return !!_user; },
  get role()    { return _profile?.role || null; },
  get isTeacher() { return _profile?.role === 'teacher'; },
  get isAdmin()   { return _profile?.role === 'admin'; },
  get isStudent() { return _profile?.role === 'student'; },
};

export async function initAuth() {
  const session = await Auth.getSession();
  if (session?.user) {
    _user = session.user;
    try { _profile = await Users.getProfile(session.user.id); } catch { _profile = null; }
  }

  Auth.onAuthChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      _user = session.user;
      try { _profile = await Users.getProfile(session.user.id); } catch { _profile = null; }
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: _user, profile: _profile } }));
    } else if (event === 'SIGNED_OUT') {
      _user    = null;
      _profile = null;
      window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null, profile: null } }));
    }
  });

  return { user: _user, profile: _profile };
}

export async function refreshProfile() {
  if (!_user) return null;
  _profile = await Users.getProfile(_user.id);
  return _profile;
}

// ── AUTH PAGE HTML ────────────────────────────────────────────
export function renderAuthPage() {
  return `
    <div class="auth-page page">
      <!-- Auth Header -->
      <div class="auth-hero">
        <div class="auth-logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
        </div>
        <h1 class="auth-brand">EduGuru</h1>
        <p class="auth-tagline">Learn from Sri Lanka's best teachers</p>
      </div>

      <!-- Tab switcher -->
      <div class="auth-tabs-wrap">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
        </div>
      </div>

      <!-- Login Form -->
      <div class="auth-form-wrap" id="form-login">
        <form id="login-form" novalidate>
          <div class="form-group">
            <label class="form-label">Email or Mobile</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input type="text" class="form-input" id="login-email" placeholder="email@example.com or 07XXXXXXXX" autocomplete="email">
            </div>
            <span class="form-error hidden" id="err-login-email"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" class="form-input" id="login-password" placeholder="Your password" autocomplete="current-password">
              <svg class="input-icon-right toggle-pw" viewBox="0 0 24 24" data-target="login-password">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <span class="form-error hidden" id="err-login-password"></span>
          </div>

          <div class="flex justify-between items-center" style="margin-bottom:24px">
            <label class="remember-wrap">
              <input type="checkbox" id="remember-me"> Remember me
            </label>
            <button type="button" class="forgot-link" id="btn-forgot">Forgot password?</button>
          </div>

          <button type="submit" class="btn btn-primary btn--full btn--lg" id="btn-login">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Sign In
          </button>
        </form>
      </div>

      <!-- Signup Form -->
      <div class="auth-form-wrap hidden" id="form-signup">
        <!-- Role selector -->
        <div class="role-selector">
          <button class="role-btn active" data-role="student">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
            I'm a Student
          </button>
          <button class="role-btn" data-role="teacher">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
            I'm a Teacher
          </button>
        </div>

        <form id="signup-form" novalidate>

          <!-- Common Fields -->
          <div class="divider-text">Personal Information</div>

          <div class="form-group">
            <label class="form-label">Full Name <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input type="text" class="form-input" id="su-name" placeholder="Your full name" autocomplete="name">
            </div>
            <span class="form-error hidden" id="err-su-name"></span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Age <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                <input type="number" class="form-input" id="su-age" placeholder="e.g. 18" min="5" max="100">
              </div>
              <span class="form-error hidden" id="err-su-age"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Gender <span class="required">*</span></label>
              <select class="form-input" id="su-gender" style="padding-left:12px">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <span class="form-error hidden" id="err-su-gender"></span>
            </div>
          </div>

          <!-- Student-only fields -->
          <div id="student-fields">
            <div class="form-group">
              <label class="form-label">Province <span class="required">*</span></label>
              <select class="form-input" id="su-province" style="padding-left:12px">
                <option value="">Select Province</option>
                <option>Western Province</option>
                <option>Central Province</option>
                <option>Southern Province</option>
                <option>Northern Province</option>
                <option>Eastern Province</option>
                <option>North Western Province</option>
                <option>North Central Province</option>
                <option>Uva Province</option>
                <option>Sabaragamuwa Province</option>
              </select>
              <span class="form-error hidden" id="err-su-province"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Town <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <input type="text" class="form-input" id="su-town" placeholder="e.g. Colombo, Kandy">
              </div>
              <span class="form-error hidden" id="err-su-town"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Phone Number <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <input type="tel" class="form-input" id="su-phone" placeholder="07XXXXXXXX" autocomplete="tel">
              </div>
              <span class="form-error hidden" id="err-su-phone"></span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input type="email" class="form-input" id="su-email" placeholder="email@example.com" autocomplete="email">
            </div>
            <span class="form-error hidden" id="err-su-email"></span>
          </div>

          <!-- Teacher-only mobile field -->
          <div id="teacher-mobile-field" class="hidden">
            <div class="form-group">
              <label class="form-label">Mobile Number <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <input type="tel" class="form-input" id="su-mobile" placeholder="07XXXXXXXX" autocomplete="tel">
              </div>
              <span class="form-error hidden" id="err-su-mobile"></span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Password <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" class="form-input" id="su-password" placeholder="Min 8 chars, 1 number, 1 special" autocomplete="new-password">
              <svg class="input-icon-right toggle-pw" viewBox="0 0 24 24" data-target="su-password">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <span class="form-error hidden" id="err-su-password"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Confirm Password <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" class="form-input" id="su-confirm" placeholder="Repeat your password" autocomplete="new-password">
            </div>
            <span class="form-error hidden" id="err-su-confirm"></span>
          </div>

          <!-- Teacher extra fields -->
          <div id="teacher-fields" class="hidden">
            <div class="divider-text">Teacher Profile</div>

            <div class="form-group">
              <label class="form-label">Profession / Subject Expertise <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <input type="text" class="form-input" id="su-expertise" placeholder="e.g., Mathematics, Physics, English">
              </div>
              <span class="form-error hidden" id="err-su-expertise"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Short Bio <span class="required">*</span></label>
              <textarea class="form-textarea" id="su-bio" placeholder="Tell students about yourself and your teaching experience..." rows="3"></textarea>
              <span class="form-error hidden" id="err-su-bio"></span>
            </div>

            <div class="form-group">
              <label class="form-label">Experience in Years</label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                <input type="number" class="form-input" id="su-experience" placeholder="e.g., 5" min="0" max="50">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Profile Photo <span style="color:var(--text-muted);font-weight:400">(Optional)</span></label>
              <div class="photo-upload-wrap" id="photo-upload-area">
                <div class="photo-upload-placeholder">
                  <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" stroke-width="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Tap to upload photo</span>
                </div>
                <input type="file" id="su-photo" accept="image/*" class="hidden">
              </div>
            </div>
          </div>

          <label class="tc-wrap">
            <input type="checkbox" id="su-tc">
            <span>I agree to the <a href="#terms" class="gradient-text">Terms & Conditions</a></span>
          </label>
          <span class="form-error hidden" id="err-su-tc"></span>

          <button type="submit" class="btn btn-primary btn--full btn--lg" id="btn-signup" style="margin-top:20px">
            Create Account
          </button>
        </form>
      </div>

      <!-- Forgot Password -->
      <div class="auth-form-wrap hidden" id="form-forgot">
        <div class="text-center mb-md">
          <div class="empty-state__icon" style="margin:0 auto 16px">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2 class="font-bold" style="font-size:20px">Reset Password</h2>
          <p class="text-gray text-sm mt-md">Enter your email and we'll send you a reset link.</p>
        </div>
        <form id="forgot-form" novalidate>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input type="email" class="form-input" id="forgot-email" placeholder="email@example.com">
            </div>
            <span class="form-error hidden" id="err-forgot-email"></span>
          </div>
          <button type="submit" class="btn btn-primary btn--full" id="btn-forgot-submit">Send Reset Link</button>
          <button type="button" class="btn btn-ghost btn--full" style="margin-top:8px" id="btn-back-login">
            Back to Sign In
          </button>
        </form>
      </div>
    </div>`;
}

// ── AUTH PAGE CSS ─────────────────────────────────────────────
export const authStyles = `
  .auth-page { min-height: 100vh; background: var(--white); padding-bottom: 32px; }

  .auth-hero {
    background: var(--gradient);
    padding: 48px 24px 32px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .auth-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.2), transparent 70%);
  }
  .auth-logo {
    width: 64px; height: 64px;
    background: rgba(255,255,255,0.2);
    border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 12px;
    backdrop-filter: blur(8px);
  }
  .auth-brand { color: white; font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .auth-tagline { color: rgba(255,255,255,0.85); font-size: 14px; margin-top: 6px; }

  .auth-tabs-wrap { padding: 20px 24px 0; }
  .auth-tabs {
    display: flex;
    background: var(--gray-100);
    border-radius: var(--radius-full);
    padding: 4px;
    gap: 4px;
  }
  .auth-tab {
    flex: 1; padding: 10px; border-radius: var(--radius-full);
    font-size: 14px; font-weight: 600; color: var(--gray-500);
    transition: var(--transition); cursor: pointer; border: none; background: none;
  }
  .auth-tab.active { background: var(--white); color: var(--black); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }

  .auth-form-wrap { padding: 20px 24px; }

  .role-selector { display: flex; gap: 10px; margin-bottom: 20px; }
  .role-btn {
    flex: 1; padding: 14px 8px;
    border: 2px solid var(--gray-200);
    border-radius: var(--radius-xl);
    background: var(--white);
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600; color: var(--gray-500);
    cursor: pointer; transition: var(--transition);
  }
  .role-btn.active {
    border-color: var(--purple-start);
    background: var(--gradient-soft);
    color: var(--purple-start);
  }
  .role-btn svg { transition: var(--transition); }

  .remember-wrap {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--gray-600); cursor: pointer;
  }
  .forgot-link { font-size: 13px; font-weight: 600; color: var(--purple-start); background: none; border: none; cursor: pointer; }

  .tc-wrap {
    display: flex; align-items: flex-start; gap: 8px;
    font-size: 13px; color: var(--gray-600); cursor: pointer; margin-top: 8px;
  }
  .tc-wrap input { margin-top: 2px; accent-color: var(--purple-start); }

  .photo-upload-wrap {
    border: 2px dashed var(--gray-200);
    border-radius: var(--radius-xl);
    overflow: hidden;
    cursor: pointer;
    transition: var(--transition);
  }
  .photo-upload-wrap:hover { border-color: var(--purple-start); background: var(--gradient-soft); }
  .photo-upload-placeholder {
    padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px;
    color: var(--gray-400); font-size: 13px;
  }
  .photo-preview { width: 100%; aspect-ratio: 1; object-fit: cover; }

  #teacher-fields .divider-text { margin: 16px 0; }
`;

// ── AUTH CONTROLLER ───────────────────────────────────────────
export function initAuthController(onSuccess) {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('form-login').classList.toggle('hidden', target !== 'login');
      document.getElementById('form-signup').classList.toggle('hidden', target !== 'signup');
      document.getElementById('form-forgot').classList.add('hidden');
    });
  });

  // Role selector — show/hide student vs teacher fields
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isTeacher = btn.dataset.role === 'teacher';
      document.getElementById('teacher-fields').classList.toggle('hidden', !isTeacher);
      document.getElementById('student-fields').classList.toggle('hidden', isTeacher);
      document.getElementById('teacher-mobile-field').classList.toggle('hidden', !isTeacher);
    });
  });

  // Password toggle
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Photo upload
  const photoArea = document.getElementById('photo-upload-area');
  const photoInput = document.getElementById('su-photo');
  if (photoArea && photoInput) {
    photoArea.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      photoArea.innerHTML = `<img src="${url}" class="photo-preview" alt="Profile">`;
    });
  }

  // Forgot password link
  document.getElementById('btn-forgot')?.addEventListener('click', () => {
    document.getElementById('form-login').classList.add('hidden');
    document.getElementById('form-forgot').classList.remove('hidden');
  });

  document.getElementById('btn-back-login')?.addEventListener('click', () => {
    document.getElementById('form-forgot').classList.add('hidden');
    document.getElementById('form-login').classList.remove('hidden');
  });

  // ── LOGIN FORM ────────────────────────────────────────────
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors('login-form');

    const identifier = sanitizeInput(document.getElementById('login-email').value);
    const password   = document.getElementById('login-password').value;
    let hasError = false;

    if (!identifier) {
      showError('err-login-email', 'Email or mobile is required');
      hasError = true;
    }
    if (!password) {
      showError('err-login-password', 'Password is required');
      hasError = true;
    }
    if (hasError) return;

    // Support mobile login — convert to email lookup if needed
    const email = Validate.email(identifier) ? identifier : identifier;

    const btn = document.getElementById('btn-login');
    setLoading(btn, true, 'Signing In...');

    try {
      await Auth.signIn({ email, password });
      toast('Welcome back!', 'success');
      onSuccess?.();
    } catch (err) {
      const msg = err.message?.includes('Invalid') ? 'Invalid email or password' : (err.message || 'Sign in failed');
      showError('err-login-password', msg);
    } finally {
      setLoading(btn, false, 'Sign In');
    }
  });

  // ── SIGNUP FORM ───────────────────────────────────────────
  document.getElementById('signup-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors('signup-form');

    const role      = document.querySelector('.role-btn.active')?.dataset.role || 'student';
    const full_name = sanitizeInput(document.getElementById('su-name').value);
    const email     = sanitizeInput(document.getElementById('su-email').value);
    const password  = document.getElementById('su-password').value;
    const confirm   = document.getElementById('su-confirm').value;
    const tc        = document.getElementById('su-tc').checked;
    const age       = parseInt(document.getElementById('su-age').value) || 0;
    const gender    = document.getElementById('su-gender').value;

    let hasError = false;

    if (!Validate.name(full_name))    { showError('err-su-name',     'Enter your full name'); hasError = true; }
    if (!age || age < 5 || age > 100) { showError('err-su-age',      'Enter a valid age (5-100)'); hasError = true; }
    if (!gender)                       { showError('err-su-gender',   'Select your gender'); hasError = true; }
    if (!Validate.email(email))        { showError('err-su-email',    'Enter a valid email address'); hasError = true; }
    if (!Validate.password(password))  { showError('err-su-password', 'Min 8 chars with a number and special character'); hasError = true; }
    if (password !== confirm)          { showError('err-su-confirm',  'Passwords do not match'); hasError = true; }
    if (!tc)                           { showError('err-su-tc',       'Please accept the Terms & Conditions'); hasError = true; }

    const extra = { age, gender };

    if (role === 'student') {
      const province = document.getElementById('su-province').value;
      const town     = sanitizeInput(document.getElementById('su-town').value);
      const phone    = sanitizeInput(document.getElementById('su-phone').value);
      if (!province)               { showError('err-su-province', 'Select your province'); hasError = true; }
      if (!town)                   { showError('err-su-town',     'Enter your town'); hasError = true; }
      if (!Validate.mobile(phone)) { showError('err-su-phone',    'Enter a valid phone number (07XXXXXXXX)'); hasError = true; }
      extra.province = province;
      extra.town     = town;
      extra.mobile   = phone;
    }

    if (role === 'teacher') {
      const mobile    = sanitizeInput(document.getElementById('su-mobile').value);
      const expertise = sanitizeInput(document.getElementById('su-expertise').value);
      const bio       = sanitizeInput(document.getElementById('su-bio').value);
      const exp       = parseInt(document.getElementById('su-experience').value) || 0;

      if (!Validate.mobile(mobile)) { showError('err-su-mobile',   'Enter a valid mobile (07XXXXXXXX)'); hasError = true; }
      if (!expertise) { showError('err-su-expertise', 'Enter your subject or expertise'); hasError = true; }
      if (bio.length < 20) { showError('err-su-bio', 'Bio must be at least 20 characters'); hasError = true; }

      extra.mobile          = mobile;
      extra.expertise       = expertise;
      extra.bio             = bio;
      extra.experience_years = exp;
    }

    if (hasError) return;

    const btn = document.getElementById('btn-signup');
    setLoading(btn, true, 'Creating Account...');

    try {
      const { user } = await Auth.signUp({ email, password, full_name, mobile: extra.mobile || '', role, ...extra });

      // Upload teacher photo if provided
      if (role === 'teacher') {
        const photoFile = document.getElementById('su-photo')?.files?.[0];
        if (photoFile && user) {
          try {
            const { Users } = await import('./supabase.js');
            const url = await Users.uploadAvatar(user.id, photoFile);
            await Users.updateProfile(user.id, { profile_picture: url });
          } catch { /* non-fatal */ }
        }
      }

      toast(
        role === 'teacher'
          ? 'Account created! Awaiting admin approval to publish courses.'
          : 'Account created! Welcome to EduGuru.',
        'success',
        4000
      );
      onSuccess?.();
    } catch (err) {
      const msg = err.message?.includes('already registered')
        ? 'This email is already registered'
        : (err.message || 'Sign up failed');
      showError('err-su-email', msg);
    } finally {
      setLoading(btn, false, 'Create Account');
    }
  });

  // ── FORGOT PASSWORD ───────────────────────────────────────
  document.getElementById('forgot-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = sanitizeInput(document.getElementById('forgot-email').value);
    if (!Validate.email(email)) {
      showError('err-forgot-email', 'Enter a valid email address');
      return;
    }

    const btn = document.getElementById('btn-forgot-submit');
    setLoading(btn, true, 'Sending...');
    try {
      await Auth.resetPassword(email);
      toast('Reset link sent! Check your email.', 'success', 5000);
      document.getElementById('form-forgot').classList.add('hidden');
      document.getElementById('form-login').classList.remove('hidden');
    } catch (err) {
      showError('err-forgot-email', err.message || 'Failed to send reset link');
    } finally {
      setLoading(btn, false, 'Send Reset Link');
    }
  });
}

// ── HELPERS ───────────────────────────────────────────────────
function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  const input = el.previousElementSibling?.querySelector?.('input') ||
                el.previousElementSibling;
  if (input?.classList) input.classList.add('error');
}

function clearErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.add('hidden');
  });
  form.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<svg class="spin" viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
         <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
       </svg> ${label}`
    : label;
}
