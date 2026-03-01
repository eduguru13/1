// ============================================================
// EduGuru — Profile Page
// ============================================================
import { Users, Courses, db } from '../supabase.js';
import { AuthState, refreshProfile } from '../auth.js';
import { toast, escapeHTML, sanitizeInput, Validate, formatLKR, discountPercent, serialChip } from '../utils.js';

export function renderProfilePage() {
  return `
    <div class="profile-page page" id="profile-page">
      <!-- Header -->
      <div style="padding:20px 16px 0">
        <h1 style="font-family:var(--font-display);font-weight:800;font-size:22px">My Profile</h1>
      </div>

      <div id="profile-content">
        <div style="text-align:center;padding:60px">
          <svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      </div>
    </div>`;
}

export async function initProfilePage(viewUserId = null) {
  // Viewing someone else's teacher profile
  if (viewUserId && viewUserId !== AuthState.user?.id) {
    await renderTeacherProfileView(viewUserId);
    return;
  }

  if (!AuthState.isLoggedIn) {
    document.getElementById('profile-content').innerHTML = `
      <div class="empty-state" style="padding-top:48px">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="empty-state__title">Not Signed In</div>
        <div class="empty-state__text">Sign in to view and manage your profile</div>
        <button class="btn btn-primary" onclick="App.navigate('auth')">Sign In</button>
      </div>`;
    return;
  }

  let profile = AuthState.profile;

  // If profile not cached, fetch directly
  let fetchError = null;
  if (!profile) {
    try {
      profile = await refreshProfile();
    } catch (e) {
      fetchError = e;
    }
  }

  if (!profile) {
    const uid = AuthState.user?.id || 'no-uid';
    const errMsg = fetchError ? (fetchError.message || JSON.stringify(fetchError)) : 'empty result';
    document.getElementById('profile-content').innerHTML = `
      <div style="padding:16px;background:#fee;border-radius:12px;margin:16px;font-size:12px;word-break:break-all">
        <b>Error Debug:</b><br>
        UID: ${uid}<br>
        Msg: ${errMsg}
      </div>
      <div style="text-align:center">
        <button class="btn btn-primary" onclick="window.location.reload()">Retry</button>
      </div>`;
    return;
  }

  renderProfile(profile);
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Compress image to ≤ 500 KB, max 800px wide, JPEG output
function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const MAX_W = 800;
      let w = img.width, h = img.height;
      if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      // Iteratively reduce quality until ≤ 500 KB
      const TARGET = 500 * 1024;
      const tryQ = (q) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          if (blob.size <= TARGET || q <= 0.25) {
            resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
          } else {
            tryQ(+(q - 0.1).toFixed(2));
          }
        }, 'image/jpeg', q);
      };
      tryQ(0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Could not load image')); };
    img.src = objUrl;
  });
}

function renderProfile(profile) {
  if (!profile) return;

  const roleLabel = {
    student: '🎓 Student',
    teacher: '👩‍🏫 Teacher',
    admin:   '⚙️ Admin',
  }[profile.role] || profile.role;

  document.getElementById('profile-content').innerHTML = `
    <!-- Avatar Section -->
    <div style="text-align:center;padding:24px 16px;background:var(--gradient-soft);margin-bottom:0">
      <div style="position:relative;display:inline-block" id="avatar-wrapper">
        <img id="profile-avatar-img"
          src="${escapeHTML(profile.profile_picture || '')}"
          class="avatar avatar-xl"
          style="border:3px solid white;box-shadow:var(--glass-shadow);${profile.profile_picture ? '' : 'display:none'}">
        <div id="profile-avatar-initials"
          class="avatar avatar-xl"
          style="border:3px solid white;box-shadow:var(--glass-shadow);font-size:28px;${profile.profile_picture ? 'display:none' : ''}">
          ${getInitials(profile.full_name)}
        </div>
        <button id="avatar-upload-btn" class="icon-btn"
          style="position:absolute;bottom:0;right:0;background:var(--gradient);border:2px solid white;width:32px;height:32px"
          onclick="document.getElementById('avatar-file').click()">
          <svg id="avatar-upload-icon" viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <svg id="avatar-upload-spin" class="spin" viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5" style="display:none">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </button>
        <input type="file" id="avatar-file" accept="image/*" class="hidden">
      </div>
      ${profile.profile_picture ? `
        <button id="avatar-remove-btn" onclick="removeAvatar()"
          style="margin-top:8px;background:none;border:none;color:#EF4444;font-size:12px;
                 font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;
                 margin-left:auto;margin-right:auto;padding:4px 8px;border-radius:8px">
          <svg viewBox="0 0 24 24" width="12" height="12" stroke="#EF4444" fill="none" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Remove photo
        </button>` : ''}
      <h2 style="font-family:var(--font-display);font-weight:800;font-size:20px;margin-top:12px">${escapeHTML(profile.full_name)}</h2>
      ${profile.serial_id ? `<div style="margin-top:6px">${serialChip(profile.serial_id)}</div>` : ''}
      <div style="display:flex;justify-content:center;gap:8px;margin-top:6px">
        <span class="chip chip-purple">${roleLabel}</span>
        ${profile.is_verified ? `<span class="chip" style="background:#ECFDF5;color:#059669">✅ Verified</span>` : ''}
      </div>
    </div>

    <!-- Profile Info -->
    <div style="padding:0 16px;margin-top:20px">

      <!-- Edit Profile Form -->
      <div class="glass-card--flat" style="padding:16px;margin-bottom:16px">
        <h3 style="font-weight:700;font-size:15px;margin-bottom:14px">Personal Information</h3>

        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-input" id="p-name" value="${escapeHTML(profile.full_name)}">
        </div>

        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="p-email" value="${escapeHTML(profile.email)}" readonly style="background:var(--gray-50);color:var(--gray-400)">
          <span class="form-hint">Email cannot be changed</span>
        </div>

        <div class="form-group">
          <label class="form-label">Mobile</label>
          <input type="tel" class="form-input" id="p-mobile" value="${escapeHTML(profile.mobile || '')}">
        </div>

        ${profile.role === 'teacher' ? `
          <div class="form-group">
            <label class="form-label">Subject / Expertise</label>
            <input type="text" class="form-input" id="p-expertise" value="${escapeHTML(profile.expertise || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">Bio</label>
            <textarea class="form-textarea" id="p-bio" rows="3">${escapeHTML(profile.bio || '')}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Years of Experience</label>
            <input type="number" class="form-input" id="p-experience" value="${profile.experience_years || 0}" min="0">
          </div>` : ''}

        <button class="btn btn-primary btn--full" onclick="saveProfile()">Save Changes</button>
      </div>

      <!-- Change Password -->
      <div class="glass-card--flat" style="padding:16px;margin-bottom:16px">
        <h3 style="font-weight:700;font-size:15px;margin-bottom:14px">Change Password</h3>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <div class="input-wrap">
            <svg class="input-icon" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <input type="password" class="form-input" id="p-new-password" placeholder="Min 8 chars, 1 number, 1 special">
          </div>
          <span class="form-error hidden" id="err-p-password"></span>
        </div>
        <button class="btn btn-outline btn--full" onclick="changePassword()">Update Password</button>
      </div>

      <!-- Quick Actions -->
      ${profile.role === 'admin' ? `
        <div class="glass-card--flat" style="padding:16px;margin-bottom:16px">
          <h3 style="font-weight:700;font-size:15px;margin-bottom:12px">Admin Actions</h3>
          <button class="btn btn-primary btn--full" onclick="App.navigate('admin')">Open Admin Panel</button>
        </div>` : ''}

      <!-- Sign Out -->
      <button class="btn btn-danger btn--full" onclick="confirmSignOut()" style="margin-bottom:16px">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16,17 21,12 16,7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>

      <!-- App Info -->
      <div style="text-align:center;padding:12px;color:var(--gray-300);font-size:12px">
        EduGuru v1.0.0 • Sri Lanka's EdTech Platform
      </div>
    </div>
  `;

  // ── Avatar upload ─────────────────────────────────────────
  document.getElementById('avatar-file')?.addEventListener('change', async e => {
    const raw = e.target.files[0];
    if (!raw) return;

    // Show loading state
    const uploadBtn  = document.getElementById('avatar-upload-btn');
    const uploadIcon = document.getElementById('avatar-upload-icon');
    const uploadSpin = document.getElementById('avatar-upload-spin');
    if (uploadBtn)  uploadBtn.disabled    = true;
    if (uploadIcon) uploadIcon.style.display = 'none';
    if (uploadSpin) uploadSpin.style.display = '';

    try {
      // Compress to ≤ 500 KB
      const file = await compressAvatar(raw);

      // Instant preview (always use <img>)
      const previewUrl  = URL.createObjectURL(file);
      const imgEl       = document.getElementById('profile-avatar-img');
      const initialsEl  = document.getElementById('profile-avatar-initials');
      if (imgEl) {
        imgEl.src = previewUrl;
        imgEl.style.display = '';
        imgEl.onload = () => URL.revokeObjectURL(previewUrl);
      }
      if (initialsEl) initialsEl.style.display = 'none';

      // Upload to Supabase Storage
      const publicUrl = await Users.uploadAvatar(AuthState.user.id, file);
      await Users.updateProfile(AuthState.user.id, { profile_picture: publicUrl });

      // Update AuthState cache
      if (AuthState.profile) AuthState.profile.profile_picture = publicUrl;

      toast('Profile photo updated! ✅', 'success');
    } catch (err) {
      toast(err.message || 'Failed to upload photo', 'error');
    } finally {
      // Restore button
      if (uploadBtn)  uploadBtn.disabled    = false;
      if (uploadIcon) uploadIcon.style.display = '';
      if (uploadSpin) uploadSpin.style.display = 'none';
      e.target.value = ''; // allow re-selecting same file
    }
  });
}

window.removeAvatar = async function() {
  if (!confirm('Remove your profile photo?')) return;

  const btn = document.getElementById('avatar-remove-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }

  try {
    // Delete from storage
    const path = `avatars/${AuthState.user.id}.jpg`;
    await db.storage.from('profiles').remove([path]);

    // Clear in DB
    await Users.updateProfile(AuthState.user.id, { profile_picture: null });

    // Update AuthState cache
    if (AuthState.profile) AuthState.profile.profile_picture = null;

    // Update UI — show initials, hide img, hide remove button
    const imgEl      = document.getElementById('profile-avatar-img');
    const initialsEl = document.getElementById('profile-avatar-initials');
    if (imgEl)      { imgEl.src = ''; imgEl.style.display = 'none'; }
    if (initialsEl) initialsEl.style.display = '';
    if (btn)        btn.style.display = 'none';

    toast('Profile photo removed', 'info');
  } catch (err) {
    toast(err.message || 'Failed to remove photo', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Remove photo'; }
  }
};

window.saveProfile = async function() {
  const name    = sanitizeInput(document.getElementById('p-name')?.value || '');
  const mobile  = sanitizeInput(document.getElementById('p-mobile')?.value || '');

  if (!Validate.name(name)) { toast('Enter a valid name', 'error'); return; }
  if (mobile && !Validate.mobile(mobile)) { toast('Enter a valid mobile number', 'error'); return; }

  const updates = { full_name: name, mobile };

  if (AuthState.isTeacher) {
    updates.expertise        = sanitizeInput(document.getElementById('p-expertise')?.value || '');
    updates.bio              = sanitizeInput(document.getElementById('p-bio')?.value || '');
    updates.experience_years = parseInt(document.getElementById('p-experience')?.value) || 0;
  }

  try {
    await Users.updateProfile(AuthState.user.id, updates);
    await refreshProfile();
    toast('Profile updated!', 'success');
  } catch (err) {
    toast(err.message || 'Failed to update profile', 'error');
  }
};

window.changePassword = async function() {
  const { Auth } = await import('../supabase.js');
  const newPwd = document.getElementById('p-new-password')?.value || '';
  const errEl  = document.getElementById('err-p-password');

  if (!Validate.password(newPwd)) {
    if (errEl) { errEl.textContent = 'Min 8 chars with a number and special character'; errEl.classList.remove('hidden'); }
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  try {
    await Auth.updatePassword(newPwd);
    toast('Password updated!', 'success');
    document.getElementById('p-new-password').value = '';
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  }
};

window.confirmSignOut = function() {
  const { confirm } = window;
  // Use native browser confirm for speed
  if (window.confirm('Are you sure you want to sign out?')) {
    App.signOut();
  }
};

// ── TEACHER PROFILE VIEW (read-only) ──────────────────────────
async function renderTeacherProfileView(userId) {
  const el = document.getElementById('profile-content');

  try {
    const profile = await Users.getPublicProfile(userId);
    if (!profile) throw new Error('Teacher profile not found');

    let coursesHTML = '';
    try {
      const courses = await Courses.getByTeacher(userId);
      const approved = (courses || []).filter(c => c.status === 'approved');
      if (approved.length > 0) {
        coursesHTML = `
          <div class="glass-card--flat" style="padding:16px;margin-bottom:16px">
            <h3 style="font-weight:700;font-size:15px;margin-bottom:14px">Courses by ${escapeHTML(profile.full_name)}</h3>
            <div style="display:flex;flex-direction:column;gap:10px">
              ${approved.map(c => {
                const price = c.discount_price || c.price;
                return `
                  <div onclick="App.navigate('course',{id:'${c.id}'})"
                    style="display:flex;gap:12px;align-items:center;cursor:pointer;padding:10px;border-radius:12px;background:var(--gray-50)">
                    ${c.thumbnail_url
                      ? `<img src="${escapeHTML(c.thumbnail_url)}" style="width:56px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0">`
                      : `<div style="width:56px;height:40px;border-radius:8px;background:var(--gradient-soft);flex-shrink:0"></div>`}
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(c.title)}</div>
                      <div style="font-size:12px;color:var(--purple-start);font-weight:700;margin-top:2px">LKR ${Number(price).toLocaleString()}</div>
                    </div>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>`;
              }).join('')}
            </div>
          </div>`;
      }
    } catch { /* courses load failed — skip */ }

    el.innerHTML = `
      <!-- Back -->
      <div style="padding:16px 16px 0;display:flex;align-items:center;gap:10px">
        <button class="icon-btn" onclick="history.back()">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style="font-weight:700;font-size:16px">Teacher Profile</span>
      </div>

      <!-- Avatar & Info -->
      <div style="text-align:center;padding:24px 16px 20px;background:var(--gradient-soft)">
        ${profile.profile_picture
          ? `<img src="${escapeHTML(profile.profile_picture)}" class="avatar avatar-xl" style="border:3px solid white;box-shadow:var(--glass-shadow)">`
          : `<div class="avatar avatar-xl" style="border:3px solid white;box-shadow:var(--glass-shadow);font-size:28px">${getInitials(profile.full_name)}</div>`}
        <h2 style="font-family:var(--font-display);font-weight:800;font-size:20px;margin-top:12px">${escapeHTML(profile.full_name)}</h2>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:6px;flex-wrap:wrap">
          ${profile.expertise ? `<span class="chip chip-purple">${escapeHTML(profile.expertise)}</span>` : ''}
          ${profile.is_verified ? `<span class="chip" style="background:#ECFDF5;color:#059669">✅ Verified Teacher</span>` : ''}
          ${profile.experience_years ? `<span class="chip">${profile.experience_years} yrs experience</span>` : ''}
        </div>
      </div>

      <div style="padding:0 16px;margin-top:16px">
        ${profile.bio ? `
          <div class="glass-card--flat" style="padding:16px;margin-bottom:16px">
            <h3 style="font-weight:700;font-size:15px;margin-bottom:8px">About</h3>
            <p style="font-size:14px;color:var(--gray-500);line-height:1.7">${escapeHTML(profile.bio)}</p>
          </div>` : ''}

        ${coursesHTML}
      </div>`;

  } catch (err) {
    el.innerHTML = `
      <div style="padding:40px 24px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">👤</div>
        <p style="color:var(--gray-500);font-size:14px">${err.message || 'Could not load teacher profile'}</p>
        <button class="btn btn-ghost" onclick="history.back()" style="margin-top:16px">Go Back</button>
      </div>`;
  }
}
