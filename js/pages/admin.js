// ============================================================
// EduGuru — Admin Panel (Redesigned)
// ============================================================
import { Admin, Categories, Ads, Transactions, FirePromotions, Notifications, WalletV2, Refunds, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { formatLKR, formatCount, timeAgo, escapeHTML, toast } from '../utils.js';

// ── STYLES ────────────────────────────────────────────────────
const ADMIN_CSS = `
  .ap { min-height:100vh; background:#F5F3FF; padding-bottom:80px; }
  .ap-header {
    background:linear-gradient(135deg,#1a0533 0%,#3d1080 60%,#0f3460 100%);
    padding:20px 16px 24px; position:relative; overflow:hidden;
  }
  .ap-header::before {
    content:''; position:absolute; inset:0;
    background:radial-gradient(circle at 80% 20%,rgba(106,17,203,0.4) 0%,transparent 60%);
  }
  .ap-header-inner { position:relative; z-index:1; }
  .ap-title { font-family:var(--font-display); font-weight:800; font-size:22px; color:#fff; }
  .ap-sub { font-size:12px; color:rgba(255,255,255,0.6); margin-top:2px; }
  .ap-admin-badge {
    display:inline-flex; align-items:center; gap:6px; margin-top:10px;
    background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2);
    border-radius:99px; padding:4px 12px;
  }
  .ap-admin-badge span { font-size:12px; color:#fff; font-weight:600; }

  .ap-tabs {
    display:flex; gap:0; overflow-x:auto; scrollbar-width:none;
    background:#fff; border-bottom:2px solid #EDE9FE;
    position:sticky; top:0; z-index:10;
  }
  .ap-tabs::-webkit-scrollbar { display:none; }
  .ap-tab {
    display:flex; flex-direction:column; align-items:center; gap:2px;
    padding:8px 14px; border:none; background:none; cursor:pointer;
    font-size:10px; font-weight:600; color:#9CA3AF; white-space:nowrap;
    border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.15s;
    flex-shrink:0;
  }
  .ap-tab.active { color:#6A11CB; border-bottom-color:#6A11CB; }
  .ap-tab span { font-size:18px; }

  .ap-content { padding:16px; }
  .ap-card {
    background:#fff; border-radius:16px; padding:16px;
    box-shadow:0 2px 12px rgba(106,17,203,0.07);
    margin-bottom:12px;
  }
  .ap-card-hdr {
    display:flex; justify-content:space-between; align-items:center;
    margin-bottom:14px;
  }
  .ap-card-title { font-weight:700; font-size:15px; color:#1F2937; }

  /* Serial ID chip */
  .eg-id {
    display:inline-flex; align-items:center; gap:4px;
    background:#EDE9FE; color:#6A11CB;
    font-family:monospace; font-size:11px; font-weight:700;
    padding:3px 8px; border-radius:6px; cursor:pointer;
    border:1px solid #DDD6FE; user-select:none; transition:background 0.2s, color 0.2s, transform 0.15s;
  }
  .eg-id:hover { background:#DDD6FE; }
  .eg-id:active { transform:scale(0.95); }
  .eg-id::after { content:'📋'; font-size:9px; opacity:0.6; transition:content 0.2s; }
  .eg-id--copied { background:#D1FAE5 !important; color:#059669 !important; border-color:#6EE7B7 !important; transform:scale(1.05); }
  .eg-id--copied::after { content:'✓' !important; opacity:1; }

  /* Stat grid */
  .ap-stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
  .ap-stat {
    border-radius:14px; padding:14px;
    display:flex; flex-direction:column; gap:4px;
  }
  .ap-stat-val { font-family:var(--font-display); font-weight:800; font-size:18px; }
  .ap-stat-lbl { font-size:11px; opacity:0.7; font-weight:600; }

  /* Action buttons */
  .ap-btn { padding:8px 14px; border-radius:99px; border:none; cursor:pointer; font-size:12px; font-weight:700; transition:all 0.15s; }
  .ap-btn:active { transform:scale(0.96); }
  .ap-btn-green  { background:#D1FAE5; color:#065F46; }
  .ap-btn-red    { background:#FEE2E2; color:#991B1B; }
  .ap-btn-amber  { background:#FEF3C7; color:#92400E; }
  .ap-btn-purple { background:#EDE9FE; color:#6A11CB; }
  .ap-btn-gray   { background:#F3F4F6; color:#374151; }
  .ap-btn-full { width:100%; text-align:center; padding:11px; border-radius:12px; margin-bottom:6px; }
  .ap-btn-primary { background:linear-gradient(135deg,#6A11CB,#2575FC); color:#fff; }

  /* Row items */
  .ap-row {
    display:flex; align-items:flex-start; gap:12px;
    padding:14px 0; border-bottom:1px solid #F3F4F6;
  }
  .ap-row:last-child { border-bottom:none; padding-bottom:0; }
  .ap-avatar {
    width:40px; height:40px; border-radius:50%; flex-shrink:0;
    background:linear-gradient(135deg,#6A11CB,#2575FC);
    display:flex; align-items:center; justify-content:center;
    color:#fff; font-weight:700; font-size:14px; overflow:hidden;
  }
  .ap-avatar img { width:100%; height:100%; object-fit:cover; }
  .ap-row-info { flex:1; min-width:0; }
  .ap-row-name { font-weight:700; font-size:14px; color:#1F2937; }
  .ap-row-sub { font-size:12px; color:#6B7280; margin-top:2px; }
  .ap-row-actions { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }

  /* Status badge */
  .ap-badge {
    display:inline-block; padding:2px 8px; border-radius:99px;
    font-size:10px; font-weight:700;
  }
  .ap-badge-green  { background:#D1FAE5; color:#065F46; }
  .ap-badge-amber  { background:#FEF3C7; color:#92400E; }
  .ap-badge-red    { background:#FEE2E2; color:#991B1B; }
  .ap-badge-purple { background:#EDE9FE; color:#6A11CB; }
  .ap-badge-gray   { background:#F3F4F6; color:#6B7280; }

  /* Search */
  .ap-search-box {
    display:flex; gap:8px; margin-bottom:16px;
  }
  .ap-search-input {
    flex:1; border:2px solid #DDD6FE; border-radius:12px;
    padding:10px 14px; font-size:14px; font-family:monospace;
    outline:none; text-transform:uppercase;
  }
  .ap-search-input:focus { border-color:#6A11CB; }
  .ap-search-input::placeholder { text-transform:none; font-family:inherit; }

  /* Result card */
  .ap-result { background:#F5F3FF; border:1.5px solid #DDD6FE; border-radius:16px; padding:16px; margin-bottom:12px; }
  .ap-result-type { font-size:11px; font-weight:800; color:#6A11CB; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; }
  .ap-detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px; }
  .ap-detail-item { font-size:12px; }
  .ap-detail-lbl { color:#9CA3AF; font-size:10px; font-weight:600; text-transform:uppercase; }
  .ap-detail-val { color:#1F2937; font-weight:600; margin-top:1px; word-break:break-all; }

  /* Payment proof */
  .ap-proof-link {
    display:inline-flex; align-items:center; gap:5px;
    background:#EDE9FE; color:#6A11CB; padding:6px 12px; border-radius:8px;
    text-decoration:none; font-size:12px; font-weight:700;
  }

  /* Modal */
  .ap-modal-overlay {
    position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000;
    display:flex; align-items:flex-end;
  }
  .ap-modal {
    background:#fff; border-radius:20px 20px 0 0; padding:24px 16px;
    width:100%; max-height:80vh; overflow-y:auto;
  }
  .ap-modal-title { font-weight:800; font-size:17px; margin-bottom:16px; }
  .ap-modal textarea, .ap-modal input {
    width:100%; border:2px solid #E5E7EB; border-radius:12px;
    padding:10px 14px; font-size:14px; outline:none; font-family:inherit;
    box-sizing:border-box; margin-bottom:12px;
  }
  .ap-modal textarea:focus, .ap-modal input:focus { border-color:#6A11CB; }
`;

// ── SHELL ─────────────────────────────────────────────────────
export function renderAdminPanel() {
  const TABS = [
    { id:'overview',     icon:'🏠', label:'Overview'  },
    { id:'search',       icon:'🔍', label:'Search'    },
    { id:'payments',     icon:'💳', label:'Payments'  },
    { id:'courses',      icon:'📚', label:'Courses'   },
    { id:'users',        icon:'👥', label:'Users'     },
    { id:'batches',      icon:'📦', label:'Batches'   },
    { id:'banners',      icon:'🎯', label:'Ads'       },
    { id:'broadcast',    icon:'📢', label:'Broadcast' },
    { id:'withdrawals',  icon:'💰', label:'Payouts'   },
    { id:'refunds',      icon:'↩️', label:'Refunds'   },
    { id:'settings',     icon:'⚙️', label:'Settings'  },
  ];

  return `
    <style>${ADMIN_CSS}</style>
    <div class="ap" id="admin-panel">
      <div class="ap-header">
        <div class="ap-header-inner">
          <div class="ap-title">Admin Panel</div>
          <div class="ap-sub">EduGuru Platform Management</div>
          <div class="ap-admin-badge" id="ap-admin-info">
            <span>Loading...</span>
          </div>
        </div>
      </div>

      <div class="ap-tabs">
        ${TABS.map(t => `
          <button class="ap-tab" data-atab="${t.id}">
            <span>${t.icon}</span>${t.label}
          </button>`).join('')}
      </div>

      <div id="admin-tab-content" class="ap-content">
        ${spinner()}
      </div>
    </div>`;
}

export async function initAdminPanel(initialTab = 'overview') {
  // Show admin serial ID
  try {
    const { data: me } = await db.from('users').select('full_name, serial_id').eq('id', (await db.auth.getUser()).data?.user?.id).single();
    const el = document.getElementById('ap-admin-info');
    if (el && me) el.innerHTML = `<span>${escapeHTML(me.full_name || 'Admin')} · ${serialChip(me.serial_id, true)}</span>`;
  } catch {}

  initAdminTabs();
  await loadAdminTab(initialTab);
  document.querySelectorAll('[data-atab]').forEach(b => {
    b.classList.toggle('active', b.dataset.atab === initialTab);
  });
}

function initAdminTabs() {
  document.querySelectorAll('[data-atab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
      await loadAdminTab(btn.dataset.atab);
    });
  });
}

async function loadAdminTab(tab) {
  const map = {
    overview:    loadOverview,
    search:      loadSearch,
    payments:    loadPayments,
    courses:     loadCourses,
    users:       loadUsers,
    batches:     loadAdminBatches,
    banners:     loadBanners,
    broadcast:   loadBroadcast,
    withdrawals: loadWithdrawals,
    refunds:     loadRefunds,
    settings:    loadSettings,
  };
  await (map[tab] || loadOverview)();
}

window.adminGo = function(tab) {
  document.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('active', b.dataset.atab === tab));
  loadAdminTab(tab);
};

// ── HELPERS ───────────────────────────────────────────────────
function serialChip(id, small = false) {
  if (!id) return '<span style="color:#9CA3AF;font-size:11px">No ID</span>';
  return `<span class="eg-id" onclick="event.stopPropagation();copySerialId(this,'${id}')" title="Click to copy">${id}</span>`;
}
window.copySerialId = function(el, id) {
  // Show animation immediately (optimistic)
  el.classList.add('eg-id--copied');
  setTimeout(() => el.classList.remove('eg-id--copied'), 1500);
  // Try modern clipboard API, fall back to execCommand
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(id).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = id; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
  } else {
    const ta = document.createElement('textarea');
    ta.value = id; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
};
function spinner() {
  return `<div style="text-align:center;padding:48px"><svg class="spin" viewBox="0 0 24 24" width="32" height="32" stroke="#6A11CB" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;
}
function emptyMsg(msg) {
  return `<div style="text-align:center;padding:40px;color:#9CA3AF;font-size:14px">${msg}</div>`;
}
function errMsg(msg) {
  return `<div style="text-align:center;padding:32px;color:#EF4444;font-size:13px">⚠️ ${escapeHTML(msg)}</div>`;
}
function fmtD(d) { return d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
function initials(name) { return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function statusBadge(s) {
  const map = { approved:'ap-badge-green', pending:'ap-badge-amber', rejected:'ap-badge-red',
    changes_requested:'ap-badge-purple', active:'ap-badge-green', completed:'ap-badge-gray',
    opening:'ap-badge-purple', upcoming:'ap-badge-amber', cancelled:'ap-badge-red' };
  return `<span class="ap-badge ${map[s]||'ap-badge-gray'}">${(s||'').replace('_',' ').toUpperCase()}</span>`;
}
function modal(id, titleHtml, bodyHtml, footerHtml) {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.className = 'ap-modal-overlay'; el.id = id;
  el.innerHTML = `<div class="ap-modal">
    <div class="ap-modal-title">${titleHtml}</div>
    ${bodyHtml}
    <div style="display:flex;gap:8px;margin-top:4px">${footerHtml}</div>
  </div>`;
  el.addEventListener('click', e => { if(e.target === el) { el.remove(); document.body.style.overflow=''; } });
  document.body.appendChild(el);
  document.body.style.overflow = 'hidden';
}
function closeModal() { document.querySelector('.ap-modal-overlay')?.remove(); document.body.style.overflow=''; }

// ── OVERVIEW ──────────────────────────────────────────────────
async function loadOverview() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const stats = await Admin.getAnalytics();
    c.innerHTML = `
      <div class="ap-stats">
        <div class="ap-stat" style="background:#EDE9FE">
          <div class="ap-stat-val" style="color:#6A11CB">${formatCount(stats.totalStudents)}</div>
          <div class="ap-stat-lbl" style="color:#6A11CB">👨‍🎓 Students</div>
        </div>
        <div class="ap-stat" style="background:#DBEAFE">
          <div class="ap-stat-val" style="color:#1D4ED8">${formatCount(stats.totalTeachers)}</div>
          <div class="ap-stat-lbl" style="color:#1D4ED8">👩‍🏫 Teachers</div>
        </div>
        <div class="ap-stat" style="background:#D1FAE5">
          <div class="ap-stat-val" style="color:#065F46">${formatCount(stats.totalCourses)}</div>
          <div class="ap-stat-lbl" style="color:#065F46">📚 Live Courses</div>
        </div>
        <div class="ap-stat" style="background:#FEF3C7">
          <div class="ap-stat-val" style="color:#92400E">${formatCount(stats.totalEnrollments)}</div>
          <div class="ap-stat-lbl" style="color:#92400E">📈 Enrollments</div>
        </div>
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">💰 Revenue</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px">
          <span style="color:#6B7280">Total Collected</span>
          <strong>${formatLKR(stats.totalRevenue)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px">
          <span style="color:#6B7280">Platform (25%)</span>
          <strong style="color:#6A11CB">${formatLKR(stats.totalCommission)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span style="color:#6B7280">Teachers (75%)</span>
          <strong style="color:#10B981">${formatLKR(stats.totalTeacherPaid)}</strong>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <button class="ap-btn ap-btn-full ap-btn-primary" onclick="adminGo('payments')">💳 Payments</button>
        <button class="ap-btn ap-btn-full ap-btn-primary" onclick="adminGo('courses')">📚 Courses</button>
        <button class="ap-btn ap-btn-full" style="background:#EDE9FE;color:#6A11CB" onclick="adminGo('search')">🔍 Search</button>
        <button class="ap-btn ap-btn-full" style="background:#FEF3C7;color:#92400E" onclick="adminGo('broadcast')">📢 Broadcast</button>
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

// ── SEARCH ────────────────────────────────────────────────────
async function loadSearch() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = `
    <div class="ap-card">
      <div class="ap-card-title" style="margin-bottom:4px">🔍 Search by ID</div>
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:14px">
        EGS = Student · EGT = Teacher · EGC = Course · EGB = Batch
      </div>
      <div class="ap-search-box">
        <input class="ap-search-input" id="ap-search-input" placeholder="e.g. EGS2026000001" maxlength="16"
          oninput="this.value=this.value.toUpperCase()">
        <button class="ap-btn ap-btn-primary" style="padding:10px 16px;border-radius:12px" onclick="adminDoSearch()">Search</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['EGS','EGT','EGC','EGB'].map(p => `
          <span style="background:#F3F4F6;color:#374151;font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;font-family:monospace">
            ${p}${new Date().getFullYear()}000001
          </span>`).join('')}
      </div>
    </div>
    <div id="ap-search-result"></div>`;

  document.getElementById('ap-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.adminDoSearch();
  });
}

window.adminDoSearch = async function() {
  const query = document.getElementById('ap-search-input')?.value?.trim();
  if (!query || query.length < 6) { toast('Enter a valid ID', 'error'); return; }
  const res = document.getElementById('ap-search-result');
  res.innerHTML = spinner();
  try {
    const data = await Admin.searchBySerial(query);
    if (!data || data.type === 'not_found') {
      res.innerHTML = `<div class="ap-result">${emptyMsg('No record found for ' + query)}</div>`;
      return;
    }
    res.innerHTML = renderSearchResult(data);
  } catch (err) { res.innerHTML = errMsg(err.message); }
};

function renderSearchResult(d) {
  const type = d.type;
  const typeLabel = { student:'👨‍🎓 Student', teacher:'👩‍🏫 Teacher', admin:'🔐 Admin', course:'📚 Course', batch:'📦 Batch' }[type] || type;

  let body = `<div class="ap-result-type">${typeLabel}</div>`;

  if (['student','teacher','admin'].includes(type)) {
    const enrollList = (d.enrollments||[]).slice(0,5).map(e => `
      <div style="padding:8px;background:#fff;border-radius:10px;margin-bottom:6px;font-size:12px">
        <div style="font-weight:600">${escapeHTML(e.course_title||'')}</div>
        <div style="color:#6B7280">${escapeHTML(e.batch_title||'')} · ${fmtD(e.enrolled_at)}</div>
        ${e.course_serial ? serialChip(e.course_serial) : ''} ${e.batch_serial ? serialChip(e.batch_serial) : ''}
      </div>`).join('');

    const courseList = (d.courses||[]).slice(0,5).map(co => `
      <div style="padding:8px;background:#fff;border-radius:10px;margin-bottom:6px;font-size:12px">
        <div style="font-weight:600">${escapeHTML(co.title||'')}</div>
        <div>${statusBadge(co.status)} ${co.serial_id ? serialChip(co.serial_id) : ''}</div>
      </div>`).join('');

    const payList = (d.payments||[]).slice(0,5).map(p => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #F3F4F6">
        <span style="color:#374151">${escapeHTML(p.course_title||'')} · ${fmtD(p.submitted_at)}</span>
        <span style="font-weight:700">${formatLKR(p.amount)} ${statusBadge(p.status)}</span>
      </div>`).join('');

    body += `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="ap-avatar" style="width:52px;height:52px;font-size:16px">
          ${d.profile_picture ? `<img src="${escapeHTML(d.profile_picture)}" alt="">` : initials(d.full_name)}
        </div>
        <div>
          <div style="font-weight:800;font-size:16px">${escapeHTML(d.full_name||'')}</div>
          ${serialChip(d.serial_id)}
          <div style="margin-top:4px">${d.is_active ? '<span style="color:#10B981;font-size:12px">● Active</span>' : '<span style="color:#EF4444;font-size:12px">● Suspended</span>'}</div>
        </div>
      </div>
      <div class="ap-detail-grid">
        <div class="ap-detail-item"><div class="ap-detail-lbl">Email</div><div class="ap-detail-val">${escapeHTML(d.email||'')}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Mobile</div><div class="ap-detail-val">${escapeHTML(d.mobile||'—')}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Role</div><div class="ap-detail-val">${d.role||''}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Joined</div><div class="ap-detail-val">${fmtD(d.created_at)}</div></div>
        ${d.expertise ? `<div class="ap-detail-item" style="grid-column:1/-1"><div class="ap-detail-lbl">Expertise</div><div class="ap-detail-val">${escapeHTML(d.expertise)}</div></div>` : ''}
      </div>
      ${enrollList ? `<div style="margin-bottom:12px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">Enrollments</div>${enrollList}</div>` : ''}
      ${courseList ? `<div style="margin-bottom:12px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">Courses Created</div>${courseList}</div>` : ''}
      ${payList   ? `<div><div style="font-weight:700;font-size:13px;margin-bottom:6px">Payments</div>${payList}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="ap-btn ap-btn-amber" onclick="adminSuspendUser('${d.id}', ${d.is_active})">${d.is_active ? 'Suspend' : 'Reactivate'}</button>
      </div>`;

  } else if (type === 'course') {
    const batchList = (d.batches||[]).map(b => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #F3F4F6">
        <div>${escapeHTML(b.title)} ${serialChip(b.serial_id)}</div>
        <div>${statusBadge(b.status)} ${b.enrolled_count||0}/${b.max_students||'∞'}</div>
      </div>`).join('');
    body += `
      <div style="font-weight:800;font-size:16px;margin-bottom:6px">${escapeHTML(d.title||'')}</div>
      ${serialChip(d.serial_id)}
      <div class="ap-detail-grid" style="margin-top:10px">
        <div class="ap-detail-item"><div class="ap-detail-lbl">Status</div><div class="ap-detail-val">${statusBadge(d.status)}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Price</div><div class="ap-detail-val">${formatLKR(d.price||0)}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Teacher</div><div class="ap-detail-val">${escapeHTML(d.teacher_name||'')} ${serialChip(d.teacher_serial)}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Created</div><div class="ap-detail-val">${fmtD(d.created_at)}</div></div>
      </div>
      ${batchList ? `<div style="margin-top:12px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">Batches</div>${batchList}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="ap-btn ap-btn-red" onclick="adminDeleteCourse('${d.id}','${escapeHTML(d.title||'')}')">🗑 Delete</button>
      </div>`;

  } else if (type === 'batch') {
    const stuList = (d.students||[]).map(s => `
      <div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #F3F4F6">
        <span>${escapeHTML(s.student_name)} ${serialChip(s.student_serial)}</span>
        <span style="color:#9CA3AF">${fmtD(s.enrolled_at)}</span>
      </div>`).join('');
    body += `
      <div style="font-weight:800;font-size:16px;margin-bottom:6px">${escapeHTML(d.title||'')}</div>
      ${serialChip(d.serial_id)}
      <div class="ap-detail-grid" style="margin-top:10px">
        <div class="ap-detail-item"><div class="ap-detail-lbl">Status</div><div class="ap-detail-val">${statusBadge(d.status)}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Students</div><div class="ap-detail-val">${d.enrolled_count||0}/${d.max_students||'∞'}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">Start</div><div class="ap-detail-val">${fmtD(d.start_at)}</div></div>
        <div class="ap-detail-item"><div class="ap-detail-lbl">End</div><div class="ap-detail-val">${fmtD(d.end_at)}</div></div>
        <div class="ap-detail-item" style="grid-column:1/-1"><div class="ap-detail-lbl">Course</div><div class="ap-detail-val">${escapeHTML(d.course_title||'')} ${serialChip(d.course_serial)}</div></div>
        <div class="ap-detail-item" style="grid-column:1/-1"><div class="ap-detail-lbl">Teacher</div><div class="ap-detail-val">${escapeHTML(d.teacher_name||'')} ${serialChip(d.teacher_serial)}</div></div>
      </div>
      ${stuList ? `<div style="margin-top:12px"><div style="font-weight:700;font-size:13px;margin-bottom:6px">Students (${(d.students||[]).length})</div>${stuList}</div>` : ''}`;
  }

  return `<div class="ap-result">${body}</div>`;
}

// ── PAYMENTS ──────────────────────────────────────────────────
async function loadPayments() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const pending = await Admin.getPendingPayments();

    // Also load recent
    const { data: recent } = await db.from('transactions')
      .select(`id, amount, payment_status, submitted_at, student:users!student_id(full_name), course:courses(title)`)
      .neq('payment_status','pending')
      .order('submitted_at',{ascending:false}).limit(20);

    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-hdr">
          <div class="ap-card-title">⏳ Pending Payments (${pending.length})</div>
          <button class="ap-btn ap-btn-gray" onclick="adminGo('payments')">↺</button>
        </div>
        ${pending.length === 0 ? emptyMsg('All payments reviewed! ✅') :
          pending.map(t => `
            <div class="ap-row">
              <div class="ap-avatar">${initials(t.student?.full_name||t.student_name)}</div>
              <div class="ap-row-info" style="flex:1">
                <div class="ap-row-name">${escapeHTML(t.student?.full_name||t.student_name||'Student')}</div>
                <div>${t.student?.serial_id ? serialChip(t.student.serial_id) : ''}</div>
                <div class="ap-row-sub">${escapeHTML(t.course?.title||'')} · ${formatLKR(t.amount)}</div>
                ${t.course?.serial_id ? `<div style="margin-top:3px">${serialChip(t.course.serial_id)} ${t.batch?.serial_id ? serialChip(t.batch.serial_id) : ''}</div>` : ''}
                <div style="font-size:11px;color:#9CA3AF;margin-top:3px">${timeAgo(t.submitted_at)} · WA: ${escapeHTML(t.student_whatsapp||'—')}</div>
                ${t.proof_url
                  ? `<a href="${escapeHTML(t.proof_url)}" target="_blank" class="ap-proof-link" style="display:inline-flex;margin-top:6px">🖼 View Proof</a>`
                  : t.student_whatsapp
                    ? `<a href="https://wa.me/${t.student_whatsapp.replace(/\D/g,'')}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:11px;font-weight:600;color:#25D366;text-decoration:none">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.122 1.528 5.855L0 24l6.335-1.501A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 0 1-5.003-1.366l-.36-.214-3.76.89.948-3.658-.234-.374A9.786 9.786 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/></svg>
                        Verify on WhatsApp
                      </a>`
                    : ''}
                <div class="ap-row-actions">
                  <button class="ap-btn ap-btn-green" onclick="adminApprovePayment('${t.id}')">✓ Approve</button>
                  <button class="ap-btn ap-btn-amber" onclick="adminResubmitPayment('${t.id}')">🔄 Re-request</button>
                  <button class="ap-btn ap-btn-red" onclick="adminRejectPayment('${t.id}')">✗ Reject</button>
                </div>
              </div>
            </div>`).join('')}
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">📋 Recent Payments</div>
        ${(recent||[]).length === 0 ? emptyMsg('No payments yet') :
          (recent||[]).map(t => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #F3F4F6;font-size:13px">
              <div>
                <div style="font-weight:600">${escapeHTML(t.student?.full_name||'')}</div>
                <div style="color:#6B7280;font-size:11px">${escapeHTML(t.course?.title||'')} · ${timeAgo(t.submitted_at)}</div>
              </div>
              <div style="text-align:right">
                <div style="font-weight:700">${formatLKR(t.amount)}</div>
                ${statusBadge(t.payment_status)}
              </div>
            </div>`).join('')}
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

window.adminApprovePayment = async function(id) {
  const user = AuthState.user;
  try {
    const { error } = await db.rpc('approve_transaction', { txn_id: id, admin_id: user.id });
    if (error) throw error;
    toast('Payment approved & student enrolled!', 'success');
    await loadPayments();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminRejectPayment = function(id) {
  modal('ap-reject-payment-modal',
    '✗ Reject Payment',
    `<textarea id="ap-rej-reason" placeholder="Reason for rejection..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmRejectPayment('${id}')">Reject</button>`
  );
};

window.adminConfirmRejectPayment = async function(id) {
  const user = AuthState.user;
  try {
    await Transactions.reject(id, user.id);
    closeModal();
    toast('Payment rejected — student notified.', 'info');
    await loadPayments();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminResubmitPayment = function(id) {
  modal('ap-resubmit-modal',
    '🔄 Request Re-submission',
    `<textarea id="ap-resub-note" placeholder="Tell the student what to fix (e.g. image unclear, wrong amount)..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-amber ap-btn-full" onclick="adminConfirmResubmit('${id}')">Send Request</button>`
  );
};

window.adminConfirmResubmit = async function(id) {
  const note = document.getElementById('ap-resub-note')?.value?.trim() || '';
  try {
    await Admin.requestPaymentResubmit(id, note);
    closeModal();
    toast('Student notified to re-send payment proof.', 'success');
  } catch (err) { toast(err.message, 'error'); }
};

// ── COURSES ───────────────────────────────────────────────────
async function loadCourses() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const pending = await Admin.getPendingCourses();

    const { data: allCourses } = await db.from('courses')
      .select(`id, title, status, price, created_at, serial_id, teacher:users!teacher_id(full_name, serial_id)`)
      .eq('status','approved').order('created_at',{ascending:false}).limit(30);

    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-hdr">
          <div class="ap-card-title">⏳ Pending Review (${pending.length})</div>
          <button class="ap-btn ap-btn-gray" onclick="adminGo('courses')">↺</button>
        </div>
        ${pending.length === 0 ? emptyMsg('All courses reviewed! ✅') :
          pending.map(co => `
            <div class="ap-row">
              <div style="width:54px;height:38px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#EDE9FE">
                ${co.thumbnail_url ? `<img src="${escapeHTML(co.thumbnail_url)}" style="width:100%;height:100%;object-fit:cover">` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:20px">📚</div>'}
              </div>
              <div class="ap-row-info">
                <div class="ap-row-name">${escapeHTML(co.title)}</div>
                <div class="ap-row-sub">by ${escapeHTML(co.teacher?.full_name||'')} ${co.teacher?.serial_id ? serialChip(co.teacher.serial_id) : ''}</div>
                <div style="margin-top:3px">${statusBadge(co.status)} · ${formatLKR(co.price||0)} · ${timeAgo(co.created_at)}</div>
                ${co.short_tagline ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">${escapeHTML(co.short_tagline)}</div>` : ''}
                <div class="ap-row-actions">
                  <button class="ap-btn ap-btn-green" onclick="adminApproveCourse('${co.id}')">✓ Approve</button>
                  <button class="ap-btn ap-btn-amber" onclick="adminChangeCourse('${co.id}')">✏ Changes</button>
                  <button class="ap-btn ap-btn-red" onclick="adminRejectCourse('${co.id}')">✗ Reject</button>
                  <button class="ap-btn ap-btn-gray" onclick="App.navigate('course','${co.id}')">👁 View</button>
                </div>
              </div>
            </div>`).join('')}
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">✅ Live Courses (${(allCourses||[]).length})</div>
        ${(allCourses||[]).map(co => `
          <div class="ap-row">
            <div class="ap-row-info">
              <div class="ap-row-name">${escapeHTML(co.title)}</div>
              <div>${serialChip(co.serial_id)}</div>
              <div class="ap-row-sub" style="margin-top:3px">by ${escapeHTML(co.teacher?.full_name||'')} · ${formatLKR(co.price||0)}</div>
              <div class="ap-row-actions">
                <button class="ap-btn ap-btn-gray" onclick="App.navigate('course','${co.id}')">👁 View</button>
                <button class="ap-btn ap-btn-red" onclick="adminDeleteCourse('${co.id}','${escapeHTML(co.title)}')">🗑 Delete</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

window.adminApproveCourse = async function(id) {
  try {
    await Admin.approveCourse(id);
    toast('Course approved and live!', 'success');
    await loadCourses();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminRejectCourse = function(id) {
  modal('ap-reject-course-modal',
    '✗ Reject Course',
    `<textarea id="ap-rej-course-reason" placeholder="Reason for rejection..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmRejectCourse('${id}')">Reject</button>`
  );
};

window.adminConfirmRejectCourse = async function(id) {
  const reason = document.getElementById('ap-rej-course-reason')?.value?.trim() || 'Does not meet platform standards.';
  try {
    await Admin.rejectCourse(id, reason);
    closeModal();
    toast('Course rejected — teacher notified.', 'info');
    await loadCourses();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminChangeCourse = function(id) {
  modal('ap-change-course-modal',
    '✏️ Request Changes',
    `<textarea id="ap-change-course-fb" placeholder="Describe what needs to be changed..." rows="4"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-amber ap-btn-full" onclick="adminConfirmChangeCourse('${id}')">Send Request</button>`
  );
};

window.adminConfirmChangeCourse = async function(id) {
  const feedback = document.getElementById('ap-change-course-fb')?.value?.trim();
  if (!feedback) { toast('Enter feedback for the teacher', 'error'); return; }
  try {
    await Admin.requestCourseChanges(id, feedback);
    closeModal();
    toast('Change request sent to teacher!', 'success');
    await loadCourses();
  } catch (err) { toast(err.message, 'error'); }
};

window.adminDeleteCourse = function(id, title) {
  modal('ap-delete-course-modal',
    '🗑 Delete Course',
    `<p style="font-size:14px;color:#374151;margin-bottom:16px">Are you sure you want to permanently delete <strong>${escapeHTML(title)}</strong>? This cannot be undone.</p>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmDeleteCourse('${id}')">Delete Permanently</button>`
  );
};

window.adminConfirmDeleteCourse = async function(id) {
  try {
    await Admin.deleteCourse(id);
    closeModal();
    toast('Course deleted.', 'info');
    await loadCourses();
  } catch (err) { toast(err.message, 'error'); }
};

// ── USERS ─────────────────────────────────────────────────────
async function loadUsers() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const [students, teachers] = await Promise.all([
      Admin.getAllStudents(),
      Admin.getAllTeachersFull(),
    ]);
    const pending = teachers.filter(t => !t.is_verified);
    const verified = teachers.filter(t => t.is_verified);

    c.innerHTML = `
      ${pending.length ? `
      <div class="ap-card">
        <div class="ap-card-hdr">
          <div class="ap-card-title">👩‍🏫 Pending Teachers (${pending.length})</div>
        </div>
        ${pending.map(t => `
          <div class="ap-row">
            <div class="ap-avatar">${initials(t.full_name)}</div>
            <div class="ap-row-info">
              <div class="ap-row-name">${escapeHTML(t.full_name)}</div>
              <div>${serialChip(t.serial_id)}</div>
              <div class="ap-row-sub">${escapeHTML(t.email)} · ${escapeHTML(t.expertise||'')}</div>
              <div class="ap-row-actions">
                <button class="ap-btn ap-btn-green" onclick="adminApproveTeacher('${t.id}')">✓ Approve</button>
                <button class="ap-btn ap-btn-red" onclick="adminRejectTeacherPrompt('${t.id}')">✗ Reject</button>
              </div>
            </div>
          </div>`).join('')}
      </div>` : ''}

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">👩‍🏫 Teachers (${verified.length})</div>
        ${verified.map(t => `
          <div class="ap-row">
            <div class="ap-avatar">${initials(t.full_name)}</div>
            <div class="ap-row-info">
              <div class="ap-row-name">${escapeHTML(t.full_name)} ${t.is_active ? '' : '<span style="color:#EF4444;font-size:11px">Suspended</span>'}</div>
              <div>${serialChip(t.serial_id)}</div>
              <div class="ap-row-sub">${escapeHTML(t.email)} · Joined ${fmtD(t.created_at)}</div>
              <div class="ap-row-actions">
                <button class="ap-btn ${t.is_active ? 'ap-btn-amber' : 'ap-btn-green'}" onclick="adminSuspendUser('${t.id}',${t.is_active})">
                  ${t.is_active ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">👨‍🎓 Students (${students.length})</div>
        ${students.map(s => `
          <div class="ap-row">
            <div class="ap-avatar">${initials(s.full_name)}</div>
            <div class="ap-row-info">
              <div class="ap-row-name">${escapeHTML(s.full_name)} ${s.is_active ? '' : '<span style="color:#EF4444;font-size:11px">Suspended</span>'}</div>
              <div>${serialChip(s.serial_id)}</div>
              <div class="ap-row-sub">${escapeHTML(s.email)} · Joined ${fmtD(s.created_at)}</div>
              <div class="ap-row-actions">
                <button class="ap-btn ${s.is_active ? 'ap-btn-amber' : 'ap-btn-green'}" onclick="adminSuspendUser('${s.id}',${s.is_active})">
                  ${s.is_active ? 'Suspend' : 'Reactivate'}
                </button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

window.adminApproveTeacher = async function(id) {
  try { await Admin.approveTeacher(id); toast('Teacher approved!','success'); await loadUsers(); }
  catch (err) { toast(err.message,'error'); }
};

window.adminRejectTeacherPrompt = function(id) {
  modal('ap-rej-teacher-modal',
    '✗ Reject Teacher Application',
    `<textarea id="ap-rej-teacher-reason" placeholder="Reason..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmRejectTeacher('${id}')">Reject</button>`
  );
};

window.adminConfirmRejectTeacher = async function(id) {
  const r = document.getElementById('ap-rej-teacher-reason')?.value?.trim() || '';
  try { await Admin.rejectTeacher(id, r); closeModal(); toast('Teacher rejected','info'); await loadUsers(); }
  catch (err) { toast(err.message,'error'); }
};

window.adminSuspendUser = async function(id, isActive) {
  try {
    await Admin.suspendUser(id, isActive);
    toast(isActive ? 'User suspended.' : 'User reactivated.', 'info');
    // Reload whichever tab is visible
    await loadUsers();
  } catch (err) { toast(err.message,'error'); }
};

// ── BATCHES ───────────────────────────────────────────────────
async function loadAdminBatches() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const { data: batches, error } = await db.from('batches')
      .select(`id, title, status, start_at, end_at, enrolled_count, max_students, price, serial_id,
        course:courses(id, title, teacher:users!teacher_id(full_name))`)
      .order('created_at',{ascending:false}).limit(60);
    if (error) throw error;

    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-hdr">
          <div class="ap-card-title">📦 All Batches (${batches?.length||0})</div>
          <button class="ap-btn ap-btn-gray" onclick="adminGo('batches')">↺</button>
        </div>
        ${!batches?.length ? emptyMsg('No batches yet') :
          batches.map(b => `
            <div class="ap-row">
              <div class="ap-row-info">
                <div class="ap-row-name">${escapeHTML(b.title)}</div>
                <div>${serialChip(b.serial_id)} ${statusBadge(b.status)}</div>
                <div class="ap-row-sub" style="margin-top:3px">${escapeHTML(b.course?.title||'')} · by ${escapeHTML(b.course?.teacher?.full_name||'')}</div>
                <div style="font-size:12px;color:#6B7280;margin-top:2px">
                  👥 ${b.enrolled_count||0}/${b.max_students||'∞'} · 📅 ${fmtD(b.start_at)} → ${fmtD(b.end_at)} · ${formatLKR(b.price||0)}
                </div>
                <div class="ap-row-actions">
                  <button class="ap-btn ap-btn-purple" onclick="App.navigate('course-dashboard',{batchId:'${b.id}'})">🏫 Dashboard</button>
                </div>
              </div>
            </div>`).join('')}
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

// ── BANNERS / ADS ─────────────────────────────────────────────
async function loadBanners() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const ads = await Ads.getAll();
    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:14px">🎯 Create New Ad Banner</div>
        <div style="border:2px dashed #DDD6FE;border-radius:12px;padding:20px;text-align:center;margin-bottom:12px;cursor:pointer"
          onclick="document.getElementById('ap-banner-file').click()">
          <div id="ap-banner-preview" style="color:#9CA3AF;font-size:14px">📷 Click to upload banner (16:9)</div>
          <input type="file" id="ap-banner-file" accept="image/*" style="display:none">
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <input type="text" class="form-input" id="ap-banner-title" placeholder="Banner title">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <input type="url" class="form-input" id="ap-banner-url" placeholder="Link URL (optional)">
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <input type="number" class="form-input" id="ap-banner-priority" value="0" placeholder="Priority (higher = first)" min="0">
        </div>
        <button class="ap-btn ap-btn-primary ap-btn-full" onclick="adminUploadBanner()">Upload Banner</button>
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">Active Banners (${ads.length})</div>
        ${ads.length === 0 ? emptyMsg('No banners yet') :
          ads.map(ad => `
            <div class="ap-row">
              <img src="${escapeHTML(ad.image_url)}" style="width:70px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0">
              <div class="ap-row-info">
                <div class="ap-row-name">${escapeHTML(ad.title||'Untitled')}</div>
                <div style="font-size:11px;color:#9CA3AF">Priority ${ad.priority_order} · ${ad.is_active?'🟢 Active':'🔴 Inactive'}</div>
                <div class="ap-row-actions">
                  <button class="ap-btn ap-btn-amber" onclick="adminToggleBanner('${ad.id}',${!ad.is_active})">${ad.is_active?'Disable':'Enable'}</button>
                  <button class="ap-btn ap-btn-red" onclick="adminDeleteBanner('${ad.id}')">Delete</button>
                </div>
              </div>
            </div>`).join('')}
      </div>`;

    // Preview on file select
    document.getElementById('ap-banner-file')?.addEventListener('change', function() {
      const file = this.files?.[0];
      if (!file) return;
      const prev = document.getElementById('ap-banner-preview');
      const reader = new FileReader();
      reader.onload = e => { prev.innerHTML = `<img src="${e.target.result}" style="width:100%;border-radius:8px;aspect-ratio:16/9;object-fit:cover">`; };
      reader.readAsDataURL(file);
    });
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

window.adminUploadBanner = async function() {
  const file  = document.getElementById('ap-banner-file')?.files?.[0];
  const title = document.getElementById('ap-banner-title')?.value?.trim();
  const url   = document.getElementById('ap-banner-url')?.value?.trim();
  const prio  = parseInt(document.getElementById('ap-banner-priority')?.value)||0;
  if (!file) { toast('Please upload a banner image','error'); return; }
  try {
    const ext  = file.name.split('.').pop();
    const path = `ads/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('ads').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: { publicUrl } } = db.storage.from('ads').getPublicUrl(path);
    await db.from('fire_promotions').insert({ image_url: publicUrl, title, redirect_url: url||null, priority_order: prio, is_active: true });
    toast('Banner uploaded!','success');
    await loadBanners();
  } catch (err) { toast(err.message,'error'); }
};

window.adminToggleBanner = async function(id, active) {
  try { await db.from('fire_promotions').update({is_active:active}).eq('id',id); toast(active?'Banner enabled':'Banner disabled','info'); await loadBanners(); }
  catch (err) { toast(err.message,'error'); }
};

window.adminDeleteBanner = async function(id) {
  try { await db.from('fire_promotions').delete().eq('id',id); toast('Banner deleted','info'); await loadBanners(); }
  catch (err) { toast(err.message,'error'); }
};

// ── BROADCAST ─────────────────────────────────────────────────
async function loadBroadcast() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = `
    <div class="ap-card">
      <div class="ap-card-title" style="margin-bottom:14px">📢 Send Notification to All</div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Send To</label>
        <select id="ap-notif-target" style="width:100%;border:2px solid #E5E7EB;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit">
          <option value="all">Everyone (Students + Teachers)</option>
          <option value="student">Students Only</option>
          <option value="teacher">Teachers Only</option>
        </select>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Title</label>
        <input type="text" id="ap-notif-title" style="width:100%;border:2px solid #E5E7EB;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit" placeholder="Notification title">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">Message</label>
        <textarea id="ap-notif-msg" style="width:100%;border:2px solid #E5E7EB;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;resize:none;font-family:inherit;box-sizing:border-box" rows="4" placeholder="Write your message..."></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <select id="ap-notif-type" style="border:2px solid #E5E7EB;border-radius:12px;padding:10px;font-size:13px;outline:none;font-family:inherit">
          <option value="info">ℹ️ Info</option>
          <option value="success">✅ Success</option>
          <option value="warning">⚠️ Warning</option>
          <option value="enrollment">🎓 Enrollment</option>
        </select>
        <button class="ap-btn ap-btn-primary" style="padding:11px;border-radius:12px;font-size:14px" onclick="adminSendBroadcast()">Send 📢</button>
      </div>
    </div>`;
}

window.adminSendBroadcast = async function() {
  const target  = document.getElementById('ap-notif-target')?.value;
  const title   = document.getElementById('ap-notif-title')?.value?.trim();
  const message = document.getElementById('ap-notif-msg')?.value?.trim();
  const type    = document.getElementById('ap-notif-type')?.value || 'info';
  if (!title || !message) { toast('Enter title and message','error'); return; }
  try {
    const count = await Admin.broadcastNotification(title, message, target === 'all' ? null : target);
    toast(`Sent to ${count} user${count!==1?'s':''}!`,'success');
    document.getElementById('ap-notif-title').value = '';
    document.getElementById('ap-notif-msg').value = '';
  } catch (err) { toast(err.message,'error'); }
};

// ── WITHDRAWALS ───────────────────────────────────────────────
async function loadWithdrawals() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    // Active requests (pending or approved but not yet paid)
    const { data: active, error } = await db.from('withdrawals')
      .select(`
        id, amount_requested, amount_approved, status, requested_at, reviewed_at, paid_at,
        bank_name, bank_account, bank_holder, account_name, bank_branch, whatsapp_number, admin_note,
        teacher:users!teacher_id(id, full_name, serial_id),
        batch:batches!batch_id(id, title, serial_id, status),
        course:courses!course_id(id, title, serial_id)
      `)
      .in('status', ['pending', 'approved'])
      .order('requested_at', { ascending: true });
    if (error) throw error;

    // Payment history (paid + rejected)
    const { data: history } = await db.from('withdrawals')
      .select(`
        id, amount_requested, amount_approved, status, requested_at, paid_at, reviewed_at, admin_note,
        bank_name, bank_account, bank_holder, account_name, bank_branch, whatsapp_number,
        teacher:users!teacher_id(full_name, serial_id),
        batch:batches!batch_id(title, serial_id),
        course:courses!course_id(title, serial_id)
      `)
      .in('status', ['paid', 'rejected'])
      .order('paid_at', { ascending: false })
      .limit(30);

    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-LK', { day:'numeric', month:'short', year:'numeric' }) : '—';

    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">⏳ Pending Payouts (${active?.length || 0})</div>
        ${!active?.length ? emptyMsg('No pending payout requests') : active.map(w => `
          <div style="border:1.5px solid #E5E7EB;border-radius:14px;overflow:hidden;margin-bottom:12px">

            <!-- Teacher + Course + Batch header -->
            <div style="padding:12px 14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <div style="font-weight:700;font-size:14px">${escapeHTML(w.teacher?.full_name || '')}</div>
                  <div style="margin-top:3px">${w.teacher?.serial_id ? serialChip(w.teacher.serial_id) : ''}</div>
                </div>
                <span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:#FFF7ED;color:#D97706;flex-shrink:0">
                  ${w.status === 'approved' ? '✅ Approved' : '⏳ Pending'}
                </span>
              </div>
              <div style="margin-top:8px;font-size:12px;color:var(--gray-500)">
                ${w.course?.title ? `📚 ${escapeHTML(w.course.title)}${w.course.serial_id ? ' <span style="font-size:10px;color:var(--purple-start);">('+w.course.serial_id+')</span>' : ''}` : ''}
                ${w.batch?.title ? `<br>📦 ${escapeHTML(w.batch.title)}${w.batch.serial_id ? ' <span style="font-size:10px;color:var(--purple-start);">('+w.batch.serial_id+')</span>' : ''}` : ''}
              </div>
              ${w.course?.id && w.batch?.id ? `
              <div style="margin-top:8px">
                <button onclick="App.navigate('course-dashboard',{batchId:'${w.batch?.id}'})"
                  style="background:var(--gradient-soft);border:none;border-radius:8px;padding:4px 10px;font-size:11px;color:var(--purple-start);font-weight:600;cursor:pointer">
                  🏫 View Batch Dashboard
                </button>
              </div>` : ''}
            </div>

            <!-- Amount -->
            <div style="padding:10px 14px;background:#fff;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:11px;color:var(--gray-500)">Requested Amount</div>
                <div style="font-family:var(--font-display);font-weight:800;font-size:20px;color:var(--purple-start)">${formatLKR(w.amount_requested)}</div>
              </div>
              <div style="text-align:right;font-size:11px;color:var(--gray-400)">
                Requested ${timeAgo(w.requested_at)}
              </div>
            </div>

            <!-- Bank Details -->
            <div style="padding:10px 14px;background:#F0FDF4;border-bottom:1px solid #D1FAE5">
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#059669;margin-bottom:8px">🏦 Bank Transfer Details</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
                <div>
                  <div style="color:var(--gray-400);font-size:10px">Bank</div>
                  <div style="font-weight:600">${escapeHTML(w.bank_name || '—')}</div>
                </div>
                <div>
                  <div style="color:var(--gray-400);font-size:10px">Branch</div>
                  <div style="font-weight:600">${escapeHTML(w.bank_branch || '—')}</div>
                </div>
                <div>
                  <div style="color:var(--gray-400);font-size:10px">Account Number</div>
                  <div style="font-weight:800;color:var(--purple-start);font-size:13px">${escapeHTML(w.bank_account || w.account_number || '—')}</div>
                </div>
                <div>
                  <div style="color:var(--gray-400);font-size:10px">Account Name</div>
                  <div style="font-weight:600">${escapeHTML(w.bank_holder || w.account_name || '—')}</div>
                </div>
              </div>
              ${w.whatsapp_number ? `
              <div style="margin-top:8px;padding:6px 10px;background:#ECFDF5;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:8px">
                <span style="color:var(--gray-500)">📱 WhatsApp</span>
                <a href="https://wa.me/${escapeHTML(w.whatsapp_number)}" target="_blank"
                  style="font-weight:700;color:#059669;text-decoration:none">+${escapeHTML(w.whatsapp_number)}</a>
              </div>` : ''}
            </div>

            <!-- Actions -->
            <div style="padding:10px 14px;background:#fff;display:flex;gap:8px;flex-wrap:wrap">
              <button class="ap-btn ap-btn-gray" style="flex:1;min-width:80px" onclick="adminRejectWithdrawalPrompt('${w.id}')">✗ Reject</button>
              <button class="ap-btn ap-btn-amber" style="flex:1;min-width:80px" onclick="adminMarkPaidPrompt('${w.id}','${w.amount_requested}')">💳 Mark as Paid</button>
            </div>
          </div>`).join('')}
      </div>

      <div class="ap-card">
        <div class="ap-card-title" style="margin-bottom:12px">📋 Payment History (${history?.length || 0})</div>
        ${!history?.length ? emptyMsg('No payment history yet') : history.map(w => `
          <div style="padding:10px 0;border-bottom:1px solid #F3F4F6">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${escapeHTML(w.teacher?.full_name || '')} ${w.teacher?.serial_id ? serialChip(w.teacher.serial_id) : ''}</div>
                <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
                  ${w.course?.title ? escapeHTML(w.course.title) + ' · ' : ''}${w.batch?.title ? escapeHTML(w.batch.title) : ''}
                </div>
                <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
                  🏦 ${escapeHTML(w.bank_name || '—')} · ${escapeHTML(w.bank_account || w.account_number || '—')}
                </div>
                <div style="font-size:10px;color:var(--gray-300);margin-top:2px">
                  ${w.status === 'paid' ? `Paid ${fmtDate(w.paid_at)}` : `Rejected ${fmtDate(w.reviewed_at)}`}
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:800;font-size:14px">${formatLKR(w.amount_approved || w.amount_requested)}</div>
                ${statusBadge(w.status)}
                ${w.status === 'paid' && w.whatsapp_number ? `
                <div style="margin-top:4px">
                  <a href="https://wa.me/${escapeHTML(w.whatsapp_number)}" target="_blank"
                    style="font-size:10px;color:#059669;font-weight:600;text-decoration:none">📱 Teacher WA</a>
                </div>` : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>`;

  } catch (err) { c.innerHTML = errMsg(err.message); }
}

// Store withdrawal data for WhatsApp caption building
window._wdData = {};

window.adminMarkPaidPrompt = async function(id, amount) {
  // Fetch full withdrawal data for WhatsApp caption
  try {
    const { data: w } = await db.from('withdrawals')
      .select(`
        id, amount_requested, bank_name, bank_account, bank_holder, account_name, bank_branch, whatsapp_number,
        teacher:users!teacher_id(full_name),
        batch:batches!batch_id(title, serial_id),
        course:courses!course_id(title, serial_id)
      `)
      .eq('id', id).single();
    window._wdData[id] = w;
  } catch { /* proceed anyway */ }

  modal('ap-wd-paid-modal',
    '💳 Mark as Paid',
    `<p style="font-size:13px;color:var(--gray-500);margin-bottom:12px;line-height:1.5">
      Confirm you have manually transferred the amount to the teacher's bank account before proceeding.
     </p>
     <div style="background:#F0FDF4;border-radius:10px;padding:10px;margin-bottom:12px;font-size:12px">
       <div style="font-weight:700;margin-bottom:4px">Amount to pay:</div>
       <input type="number" id="ap-wd-paid-amount" value="${amount}"
         style="width:100%;border:2px solid #D1FAE5;border-radius:10px;padding:10px;font-size:16px;font-weight:800;outline:none;box-sizing:border-box;font-family:inherit;color:var(--purple-start)">
     </div>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-green ap-btn-full" onclick="adminConfirmMarkPaid('${id}')">✅ Confirm Paid + Send WhatsApp</button>`
  );
};

window.adminConfirmMarkPaid = async function(id) {
  const amount = parseFloat(document.getElementById('ap-wd-paid-amount')?.value);
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }

  const btn = document.querySelector('.modal-sheet .ap-btn-green');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    const { error } = await WalletV2.markPaid(id, amount);
    if (error) throw error;

    closeModal();
    toast('Marked as paid! Opening WhatsApp...', 'success');
    await loadWithdrawals();

    // Build WhatsApp caption and open
    const w = window._wdData[id];
    if (w?.whatsapp_number) {
      const teacherName  = w.teacher?.full_name || 'Teacher';
      const courseName   = w.course?.title  || '';
      const courseSerial = w.course?.serial_id || '';
      const batchName    = w.batch?.title   || '';
      const batchSerial  = w.batch?.serial_id || '';
      const bankName     = w.bank_name || '';
      const acctNo       = w.bank_account || w.account_number || '';
      const acctName     = w.bank_holder || w.account_name || '';
      const branch       = w.bank_branch || '';
      const today        = new Date().toLocaleDateString('en-LK', { day:'numeric', month:'long', year:'numeric' });
      const amtFmt       = 'LKR ' + Number(amount).toLocaleString();

      const caption = `Hi ${teacherName}! 👋

Your EduGuru payout has been processed! 🎉

📚 *Course:* ${courseName}${courseSerial ? ` (${courseSerial})` : ''}
📦 *Batch:* ${batchName}${batchSerial ? ` (${batchSerial})` : ''}
💰 *Amount Transferred:* ${amtFmt}
🏦 *Bank:* ${bankName}${branch ? ` — ${branch}` : ''}
🔢 *Account No.:* ${acctNo}
👤 *Account Name:* ${acctName}
📅 *Payment Date:* ${today}

Thank you for being an amazing teacher on EduGuru! 🌟 Your dedication is transforming the lives of students across Sri Lanka. Keep inspiring and keep growing! 💪

_Please reply with your payment receipt for our records._

With appreciation,
*EduGuru Team* ❤️`;

      const waUrl = `https://wa.me/${w.whatsapp_number}?text=${encodeURIComponent(caption)}`;
      window.open(waUrl, '_blank');
    } else {
      toast('⚠️ Teacher WhatsApp number not found — send receipt manually', 'warning', 5000);
    }
  } catch (err) {
    toast(err.message || 'Failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Confirm Paid + Send WhatsApp'; }
  }
};

window.adminRejectWithdrawalPrompt = function(id) {
  modal('ap-wd-reject-modal',
    '✗ Reject Payout',
    `<textarea id="ap-wd-reason" placeholder="Reason for rejection..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmRejectWithdrawal('${id}')">Reject</button>`
  );
};

window.adminConfirmRejectWithdrawal = async function(id) {
  const reason = document.getElementById('ap-wd-reason')?.value?.trim() || 'Rejected by admin';
  try {
    await WalletV2.rejectWithdrawal(id, reason);
    closeModal();
    toast('Withdrawal rejected.','info');
    await loadWithdrawals();
  } catch (err) { toast(err.message,'error'); }
};

// ── REFUNDS ───────────────────────────────────────────────────
async function loadRefunds() {
  const c = document.getElementById('admin-tab-content');
  c.innerHTML = spinner();
  try {
    const refunds = await Refunds.getPending();
    c.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-hdr">
          <div class="ap-card-title">↩️ Pending Refunds (${refunds.length})</div>
          <button class="ap-btn ap-btn-gray" onclick="adminGo('refunds')">↺</button>
        </div>
        ${!refunds.length ? emptyMsg('No pending refunds ✅') :
          refunds.map(r => `
            <div class="ap-row">
              <div class="ap-avatar">${initials(r.student?.full_name)}</div>
              <div class="ap-row-info">
                <div class="ap-row-name">${escapeHTML(r.student?.full_name||'')}</div>
                <div class="ap-row-sub">${escapeHTML(r.batch?.course?.title||'')} — ${escapeHTML(r.batch?.title||'')}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:12px;color:#6B7280;margin-top:6px">
                  <div>Paid: <strong>${formatLKR(r.amount_paid)}</strong></div>
                  <div>Sessions: <strong>${r.sessions_accessed}/${r.sessions_total}</strong></div>
                  <div>Refund: <strong style="color:#10B981">${formatLKR(r.refund_amount)}</strong></div>
                </div>
                ${r.reason ? `<div style="font-size:12px;color:#6B7280;margin-top:6px">"${escapeHTML(r.reason)}"</div>` : ''}
                <div class="ap-row-actions">
                  <button class="ap-btn ap-btn-green" onclick="adminApproveRefund('${r.id}')">✓ Approve</button>
                  <button class="ap-btn ap-btn-red" onclick="adminRejectRefundPrompt('${r.id}')">✗ Reject</button>
                </div>
              </div>
            </div>`).join('')}
      </div>`;
  } catch (err) { c.innerHTML = errMsg(err.message); }
}

window.adminApproveRefund = async function(id) {
  try { await Refunds.approve(id); toast('Refund approved!','success'); await loadRefunds(); }
  catch (err) { toast(err.message,'error'); }
};

window.adminRejectRefundPrompt = function(id) {
  modal('ap-ref-reject-modal',
    '✗ Reject Refund',
    `<textarea id="ap-ref-reason" placeholder="Reason..." rows="3"></textarea>`,
    `<button class="ap-btn ap-btn-gray ap-btn-full" onclick="closeModal()">Cancel</button>
     <button class="ap-btn ap-btn-red ap-btn-full" onclick="adminConfirmRejectRefund('${id}')">Reject</button>`
  );
};

window.adminConfirmRejectRefund = async function(id) {
  const reason = document.getElementById('ap-ref-reason')?.value?.trim() || 'Rejected by admin';
  try { await Refunds.reject(id, reason); closeModal(); toast('Refund rejected.','info'); await loadRefunds(); }
  catch (err) { toast(err.message,'error'); }
};

window.closeModal = closeModal;

// ── SETTINGS ──────────────────────────────────────────────────
async function loadSettings() {
  const c = document.getElementById('admin-tab-content');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('eduguru_settings')||'{}'); } catch {}

  const field = (key, label, val) => `
    <div style="margin-bottom:12px">
      <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">${label}</label>
      <input type="text" id="s-${key}" style="width:100%;border:2px solid #E5E7EB;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit"
        value="${escapeHTML(val)}" placeholder="${label}">
    </div>`;

  c.innerHTML = `
    <div class="ap-card">
      <div class="ap-card-title" style="margin-bottom:14px">🏦 Bank Transfer Details</div>
      ${field('bankName',    'Bank Name',       saved.bankName    ||'HNB Bank')}
      ${field('bankAccount','Account Number',   saved.bankAccount ||'250020397954')}
      ${field('bankHolder', 'Account Name',     saved.bankHolder  ||'MOHAMED MI I')}
      ${field('bankBranch', 'Branch',           saved.bankBranch  ||'Kattankudy')}
    </div>
    <div class="ap-card">
      <div class="ap-card-title" style="margin-bottom:14px">📞 Contact Details</div>
      ${field('whatsapp','WhatsApp (with country code)', saved.whatsapp||'94789929233')}
      ${field('phone',   'Display Phone',                saved.phone   ||'0789929233')}
      ${field('email',   'Contact Email',                saved.email   ||'eduguru1@gmail.com')}
    </div>
    <div class="ap-card">
      <div class="ap-card-title" style="margin-bottom:14px">🎓 Platform Identity</div>
      ${field('platformName','Platform Name', saved.platformName||'EduGuru')}
      ${field('tagline',     'Tagline',       saved.tagline     ||"Sri Lanka's Education Marketplace")}
    </div>
    <button class="ap-btn ap-btn-primary ap-btn-full" onclick="adminSaveSettings()">Save Settings</button>`;
}

window.adminSaveSettings = function() {
  const keys = ['bankName','bankAccount','bankHolder','bankBranch','whatsapp','phone','email','platformName','tagline'];
  const settings = {};
  keys.forEach(k => { const el = document.getElementById('s-'+k); if(el) settings[k] = el.value.trim(); });
  localStorage.setItem('eduguru_settings', JSON.stringify(settings));
  toast('Settings saved!','success');
};
