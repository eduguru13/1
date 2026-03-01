// ============================================================
// EduGuru — Course Dashboard (Per-Batch, Role-Based)
// Route: #course-dashboard?batchId=XXX
// ============================================================
import { BatchLessons, BatchChat, WalletV2, Curriculum, Courses, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { toast, escapeHTML, formatLKR, timeAgo, serialChip } from '../utils.js';

// ── CONSTANTS ────────────────────────────────────────────────
const LESSON_ICON  = { video: '🎬', live: '📡', resource: '📄', exam: '📝' };
const LESSON_LABEL = { video: 'Video', live: 'Live Class', resource: 'Resource', exam: 'Exam' };
const LESSON_CLR   = { video: '#3B82F6', live: '#EF4444', resource: '#8B5CF6', exam: '#F59E0B' };
const STATUS_CLR   = { opening: '#8B5CF6', upcoming: '#F59E0B', active: '#10B981', completed: '#6B7280', cancelled: '#EF4444' };
const STATUS_BG    = { opening: '#F5F3FF', upcoming: '#FFFBEB', active: '#ECFDF5', completed: '#F9FAFB', cancelled: '#FEF2F2' };

const TABS = {
  student: [
    { id: 'modules',    icon: '📚', label: 'Modules'   },
    { id: 'chat',       icon: '💬', label: 'Chat'      },
    { id: 'students',   icon: '👥', label: 'Students'  },
    { id: 'schedule',   icon: '📅', label: 'Schedule'  },
    { id: 'progress',   icon: '✅', label: 'Progress'  },
    { id: 'support',    icon: '🎧', label: 'Support'   },
  ],
  teacher: [
    { id: 'curriculum', icon: '📚', label: 'Curriculum'},
    { id: 'students',   icon: '👥', label: 'Students'  },
    { id: 'chat',       icon: '💬', label: 'Chat'      },
    { id: 'schedule',   icon: '📅', label: 'Schedule'  },
    { id: 'wallet',     icon: '💰', label: 'Earnings'  },
  ],
  admin: [
    { id: 'overview',   icon: '📊', label: 'Overview'  },
    { id: 'students',   icon: '👥', label: 'Students'  },
    { id: 'chat',       icon: '💬', label: 'Chat'      },
    { id: 'wallet',     icon: '💰', label: 'Wallet'    },
    { id: 'actions',    icon: '⚙️',  label: 'Actions'   },
  ],
};

// ── STATE ────────────────────────────────────────────────────
const S = {
  batchId: null,
  batch: null,
  course: null,
  user: null,
  profile: null,
  role: 'student',
  curriculum: null,
  activeTab: null,
  chatSub: null,
  chatPollInterval: null,  // polling fallback for realtime
  chatMessages: [],
  senderCache: {},
  chatUnread: 0,
  timers: {},
};

// ── HELPERS ──────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function pct(done, total) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
function clearTimers() {
  Object.values(S.timers).forEach(clearInterval);
  S.timers = {};
}
function progressRing(percent, size = 72, stroke = 7) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
        stroke="url(#cdGrad)" stroke-width="${stroke}"
        stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round"/>
    </svg>`;
}

// ── INJECT STYLES ────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('cd-styles')) return;
  const s = document.createElement('style');
  s.id = 'cd-styles';
  s.textContent = `
    .cd { min-height:100vh; background:var(--bg); padding-bottom:80px; }
    .cd-hero {
      position:relative; min-height:200px; overflow:hidden;
      background:linear-gradient(135deg,#1a0533 0%,#2d1060 50%,#0f3460 100%);
    }
    .cd-hero-bg {
      position:absolute; inset:0; object-fit:cover; width:100%; height:100%;
      opacity:0.22; filter:blur(2px);
    }
    .cd-hero-overlay {
      position:relative; z-index:1; padding:14px 16px 20px;
      background:linear-gradient(to top, rgba(10,3,26,0.92) 0%, rgba(10,3,26,0.45) 60%, transparent 100%);
    }
    .cd-back-btn {
      display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.12);
      border:none; color:rgba(255,255,255,0.85); font-size:13px; padding:7px 12px;
      border-radius:99px; cursor:pointer; backdrop-filter:blur(8px);
      margin-bottom:14px; transition:background 0.15s;
    }
    .cd-back-btn:hover { background:rgba(255,255,255,0.2); }
    .cd-status-badge {
      display:inline-block; padding:3px 10px; border-radius:99px;
      font-size:10px; font-weight:800; letter-spacing:0.5px; text-transform:uppercase;
      margin-bottom:8px;
    }
    .cd-hero-title {
      font-family:var(--font-display); font-weight:800; font-size:20px;
      color:#fff; line-height:1.25; margin-bottom:10px;
    }
    .cd-hero-meta { display:flex; flex-wrap:wrap; gap:12px; }
    .cd-meta-chip {
      display:flex; align-items:center; gap:5px;
      font-size:12px; color:rgba(255,255,255,0.75);
    }

    /* Tab bar */
    .cd-tabs {
      display:flex; gap:0; overflow-x:auto; scrollbar-width:none;
      background:#fff; border-bottom:1.5px solid #F0F0F5;
      position:sticky; top:0; z-index:10;
    }
    .cd-tabs::-webkit-scrollbar { display:none; }
    .cd-tab {
      display:flex; flex-direction:column; align-items:center; gap:3px;
      padding:10px 16px; min-width:64px; cursor:pointer; border:none;
      background:transparent; font-size:11px; color:#9CA3AF; white-space:nowrap;
      font-weight:600; border-bottom:2px solid transparent; transition:all 0.2s;
      flex-shrink:0;
    }
    .cd-tab .cd-tab-icon { font-size:18px; }
    .cd-tab.active { color:#6A11CB; border-bottom-color:#6A11CB; }
    .cd-tab:hover:not(.active) { color:#4B5563; background:#F9FAFB; }

    /* Content area */
    .cd-content { padding:16px; }

    /* Module accordion */
    .cd-module {
      background:#fff; border-radius:16px; margin-bottom:10px;
      box-shadow:0 2px 12px rgba(0,0,0,0.06); overflow:hidden;
    }
    .cd-module-hdr {
      display:flex; align-items:center; gap:12px; padding:14px 16px;
      cursor:pointer; user-select:none;
    }
    .cd-module-icon {
      width:36px; height:36px; border-radius:10px; background:var(--gradient);
      display:flex; align-items:center; justify-content:center;
      font-size:16px; flex-shrink:0; color:#fff;
    }
    .cd-module-info { flex:1; }
    .cd-module-title { font-weight:700; font-size:14px; color:#111; }
    .cd-module-sub { font-size:12px; color:#9CA3AF; margin-top:1px; }
    .cd-module-chevron { transition:transform 0.25s; font-size:16px; color:#9CA3AF; }
    .cd-module.open .cd-module-chevron { transform:rotate(180deg); }
    .cd-module-body { border-top:1.5px solid #F3F4F6; }

    /* Lesson row */
    .cd-lesson {
      display:flex; align-items:center; gap:12px;
      padding:12px 16px; border-bottom:1px solid #F9FAFB;
      transition:background 0.15s;
    }
    .cd-lesson:last-child { border-bottom:none; }
    .cd-lesson.done { background:#F0FDF4; }
    .cd-lesson.live-now { background:#FFF5F5; }
    .cd-lesson-type-dot {
      width:34px; height:34px; border-radius:10px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center; font-size:16px;
    }
    .cd-lesson-info { flex:1; min-width:0; }
    .cd-lesson-title { font-weight:600; font-size:13px; color:#1F2937; }
    .cd-lesson-meta { font-size:11px; color:#9CA3AF; margin-top:2px; }
    .cd-lesson-actions { display:flex; gap:6px; align-items:center; flex-shrink:0; }
    .cd-btn-sm {
      padding:5px 12px; border-radius:99px; font-size:12px; font-weight:700;
      border:none; cursor:pointer; transition:opacity 0.15s; white-space:nowrap;
    }
    .cd-btn-primary { background:var(--gradient); color:#fff; }
    .cd-btn-primary:hover { opacity:0.87; }
    .cd-btn-outline {
      background:#fff; color:#6A11CB; border:1.5px solid #E0D5F5;
    }
    .cd-btn-outline:hover { background:#F5F0FF; }
    .cd-done-check {
      width:22px; height:22px; border-radius:50%; background:#10B981;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; color:#fff; font-size:12px;
    }
    .cd-countdown {
      font-size:11px; font-weight:700; color:#EF4444;
      font-variant-numeric:tabular-nums;
    }
    .cd-live-badge {
      background:#EF4444; color:#fff; font-size:9px; font-weight:800;
      padding:2px 6px; border-radius:99px; letter-spacing:0.5px;
      animation:cdPulse 1.5s ease-in-out infinite;
    }
    @keyframes cdPulse {
      0%,100% { opacity:1; } 50% { opacity:0.6; }
    }

    /* Chat */
    /* WhatsApp-style chat layout — input always stuck to bottom */
    .cd-content:has(> .cd-chat) { padding:0; }
    .cd-chat {
      display:flex; flex-direction:column;
      height:calc(100dvh - var(--topbar-h, 56px) - 56px - 56px - var(--bottomnav-h, 64px));
      min-height:300px;
    }
    .cd-chat-msgs {
      flex:1; overflow-y:auto; padding:12px 16px; display:flex;
      flex-direction:column; gap:10px;
      overscroll-behavior:contain;
    }
    .cd-msg { display:flex; flex-direction:column; max-width:80%; }
    .cd-msg--me { align-self:flex-end; align-items:flex-end; }
    .cd-msg--other { align-self:flex-start; align-items:flex-start; }
    .cd-msg-sender {
      font-size:10px; color:#9CA3AF; margin-bottom:3px; font-weight:600;
      display:flex; align-items:center; gap:4px;
    }
    .cd-msg-bubble {
      padding:10px 14px; border-radius:16px; font-size:14px; line-height:1.5;
      word-break:break-word; max-width:100%;
    }
    .cd-msg--me .cd-msg-bubble {
      background:linear-gradient(135deg,#6A11CB,#2575FC); color:#fff;
      border-radius:16px 16px 4px 16px;
    }
    .cd-msg--other .cd-msg-bubble {
      background:#fff; color:#1F2937;
      box-shadow:0 1px 4px rgba(0,0,0,0.08);
      border-radius:16px 16px 16px 4px;
    }
    .cd-msg-time { font-size:10px; color:#CBD5E1; margin-top:3px; }
    .cd-msg-sender { font-size:10px; color:#9CA3AF; margin-bottom:3px; font-weight:600; display:flex; align-items:center; gap:4px; }
    .cd-msg--me .cd-msg-sender { justify-content:flex-end; }
    .cd-teacher-badge {
      background:linear-gradient(135deg,#F59E0B,#EF4444);
      color:#fff; font-size:9px; font-weight:800;
      padding:1px 5px; border-radius:4px;
    }
    /* Teacher messages — amber/gold bubble */
    .cd-msg--teacher.cd-msg--other .cd-msg-bubble {
      background:linear-gradient(135deg,#FEF3C7,#FDE68A); color:#92400E;
      border-left:3px solid #F59E0B;
    }
    .cd-msg--teacher.cd-msg--me .cd-msg-bubble {
      background:linear-gradient(135deg,#F59E0B,#EF4444); color:#fff;
    }
    .cd-chat-input-row {
      display:flex; gap:8px; padding:10px 16px 12px;
      border-top:1.5px solid #F0F0F5;
      background:#fff; flex-shrink:0;
      box-shadow:0 -2px 12px rgba(106,17,203,0.06);
    }
    .cd-chat-gap { height:12px; background:#fff; flex-shrink:0; }
    .cd-chat-input {
      flex:1; border:1.5px solid #E5E7EB; border-radius:24px;
      padding:10px 16px; font-size:14px; outline:none; resize:none;
      font-family:inherit; line-height:1.4; max-height:100px;
      background:#F9FAFB;
    }
    .cd-chat-input:focus { border-color:#6A11CB; }
    .cd-chat-send {
      width:42px; height:42px; border-radius:50%; border:none;
      background:var(--gradient); color:#fff; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:opacity 0.15s;
    }
    .cd-chat-send:hover { opacity:0.85; }

    /* Schedule */
    .cd-week { margin-bottom:16px; }
    .cd-week-label {
      font-size:12px; font-weight:700; color:#6A11CB;
      margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;
    }
    .cd-sched-item {
      display:flex; align-items:center; gap:10px;
      background:#fff; border-radius:12px; padding:10px 12px;
      margin-bottom:6px; box-shadow:0 1px 6px rgba(0,0,0,0.05);
    }
    .cd-sched-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .cd-sched-info { flex:1; }
    .cd-sched-title { font-size:13px; font-weight:600; color:#1F2937; }
    .cd-sched-date { font-size:11px; color:#9CA3AF; margin-top:1px; }

    /* Progress rings */
    .cd-progress-card {
      background:#fff; border-radius:20px; padding:20px;
      box-shadow:0 2px 12px rgba(0,0,0,0.07); margin-bottom:14px;
    }
    .cd-ring-wrap {
      display:flex; align-items:center; gap:16px; margin-bottom:16px;
    }
    .cd-ring-text { position:relative; }
    .cd-ring-pct {
      position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; pointer-events:none;
    }
    .cd-ring-num { font-family:var(--font-display); font-weight:800; font-size:16px; color:#1F2937; }
    .cd-ring-sub { font-size:9px; color:#9CA3AF; }

    /* Student row */
    .cd-student-row {
      display:flex; align-items:center; gap:12px;
      background:#fff; border-radius:12px; padding:12px;
      margin-bottom:8px; box-shadow:0 1px 6px rgba(0,0,0,0.05);
    }
    .cd-avatar {
      width:40px; height:40px; border-radius:50%; background:var(--gradient);
      display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:14px; color:#fff; flex-shrink:0; overflow:hidden;
    }
    .cd-avatar img { width:100%; height:100%; object-fit:cover; }
    .cd-student-info { flex:1; min-width:0; }
    .cd-student-name { font-weight:700; font-size:13px; color:#1F2937; }
    .cd-student-sub { font-size:11px; color:#9CA3AF; margin-top:1px; }
    .cd-mini-bar { height:4px; border-radius:2px; background:#E5E7EB; margin-top:5px; }
    .cd-mini-bar-fill { height:4px; border-radius:2px; background:var(--gradient); }

    /* Support */
    .cd-support-card {
      background:#fff; border-radius:20px; padding:24px 20px;
      box-shadow:0 2px 12px rgba(0,0,0,0.07); text-align:center;
      margin-bottom:14px;
    }
    .cd-support-icon {
      width:56px; height:56px; border-radius:18px;
      display:flex; align-items:center; justify-content:center;
      font-size:24px; margin:0 auto 12px;
    }
    .cd-support-title { font-weight:800; font-size:16px; color:#1F2937; margin-bottom:4px; }
    .cd-support-desc { font-size:13px; color:#9CA3AF; margin-bottom:16px; line-height:1.5; }
    .cd-support-btn {
      display:flex; align-items:center; justify-content:center; gap:8px;
      padding:12px 20px; border-radius:14px; font-size:14px; font-weight:700;
      text-decoration:none; border:none; cursor:pointer; width:100%;
      transition:opacity 0.15s;
    }
    .cd-support-btn:hover { opacity:0.87; }

    /* Stat card */
    .cd-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
    .cd-stat-card {
      border-radius:16px; padding:14px; color:#fff;
      display:flex; flex-direction:column; gap:4px;
    }
    .cd-stat-icon { font-size:20px; }
    .cd-stat-val { font-family:var(--font-display); font-weight:800; font-size:20px; }
    .cd-stat-lbl { font-size:11px; opacity:0.85; }

    /* Wallet / ledger */
    .cd-ledger-row {
      display:flex; justify-content:space-between; align-items:center;
      padding:10px 14px; background:#fff; border-radius:12px;
      margin-bottom:6px; box-shadow:0 1px 6px rgba(0,0,0,0.05);
    }
    .cd-ledger-label { font-size:13px; font-weight:600; color:#1F2937; }
    .cd-ledger-sub { font-size:11px; color:#9CA3AF; margin-top:1px; }
    .cd-ledger-amount { font-family:var(--font-display); font-weight:800; font-size:15px; }

    /* Actions */
    .cd-action-btn {
      display:flex; align-items:center; gap:10px; width:100%;
      padding:14px 16px; background:#fff; border-radius:14px; border:1.5px solid #E5E7EB;
      cursor:pointer; text-align:left; margin-bottom:10px; transition:border-color 0.15s;
    }
    .cd-action-btn:hover { border-color:#6A11CB; }
    .cd-action-icon {
      width:40px; height:40px; border-radius:12px; display:flex;
      align-items:center; justify-content:center; font-size:20px; flex-shrink:0;
    }

    /* Section header */
    .cd-sec-hdr {
      font-family:var(--font-display); font-weight:800; font-size:16px;
      color:#1F2937; margin-bottom:12px; margin-top:4px;
    }
    .cd-empty {
      text-align:center; padding:40px 20px; color:#9CA3AF; font-size:14px;
    }
    .cd-empty-icon { font-size:40px; margin-bottom:12px; }

    /* SVG defs for gradient */
    .cd-svg-defs { position:absolute; width:0; height:0; }
  `;
  document.head.appendChild(s);
}

// ── RENDER SHELL ─────────────────────────────────────────────
export function renderCourseDashboard() {
  return `<div class="cd" id="course-dashboard">
    <div style="text-align:center;padding:60px 20px">
      <svg class="spin" viewBox="0 0 24 24" width="32" height="32"
        stroke="#6A11CB" fill="none" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </div>
  </div>`;
}

// ── INIT ─────────────────────────────────────────────────────
export async function initCourseDashboard(batchId) {
  injectStyles();
  clearTimers();
  if (S.chatSub) { BatchChat.unsubscribe(S.chatSub); S.chatSub = null; }
  if (S.chatPollInterval) { clearInterval(S.chatPollInterval); S.chatPollInterval = null; }

  S.batchId = batchId;
  S.user        = AuthState.user;
  S.profile     = AuthState.profile;
  S.senderCache = {};
  S.chatUnread  = 0;
  S.role        = AuthState.profile?.role || 'student';
  if (S.role !== 'teacher' && S.role !== 'admin') S.role = 'student';

  const el = document.getElementById('course-dashboard');
  if (!el) return;

  try {
    const { data: batch, error: bErr } = await BatchLessons.getBatchDetail(batchId);
    if (bErr || !batch) {
      el.innerHTML = errScreen('Batch not found');
      return;
    }
    S.batch  = batch;
    S.course = batch.course;
    await BatchLessons.autoActivate();

    el.innerHTML = layoutHTML();
    initTabEvents();

    // Default tab per role
    const defaultTab = TABS[S.role][0].id;
    switchTab(defaultTab);
  } catch (err) {
    el.innerHTML = errScreen(err.message);
  }
}

// ── LAYOUT HTML ──────────────────────────────────────────────
function layoutHTML() {
  const b  = S.batch;
  const c  = S.course;
  const st = b.status || 'opening';

  const thumb = c?.thumbnail_url;
  const tabs  = TABS[S.role];

  return `
    <svg class="cd-svg-defs" aria-hidden="true">
      <defs>
        <linearGradient id="cdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6A11CB"/>
          <stop offset="100%" stop-color="#2575FC"/>
        </linearGradient>
      </defs>
    </svg>

    <!-- Hero -->
    <div class="cd-hero">
      ${thumb ? `<img class="cd-hero-bg" src="${escapeHTML(thumb)}" alt="">` : ''}
      <div class="cd-hero-overlay">
        <button class="cd-back-btn" onclick="history.back()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>

        <span class="cd-status-badge"
          style="background:${STATUS_BG[st]};color:${STATUS_CLR[st]}">
          ${st.toUpperCase()}
        </span>

        <div class="cd-hero-title">${escapeHTML(c?.title || b.title)}</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:4px">
          ${escapeHTML(b.title)}
          ${S.role !== 'student' && c?.teacher ? `· ${escapeHTML(c.teacher.full_name)}` : ''}
        </div>
        <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap">
          ${b.serial_id ? serialChip(b.serial_id) : ''}
          ${c?.serial_id ? serialChip(c.serial_id) : ''}
        </div>

        <div class="cd-hero-meta">
          <div class="cd-meta-chip">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${b.start_at ? fmtDate(b.start_at) : 'Not set'}
            ${b.end_at ? ` → ${fmtDate(b.end_at)}` : ''}
          </div>
          <div class="cd-meta-chip">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            ${b.enrolled_count || 0} / ${b.max_students || '∞'} students
          </div>
          ${c?.total_hours ? `<div class="cd-meta-chip">⏱ ${c.total_hours}h</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="cd-tabs" id="cd-tabs">
      ${tabs.map(t => `
        <button class="cd-tab" id="cd-tab-${t.id}" data-tab="${t.id}" onclick="cdSwitchTab('${t.id}')">
          <div style="position:relative;display:inline-flex;justify-content:center">
            <span class="cd-tab-icon">${t.icon}</span>
            <span id="cd-tab-dot-${t.id}" style="display:none;position:absolute;top:-2px;right:-4px;width:8px;height:8px;background:#EF4444;border-radius:50%;border:1.5px solid white"></span>
          </div>
          <span>${t.label}</span>
        </button>`).join('')}
    </div>

    <!-- Tab Content -->
    <div class="cd-content" id="cd-tab-content">
      <div class="cd-empty"><div class="cd-empty-icon">⏳</div>Loading…</div>
    </div>
  `;
}

// ── TAB NAVIGATION ───────────────────────────────────────────
function initTabEvents() {
  window.cdSwitchTab = (tabId) => switchTab(tabId);
}

function switchTab(tabId) {
  // Update active tab button
  document.querySelectorAll('.cd-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Cleanup chat resources when leaving chat tab
  if (S.activeTab === 'chat') {
    if (S.chatSub) { BatchChat.unsubscribe(S.chatSub); S.chatSub = null; }
    if (S.chatPollInterval) { clearInterval(S.chatPollInterval); S.chatPollInterval = null; }
  }
  if (S.activeTab !== tabId) clearTimers();
  S.activeTab = tabId;

  // Clear unread dot when opening chat
  if (tabId === 'chat') {
    S.chatUnread = 0;
    const dot = document.getElementById('cd-tab-dot-chat');
    if (dot) dot.style.display = 'none';
  }

  // Scroll tab into view
  document.getElementById(`cd-tab-${tabId}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  // Render tab
  const content = document.getElementById('cd-tab-content');
  if (!content) return;
  content.innerHTML = `<div class="cd-empty"><svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="#6A11CB" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;

  const schedFn = (S.role === 'teacher' || S.role === 'admin')
    ? renderScheduleTab_teacher
    : renderScheduleTab_student;

  const map = {
    modules:    renderModulesTab,
    curriculum: renderCurriculumTab,
    chat:       renderChatTab,
    schedule:   schedFn,
    progress:   renderProgressTab,
    students:   S.role === 'student' ? renderStudentsTab_student : renderStudentsTab,
    wallet:     renderWalletTab,
    support:    renderSupportTab,
    overview:   renderOverviewTab,
    actions:    renderActionsTab,
  };
  const fn = map[tabId];
  if (fn) fn(content);
}

// ── LOADING HELPERS ──────────────────────────────────────────
function errScreen(msg) {
  return `<div class="cd-empty"><div class="cd-empty-icon">⚠️</div><p>${escapeHTML(msg)}</p></div>`;
}

// ============================================================
// STUDENT TABS
// ============================================================

// ── MODULES TAB (student) ────────────────────────────────────
async function renderModulesTab(container) {
  try {
    const { data: modules, error } = await BatchLessons.getCurriculum(S.batchId);
    if (error) throw error;
    S.curriculum = modules || [];

    if (!S.curriculum.length) {
      container.innerHTML = `<div class="cd-empty"><div class="cd-empty-icon">📚</div><p>No modules published yet.<br>Check back soon!</p></div>`;
      return;
    }

    const bStatus = S.batch.status;
    container.innerHTML = S.curriculum.map((mod, i) => moduleBlock(mod, i, bStatus)).join('');
    setupModuleToggles();
    startAllCountdowns();

    // expose globals for lesson actions
    window.cdAccessLesson   = accessLesson;
    window.cdMarkDone       = markDone;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

function moduleBlock(mod, idx, bStatus) {
  const lessons    = mod.lessons || [];
  const doneCount  = lessons.filter(l => l.is_done).length;
  const open       = idx === 0;

  return `
    <div class="cd-module ${open ? 'open' : ''}" id="cdmod-${mod.module_id}">
      <div class="cd-module-hdr" onclick="cdToggleModule('${mod.module_id}')">
        <div class="cd-module-icon">${idx + 1}</div>
        <div class="cd-module-info">
          <div class="cd-module-title">${escapeHTML(mod.module_title)}</div>
          <div class="cd-module-sub">${doneCount}/${lessons.length} lessons done</div>
        </div>
        <svg class="cd-module-chevron" viewBox="0 0 24 24" width="18" height="18"
          fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="cd-module-body" ${open ? '' : 'style="display:none"'}>
        ${lessons.length ? lessons.map(l => lessonRow(l, bStatus)).join('') : `<div style="padding:14px 16px;font-size:13px;color:#9CA3AF">No lessons in this module</div>`}
      </div>
    </div>`;
}

function lessonRow(l, bStatus) {
  const isDone    = l.is_done;
  const type      = l.lesson_type || 'video';
  const clr       = LESSON_CLR[type] || '#6B7280';
  const hasLink   = l.has_link;
  const isLive    = type === 'live' || type === 'exam';
  const liveStart = l.live_start ? new Date(l.live_start) : null;
  const liveEnd   = l.live_end   ? new Date(l.live_end)   : null;
  const now       = new Date();
  const isLiveNow = liveStart && liveEnd && now >= liveStart && now <= liveEnd;
  const upcoming  = liveStart && now < liveStart;
  const canAccess = hasLink && (bStatus === 'active' || l.is_public) &&
                    (!isLive || isLiveNow);

  let metaHTML = `<span style="color:${clr};font-weight:700">${LESSON_LABEL[type]}</span>`;
  let countdownId = `cd-cd-${l.id}`;

  if (isLive) {
    if (isLiveNow) {
      metaHTML += ` · <span class="cd-live-badge">● LIVE</span>`;
    } else if (upcoming) {
      metaHTML += ` · <span class="cd-countdown" id="${countdownId}">…</span>`;
    } else if (liveEnd && now > liveEnd) {
      metaHTML += ` · <span style="color:#9CA3AF">Ended ${timeAgo(l.live_end)}</span>`;
    }
    if (liveStart) metaHTML += `<br><span style="font-size:10px;color:#9CA3AF">${fmtDate(l.live_start)} ${fmtTime(l.live_start)}</span>`;
  }

  return `
    <div class="cd-lesson ${isDone ? 'done' : ''} ${isLiveNow ? 'live-now' : ''}"
      id="cdl-${l.id}">
      <div class="cd-lesson-type-dot" style="background:${clr}22">
        <span>${LESSON_ICON[type] || '📄'}</span>
      </div>
      <div class="cd-lesson-info">
        <div class="cd-lesson-title">${escapeHTML(l.title)}</div>
        <div class="cd-lesson-meta">${metaHTML}</div>
      </div>
      <div class="cd-lesson-actions">
        ${isDone
          ? `<div class="cd-done-check" title="Completed">✓</div>`
          : canAccess
            ? `<button class="cd-btn-sm cd-btn-primary" onclick="cdAccessLesson('${l.id}','${type}')">
                 ${type === 'live' || type === 'exam' ? 'Join' : 'Open'}
               </button>
               <button class="cd-btn-sm cd-btn-outline" onclick="cdMarkDone('${l.id}')">✓ Done</button>`
            : !hasLink
              ? `<span style="font-size:11px;color:#CBD5E1">Link pending</span>`
              : upcoming
                ? `<span style="font-size:11px;color:#F59E0B">Upcoming</span>`
                : bStatus === 'opening' || bStatus === 'upcoming'
                  ? `<span style="font-size:11px;color:#9CA3AF">Batch ${bStatus}</span>`
                  : ''
        }
      </div>
    </div>
    ${isLiveNow || upcoming ? `<script>/* countdown for ${l.id} queued */</script>` : ''}`;
}

function setupModuleToggles() {
  window.cdToggleModule = (modId) => {
    const el   = document.getElementById(`cdmod-${modId}`);
    const body = el?.querySelector('.cd-module-body');
    if (!el || !body) return;
    const open = el.classList.toggle('open');
    body.style.display = open ? '' : 'none';
  };
}

function startAllCountdowns() {
  // Find all countdown elements and start timers
  document.querySelectorAll('.cd-countdown[id^="cd-cd-"]').forEach(el => {
    const lessonId = el.id.replace('cd-cd-', '');
    // Find lesson in curriculum
    for (const mod of (S.curriculum || [])) {
      const lesson = (mod.lessons || []).find(l => l.id === lessonId);
      if (lesson?.live_start) {
        startCountdown(el.id, lesson.live_start);
        break;
      }
    }
  });
}

function startCountdown(elId, targetISO) {
  const target = new Date(targetISO).getTime();
  const tick = () => {
    const el  = document.getElementById(elId);
    if (!el) { clearInterval(S.timers[elId]); delete S.timers[elId]; return; }
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = 'Starting now!'; el.style.color = '#10B981'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  };
  tick();
  S.timers[elId] = setInterval(tick, 1000);
}

async function accessLesson(lessonId, type) {
  try {
    const { data, error } = await BatchLessons.access(lessonId);
    if (error) { toast(error.message, 'error'); return; }
    const url = data?.url || data;
    if (url) {
      window.open(url, '_blank', 'noopener');
    } else {
      toast('Link not available yet', 'info');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function markDone(lessonId) {
  try {
    const { error } = await BatchLessons.studentMarkDone(lessonId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Marked as done!', 'success');
    // Visually update the row
    const row = document.getElementById(`cdl-${lessonId}`);
    if (row) {
      row.classList.add('done');
      const actions = row.querySelector('.cd-lesson-actions');
      if (actions) actions.innerHTML = `<div class="cd-done-check">✓</div>`;
    }
    // Refresh curriculum cache and progress counters
    await refreshModuleProgress();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function refreshModuleProgress() {
  try {
    const { data } = await BatchLessons.getCurriculum(S.batchId);
    S.curriculum = data || [];
    S.curriculum.forEach(mod => {
      const lessons   = mod.lessons || [];
      const doneCount = lessons.filter(l => l.is_done).length;
      const subEl     = document.querySelector(`#cdmod-${mod.module_id} .cd-module-sub`);
      if (subEl) subEl.textContent = `${doneCount}/${lessons.length} lessons done`;
    });
  } catch { /* silent */ }
}

// ── CHAT TAB ─────────────────────────────────────────────────
async function renderChatTab(container) {
  const isTeacher = S.role === 'teacher' || S.role === 'admin';
  container.innerHTML = `
    <div class="cd-chat">
      <div class="cd-chat-msgs" id="cd-chat-msgs">
        <div class="cd-empty" style="padding:24px">
          <svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="#6A11CB" fill="none" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      </div>
      <div class="cd-chat-input-row">
        <textarea id="cd-chat-input" class="cd-chat-input" rows="1"
          placeholder="Type a message…" onkeydown="cdChatKey(event)"></textarea>
        <button class="cd-chat-send" onclick="cdChatSend()">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <div class="cd-chat-gap"></div>
    </div>`;

  // Load messages and build sender cache
  const { data: msgs, error } = await BatchChat.getMessages(S.batchId);
  S.chatMessages = msgs || [];
  S.chatMessages.forEach(m => { if (m.sender_id && m.sender) S.senderCache[m.sender_id] = m.sender; });
  renderMessages(S.chatMessages);

  // Helper: fetch & append messages newer than the last one we have
  async function fetchNewMessages() {
    const lastTs = S.chatMessages.filter(m => !m.id?.startsWith?.('opt-')).at(-1)?.created_at;
    const query = db
      .from('chat_messages')
      .select('id, message, created_at, sender_id, sender:users!sender_id(full_name, profile_picture, role)')
      .eq('batch_id', S.batchId)
      .order('created_at', { ascending: true });
    if (lastTs) query.gt('created_at', lastTs);
    const { data } = await query;
    (data || []).forEach(msg => {
      if (S.chatMessages.some(m => m.id === msg.id)) return;
      if (msg.sender_id) S.senderCache[msg.sender_id] = msg.sender;
      S.chatMessages.push(msg);
      appendMessage(msg);
      if (S.activeTab !== 'chat') {
        S.chatUnread++;
        const dot = document.getElementById('cd-tab-dot-chat');
        if (dot) dot.style.display = 'block';
      }
    });
  }

  // Realtime subscription — primary delivery
  S.chatSub = BatchChat.subscribe(S.batchId, async (row) => {
    // If payload.new is empty (RLS blocked the realtime row), fall back to a fetch
    if (!row?.id) { await fetchNewMessages(); return; }

    // Skip duplicates (optimistic messages already shown)
    if (S.chatMessages.some(m => m.id === row.id)) return;

    // Get sender from cache, else fetch profile only
    let sender = S.senderCache[row.sender_id];
    if (!sender) {
      const { data: prof } = await db
        .from('users')
        .select('full_name, profile_picture, role')
        .eq('id', row.sender_id)
        .single();
      sender = prof || {};
      if (row.sender_id) S.senderCache[row.sender_id] = sender;
    }

    const full = { ...row, sender };
    S.chatMessages.push(full);
    appendMessage(full);

    if (S.activeTab !== 'chat') {
      S.chatUnread++;
      const dot = document.getElementById('cd-tab-dot-chat');
      if (dot) dot.style.display = 'block';
    }
  });

  // Polling fallback (every 4s) — ensures delivery even if realtime fails
  if (S.chatPollInterval) clearInterval(S.chatPollInterval);
  S.chatPollInterval = setInterval(fetchNewMessages, 4000);

  window.cdChatKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cdChatSend(); } };
  window.cdChatSend = sendChat;
}

function renderMessages(msgs) {
  const box = document.getElementById('cd-chat-msgs');
  if (!box) return;
  if (!msgs.length) {
    box.innerHTML = `<div class="cd-empty" style="padding:24px 0">
      <div class="cd-empty-icon">💬</div>
      <p>No messages yet. Say hello!</p>
    </div>`;
    return;
  }
  box.innerHTML = msgs.map(m => msgBubble(m)).join('');
  box.scrollTop = box.scrollHeight;
}

function appendMessage(msg) {
  const box = document.getElementById('cd-chat-msgs');
  if (!box) return;
  const emptyEl = box.querySelector('.cd-empty');
  if (emptyEl) box.innerHTML = '';
  box.insertAdjacentHTML('beforeend', msgBubble(msg));
  box.scrollTop = box.scrollHeight;
}

function msgBubble(msg) {
  const isMe      = msg.sender_id === S.user?.id;
  const sender    = msg.sender || {};
  // Use profile data for current user's messages (auth user has no role/name)
  const role      = sender.role || (isMe ? S.profile?.role || S.role : '');
  const isTeacher = role === 'teacher' || role === 'admin';
  const roleLabel = role === 'admin' ? 'ADMIN' : role === 'teacher' ? 'TEACHER' : '';
  const name      = escapeHTML(sender.full_name || (isMe ? S.profile?.full_name : '') || 'Unknown');
  const text      = escapeHTML(msg.message || '');
  const time      = msg.created_at ? timeAgo(msg.created_at) : '';

  return `
    <div class="cd-msg cd-msg--${isMe ? 'me' : 'other'}${isTeacher ? ' cd-msg--teacher' : ''}">
      <div class="cd-msg-sender">
        ${name}
        ${isTeacher && roleLabel ? `<span class="cd-teacher-badge">${roleLabel}</span>` : ''}
      </div>
      <div class="cd-msg-bubble">${text}</div>
      <div class="cd-msg-time">${time}</div>
    </div>`;
}

async function sendChat() {
  const input = document.getElementById('cd-chat-input');
  const msg   = input?.value.trim();
  if (!msg || !S.user) return;

  input.value = '';
  input.style.height = '';

  // Optimistic update — show message immediately without waiting for Realtime
  const optimisticId = `opt-${Date.now()}`;
  const optimistic = {
    id:         optimisticId,
    message:    msg,
    sender_id:  S.user.id,
    created_at: new Date().toISOString(),
    sender: {
      full_name:       S.profile?.full_name,
      profile_picture: S.profile?.profile_picture,
      role:            S.profile?.role || S.role,
    },
  };
  // Cache own sender info
  S.senderCache[S.user.id] = optimistic.sender;
  S.chatMessages.push(optimistic);
  appendMessage(optimistic);

  try {
    const { data, error } = await BatchChat.send(S.batchId, S.user.id, msg);
    if (error) {
      // Remove optimistic message on failure
      S.chatMessages = S.chatMessages.filter(m => m.id !== optimisticId);
      renderMessages(S.chatMessages);
      toast(error.message, 'error');
    } else if (data?.id) {
      // Replace temp id with real DB id so Realtime dedup works
      const idx = S.chatMessages.findIndex(m => m.id === optimisticId);
      if (idx !== -1) S.chatMessages[idx].id = data.id;
    }
  } catch (err) {
    S.chatMessages = S.chatMessages.filter(m => m.id !== optimisticId);
    renderMessages(S.chatMessages);
    toast(err.message, 'error');
  }
}

// ── SCHEDULE TAB (student) ───────────────────────────────────
async function renderScheduleTab_student(container) {
  try {
    if (!S.curriculum) {
      const { data } = await BatchLessons.getCurriculum(S.batchId);
      S.curriculum = data || [];
    }
    const b = S.batch;
    const allLessons = S.curriculum.flatMap(m => m.lessons || []);

    if (!b.start_at) {
      container.innerHTML = `<div class="cd-empty">
        <div class="cd-empty-icon">📅</div>
        <p>Schedule not set yet.<br>Ask your teacher for the start date.</p>
      </div>`;
      return;
    }

    // Build schedule: live/exam lessons on their actual date, others distributed weekly
    const startMs    = new Date(b.start_at).getTime();
    const endMs      = b.end_at ? new Date(b.end_at).getTime() : startMs + 8 * 7 * 86400000;
    const totalWeeks = Math.max(1, Math.ceil((endMs - startMs) / (7 * 86400000)));

    const liveLessons  = allLessons.filter(l => l.live_start && (l.lesson_type === 'live' || l.lesson_type === 'exam'));
    const otherLessons = allLessons.filter(l => !l.live_start || (l.lesson_type !== 'live' && l.lesson_type !== 'exam'));
    const perWeek      = Math.max(1, Math.ceil(otherLessons.length / totalWeeks));

    // Group by week
    const weeks = {};
    for (let w = 0; w < totalWeeks; w++) {
      const wStart = new Date(startMs + w * 7 * 86400000);
      const wEnd   = new Date(startMs + (w + 1) * 7 * 86400000);
      weeks[w] = {
        label: `Week ${w + 1}: ${fmtDate(wStart.toISOString())} — ${fmtDate(wEnd.toISOString())}`,
        lessons: [],
      };
      // Distribute other lessons
      const slice = otherLessons.slice(w * perWeek, (w + 1) * perWeek);
      slice.forEach(l => weeks[w].lessons.push({ ...l, _wStart: wStart }));
    }

    // Place live/exam lessons in correct week
    liveLessons.forEach(l => {
      const lMs = new Date(l.live_start).getTime();
      const w   = Math.min(totalWeeks - 1, Math.floor((lMs - startMs) / (7 * 86400000)));
      if (weeks[Math.max(0, w)]) weeks[Math.max(0, w)].lessons.push(l);
    });

    const now = Date.now();
    let html = `
      <h2 class="cd-sec-hdr">📅 Study Schedule</h2>
      <p style="font-size:13px;color:#9CA3AF;margin-bottom:16px">
        ${fmtDate(b.start_at)} → ${b.end_at ? fmtDate(b.end_at) : 'Ongoing'}
      </p>`;

    Object.values(weeks).forEach(wk => {
      if (!wk.lessons.length) return;
      html += `<div class="cd-week"><div class="cd-week-label">${wk.label}</div>`;
      wk.lessons.forEach(l => {
        const type      = l.lesson_type || 'video';
        const done      = l.is_done;
        const dateStr   = l.live_start ? `${fmtDate(l.live_start)} ${fmtTime(l.live_start)}` : wk.label.split(':')[1]?.trim() || '';
        const clr       = done ? '#10B981' : LESSON_CLR[type] || '#6B7280';
        const isLiveNow = l.live_start && l.live_end && now >= new Date(l.live_start) && now <= new Date(l.live_end);
        html += `
          <div class="cd-sched-item" style="${isLiveNow ? 'border:1.5px solid #EF4444' : ''}">
            <div class="cd-sched-dot" style="background:${clr}"></div>
            <div class="cd-sched-info">
              <div class="cd-sched-title">
                ${LESSON_ICON[type]} ${escapeHTML(l.title)}
                ${done ? ' <span style="color:#10B981;font-size:11px">✓ Done</span>' : ''}
                ${isLiveNow ? ' <span class="cd-live-badge">● LIVE</span>' : ''}
              </div>
              <div class="cd-sched-date">${LESSON_LABEL[type]}${dateStr ? ' · ' + dateStr : ''}</div>
            </div>
          </div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

// ── PROGRESS TAB (student) ────────────────────────────────────
async function renderProgressTab(container) {
  try {
    if (!S.curriculum) {
      const { data } = await BatchLessons.getCurriculum(S.batchId);
      S.curriculum = data || [];
    }
    const allLessons  = S.curriculum.flatMap(m => m.lessons || []);
    const total       = allLessons.length;
    const done        = allLessons.filter(l => l.is_done).length;
    const p           = pct(done, total);

    container.innerHTML = `
      <h2 class="cd-sec-hdr">✅ My Progress</h2>

      <!-- Overall ring -->
      <div class="cd-progress-card">
        <div class="cd-ring-wrap">
          <div class="cd-ring-text" style="position:relative;width:72px;height:72px">
            ${progressRing(p)}
            <div class="cd-ring-pct">
              <div class="cd-ring-num">${p}%</div>
              <div class="cd-ring-sub">done</div>
            </div>
          </div>
          <div>
            <div style="font-family:var(--font-display);font-weight:800;font-size:18px;color:#1F2937">
              ${done} of ${total} lessons
            </div>
            <div style="font-size:13px;color:#9CA3AF;margin-top:4px">
              ${total - done} remaining
            </div>
            <div style="margin-top:8px;font-size:12px;color:${p >= 80 ? '#10B981' : p >= 40 ? '#F59E0B' : '#EF4444'};font-weight:700">
              ${p >= 80 ? '🔥 Great progress!' : p >= 40 ? '👍 Keep going!' : '💪 Just getting started!'}
            </div>
          </div>
        </div>

        ${S.batch.start_at && S.batch.end_at ? (() => {
          const elapsed = Date.now() - new Date(S.batch.start_at).getTime();
          const span    = new Date(S.batch.end_at).getTime() - new Date(S.batch.start_at).getTime();
          const timePct = Math.min(100, Math.round((elapsed / span) * 100));
          return `
            <div style="margin-top:12px">
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#9CA3AF;margin-bottom:5px">
                <span>Batch progress</span><span>${timePct}% of time elapsed</span>
              </div>
              <div style="height:6px;background:#E5E7EB;border-radius:3px">
                <div style="height:6px;background:var(--gradient);border-radius:3px;width:${timePct}%"></div>
              </div>
            </div>`;
        })() : ''}
      </div>

      <!-- Per module -->
      ${S.curriculum.map(mod => {
        const lessons  = mod.lessons || [];
        const mDone    = lessons.filter(l => l.is_done).length;
        const mPct     = pct(mDone, lessons.length);
        return `
          <div class="cd-progress-card" style="padding:14px 16px;margin-bottom:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div style="font-weight:700;font-size:13px;color:#1F2937">${escapeHTML(mod.module_title)}</div>
              <div style="font-size:12px;color:#9CA3AF">${mDone}/${lessons.length}</div>
            </div>
            <div class="cd-mini-bar">
              <div class="cd-mini-bar-fill" style="width:${mPct}%"></div>
            </div>
          </div>`;
      }).join('')}
    `;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

// ── SUPPORT TAB ───────────────────────────────────────────────
function renderSupportTab(container) {
  container.innerHTML = `
    <h2 class="cd-sec-hdr">🎧 Team Support</h2>
    <p style="font-size:13px;color:#9CA3AF;margin-bottom:20px">
      We're here to help! Reach out anytime.
    </p>

    <div class="cd-support-card">
      <div class="cd-support-icon" style="background:#ECFDF5">💬</div>
      <div class="cd-support-title">WhatsApp Support</div>
      <div class="cd-support-desc">Chat with our support team instantly on WhatsApp. We respond within minutes!</div>
      <a class="cd-support-btn" style="background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border-radius:14px"
         href="https://wa.me/94789929233?text=Hi%20EduGuru%20Support!%20I%20need%20help%20with%20my%20course."
         target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Chat on WhatsApp
      </a>
    </div>

    <div class="cd-support-card">
      <div class="cd-support-icon" style="background:#EFF6FF">📞</div>
      <div class="cd-support-title">Call Support</div>
      <div class="cd-support-desc">Prefer a call? Our team is available Mon–Sat, 9am to 6pm.</div>
      <a class="cd-support-btn" style="background:linear-gradient(135deg,#3B82F6,#1D4ED8);color:#fff;border-radius:14px"
         href="tel:+94789929233">
        📞 Call +94 78 992 9233
      </a>
    </div>

    <div class="cd-support-card">
      <div class="cd-support-icon" style="background:#FFF7ED">📧</div>
      <div class="cd-support-title">Email Support</div>
      <div class="cd-support-desc">Send us an email for non-urgent queries. We reply within 24 hours.</div>
      <a class="cd-support-btn" style="background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;border-radius:14px"
         href="mailto:eduguru1@gmail.com">
        📧 eduguru1@gmail.com
      </a>
    </div>
  `;
}

// ============================================================
// TEACHER TABS
// ============================================================

// ── CURRICULUM TAB (teacher) ──────────────────────────────────
async function renderCurriculumTab(container) {
  try {
    const { data: modules, error } = await BatchLessons.getCurriculum(S.batchId);
    if (error) throw error;
    S.curriculum = modules || [];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 class="cd-sec-hdr" style="margin:0">📚 Curriculum</h2>
        <button class="cd-btn-sm cd-btn-primary" onclick="cdAddModule()">➕ Add Module</button>
      </div>
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:8px 12px;
                  font-size:11.5px;color:#0369A1;margin-bottom:14px;display:flex;gap:6px;align-items:flex-start">
        <span style="font-size:14px">🔄</span>
        <span>Changes here <strong>sync to the course</strong> — new batches will get the updated curriculum. Links are batch-specific.</span>
      </div>
      ${!S.curriculum.length
        ? `<div class="cd-empty"><div class="cd-empty-icon">📚</div><p>No modules yet. Add your first module!</p></div>`
        : S.curriculum.map((mod, i) => teacherModuleBlock(mod, i)).join('')}`;

    setupModuleToggles();
    window.cdOpenLinkForm  = openLinkForm;
    window.cdTeacherDone   = teacherMarkComplete;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

function teacherModuleBlock(mod, idx) {
  const lessons = mod.lessons || [];
  const done    = lessons.filter(l => l.is_completed).length;
  return `
    <div class="cd-module ${idx === 0 ? 'open' : ''}" id="cdmod-${mod.module_id}">
      <div class="cd-module-hdr" onclick="cdToggleModule('${mod.module_id}')">
        <div class="cd-module-icon">${idx + 1}</div>
        <div class="cd-module-info">
          <div class="cd-module-title">${escapeHTML(mod.module_title)}</div>
          <div class="cd-module-sub">${done}/${lessons.length} completed</div>
        </div>
        <div style="display:flex;gap:4px;margin-left:auto" onclick="event.stopPropagation()">
          <button class="cd-btn-sm cd-btn-outline" style="padding:3px 8px;font-size:11px"
            onclick="cdRenameModule('${mod.module_id}','${escapeHTML(mod.module_title).replace(/'/g,"\\'")}')">✏️</button>
          <button class="cd-btn-sm cd-btn-outline" style="padding:3px 8px;font-size:11px;color:#EF4444;border-color:#EF4444"
            onclick="cdDeleteModule('${mod.module_id}')">🗑</button>
        </div>
        <svg class="cd-module-chevron" viewBox="0 0 24 24" width="18" height="18"
          fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:6px">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="cd-module-body" ${idx === 0 ? '' : 'style="display:none"'}>
        ${lessons.map(l => teacherLessonRow(l)).join('')}
        <div style="padding:10px 0 4px">
          <button class="cd-btn-sm cd-btn-outline" style="width:100%;justify-content:center"
            onclick="cdAddLesson('${mod.module_id}')">➕ Add Lesson</button>
        </div>
      </div>
    </div>`;
}

function teacherLessonRow(l) {
  const type  = l.lesson_type || 'video';
  const clr   = LESSON_CLR[type] || '#6B7280';
  const isLive = type === 'live' || type === 'exam';

  let linkMeta = l.has_link
    ? `<span style="color:#10B981;font-weight:700">● Link set</span>`
    + (l.is_public ? ` · <span style="color:#3B82F6">🌐 Public</span>` : ` · <span style="color:#9CA3AF">🔒 Enrolled</span>`)
    : `<span style="color:#EF4444">No link</span>`;

  if (isLive && l.live_start) {
    linkMeta += `<br><span style="font-size:10px;color:#9CA3AF">${fmtDate(l.live_start)} ${fmtTime(l.live_start)} → ${fmtTime(l.live_end)}</span>`;
  }

  return `
    <div class="cd-lesson ${l.is_completed ? 'done' : ''}">
      <div class="cd-lesson-type-dot" style="background:${clr}22">
        ${LESSON_ICON[type] || '📄'}
      </div>
      <div class="cd-lesson-info">
        <div class="cd-lesson-title">${escapeHTML(l.title)}</div>
        <div class="cd-lesson-meta">
          <span style="color:${clr};font-weight:700">${LESSON_LABEL[type]}</span>
          · ${linkMeta}
        </div>
      </div>
      <div class="cd-lesson-actions">
        <button class="cd-btn-sm cd-btn-outline" onclick="cdEditLesson('${l.id}','${escapeHTML(l.title).replace(/'/g,"\\'")}','${type}')">✏️</button>
        <button class="cd-btn-sm cd-btn-outline" onclick="cdOpenLinkForm('${l.id}','${type}','${l.live_start || ''}','${l.live_end || ''}','${l.is_public ? '1' : '0'}')">
          ${l.has_link ? '🔗' : '➕ Link'}
        </button>
        ${!l.is_completed
          ? `<button class="cd-btn-sm cd-btn-primary" onclick="cdTeacherDone('${l.id}')">✓</button>`
          : `<span style="color:#10B981;font-size:11px;font-weight:700">✓</span>`}
        <button class="cd-btn-sm cd-btn-outline" style="color:#EF4444;border-color:#EF4444" onclick="cdDeleteLesson('${l.id}')">🗑</button>
      </div>
    </div>`;
}

function openLinkForm(lessonId, lessonType, existingStart, existingEnd, existingPublic) {
  const isLive    = lessonType === 'live' || lessonType === 'exam';
  const canPublic = lessonType === 'video' || lessonType === 'resource';
  const urlLabel  = isLive ? 'Meeting / Join URL' : lessonType === 'resource' ? 'Resource URL' : 'Video URL';

  const modalId = 'cd-link-modal';
  document.getElementById(modalId)?.remove();

  const modal = document.createElement('div');
  modal.id    = modalId;
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;
    display:flex;align-items:flex-end;justify-content:center;padding:0;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:500px;
                max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="font-family:var(--font-display);font-weight:800;font-size:18px">
          Set ${LESSON_LABEL[lessonType]} Link
        </h3>
        <button onclick="document.getElementById('${modalId}').remove()"
          style="border:none;background:#F3F4F6;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:16px">×</button>
      </div>

      <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">
        ${urlLabel}
      </label>
      <input id="cd-link-url" type="url"
        placeholder="${isLive ? 'https://meet.google.com/...' : lessonType === 'resource' ? 'https://drive.google.com/...' : 'https://youtube.com/...'}"
        style="width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;box-sizing:border-box;outline:none;font-family:inherit">

      ${isLive ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
          <div>
            <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">Start Time</label>
            <input id="cd-link-start" type="datetime-local" value="${existingStart ? existingStart.slice(0,16) : ''}"
              style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:13px;box-sizing:border-box;font-family:inherit">
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">End Time</label>
            <input id="cd-link-end" type="datetime-local" value="${existingEnd ? existingEnd.slice(0,16) : ''}"
              style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:13px;box-sizing:border-box;font-family:inherit">
          </div>
        </div>` : ''}

      ${canPublic ? `
        <label style="display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer;padding:12px;background:#F9FAFB;border-radius:12px">
          <input type="checkbox" id="cd-link-public" ${existingPublic === '1' ? 'checked' : ''}
            style="width:16px;height:16px;accent-color:#6A11CB">
          <div>
            <div style="font-weight:700;font-size:13px">🌐 Public Access</div>
            <div style="font-size:12px;color:#9CA3AF">Anyone can access (not just enrolled students)</div>
          </div>
        </label>` : ''}

      <button onclick="cdSaveLessonLink('${lessonId}','${isLive}','${canPublic}')"
        style="width:100%;margin-top:18px;padding:14px;background:var(--gradient);color:#fff;
               border:none;border-radius:14px;font-weight:800;font-size:15px;cursor:pointer">
        Save Link
      </button>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  window.cdSaveLessonLink = async (lessonId, needsTime, canPub) => {
    const url       = document.getElementById('cd-link-url')?.value.trim();
    const liveStart = needsTime === 'true' ? document.getElementById('cd-link-start')?.value : null;
    const liveEnd   = needsTime === 'true' ? document.getElementById('cd-link-end')?.value : null;
    const isPublic  = canPub === 'true' ? (document.getElementById('cd-link-public')?.checked || false) : false;

    if (!url) { toast('Please enter a URL', 'error'); return; }
    if (needsTime === 'true' && (!liveStart || !liveEnd)) { toast('Please set start and end time', 'error'); return; }

    const btn = document.querySelector(`[onclick="cdSaveLessonLink('${lessonId}','${needsTime}','${canPub}')"]`);
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

    const { error } = await BatchLessons.setLink(lessonId, {
      url,
      liveStart: liveStart ? new Date(liveStart).toISOString() : null,
      liveEnd:   liveEnd   ? new Date(liveEnd).toISOString()   : null,
      isPublic,
    });
    if (error) { toast(error.message, 'error'); if (btn) { btn.textContent = 'Save Link'; btn.disabled = false; } return; }

    toast('Link saved!', 'success');
    document.getElementById(modalId)?.remove();
    const content = document.getElementById('cd-tab-content');
    if (content) renderCurriculumTab(content);
  };
}

async function teacherMarkComplete(lessonId) {
  if (!confirm('Mark this lesson as completed for all students?')) return;
  const { error } = await BatchLessons.complete(lessonId);
  if (error) { toast(error.message, 'error'); return; }
  toast('Lesson marked complete!', 'success');
  const content = document.getElementById('cd-tab-content');
  if (content) renderCurriculumTab(content);
}

// ── CURRICULUM CRUD HELPERS ────────────────────────────────────
function _cdReload() {
  const c = document.getElementById('cd-tab-content');
  if (c) renderCurriculumTab(c);
}

async function _cdSubmitModuleForReview() {
  const courseId = S.batch?.course_id || S.batch?.course?.id;
  if (!courseId) return;
  try {
    await Courses.update(courseId, { status: 'pending' });
    toast('Module changes submitted for admin review ✅', 'success');
  } catch { /* non-critical */ }
}

function _cdModuleModal(title, currentValue, onSave) {
  const id = 'cd-mod-modal';
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  el.innerHTML = `
    <div style="background:#fff;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:500px">
      <h3 style="font-family:var(--font-display);font-weight:800;font-size:17px;margin-bottom:16px">${title}</h3>
      <input id="cd-mod-inp" type="text" value="${escapeHTML(currentValue)}" placeholder="Module title"
        style="width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;box-sizing:border-box;font-family:inherit;outline:none">
      <div style="display:flex;gap:10px;margin-top:16px">
        <button onclick="document.getElementById('${id}').remove()"
          style="flex:1;padding:12px;border:1.5px solid #E5E7EB;border-radius:12px;font-weight:700;cursor:pointer;background:#fff">Cancel</button>
        <button id="cd-mod-save-btn"
          style="flex:2;padding:12px;background:var(--gradient);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer">Save</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.getElementById('cd-mod-save-btn').onclick = async () => {
    const val = document.getElementById('cd-mod-inp')?.value.trim();
    if (!val) { toast('Enter a title', 'error'); return; }
    document.getElementById('cd-mod-save-btn').textContent = 'Saving…';
    document.getElementById('cd-mod-save-btn').disabled = true;
    await onSave(val);
    el.remove();
  };
  setTimeout(() => document.getElementById('cd-mod-inp')?.focus(), 100);
}

function _cdLessonModal(title, currentTitle, currentType, onSave) {
  const id = 'cd-les-modal';
  document.getElementById(id)?.remove();
  const types = ['video','live','resource','exam'];
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  el.innerHTML = `
    <div style="background:#fff;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:500px">
      <h3 style="font-family:var(--font-display);font-weight:800;font-size:17px;margin-bottom:16px">${title}</h3>
      <input id="cd-les-inp" type="text" value="${escapeHTML(currentTitle)}" placeholder="Lesson title"
        style="width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;box-sizing:border-box;font-family:inherit;outline:none;margin-bottom:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${types.map(t => `
          <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;border:1.5px solid ${t===currentType?'#6A11CB':'#E5E7EB'};border-radius:10px;cursor:pointer;font-size:13px;font-weight:600">
            <input type="radio" name="cd-les-type" value="${t}" ${t===currentType?'checked':''} style="accent-color:#6A11CB">
            ${LESSON_ICON[t]} ${LESSON_LABEL[t]}
          </label>`).join('')}
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('${id}').remove()"
          style="flex:1;padding:12px;border:1.5px solid #E5E7EB;border-radius:12px;font-weight:700;cursor:pointer;background:#fff">Cancel</button>
        <button id="cd-les-save-btn"
          style="flex:2;padding:12px;background:var(--gradient);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer">Save</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) el.remove(); });
  document.getElementById('cd-les-save-btn').onclick = async () => {
    const val  = document.getElementById('cd-les-inp')?.value.trim();
    const type = document.querySelector('input[name="cd-les-type"]:checked')?.value || 'video';
    if (!val) { toast('Enter a title', 'error'); return; }
    document.getElementById('cd-les-save-btn').textContent = 'Saving…';
    document.getElementById('cd-les-save-btn').disabled = true;
    await onSave(val, type);
    el.remove();
  };
  setTimeout(() => document.getElementById('cd-les-inp')?.focus(), 100);
}

// Module: Add
window.cdAddModule = function() {
  _cdModuleModal('➕ Add Module', '', async (title) => {
    const courseId = S.batch?.course_id || S.batch?.course?.id;
    const nextIdx  = (S.curriculum?.length || 0);
    const { error } = await Curriculum.addModule(courseId, title, nextIdx);
    if (error) { toast(error.message, 'error'); return; }
    await _cdSubmitModuleForReview();
    _cdReload();
  });
};

// Module: Rename
window.cdRenameModule = function(moduleId, currentTitle) {
  _cdModuleModal('✏️ Rename Module', currentTitle, async (title) => {
    const { error } = await Curriculum.updateModule(moduleId, title);
    if (error) { toast(error.message, 'error'); return; }
    await _cdSubmitModuleForReview();
    _cdReload();
  });
};

// Module: Delete
window.cdDeleteModule = async function(moduleId) {
  if (!confirm('Delete this module and all its lessons? This cannot be undone.')) return;
  const { error } = await Curriculum.deleteModule(moduleId);
  if (error) { toast(error.message, 'error'); return; }
  await _cdSubmitModuleForReview();
  _cdReload();
};

// Lesson: Add
window.cdAddLesson = function(moduleId) {
  const courseId = S.batch?.course_id || S.batch?.course?.id;
  _cdLessonModal('➕ Add Lesson', '', 'video', async (title, lessonType) => {
    const { error } = await BatchLessons.add(S.batchId, moduleId, { title, lessonType });
    if (error) { toast(error.message, 'error'); return; }
    toast('Lesson added!', 'success');
    _cdReload();
  });
};

// Lesson: Edit title/type
window.cdEditLesson = function(lessonId, currentTitle, currentType) {
  _cdLessonModal('✏️ Edit Lesson', currentTitle, currentType, async (title, lessonType) => {
    const { error } = await BatchLessons.edit(lessonId, { title, lessonType });
    if (error) { toast(error.message, 'error'); return; }
    toast('Lesson updated!', 'success');
    _cdReload();
  });
};

// Lesson: Delete
window.cdDeleteLesson = async function(lessonId) {
  if (!confirm('Delete this lesson?')) return;
  const { error } = await BatchLessons.delete(lessonId);
  if (error) { toast(error.message, 'error'); return; }
  toast('Lesson deleted', 'info');
  _cdReload();
};

// ── STUDENTS TAB (student view — classmates) ──────────────────
async function renderStudentsTab_student(container) {
  container.innerHTML = `<div class="cd-empty"><svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="#6A11CB" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;
  try {
    // Fetch teacher info
    const b           = S.batch;
    const teacher     = b?.course?.teacher || {};
    const teacherName = escapeHTML(teacher.full_name || 'Teacher');
    const teacherPic  = teacher.profile_picture || null;

    // Fetch enrolled students
    const { data: rows, error } = await db
      .from('enrollments')
      .select('enrolled_at, student:users!student_id(id, full_name, profile_picture, serial_id)')
      .eq('batch_id', S.batchId)
      .order('enrolled_at', { ascending: true });
    if (error) throw error;

    const students = (rows || []).filter(r => r.student);

    container.innerHTML = `
      <h2 class="cd-sec-hdr">👨‍🏫 Teacher</h2>
      <div class="cd-student-row" style="margin-bottom:20px;border-bottom:1.5px solid #F0F0F5;padding-bottom:16px">
        <div class="cd-avatar" style="background:linear-gradient(135deg,#F59E0B,#EF4444)">
          ${teacherPic
            ? `<img src="${escapeHTML(teacherPic)}" alt="">`
            : `<span style="color:#fff;font-weight:800;font-size:14px">${(teacher.full_name||'T').charAt(0).toUpperCase()}</span>`}
        </div>
        <div class="cd-student-info">
          <div class="cd-student-name">${teacherName}</div>
          <div class="cd-student-sub" style="display:flex;align-items:center;gap:4px">
            <span style="background:linear-gradient(135deg,#F59E0B,#EF4444);color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:4px">TEACHER</span>
          </div>
        </div>
      </div>

      <h2 class="cd-sec-hdr">👥 Classmates (${students.length})</h2>
      ${students.length === 0 ? `<div class="cd-empty"><p>No classmates yet.</p></div>` :
        students.map((r, idx) => {
          const s    = r.student;
          const isMe = s.id === S.user?.id;
          const name = escapeHTML(s.full_name || 'Student');
          const num  = String(idx + 1).padStart(3, '0');
          return `
            <div class="cd-student-row">
              <div class="cd-avatar">
                ${s.profile_picture
                  ? `<img src="${escapeHTML(s.profile_picture)}" alt="">`
                  : initials(s.full_name)}
              </div>
              <div class="cd-student-info">
                <div class="cd-student-name">
                  ${name}
                  ${isMe ? `<span style="background:#EDE9FE;color:#6A11CB;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700;margin-left:4px">YOU</span>` : ''}
                </div>
                ${s.serial_id ? `<div style="margin-bottom:2px">${serialChip(s.serial_id)}</div>` : ''}
                <div class="cd-student-sub">Student #${num}</div>
              </div>
            </div>`;
        }).join('')}
    `;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

// ── STUDENTS TAB (teacher/admin) ──────────────────────────────
async function renderStudentsTab(container) {
  container.innerHTML = `<div class="cd-empty"><svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="#6A11CB" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;
  try {
    const { data: students, error } = await BatchLessons.getStudentsProgress(S.batchId);
    if (error) throw error;

    if (!students?.length) {
      container.innerHTML = `<div class="cd-empty"><div class="cd-empty-icon">👥</div><p>No students enrolled yet.</p></div>`;
      return;
    }

    const total = students[0]?.total_lessons || 0;
    container.innerHTML = `
      <h2 class="cd-sec-hdr">👥 Students (${students.length})</h2>
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:14px">${total} lessons total per student</div>
      ${students.map(s => {
        const p    = pct(s.done_count, total);
        const name = escapeHTML(s.full_name || 'Student');
        const last = s.last_done_at ? `Last active ${timeAgo(s.last_done_at)}` : 'No activity yet';
        return `
          <div class="cd-student-row">
            <div class="cd-avatar">
              ${s.profile_picture
                ? `<img src="${escapeHTML(s.profile_picture)}" alt="">`
                : initials(s.full_name)}
            </div>
            <div class="cd-student-info">
              <div class="cd-student-name">${name}</div>
              ${s.serial_id ? `<div style="margin-bottom:2px">${serialChip(s.serial_id)}</div>` : ''}
              <div class="cd-student-sub">${last} · ${s.done_count}/${total} lessons</div>
              <div class="cd-mini-bar">
                <div class="cd-mini-bar-fill" style="width:${p}%"></div>
              </div>
            </div>
            <div style="font-family:var(--font-display);font-weight:800;font-size:15px;
              color:${p >= 80 ? '#10B981' : p >= 40 ? '#F59E0B' : '#6B7280'}">
              ${p}%
            </div>
          </div>`;
      }).join('')}
    `;
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

// ── SCHEDULE TAB (teacher) ────────────────────────────────────
async function renderScheduleTab_teacher(container) {
  const b = S.batch;
  container.innerHTML = `
    <h2 class="cd-sec-hdr">📅 Batch Schedule</h2>

    <div class="cd-progress-card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-weight:700;color:#1F2937">Current Schedule</div>
        <button class="cd-btn-sm cd-btn-outline" onclick="cdOpenScheduleForm()">✏️ Edit</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div class="cd-ledger-row">
          <div><div class="cd-ledger-label">📅 Start Date</div></div>
          <div class="cd-ledger-amount" style="color:#1F2937">${b.start_at ? fmtDate(b.start_at) : '—'}</div>
        </div>
        <div class="cd-ledger-row">
          <div><div class="cd-ledger-label">🏁 End Date</div></div>
          <div class="cd-ledger-amount" style="color:#1F2937">${b.end_at ? fmtDate(b.end_at) : '—'}</div>
        </div>
        <div class="cd-ledger-row">
          <div><div class="cd-ledger-label">📊 Status</div></div>
          <span class="cd-status-badge" style="background:${STATUS_BG[b.status]};color:${STATUS_CLR[b.status]}">
            ${(b.status || 'opening').toUpperCase()}
          </span>
        </div>
      </div>
    </div>

    <div id="cd-sched-form-area"></div>`;

  window.cdOpenScheduleForm = openScheduleForm;
}

function openScheduleForm() {
  const area = document.getElementById('cd-sched-form-area');
  if (!area) return;
  const b = S.batch;
  const toLocal = iso => iso ? iso.slice(0, 16) : '';

  // Compute suggested end_at from course hours if not set
  const course = S.course;
  const suggestEnd = () => {
    const startEl = document.getElementById('cd-sched-start');
    if (!startEl?.value) return;
    const hours = course?.total_hours || 0;
    if (!hours) return;
    const endEl = document.getElementById('cd-sched-end');
    if (endEl && !endEl.value) {
      const ms  = parseFloat(hours) * 3600 * 1000;
      const end = new Date(new Date(startEl.value).getTime() + ms);
      endEl.value = toLocal(end.toISOString());
    }
  };

  area.innerHTML = `
    <div class="cd-progress-card">
      <h3 style="font-weight:800;font-size:15px;margin-bottom:14px">📅 Set Schedule</h3>

      <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">Start Date & Time</label>
      <input id="cd-sched-start" type="datetime-local" value="${toLocal(b.start_at)}"
        style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;margin-bottom:12px;box-sizing:border-box"
        onchange="(function(){const h=${course?.total_hours||0};if(!h)return;const e=document.getElementById('cd-sched-end');if(e&&!e.value){const ms=h*3600000;e.value=new Date(new Date(this.value).getTime()+ms).toISOString().slice(0,16);}}).call(this)">

      <label style="display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:6px">End Date & Time</label>
      <input id="cd-sched-end" type="datetime-local" value="${toLocal(b.end_at)}"
        style="width:100%;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:12px;font-size:14px;margin-bottom:6px;box-sizing:border-box">

      ${course?.total_hours ? `
      <div style="font-size:11px;color:#9CA3AF;margin-bottom:16px">
        💡 Course duration: ${course.total_hours}h — End date auto-suggested from start
      </div>` : '<div style="margin-bottom:16px"></div>'}

      <button onclick="cdSaveSchedule(false)" style="width:100%;padding:13px;background:var(--gradient);color:#fff;
        border:none;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:10px">
        💾 Save Schedule
      </button>
      <button onclick="cdSaveSchedule(true)" style="width:100%;padding:13px;background:linear-gradient(135deg,#10B981,#059669);color:#fff;
        border:none;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer">
        ⚡ Save & Auto-Schedule All Lessons
      </button>
      <div style="font-size:11px;color:#9CA3AF;margin-top:8px;text-align:center">
        Auto-schedule spreads all lessons evenly across start → end
      </div>
    </div>`;

  window.cdSaveSchedule = async (autoSchedule = false) => {
    const startVal = document.getElementById('cd-sched-start')?.value;
    const endVal   = document.getElementById('cd-sched-end')?.value;
    if (!startVal) { toast('Start date required', 'error'); return; }
    if (endVal && endVal <= startVal) { toast('End must be after start', 'error'); return; }
    if (autoSchedule && !endVal) { toast('End date required for auto-schedule', 'error'); return; }

    const startISO = new Date(startVal).toISOString();
    const endISO   = endVal ? new Date(endVal).toISOString() : null;

    if (autoSchedule) {
      // Auto-spread all lessons across the date range
      const { data: count, error } = await BatchLessons.autoScheduleLessons(S.batchId, startISO, endISO);
      if (error) { toast(error.message, 'error'); return; }
      toast(`✅ Schedule saved! ${count || 0} lessons auto-scheduled.`, 'success');
    } else {
      const { error } = await BatchLessons.setBatchSchedule(S.batchId, startISO, endISO);
      if (error) { toast(error.message, 'error'); return; }
      toast('Schedule saved!', 'success');
    }

    S.batch.start_at = startISO;
    S.batch.end_at   = endISO;
    area.innerHTML   = '';
    const content    = document.getElementById('cd-tab-content');
    if (content) renderScheduleTab_teacher(content);
  };
}

// ── WALLET TAB (teacher) ──────────────────────────────────────
async function renderWalletTab(container) {
  container.innerHTML = `<div class="cd-empty"><svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="#6A11CB" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;
  try {
    const { data: fin, error } = await BatchLessons.getBatchFinancial(S.batchId);
    if (error) throw error;

    const fin2    = fin || {};
    const total   = fin2.total_collected || 0;
    const pFee    = fin2.platform_cut || 0;
    const tShare  = fin2.teacher_share || 0;
    const balance = fin2.wallet_balance || 0;
    const withdrawn = fin2.withdrawn || 0;
    const withdrawals = fin2.withdrawals || [];

    container.innerHTML = `
      <h2 class="cd-sec-hdr">💰 Earnings</h2>

      <div style="background:linear-gradient(135deg,#F59E0B,#D97706);border-radius:20px;padding:20px;color:#fff;margin-bottom:16px;text-align:center">
        <div style="font-size:13px;opacity:0.85;margin-bottom:4px">Your Share (75%)</div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:28px">${formatLKR(tShare)}</div>
        <div style="font-size:12px;opacity:0.7;margin-top:4px">From ${S.batch.enrolled_count || 0} enrollments</div>
      </div>

      <div class="cd-stat-grid">
        <div class="cd-stat-card" style="background:linear-gradient(135deg,#3B82F6,#1D4ED8)">
          <div class="cd-stat-icon">💵</div>
          <div class="cd-stat-val">${formatLKR(total)}</div>
          <div class="cd-stat-lbl">Total Collected</div>
        </div>
        <div class="cd-stat-card" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">
          <div class="cd-stat-icon">🏦</div>
          <div class="cd-stat-val">${formatLKR(balance)}</div>
          <div class="cd-stat-lbl">Wallet Balance</div>
        </div>
        <div class="cd-stat-card" style="background:linear-gradient(135deg,#10B981,#059669)">
          <div class="cd-stat-icon">✅</div>
          <div class="cd-stat-val">${formatLKR(withdrawn)}</div>
          <div class="cd-stat-lbl">Withdrawn</div>
        </div>
        <div class="cd-stat-card" style="background:linear-gradient(135deg,#EF4444,#DC2626)">
          <div class="cd-stat-icon">🏛️</div>
          <div class="cd-stat-val">${formatLKR(pFee)}</div>
          <div class="cd-stat-lbl">Platform Fee</div>
        </div>
      </div>

      ${balance > 0 && S.batch.status === 'completed' ? `
        <button onclick="cdRequestWithdrawal()" style="width:100%;padding:14px;background:var(--gradient);
          color:#fff;border:none;border-radius:14px;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:16px">
          💸 Request Withdrawal
        </button>` : ''}

      ${withdrawals.length ? `
        <h3 class="cd-sec-hdr" style="font-size:14px">Withdrawal History</h3>
        ${withdrawals.map(w => `
          <div class="cd-ledger-row">
            <div>
              <div class="cd-ledger-label">${formatLKR(w.amount_requested)} requested</div>
              <div class="cd-ledger-sub">${timeAgo(w.requested_at)}</div>
            </div>
            <span style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;
              background:${w.status === 'approved' ? '#ECFDF5' : w.status === 'pending' ? '#FFFBEB' : '#FEF2F2'};
              color:${w.status === 'approved' ? '#059669' : w.status === 'pending' ? '#D97706' : '#DC2626'}">
              ${w.status.toUpperCase()}
            </span>
          </div>`).join('')}
      ` : ''}
    `;

    window.cdRequestWithdrawal = async () => {
      const amt = parseFloat(prompt('Enter withdrawal amount (LKR):', balance));
      if (!amt || amt <= 0) return;
      if (amt > balance) { toast('Amount exceeds wallet balance', 'error'); return; }
      const { error } = await WalletV2.requestWithdrawal(S.batchId, amt);
      if (error) { toast(error.message, 'error'); return; }
      toast('Withdrawal request sent!', 'success');
      renderWalletTab(container);
    };
  } catch (err) {
    container.innerHTML = errScreen(err.message);
  }
}

// ============================================================
// ADMIN TABS
// ============================================================

// ── OVERVIEW TAB (admin) ──────────────────────────────────────
async function renderOverviewTab(container) {
  if (!S.curriculum) {
    const { data } = await BatchLessons.getCurriculum(S.batchId);
    S.curriculum = data || [];
  }
  const b  = S.batch;
  const c  = S.course;
  const st = b.status || 'opening';
  container.innerHTML = `
    <h2 class="cd-sec-hdr">📊 Batch Overview</h2>

    <div class="cd-stat-grid">
      <div class="cd-stat-card" style="background:var(--gradient)">
        <div class="cd-stat-icon">👥</div>
        <div class="cd-stat-val">${b.enrolled_count || 0}</div>
        <div class="cd-stat-lbl">Enrolled</div>
      </div>
      <div class="cd-stat-card" style="background:linear-gradient(135deg,#10B981,#059669)">
        <div class="cd-stat-icon">💺</div>
        <div class="cd-stat-val">${(b.max_students || 0) - (b.enrolled_count || 0)}</div>
        <div class="cd-stat-lbl">Seats Left</div>
      </div>
      <div class="cd-stat-card" style="background:linear-gradient(135deg,#F59E0B,#D97706)">
        <div class="cd-stat-icon">💰</div>
        <div class="cd-stat-val">${formatLKR((b.price || 0) * (b.enrolled_count || 0))}</div>
        <div class="cd-stat-lbl">Est. Revenue</div>
      </div>
      <div class="cd-stat-card" style="background:linear-gradient(135deg,#8B5CF6,#6D28D9)">
        <div class="cd-stat-icon">📚</div>
        <div class="cd-stat-val">${(S.curriculum || []).reduce((s, m) => s + (m.lessons || []).length, 0)}</div>
        <div class="cd-stat-lbl">Lessons</div>
      </div>
    </div>

    <div class="cd-progress-card">
      <h3 style="font-weight:800;font-size:15px;margin-bottom:12px">Batch Info</h3>
      ${[
        ['Course', escapeHTML(c?.title || '—')],
        ['Teacher', escapeHTML(c?.teacher?.full_name || '—')],
        ['Status', `<span class="cd-status-badge" style="background:${STATUS_BG[st]};color:${STATUS_CLR[st]}">${st.toUpperCase()}</span>`],
        ['Start', b.start_at ? fmtDate(b.start_at) : '—'],
        ['End', b.end_at ? fmtDate(b.end_at) : '—'],
        ['Price', formatLKR(b.price || 0)],
      ].map(([k, v]) => `
        <div class="cd-ledger-row">
          <div class="cd-ledger-label">${k}</div>
          <div style="font-weight:700;font-size:13px;color:#1F2937">${v}</div>
        </div>`).join('')}
    </div>`;
}

// ── ACTIONS TAB (admin) ───────────────────────────────────────
function renderActionsTab(container) {
  const b  = S.batch;
  const st = b.status;

  const actions = [
    st === 'opening' && { icon: '🚀', label: 'Mark as Upcoming', desc: 'Move batch to upcoming status', color: '#F59E0B', fn: `cdAdminAction('upcoming')` },
    st === 'upcoming' && { icon: '▶️', label: 'Activate Batch', desc: 'Allow students to access lessons', color: '#10B981', fn: `cdAdminAction('active')` },
    st === 'active' && { icon: '✅', label: 'Complete Batch', desc: 'Mark as completed & credit teacher wallet', color: '#6A11CB', fn: `cdAdminAction('completed')` },
    (st !== 'cancelled' && st !== 'completed') && { icon: '❌', label: 'Cancel Batch', desc: 'Cancel this batch (provide reason)', color: '#EF4444', fn: `cdAdminAction('cancelled')` },
  ].filter(Boolean);

  container.innerHTML = `
    <h2 class="cd-sec-hdr">⚙️ Admin Actions</h2>
    <p style="font-size:13px;color:#9CA3AF;margin-bottom:20px">
      Current status: <strong style="color:${STATUS_CLR[st]}">${st?.toUpperCase()}</strong>
    </p>
    ${actions.map(a => `
      <button class="cd-action-btn" onclick="${a.fn}">
        <div class="cd-action-icon" style="background:${a.color}22">${a.icon}</div>
        <div>
          <div style="font-weight:700;font-size:14px;color:#1F2937">${a.label}</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px">${a.desc}</div>
        </div>
      </button>`).join('')}
    ${!actions.length ? `<div class="cd-empty"><p>No actions available for ${st} status.</p></div>` : ''}
  `;

  window.cdAdminAction = async (targetStatus) => {
    const confirmMsg = targetStatus === 'cancelled'
      ? 'Enter cancellation reason:'
      : `Confirm: Move batch to "${targetStatus}"?`;

    if (targetStatus === 'cancelled') {
      const reason = prompt(confirmMsg);
      if (!reason) return;
      const { error } = await db.rpc('cancel_batch', { p_batch_id: S.batchId, p_reason: reason });
      if (error) { toast(error.message, 'error'); return; }
    } else {
      if (!confirm(confirmMsg)) return;
      let error;
      if (targetStatus === 'active') {
        ({ error } = await db.rpc('activate_batch', { p_batch_id: S.batchId }));
      } else if (targetStatus === 'upcoming') {
        ({ error } = await db.rpc('set_batch_upcoming', { p_batch_id: S.batchId }));
      } else if (targetStatus === 'completed') {
        ({ error } = await BatchLessons.completeBatch(S.batchId));
      }
      if (error) { toast(error.message, 'error'); return; }
    }
    toast(`Batch ${targetStatus}!`, 'success');
    S.batch.status = targetStatus;
    renderActionsTab(container);
    // Refresh hero status
    const badge = document.querySelector('.cd-status-badge');
    if (badge) {
      badge.textContent = targetStatus.toUpperCase();
      badge.style.background = STATUS_BG[targetStatus];
      badge.style.color = STATUS_CLR[targetStatus];
    }
  };
}

// ── renderScheduleTab dispatcher (wraps student vs teacher) ──
// The student version defined above IS renderScheduleTab_student
// We rename it here for clarity via the switchTab map override:
