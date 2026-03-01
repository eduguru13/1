// ============================================================
// EduGuru — Teacher Dashboard
// ============================================================
import { Courses, Transactions, Enrollments, Batches, BatchLessons, WalletV2, TeacherBank, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { formatLKR, formatCount, timeAgo, escapeHTML, toast, serialChip } from '../utils.js';

// ── TEMPLATE ──────────────────────────────────────────────────
export function renderTeacherDashboard() {
  return `
    <div class="teacher-dashboard page" id="teacher-dashboard">
      <!-- Header -->
      <div style="padding:20px 16px 0">
        <h1 style="font-family:var(--font-display);font-weight:800;font-size:22px">My Courses</h1>
        <p style="color:var(--gray-500);font-size:14px;margin-top:4px">Manage your courses & earnings</p>
      </div>

      <!-- Stats Row -->
      <div id="teacher-stats" style="padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${Array(4).fill(0).map(() => `<div class="skeleton" style="height:80px;border-radius:16px"></div>`).join('')}
      </div>

      <!-- Main Content (course list OR course detail) -->
      <div id="teacher-main-content">
        <div style="text-align:center;padding:40px">
          <svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      </div>
    </div>`;
}

export async function initTeacherDashboard() {
  await loadTeacherStats();
  await loadTeacherCourses();
}

// ── STATS ─────────────────────────────────────────────────────
async function loadTeacherStats() {
  try {
    const [courses, txns] = await Promise.all([
      Courses.getByTeacher(AuthState.user.id),
      loadTeacherTransactions(),
    ]);
    const approved      = courses.filter(c => c.status === 'approved').length;
    const pending       = courses.filter(c => c.status === 'pending').length;
    const totalStudents = courses.reduce((s, c) => s + (c.total_enrollments || 0), 0);
    const totalEarnings = txns.reduce((s, t) => s + Number(t.teacher_earning || 0), 0);

    document.getElementById('teacher-stats').innerHTML = `
      ${statCard('📚', courses.length, 'Total Courses', 'var(--gradient)')}
      ${statCard('👥', formatCount(totalStudents), 'Total Students', 'linear-gradient(135deg,#11CB6A,#0A9E52)')}
      ${statCard('💰', formatLKR(totalEarnings), 'Total Earned', 'linear-gradient(135deg,#F59E0B,#D97706)')}
      ${statCard('⏳', pending, 'Pending Review', 'linear-gradient(135deg,#FF8A00,#FF416C)')}`;
  } catch { /* silent */ }
}

function statCard(icon, value, label, bg) {
  return `
    <div style="background:${bg};border-radius:16px;padding:14px;color:white">
      <div style="font-size:20px;margin-bottom:4px">${icon}</div>
      <div style="font-family:var(--font-display);font-weight:800;font-size:18px">${escapeHTML(String(value))}</div>
      <div style="font-size:12px;opacity:0.85">${label}</div>
    </div>`;
}

async function loadTeacherTransactions() {
  const { db } = await import('../supabase.js');
  const { data } = await db
    .from('transactions')
    .select(`teacher_earning, course:courses!inner(teacher_id)`)
    .eq('courses.teacher_id', AuthState.user.id)
    .eq('payment_status', 'approved');
  return data || [];
}

// ── COURSE LIST ───────────────────────────────────────────────
async function loadTeacherCourses() {
  window._currentDetailCourseId = null;
  const container = document.getElementById('teacher-main-content');
  container.innerHTML = `
    <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
      ${Array(3).fill(0).map(() => `<div class="skeleton" style="height:110px;border-radius:16px"></div>`).join('')}
    </div>`;

  try {
    const courses = await Courses.getByTeacher(AuthState.user.id);

    if (!courses.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <div class="empty-state__title">No Courses Yet</div>
          <div class="empty-state__text">Create your first course and start earning!</div>
          <button class="btn btn-primary" onclick="App.navigate('create')">Create Course</button>
        </div>`;
      return;
    }

    const statusColor = { draft:'#6B7599', pending:'#F59E0B', approved:'#11CB6A', rejected:'#FF416C' };
    const statusBg    = { draft:'#F5F5F5', pending:'#FFF7ED', approved:'#ECFDF5', rejected:'#FFF1F2' };

    container.innerHTML = `
      <div style="padding:0 16px 80px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div style="font-size:13px;color:var(--gray-500);font-weight:600">${courses.length} course${courses.length !== 1 ? 's' : ''}</div>
          <button class="btn btn-primary btn--sm" onclick="App.navigate('create')">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Course
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${courses.map(c => courseCard(c, statusColor, statusBg)).join('')}
        </div>
      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
}

function courseCard(c, statusColor, statusBg) {
  return `
    <div class="glass-card--flat" style="padding:0;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s"
      onclick="openCourseDetail('${c.id}')"
      onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.98)'" ontouchend="this.style.transform=''">
      <div style="display:flex">
        ${c.thumbnail_url
          ? `<img src="${escapeHTML(c.thumbnail_url)}" style="width:90px;height:82px;object-fit:cover;flex-shrink:0">`
          : `<div style="width:90px;height:82px;background:var(--gradient-soft);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:28px">📚</div>`
        }
        <div style="flex:1;min-width:0;padding:12px 14px">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(c.title)}</div>
          ${c.serial_id ? `<div style="margin-top:3px">${serialChip(c.serial_id)}</div>` : ''}
          <div style="color:var(--gray-400);font-size:12px;margin-top:3px">
            ${formatCount(c.total_enrollments || 0)} students • LKR ${(c.price || 0).toLocaleString()}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
            <span style="padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;
              background:${statusBg[c.status] || '#F5F5F5'};color:${statusColor[c.status] || '#666'}">
              ${c.status.charAt(0).toUpperCase() + c.status.slice(1)}
            </span>
            <span style="font-size:12px;color:var(--purple-start);font-weight:600;display:flex;align-items:center;gap:3px">
              Manage
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2.5">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
      ${c.status === 'rejected' && c.rejection_reason ? `
        <div style="padding:8px 14px;background:#FFF1F2;font-size:12px;color:#FF416C;border-top:1px solid #FFE4E6">
          ⚠️ Rejected: ${escapeHTML(c.rejection_reason)}
        </div>` : ''}
    </div>`;
}

window.loadTeacherCoursesGlobal = () => loadTeacherCourses();

window.submitForReview = async function(courseId, e) {
  if (e) e.stopPropagation();
  try {
    await Courses.update(courseId, { status: 'pending' });
    toast('Course submitted for review!', 'success');
    // Refresh whichever view is active
    if (window._currentDetailCourseId === courseId) {
      await window.openCourseDetail(courseId);
    } else {
      await loadTeacherCourses();
    }
  } catch (err) {
    toast(err.message || 'Failed to submit', 'error');
  }
};

// ── COURSE DETAIL ─────────────────────────────────────────────
window.openCourseDetail = async function(courseId) {
  window._currentDetailCourseId = courseId;
  const container = document.getElementById('teacher-main-content');

  container.innerHTML = `
    <div style="text-align:center;padding:40px">
      <svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </div>`;

  try {
    const courses = await Courses.getByTeacher(AuthState.user.id);
    const course  = courses.find(c => c.id === courseId);
    if (!course) throw new Error('Course not found');

    container.innerHTML = `
      <div style="padding:0 0 80px">

        <!-- Course Header -->
        <div style="margin:0 16px 16px;background:var(--gradient);border-radius:20px;padding:16px;color:white;position:relative;overflow:hidden">
          <div style="position:absolute;top:-10px;right:-10px;font-size:80px;opacity:0.1;line-height:1">📚</div>

          <!-- Back button -->
          <button onclick="loadTeacherCoursesGlobal()"
            style="background:rgba(255,255,255,0.2);border:none;border-radius:99px;padding:5px 12px 5px 8px;color:white;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-bottom:12px">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg>
            My Courses
          </button>

          <div style="font-family:var(--font-display);font-weight:800;font-size:17px;line-height:1.3;margin-bottom:8px">
            ${escapeHTML(course.title)}
          </div>
          ${course.serial_id ? `<div style="margin-bottom:8px">${serialChip(course.serial_id)}</div>` : ''}

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <span style="background:rgba(255,255,255,0.25);border-radius:99px;padding:2px 10px;font-size:11px;font-weight:700">
              ${course.status.charAt(0).toUpperCase() + course.status.slice(1)}
            </span>
            <span style="font-size:12px;opacity:0.85">${formatCount(course.total_enrollments || 0)} students</span>
            <span style="font-size:12px;opacity:0.85">LKR ${(course.price || 0).toLocaleString()}</span>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn--sm" style="background:rgba(255,255,255,0.2);color:white;border:none;flex:1;min-width:100px"
              onclick="App.navigate('create',{id:'${courseId}'})">
              ✏️ Edit Course
            </button>
            ${course.status === 'approved' ? `
              <button class="btn btn--sm" style="background:rgba(255,255,255,0.2);color:white;border:none;flex:1;min-width:100px"
                onclick="App.navigate('course','${courseId}')">
                👁 View Page
              </button>` : ''}
            ${course.status === 'draft' ? `
              <button class="btn btn--sm" style="background:rgba(255,255,255,0.9);color:var(--purple-start);border:none;font-weight:700;flex:1;min-width:100px"
                onclick="submitForReview('${courseId}', event)">
                🚀 Submit for Review
              </button>` : ''}
          </div>
        </div>

        <!-- Sub-Tabs -->
        <div class="tabs-wrap" style="margin:0 0 0">
          <div class="tabs">
            <button class="tab-btn active" data-ctab="batches">📦 Batches</button>
            <button class="tab-btn" data-ctab="students">👥 Students</button>
            <button class="tab-btn" data-ctab="earnings">💰 Earnings</button>
          </div>
        </div>

        <!-- Sub-Tab Content -->
        <div id="course-detail-content" style="margin-top:16px">
          <div style="text-align:center;padding:30px">
            <svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="var(--purple-start)" fill="none" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        </div>
      </div>`;

    _initCourseDetailTabs(courseId);
    await loadCourseBatches(courseId);

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
};

function _initCourseDetailTabs(courseId) {
  document.querySelectorAll('[data-ctab]').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('[data-ctab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.ctab;
      if (tab === 'batches')  await loadCourseBatches(courseId);
      if (tab === 'students') await loadCourseStudents(courseId);
      if (tab === 'earnings') await loadCourseEarnings(courseId);
    });
  });
}

// ── COURSE BATCHES ─────────────────────────────────────────────
async function loadCourseBatches(courseId) {
  const container = document.getElementById('course-detail-content');
  if (!container) return;
  container.innerHTML = `
    <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
      ${Array(2).fill(0).map(() => `<div class="skeleton" style="height:130px;border-radius:16px"></div>`).join('')}
    </div>`;

  try {
    await BatchLessons.autoActivate().catch(() => {});

    const { data: batches } = await db
      .from('batches')
      .select('id, title, status, max_students, enrolled_count, price, start_at, end_at, activated_at, serial_id, course:course_id(title)')
      .eq('teacher_id', AuthState.user.id)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    // Fetch pending payment counts per batch for seat reservation display
    const batchIds = (batches || []).map(b => b.id);
    let pendingByBatch = {};
    if (batchIds.length) {
      const { data: pendingTxns } = await db
        .from('transactions')
        .select('batch_id')
        .in('batch_id', batchIds)
        .eq('payment_status', 'pending');
      (pendingTxns || []).forEach(t => {
        pendingByBatch[t.batch_id] = (pendingByBatch[t.batch_id] || 0) + 1;
      });
    }

    container.innerHTML = `
      <div style="padding:0 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:13px;color:var(--gray-500)">${(batches || []).length} batch(es)</div>
          <button class="btn btn-primary btn--sm" onclick="openCreateBatchForm('${courseId}')">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="white" fill="none" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Batch
          </button>
        </div>
        ${!(batches || []).length ? `
          <div class="empty-state" style="padding:32px 0">
            <div style="font-size:40px;text-align:center;margin-bottom:8px">📦</div>
            <div class="empty-state__title">No Batches Yet</div>
            <div class="empty-state__text">Create your first batch to start accepting students!</div>
          </div>` : `
          <div style="display:flex;flex-direction:column;gap:12px">
            ${(batches || []).map(b => batchCard(b, pendingByBatch[b.id] || 0)).join('')}
          </div>`}
      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
}

// Back from batch lesson view → returns to course batches
window.loadBatchesGlobal = () => {
  if (window._currentDetailCourseId) {
    loadCourseBatches(window._currentDetailCourseId);
  } else {
    loadTeacherCourses();
  }
};

// ── COURSE STUDENTS ────────────────────────────────────────────
async function loadCourseStudents(courseId) {
  const container = document.getElementById('course-detail-content');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:40px"><svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;

  try {
    // Fetch enrolled (paid) and pending payment students in parallel
    const [{ data: enrollments }, { data: pendingTxns }] = await Promise.all([
      db.from('enrollments')
        .select(`enrolled_at, progress_percent, batch_id,
          student:users!student_id(full_name, profile_picture),
          batch:batches!batch_id(title)`)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false })
        .limit(100),
      db.from('transactions')
        .select(`id, submitted_at, amount, batch_id,
          student:users!student_id(full_name, profile_picture),
          batch:batches!batch_id(title)`)
        .eq('course_id', courseId)
        .eq('payment_status', 'pending')
        .order('submitted_at', { ascending: false })
        .limit(100),
    ]);

    const enrolled = enrollments || [];
    const pending  = pendingTxns  || [];

    if (!enrolled.length && !pending.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">No Students Yet</div>
          <div class="empty-state__text">Students will appear here once they enroll.</div>
        </div>`;
      return;
    }

    const getInitials = n => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    container.innerHTML = `
      <div style="padding:0 16px">
        <div style="font-size:13px;color:var(--gray-500);margin-bottom:12px;font-weight:600">
          ${enrolled.length} enrolled${pending.length ? ` · ${pending.length} pending payment` : ''}
        </div>

        ${pending.length ? `
          <div style="margin-bottom:16px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
              color:#B45309;margin-bottom:8px;padding:5px 10px;background:#FFF7ED;border-radius:8px">
              ⏳ Awaiting Payment Approval (${pending.length})
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${pending.map(t => `
                <div class="glass-card--flat" style="padding:12px;display:flex;gap:10px;align-items:center;border-left:3px solid #F59E0B">
                  ${t.student?.profile_picture
                    ? `<img src="${escapeHTML(t.student.profile_picture)}" class="avatar avatar-md">`
                    : `<div class="avatar avatar-md">${getInitials(t.student?.full_name)}</div>`
                  }
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:14px">${escapeHTML(t.student?.full_name || 'Student')}</div>
                    <div style="font-size:12px;color:var(--gray-400)">
                      ${t.batch?.title ? escapeHTML(t.batch.title) + ' · ' : ''}Submitted ${timeAgo(t.submitted_at)}
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;
                      background:#FFF7ED;color:#B45309">Pending</span>
                    <div style="font-size:11px;color:var(--gray-400);margin-top:3px">${formatLKR(t.amount)}</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>` : ''}

        ${enrolled.length ? `
          <div>
            ${pending.length ? `
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
                color:#059669;margin-bottom:8px;padding:5px 10px;background:#ECFDF5;border-radius:8px">
                ✅ Enrolled — Paid (${enrolled.length})
              </div>` : ''}
            <div style="display:flex;flex-direction:column;gap:10px">
              ${enrolled.map(e => `
                <div class="glass-card--flat" style="padding:12px;display:flex;gap:10px;align-items:center">
                  ${e.student?.profile_picture
                    ? `<img src="${escapeHTML(e.student.profile_picture)}" class="avatar avatar-md">`
                    : `<div class="avatar avatar-md">${getInitials(e.student?.full_name)}</div>`
                  }
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:14px">${escapeHTML(e.student?.full_name || 'Student')}</div>
                    <div style="font-size:12px;color:var(--gray-400)">
                      ${e.batch?.title ? escapeHTML(e.batch.title) + ' · ' : ''}${timeAgo(e.enrolled_at)}
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <span style="padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;
                      background:#ECFDF5;color:#059669">Paid</span>
                    <div style="font-size:11px;color:var(--purple-start);font-weight:700;margin-top:3px">
                      ${Math.round(e.progress_percent || 0)}%
                    </div>
                  </div>
                </div>`).join('')}
            </div>
          </div>` : ''}
      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
}

// ── COURSE EARNINGS ────────────────────────────────────────────
async function loadCourseEarnings(courseId) {
  const container = document.getElementById('course-detail-content');
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:40px"><svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;

  try {
    // Fetch all transactions (approved + pending) + wallet summary in parallel
    const [txnRes, walletRes, batchRes] = await Promise.all([
      db.from('transactions')
        .select(`id, amount, teacher_earning, platform_commission, payment_status,
                 submitted_at, approved_at, batch_id,
                 student:users!student_id(full_name, serial_id)`)
        .eq('course_id', courseId)
        .order('submitted_at', { ascending: false }),
      WalletV2.getSummary(),
      db.from('batches')
        .select('id, title, status, serial_id, enrolled_count, price, start_at, end_at')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false }),
    ]);

    const allTxns    = txnRes.data    || [];
    const wallet     = walletRes.data || {};
    const batches    = batchRes.data  || [];

    const approved   = allTxns.filter(t => t.payment_status === 'approved');
    const pending    = allTxns.filter(t => t.payment_status === 'pending');
    const totalEarned = approved.reduce((s, t) => s + Number(t.teacher_earning || 0), 0);
    const pendingAmt  = pending.reduce((s, t) => s + Number(t.teacher_earning || 0), 0);

    // Group approved txns by batch
    const byBatch = {};
    approved.forEach(t => {
      const k = t.batch_id || '__no_batch__';
      if (!byBatch[k]) byBatch[k] = [];
      byBatch[k].push(t);
    });

    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-LK', { day:'numeric', month:'short', year:'numeric' }) : '—';

    const statusColors = { opening:'#8B5CF6', upcoming:'#2575FC', active:'#11CB6A', completed:'#F59E0B', cancelled:'#FF416C' };
    const statusBg     = { opening:'#F5F3FF', upcoming:'#EFF6FF', active:'#ECFDF5', completed:'#FFF7ED', cancelled:'#FFF1F2' };

    container.innerHTML = `
      <div style="padding:0 16px 24px;display:flex;flex-direction:column;gap:16px">

        <!-- ── WALLET SUMMARY ── -->
        <div style="background:linear-gradient(135deg,#6A11CB,#2575FC);border-radius:20px;padding:18px;color:#fff">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="font-size:12px;opacity:0.8;margin-bottom:2px">💰 Wallet Balance</div>
              <div style="font-family:var(--font-display);font-weight:800;font-size:26px;margin-bottom:12px">
                ${formatLKR(wallet.wallet_balance || 0, false)}
              </div>
            </div>
            <button onclick="openBankDetailsForm()" style="background:rgba(255,255,255,0.2);border:none;border-radius:10px;padding:6px 10px;color:#fff;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0">
              🏦 Bank Details
            </button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px">
              <div style="font-size:11px;opacity:0.8">📈 Total Earned</div>
              <div style="font-weight:800;font-size:14px;margin-top:2px">${formatLKR(totalEarned)}</div>
            </div>
            <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:10px">
              <div style="font-size:11px;opacity:0.8">🔒 In Escrow</div>
              <div style="font-weight:800;font-size:14px;margin-top:2px">${formatLKR(wallet.wallet_locked || 0, false)}</div>
            </div>
          </div>
          ${pendingAmt > 0 ? `
          <div style="margin-top:10px;background:rgba(255,255,255,0.15);border-radius:12px;padding:10px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;opacity:0.9">⏳ Awaiting Admin Approval</span>
            <span style="font-weight:800;font-size:14px">+${formatLKR(pendingAmt)}</span>
          </div>` : ''}
        </div>

        <!-- ── PENDING PAYMENTS ── -->
        ${pending.length ? `
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:4px;height:18px;background:#F59E0B;border-radius:2px"></div>
            <h3 style="font-weight:800;font-size:15px;margin:0">⏳ Pending Payments (${pending.length})</h3>
          </div>
          <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:14px;padding:4px 0">
            ${pending.map((t, i) => `
              <div style="padding:12px 14px;${i < pending.length-1 ? 'border-bottom:1px solid #FDE68A;' : ''}display:flex;align-items:center;gap:10px">
                <div style="width:34px;height:34px;border-radius:50%;background:#FEF3C7;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">👤</div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:700;font-size:13px">${escapeHTML(t.student?.full_name || 'Student')}</div>
                  <div style="font-size:11px;color:#92400E;margin-top:1px">
                    ${batches.find(b=>b.id===t.batch_id)?.title || 'No batch'} · Submitted ${timeAgo(t.submitted_at)}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:800;font-size:13px;color:#D97706">${formatLKR(t.teacher_earning)}</div>
                  <div style="font-size:10px;color:#92400E">Student paid ${formatLKR(t.amount)}</div>
                  <span style="display:inline-block;margin-top:3px;padding:2px 7px;background:#FEF3C7;color:#92400E;border-radius:99px;font-size:10px;font-weight:700">PENDING</span>
                </div>
              </div>`).join('')}
          </div>
          <div style="margin-top:6px;font-size:11px;color:#92400E;padding:0 4px">ℹ️ Admin approve பண்ணியதும் automatically wallet-ல credit ஆகும்.</div>
        </div>` : ''}

        <!-- ── PER-BATCH BREAKDOWN ── -->
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:4px;height:18px;background:var(--purple-start);border-radius:2px"></div>
            <h3 style="font-weight:800;font-size:15px;margin:0">📦 Batch-wise Earnings</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            ${batches.length === 0
              ? `<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px">No batches yet</div>`
              : batches.map(b => {
                  const bTxns  = byBatch[b.id] || [];
                  const bTotal = bTxns.reduce((s,t) => s + Number(t.teacher_earning||0), 0);
                  const bPend  = pending.filter(t => t.batch_id === b.id);
                  const sColor = statusColors[b.status] || '#666';
                  const sBg    = statusBg[b.status]    || '#F5F5F5';
                  const walletBatch = wallet.completed_batches?.find(wb => wb.batch_id === b.id);
                  return `
                  <div style="border:1.5px solid #E5E7EB;border-radius:16px;overflow:hidden">
                    <!-- Batch header -->
                    <div style="padding:12px 14px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center">
                      <div>
                        <div style="font-weight:700;font-size:13px">${escapeHTML(b.title)}</div>
                        <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
                          ${fmtDate(b.start_at)} → ${fmtDate(b.end_at)} · ${b.enrolled_count||0} students
                        </div>
                      </div>
                      <span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;background:${sBg};color:${sColor}">
                        ${b.status.charAt(0).toUpperCase()+b.status.slice(1)}
                      </span>
                    </div>

                    <!-- Earnings summary -->
                    <div style="padding:12px 14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#fff">
                      <div style="text-align:center;padding:8px;background:#F9FAFB;border-radius:10px">
                        <div style="font-size:10px;color:var(--gray-500);margin-bottom:2px">Students Paid</div>
                        <div style="font-weight:800;font-size:13px">${formatLKR(bTxns.reduce((s,t)=>s+Number(t.amount||0),0))}</div>
                      </div>
                      <div style="text-align:center;padding:8px;background:#ECFDF5;border-radius:10px">
                        <div style="font-size:10px;color:#059669;margin-bottom:2px">Your 75%</div>
                        <div style="font-weight:800;font-size:13px;color:#059669">${formatLKR(bTotal)}</div>
                      </div>
                      <div style="text-align:center;padding:8px;background:#FEF2F2;border-radius:10px">
                        <div style="font-size:10px;color:#DC2626;margin-bottom:2px">Platform 25%</div>
                        <div style="font-weight:800;font-size:13px;color:#DC2626">${formatLKR(bTxns.reduce((s,t)=>s+Number(t.platform_commission||0),0))}</div>
                      </div>
                    </div>

                    <!-- Per-student rows -->
                    ${bTxns.length ? `
                    <div style="border-top:1px solid #E5E7EB">
                      ${bTxns.map((t,i) => `
                        <div style="padding:10px 14px;${i<bTxns.length-1?'border-bottom:1px solid #F3F4F6;':''}display:flex;align-items:center;gap:8px">
                          <div style="width:28px;height:28px;border-radius:50%;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">👤</div>
                          <div style="flex:1;min-width:0">
                            <div style="font-size:12px;font-weight:600">${escapeHTML(t.student?.full_name || 'Student')}</div>
                            <div style="font-size:11px;color:var(--gray-400)">${fmtDate(t.approved_at)}</div>
                          </div>
                          <div style="text-align:right;flex-shrink:0">
                            <div style="font-size:12px;color:var(--gray-400)">Paid ${formatLKR(t.amount)}</div>
                            <div style="font-weight:800;font-size:13px;color:#059669">+${formatLKR(t.teacher_earning)}</div>
                          </div>
                        </div>`).join('')}
                    </div>` : `
                    <div style="padding:12px 14px;font-size:12px;color:var(--gray-400);text-align:center;border-top:1px solid #E5E7EB">
                      No approved payments yet${bPend.length ? ` · ${bPend.length} pending` : ''}
                    </div>`}

                    <!-- Payout row for completed batches -->
                    ${b.status === 'completed' ? (() => {
                      const ws = walletBatch?.withdrawal_status;
                      const EDUGURU_WA = '94789929233';
                      if (ws === 'paid') return `
                        <div style="padding:10px 14px;background:#ECFDF5;border-top:1px solid #D1FAE5;display:flex;justify-content:space-between;align-items:center">
                          <div>
                            <div style="font-size:11px;color:#065F46;font-weight:700">✅ Payment Received!</div>
                            <div style="font-size:10px;color:#059669;margin-top:1px">Amount: ${formatLKR(bTotal)} · Transfer completed</div>
                          </div>
                          <a href="https://wa.me/${EDUGURU_WA}" target="_blank"
                            style="padding:6px 12px;background:#25D366;color:#fff;border-radius:10px;font-weight:700;font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:4px">
                            📱 Check WhatsApp
                          </a>
                        </div>`;
                      if (ws === 'pending') return `
                        <div style="padding:10px 14px;background:#FFFBEB;border-top:1px solid #FDE68A;display:flex;justify-content:space-between;align-items:center">
                          <div>
                            <div style="font-size:11px;color:#92400E;font-weight:600">⏳ Withdrawal under admin review</div>
                            <div style="font-size:10px;color:#92400E;margin-top:1px">Your earnings: ${formatLKR(bTotal)}</div>
                          </div>
                          <span style="padding:4px 10px;background:#FEF3C7;color:#92400E;border-radius:8px;font-size:10px;font-weight:700">Pending</span>
                        </div>`;
                      if (ws === 'approved') return `
                        <div style="padding:10px 14px;background:#EFF6FF;border-top:1px solid #BFDBFE;display:flex;justify-content:space-between;align-items:center">
                          <div>
                            <div style="font-size:11px;color:#1D4ED8;font-weight:600">✅ Approved — Transfer in progress</div>
                            <div style="font-size:10px;color:#1D4ED8;margin-top:1px">Your earnings: ${formatLKR(bTotal)}</div>
                          </div>
                          <span style="padding:4px 10px;background:#DBEAFE;color:#1D4ED8;border-radius:8px;font-size:10px;font-weight:700">Approved</span>
                        </div>`;
                      if (ws === 'rejected') return `
                        <div style="padding:10px 14px;background:#FFF1F2;border-top:1px solid #FFE4E6;display:flex;justify-content:space-between;align-items:center">
                          <div>
                            <div style="font-size:11px;color:#BE123C;font-weight:600">✗ Withdrawal rejected</div>
                            <div style="font-size:10px;color:#BE123C;margin-top:1px">Contact support for details</div>
                          </div>
                          <button onclick="openWithdrawForm('${b.id}')" style="padding:5px 10px;background:#FF416C;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:11px;cursor:pointer">
                            Try Again
                          </button>
                        </div>`;
                      // 'none' or no status — ready to withdraw
                      return `
                        <div style="padding:10px 14px;background:#FFFBEB;border-top:1px solid #FDE68A;display:flex;justify-content:space-between;align-items:center">
                          <div>
                            <div style="font-size:11px;color:#92400E;font-weight:600">✅ Ready to withdraw</div>
                            <div style="font-size:10px;color:#92400E;margin-top:1px">Your earnings: ${formatLKR(bTotal)}</div>
                          </div>
                          <button onclick="openWithdrawForm('${b.id}')" style="padding:6px 14px;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:12px;cursor:pointer">
                            💸 Request Payout
                          </button>
                        </div>`;
                    })() : b.status === 'active' ? `
                    <div style="padding:8px 14px;background:#ECFDF5;border-top:1px solid #D1FAE5;font-size:11px;color:#065F46;font-weight:600">
                      🔒 Earnings locked until batch is completed
                    </div>` : ''}
                  </div>`;
                }).join('')}
          </div>
        </div>

      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
}

// ── BATCH CARD + CONSTANTS ────────────────────────────────────
const BATCH_STATUS_COLOR = { opening:'#8B5CF6', upcoming:'#2575FC', active:'#11CB6A', completed:'#F59E0B', cancelled:'#FF416C' };
const BATCH_STATUS_BG    = { opening:'#F5F3FF', upcoming:'#EFF6FF', active:'#ECFDF5', completed:'#FFF7ED', cancelled:'#FFF1F2' };
const LESSON_ICON        = { video:'🎬', live:'📡', resource:'📄', exam:'📝' };

function batchCard(b, pendingCount = 0) {
  const s = b.status;
  const fmtDate = d => d
    ? new Date(d).toLocaleString('en-LK', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
    : null;
  const startLabel = fmtDate(b.start_at);
  const endLabel   = fmtDate(b.end_at);

  let scheduleInfo = '';
  if (s === 'upcoming' && b.start_at) {
    const diff = new Date(b.start_at) - new Date();
    if (diff > 0) {
      const days  = Math.floor(diff / 86400000);
      const hrs   = Math.floor((diff % 86400000) / 3600000);
      const label = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
      scheduleInfo = `<div style="margin-bottom:8px;padding:6px 10px;background:#F5F3FF;border-radius:8px;font-size:11px;color:#8B5CF6;font-weight:600">
        ⏳ Enrollment opens in ${label} — ${startLabel}
      </div>`;
    } else {
      scheduleInfo = `<div style="margin-bottom:8px;padding:6px 10px;background:#ECFDF5;border-radius:8px;font-size:11px;color:#059669;font-weight:600">
        ✅ Start time passed — refresh to see updated status
      </div>`;
    }
  }

  return `
    <div class="glass-card--flat" style="padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(b.title)}</div>
          ${b.serial_id ? `<div style="margin-top:3px">${serialChip(b.serial_id)}</div>` : ''}
        </div>
        <span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;
          background:${BATCH_STATUS_BG[s] || '#F5F5F5'};color:${BATCH_STATUS_COLOR[s] || '#666'};flex-shrink:0;margin-left:8px">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      </div>

      ${scheduleInfo}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:12px;font-size:12px;color:var(--gray-500)">
        <div>👥 ${b.enrolled_count || 0}${pendingCount ? ` <span style="color:#F59E0B">+${pendingCount} pending</span>` : ''} / ${b.max_students || 30}</div>
        <div>💰 LKR ${b.price ? Number(b.price).toLocaleString() : '—'}</div>
        <div>📅 ${startLabel || 'Start not set'}</div>
        ${endLabel ? `<div>🏁 ${endLabel}</div>` : '<div></div>'}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button class="btn btn-primary btn--sm flex-1"
          onclick="App.navigate('course-dashboard',{batchId:'${b.id}'})">
          🏫 Open Dashboard
        </button>
        ${s === 'opening' || s === 'upcoming' ? `
          <button class="btn btn-outline btn--sm" onclick="openSetSchedule('${b.id}','${b.start_at || ''}','${b.end_at || ''}')">
            📅 Schedule
          </button>` : ''}
        ${s === 'upcoming' ? `
          <button class="btn btn-outline btn--sm" style="color:#8B5CF6;border-color:#8B5CF6"
            onclick="changeBatchStatus('${b.id}','opening','Open Enrollment')">
            🟢 Open Enrollment
          </button>` : ''}
        ${s === 'opening' ? `
          <button class="btn btn-outline btn--sm" style="color:#2575FC;border-color:#2575FC"
            onclick="changeBatchStatus('${b.id}','active','Start Batch')">
            ▶️ Start Batch
          </button>
          <button class="btn btn-outline btn--sm" style="color:#6B7280;border-color:#6B7280"
            onclick="changeBatchStatus('${b.id}','upcoming','Pause Enrollment')">
            ⏸
          </button>` : ''}
        ${s === 'active' ? `
          <button class="btn btn-outline btn--sm" style="color:#11CB6A;border-color:#11CB6A"
            onclick="doCompleteBatch('${b.id}')">
            ✅ Complete
          </button>` : ''}
        ${s === 'completed' ? `
          <button class="btn btn-outline btn--sm" style="color:#F59E0B;border-color:#F59E0B"
            onclick="openWithdrawForm('${b.id}')">
            💰 Payout
          </button>` : ''}
      </div>
    </div>`;
}

// ── CHANGE BATCH STATUS ───────────────────────────────────────
const STATUS_CONFIRM = {
  opening:   '🟢 Open this batch for enrollment?\nStudents will be able to enroll and pay.',
  upcoming:  '⏸ Pause enrollment?\nNo new students can enroll until you re-open.',
  active:    '▶️ Start this batch now?\nEnrolled students will get access to lessons.',
  completed: '✅ Mark as completed?\nUse the Complete button instead to credit your wallet.',
};
const STATUS_SUCCESS = {
  opening: '✅ Enrollment is now open! Students can join.',
  upcoming: '⏸ Enrollment paused.',
  active:  '▶️ Batch is now active! Students can access lessons.',
};

window.changeBatchStatus = async function(batchId, newStatus) {
  const msg = STATUS_CONFIRM[newStatus] || `Change status to "${newStatus}"?`;
  if (!confirm(msg)) return;

  try {
    const { error } = await Batches.setStatus(batchId, newStatus);
    if (error) throw error;
    toast(STATUS_SUCCESS[newStatus] || `Status changed to ${newStatus}`, 'success', 4000);
    if (window._currentDetailCourseId) await loadCourseBatches(window._currentDetailCourseId);
  } catch (err) {
    const m = err.message || '';
    if (m.includes('one_active_batch_per_course')) {
      toast('⚠️ Another batch for this course is already active.\nRun supabase_patch_v7.sql in Supabase to allow multiple active batches.', 'error', 6000);
    } else {
      toast(m || 'Failed to change status', 'error');
    }
  }
};

// ── CREATE NEW BATCH ──────────────────────────────────────────
window.openCreateBatchForm = async function(preselectedCourseId) {
  let approvedCourses = [];
  try {
    const all = await Courses.getByTeacher(AuthState.user.id);
    approvedCourses = all.filter(c => c.status === 'approved');
  } catch { /* ignore */ }

  const targetCourse = preselectedCourseId
    ? approvedCourses.find(c => c.id === preselectedCourseId)
    : null;

  if (preselectedCourseId && !targetCourse) {
    toast('This course must be approved before creating a batch.', 'error', 4000);
    return;
  }
  if (!approvedCourses.length) {
    toast('You need at least one approved course to create a batch.', 'error', 4000);
    return;
  }

  const courseOptions = approvedCourses.map(c =>
    `<option value="${c.id}" ${c.id === preselectedCourseId ? 'selected' : ''}>${escapeHTML(c.title)}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.id = 'create-batch-modal';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-sheet__handle"></div>
      <h3 class="modal-title">📦 Create New Batch</h3>

      ${targetCourse ? `
        <div style="background:var(--gradient-soft);border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;font-weight:600;color:var(--gray-600)">
          📚 ${escapeHTML(targetCourse.title)}
        </div>
        <input type="hidden" id="cb-course" value="${targetCourse.id}">
      ` : `
        <div class="form-group">
          <label class="form-label">Course <span class="required">*</span></label>
          <select class="form-select" id="cb-course" onchange="cbCourseChanged(this)">
            ${courseOptions}
          </select>
        </div>
      `}

      <div class="form-group">
        <label class="form-label">Batch Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="cb-title" placeholder="e.g., Batch 2 — March 2025">
        <span class="form-hint">Students see this name when enrolling</span>
      </div>

      <div class="form-group">
        <label class="form-label">Max Students</label>
        <input type="number" class="form-input" id="cb-max" value="30" min="1" max="50"
          oninput="if(parseInt(this.value)>50){this.value=50;this.style.borderColor='#EF4444'}else{this.style.borderColor=''}">
        <div style="font-size:11px;color:#9CA3AF;margin-top:4px">⚠️ Maximum 50 students per batch</div>
      </div>

      <div style="background:var(--gradient-soft);border-radius:12px;padding:10px;font-size:12px;color:var(--gray-500);margin-bottom:14px;line-height:1.6">
        💡 New batch starts as <strong>Upcoming</strong>. After creating, set the schedule — then change status to <strong>Opening</strong> to accept enrollments.
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
        <button class="btn btn-primary flex-1" id="cb-submit-btn" onclick="doCreateBatch()">Create Batch</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Auto-suggest title
  const forTitle = targetCourse || approvedCourses[0];
  if (forTitle) {
    const existing = (await db.from('batches').select('id').eq('course_id', forTitle.id)).data || [];
    document.getElementById('cb-title').value = `${forTitle.title} — Batch ${existing.length + 1}`;
  }
};

window.cbCourseChanged = async function(select) {
  const courseId   = select.value;
  const courseName = select.options[select.selectedIndex].text;
  const { data: existing } = await db.from('batches').select('id').eq('course_id', courseId);
  const batchNum = (existing?.length || 0) + 1;
  document.getElementById('cb-title').value = `${courseName} — Batch ${batchNum}`;
};

window.doCreateBatch = async function() {
  const courseId    = document.getElementById('cb-course')?.value;
  const title       = document.getElementById('cb-title')?.value?.trim();
  const maxStudents = parseInt(document.getElementById('cb-max')?.value) || 30;

  if (!courseId)        { toast('Select a course', 'error'); return; }
  if (!title)           { toast('Batch title is required', 'error'); return; }
  if (maxStudents > 50) { toast('Maximum 50 students allowed per batch', 'error'); return; }

  const btn = document.getElementById('cb-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  try {
    const newBatchId = await Batches.create(courseId, { title, maxStudents });
    // Curriculum is auto-cloned from the COURSE template inside create_batch RPC (patch v18)
    // No more cloning from previous batch → no mixing of links/completion status

    document.getElementById('create-batch-modal')?.remove();
    document.body.style.overflow = '';
    toast(`Batch "${title}" created! Course curriculum has been copied. Set the schedule next.`, 'success', 4000);
    if (window._currentDetailCourseId) await loadCourseBatches(window._currentDetailCourseId);
  } catch (err) {
    toast(err.message || 'Failed to create batch', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Create Batch'; }
  }
};

// ── SET BATCH SCHEDULE ─────────────────────────────────────────
window.openSetSchedule = function(batchId, existingStart = '', existingEnd = '') {
  const fmtLocal = iso => {
    if (!iso) return '';
    const d   = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-sheet__handle"></div>
      <h3 class="modal-title">📅 Set Batch Schedule</h3>
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:14px;line-height:1.5">
        <span style="color:#8B5CF6;font-weight:600">📅 Start time:</span> Enrollment opens automatically (<em>upcoming → opening</em>)<br>
        <span style="color:#6B7280;font-weight:600">🏁 End time:</span> Reference only — manually click <strong>▶️ Start</strong> then <strong>✅ Complete</strong> when done.
      </p>
      <div class="form-group">
        <label class="form-label">Start Date & Time <span class="required">*</span></label>
        <input type="datetime-local" class="form-input" id="sd-start" value="${fmtLocal(existingStart)}">
        <span class="form-hint">Batch goes from upcoming → opening automatically</span>
      </div>
      <div class="form-group">
        <label class="form-label">End Date & Time <span class="required">*</span></label>
        <input type="datetime-local" class="form-input" id="sd-end" value="${fmtLocal(existingEnd)}">
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="doSetSchedule('${batchId}')">Save Schedule</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
};

window.doSetSchedule = async function(batchId) {
  const startVal = document.getElementById('sd-start')?.value;
  const endVal   = document.getElementById('sd-end')?.value;
  if (!startVal) { toast('Start date is required', 'error'); return; }
  if (!endVal)   { toast('End date is required', 'error'); return; }
  if (new Date(endVal) <= new Date(startVal)) {
    toast('End date must be after start date', 'error'); return;
  }
  const btn = document.querySelector('.modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const { error } = await BatchLessons.setBatchSchedule(
      batchId,
      new Date(startVal).toISOString(),
      new Date(endVal).toISOString()
    );
    if (error) throw error;
    document.querySelector('.modal-overlay')?.remove();
    document.body.style.overflow = '';
    toast('Schedule saved!', 'success');
    if (window._currentDetailCourseId) await loadCourseBatches(window._currentDetailCourseId);
  } catch (err) {
    toast(err.message || 'Failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Schedule'; }
  }
};

// ── MARK BATCH COMPLETED ──────────────────────────────────────
window.doCompleteBatch = async function(batchId) {
  const checkBtn = event?.target;
  if (checkBtn) { checkBtn.disabled = true; checkBtn.textContent = 'Checking...'; }
  try {
    const { data: check } = await BatchLessons.checkCompletion(batchId);
    if (checkBtn) { checkBtn.disabled = false; checkBtn.textContent = '✅ Complete'; }

    if (!check?.eligible) {
      const reasons = (check?.reasons || []).join('\n• ');
      toast('Cannot complete batch:\n• ' + reasons, 'error', 7000);
      return;
    }

    if (!confirm('Mark this batch as completed? Earnings will be credited to your wallet.')) return;
    const { error } = await BatchLessons.completeBatch(batchId);
    if (error) throw error;
    toast('Batch completed! Earnings credited to your wallet. 💰', 'success', 5000);
    if (window._currentDetailCourseId) await loadCourseBatches(window._currentDetailCourseId);
  } catch (err) {
    if (checkBtn) { checkBtn.disabled = false; checkBtn.textContent = '✅ Complete'; }
    toast(err.message || 'Failed', 'error');
  }
};

// ── BANK DETAILS FORM ─────────────────────────────────────────
window.openBankDetailsForm = async function(resumeBatchId = null) {
  try {
    const { data: u } = await TeacherBank.get();
    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
      <div class="modal-sheet" style="max-height:90vh;overflow-y:auto">
        <div class="modal-sheet__handle"></div>
        <h3 class="modal-title">🏦 Bank Transfer Details</h3>
        ${!TeacherBank.hasBankDetails(u) ? `
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#92400E;font-weight:600">
          ⚠️ Bank details required to request a payout. Admin will transfer to this account.
        </div>` : ''}

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500);margin-bottom:10px">🏦 Bank Details</div>

        <div class="form-group">
          <label class="form-label">Bank Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="bd-bank-name" value="${escapeHTML(u?.bank_name || '')}" placeholder="e.g., HNB Bank, Sampath Bank, BOC">
        </div>
        <div class="form-group">
          <label class="form-label">Account Number <span class="required">*</span></label>
          <input type="text" class="form-input" id="bd-acc-num" value="${escapeHTML(u?.account_number || '')}" placeholder="Bank account number">
        </div>
        <div class="form-group">
          <label class="form-label">Account Name <span class="required">*</span></label>
          <input type="text" class="form-input" id="bd-acc-name" value="${escapeHTML(u?.account_name || '')}" placeholder="Name on the bank account">
        </div>
        <div class="form-group">
          <label class="form-label">Branch</label>
          <input type="text" class="form-input" id="bd-branch" value="${escapeHTML(u?.bank_branch || '')}" placeholder="Branch name or city">
        </div>

        <div style="height:1px;background:#E5E7EB;margin:14px 0"></div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--gray-500);margin-bottom:10px">📞 Contact Details</div>

        <div class="form-group">
          <label class="form-label">WhatsApp (with country code)</label>
          <input type="tel" class="form-input" id="bd-whatsapp" value="${escapeHTML(u?.whatsapp_number || '')}" placeholder="94771234567">
        </div>
        <div class="form-group">
          <label class="form-label">Display Phone</label>
          <input type="tel" class="form-input" id="bd-phone" value="${escapeHTML(u?.display_phone || '')}" placeholder="0771234567">
        </div>
        <div class="form-group">
          <label class="form-label">Contact Email</label>
          <input type="email" class="form-input" id="bd-email" value="${escapeHTML(u?.contact_email || '')}" placeholder="your@email.com">
        </div>

        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
          <button class="btn btn-primary flex-1" id="bd-save-btn" onclick="saveBankDetails('${resumeBatchId || ''}')">
            ${resumeBatchId ? 'Save & Continue' : 'Save Details'}
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  } catch (err) { toast(err.message || 'Error loading bank details', 'error'); }
};

window.saveBankDetails = async function(resumeBatchId) {
  const bankName = document.getElementById('bd-bank-name')?.value?.trim();
  const accNum   = document.getElementById('bd-acc-num')?.value?.trim();
  const accName  = document.getElementById('bd-acc-name')?.value?.trim();
  const branch   = document.getElementById('bd-branch')?.value?.trim();
  const whatsapp = document.getElementById('bd-whatsapp')?.value?.trim();
  const phone    = document.getElementById('bd-phone')?.value?.trim();
  const email    = document.getElementById('bd-email')?.value?.trim();

  if (!bankName) { toast('Bank name is required', 'error'); return; }
  if (!accNum)   { toast('Account number is required', 'error'); return; }
  if (!accName)  { toast('Account name is required', 'error'); return; }

  const btn = document.getElementById('bd-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const { error } = await TeacherBank.save({
      bank_name:       bankName,
      account_number:  accNum,
      account_name:    accName,
      bank_branch:     branch,
      whatsapp_number: whatsapp,
      display_phone:   phone,
      contact_email:   email,
    });
    if (error) throw error;
    document.querySelector('.modal-overlay')?.remove();
    document.body.style.overflow = '';
    toast('Bank details saved! ✅', 'success');
    // Resume payout flow if we were mid-flow
    if (resumeBatchId) await openWithdrawForm(resumeBatchId);
  } catch (err) {
    toast(err.message || 'Failed to save', 'error');
    if (btn) { btn.disabled = false; btn.textContent = resumeBatchId ? 'Save & Continue' : 'Save Details'; }
  }
};

// ── WITHDRAWAL ────────────────────────────────────────────────
window.openWithdrawForm = async function(batchId) {
  try {
    // Step 1 — Check bank details exist
    const { data: bankInfo } = await TeacherBank.get();
    if (!TeacherBank.hasBankDetails(bankInfo)) {
      await openBankDetailsForm(batchId);
      return;
    }

    const { data: summary } = await WalletV2.getSummary();
    const available = Number(summary?.wallet_balance || 0);
    const batchData = summary?.completed_batches?.find(b => b.batch_id === batchId);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-sheet__handle"></div>
        <h3 class="modal-title">💰 Request Payout</h3>
        ${batchData ? `
          <div style="background:var(--gradient-soft);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:var(--gray-500)">Gross (students paid)</span>
              <span>LKR ${Number(batchData.gross || 0).toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:var(--gray-500)">Refunds deducted</span>
              <span style="color:#FF416C">− LKR ${Number(batchData.refunds || 0).toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid var(--gray-100);padding-top:8px;margin-top:4px">
              <span>Your Net Earnings (75%)</span>
              <span style="color:#11CB6A">LKR ${Number(batchData.net || 0).toLocaleString()}</span>
            </div>
          </div>` : ''}
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:12px;color:var(--gray-500)">Wallet Balance</div>
          <div style="font-size:22px;font-weight:800;color:var(--purple-start)">LKR ${available.toLocaleString()}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Amount to Withdraw (LKR)</label>
          <input type="number" class="form-input" id="wd-amount" value="${available}" max="${available}" min="1"
            oninput="const m=+this.max;if(+this.value>m){this.value=m;document.getElementById('wd-amount-warn').style.display='flex';}else{document.getElementById('wd-amount-warn').style.display='none';}">
          <div id="wd-amount-warn" style="display:none;align-items:center;gap:6px;margin-top:6px;padding:7px 10px;background:#FEF2F2;border-radius:8px;font-size:12px;color:#DC2626;font-weight:600">
            ⚠️ Maximum withdrawal is LKR ${available.toLocaleString()}
          </div>
        </div>
        <!-- Bank account being paid to -->
        <div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:12px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#059669;margin-bottom:6px">💳 Transfer to</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="color:var(--gray-500)">Bank</span>
            <span style="font-weight:600">${escapeHTML(bankInfo.bank_name)}${bankInfo.bank_branch ? ' — ' + escapeHTML(bankInfo.bank_branch) : ''}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="color:var(--gray-500)">Account No.</span>
            <span style="font-weight:700;color:var(--purple-start)">${escapeHTML(bankInfo.account_number)}</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="color:var(--gray-500)">Account Name</span>
            <span style="font-weight:600">${escapeHTML(bankInfo.account_name)}</span>
          </div>
          <button onclick="openBankDetailsForm();this.closest('.modal-overlay').remove();document.body.style.overflow=''"
            style="margin-top:8px;background:none;border:none;font-size:11px;color:var(--purple-start);cursor:pointer;font-weight:600;padding:0">
            ✏️ Edit bank details
          </button>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
          <button class="btn btn-primary flex-1" onclick="submitWithdrawal('${batchId}')">Request Payout</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  } catch (err) { toast(err.message || 'Error loading wallet', 'error'); }
};

window.submitWithdrawal = async function(batchId) {
  const input  = document.getElementById('wd-amount');
  const amount = parseFloat(input?.value);
  const max    = parseFloat(input?.max || 0);
  if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (amount > max) {
    toast(`Maximum withdrawal is LKR ${max.toLocaleString()}`, 'error');
    input.value = max;
    return;
  }
  const btn = document.querySelector('.modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Requesting...'; }
  try {
    const { error } = await WalletV2.requestWithdrawal(batchId, amount);
    if (error) throw error;
    document.querySelector('.modal-overlay')?.remove();
    document.body.style.overflow = '';
    toast('Payout requested! Admin will review and transfer.', 'success');
    if (window._currentDetailCourseId) await loadCourseBatches(window._currentDetailCourseId);
  } catch (err) {
    toast(err.message || 'Failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Request Payout'; }
  }
};

// ── BATCH LESSONS VIEW ────────────────────────────────────────
window.openBatchLessons = async function(batchId, batchTitle) {
  const container = document.getElementById('course-detail-content');
  if (!container) return;
  container.innerHTML = `<div style="padding:40px;text-align:center">
    <svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;

  try {
    const { data: curriculum, error } = await BatchLessons.getCurriculum(batchId);
    if (error) throw error;

    const { data: batchRow } = await db.from('batches').select('status').eq('id', batchId).single();
    const batchStatus = batchRow?.status || 'opening';
    const canEdit     = ['opening', 'upcoming', 'active'].includes(batchStatus);

    const totalLessons = (curriculum || []).reduce((s, m) => s + (m.lessons?.length || 0), 0);
    const doneLessons  = (curriculum || []).reduce((s, m) => s + (m.lessons || []).filter(l => l.is_completed).length, 0);

    container.innerHTML = `
      <div style="padding:0 16px 80px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <button class="icon-btn" onclick="loadBatchesGlobal()">
            <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>
          </button>
          <div style="flex:1;min-width:0">
            <h2 style="font-family:var(--font-display);font-weight:700;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(batchTitle)}</h2>
            <div style="font-size:12px;color:var(--gray-500)">${doneLessons}/${totalLessons} lessons done • ${batchStatus}</div>
          </div>
        </div>

        ${totalLessons > 0 ? `
          <div style="background:var(--gray-100);border-radius:99px;height:6px;margin-bottom:16px;overflow:hidden">
            <div style="background:var(--gradient);height:100%;border-radius:99px;width:${Math.round(doneLessons / totalLessons * 100)}%;transition:width .4s"></div>
          </div>` : ''}

        ${!(curriculum || []).length
          ? `<div class="empty-state" style="padding:24px 0">
              <div style="font-size:36px;text-align:center">📭</div>
              <div class="empty-state__text">No lessons yet. Add lessons to your course curriculum first.</div>
             </div>`
          : (curriculum || []).map(mod => moduleBlock(mod, batchId, batchStatus, canEdit)).join('')}
      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state__text" style="color:#FF416C">${escapeHTML(err.message)}</div></div>`;
  }
};

function moduleBlock(mod, batchId, batchStatus, canEdit) {
  const lessons = mod.lessons || [];
  const done    = lessons.filter(l => l.is_completed).length;
  return `
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700;font-size:14px;color:var(--purple-start)">
          📂 ${escapeHTML(mod.module_title || mod.title || 'Module')}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--gray-400)">${done}/${lessons.length}</span>
          ${canEdit ? `
            <button class="btn btn-ghost btn--sm" style="padding:3px 8px;font-size:11px"
              onclick="openAddLessonForm('${batchId}','${mod.module_id}','${escapeHTML(mod.module_title || '').replace(/'/g, "\\'")}')">
              + Lesson
            </button>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${!lessons.length
          ? `<div style="font-size:12px;color:var(--gray-300);padding:8px 12px">No lessons in this module</div>`
          : lessons.map(l => lessonCard(l, batchId, batchStatus, canEdit)).join('')}
      </div>
    </div>`;
}

function lessonCard(lesson, batchId, batchStatus, canEdit) {
  const done     = lesson.is_completed;
  const hasLink  = !!lesson.link_url;
  const icon     = LESSON_ICON[lesson.lesson_type] || '📄';
  const safeId   = lesson.id;
  const safeTitle = escapeHTML(lesson.title || '');
  const safeBatch = escapeHTML(batchId || '');

  let timeInfo = '';
  if (lesson.live_start_at) {
    const start = new Date(lesson.live_start_at);
    const diff  = start - new Date();
    if (diff > 0) {
      const hrs  = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      timeInfo = `<span style="font-size:10px;color:#FF9500;font-weight:600">⏰ ${hrs > 0 ? hrs + 'h ' : ''}${mins}m remaining</span>`;
    } else {
      timeInfo = `<span style="font-size:10px;color:#11CB6A;font-weight:600">🟢 Live now</span>`;
    }
  }

  return `
    <div class="glass-card--flat" style="padding:10px 12px;${done ? 'opacity:0.7' : ''}">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="width:30px;height:30px;border-radius:8px;background:${done ? '#ECFDF5' : 'var(--gradient-soft)'};
          display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          ${done ? '✅' : icon}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px">${safeTitle}</div>
          <div style="font-size:11px;color:var(--gray-400);margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span>${(lesson.lesson_type || 'video').toUpperCase()}</span>
            ${lesson.is_mandatory_qa ? `<span style="color:#FF9500;font-weight:600">★ Mandatory Q&A</span>` : ''}
            ${hasLink
              ? `<span style="color:#11CB6A">● Link set${lesson.is_public ? ' • 🌐 Public' : ' • 🔒 Enrolled only'}</span>`
              : `<span style="color:var(--gray-300)">○ No link</span>`}
            ${timeInfo}
          </div>
          ${lesson.live_start_at ? `
            <div style="font-size:11px;color:var(--gray-400);margin-top:2px">
              🕐 ${new Date(lesson.live_start_at).toLocaleString('en-LK', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
              ${lesson.live_end_at ? ' → ' + new Date(lesson.live_end_at).toLocaleString('en-LK', { hour:'2-digit', minute:'2-digit' }) : ''}
            </div>` : ''}
        </div>
        ${done ? `<span style="font-size:11px;color:#059669;font-weight:600;flex-shrink:0">Done ✓</span>` : ''}
      </div>

      ${canEdit && !done ? `
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-ghost btn--sm flex-1" onclick="openSetLinkForm('${safeId}','${lesson.lesson_type}')">
            ${hasLink ? '✏️ Edit Link' : '🔗 Set Link'}
          </button>
          ${batchStatus === 'active' ? `
            <button class="btn btn-success btn--sm" onclick="doCompleteLesson('${safeId}','${safeBatch}','${safeTitle.replace(/'/g, "\\'")}')">
              ✅ Done
            </button>` : ''}
          <button class="btn btn-ghost btn--sm" style="padding:4px 8px;color:#FF416C"
            onclick="doDeleteLesson('${safeId}','${safeBatch}')">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            </svg>
          </button>
        </div>` : ''}
    </div>`;
}

// ── ADD LESSON TO BATCH ───────────────────────────────────────
window.openAddLessonForm = function(batchId, moduleId, moduleTitle) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-sheet__handle"></div>
      <h3 class="modal-title">Add Lesson</h3>
      <p style="font-size:12px;color:var(--gray-400);margin-bottom:14px">Module: ${escapeHTML(moduleTitle)}</p>
      <div class="form-group">
        <label class="form-label">Title <span class="required">*</span></label>
        <input type="text" class="form-input" id="al-title" placeholder="Lesson title">
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-input" id="al-type">
          <option value="video">🎬 Video</option>
          <option value="live">📡 Live</option>
          <option value="resource">📄 Resource</option>
          <option value="exam">📝 Exam</option>
        </select>
      </div>
      <label class="tc-wrap" style="margin-bottom:14px">
        <input type="checkbox" id="al-qa">
        <span>Mandatory Q&A lesson</span>
      </label>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="doAddLesson('${batchId}','${moduleId}')">Add</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
};

window.doAddLesson = async function(batchId, moduleId) {
  const title = document.getElementById('al-title')?.value?.trim();
  if (!title) { toast('Title required', 'error'); return; }
  const btn = document.querySelector('.modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
  try {
    const { error } = await BatchLessons.add(batchId, moduleId, {
      title,
      lessonType:    document.getElementById('al-type').value,
      isMandatoryQa: document.getElementById('al-qa').checked,
    });
    if (error) throw error;
    document.querySelector('.modal-overlay')?.remove();
    document.body.style.overflow = '';
    toast('Lesson added!', 'success');
    const batchTitle = document.querySelector('#course-detail-content h2')?.textContent || '';
    await window.openBatchLessons(batchId, batchTitle);
  } catch (err) {
    toast(err.message || 'Failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Add'; }
  }
};

// ── SET LESSON LINK ───────────────────────────────────────────
window.openSetLinkForm = function(lessonId, lessonType) {
  const needsTime = ['live', 'exam'].includes(lessonType);
  const canPublic = ['video', 'resource'].includes(lessonType);
  const typeLabels = { live:'Google Meet URL', exam:'Exam URL', video:'Video/Drive URL', resource:'Resource URL' };
  const placeholder = lessonType === 'live'     ? 'https://meet.google.com/xxx'
                    : lessonType === 'video'    ? 'Google Drive / YouTube share link'
                    : lessonType === 'resource' ? 'Google Drive / Docs link'
                    : 'https://...';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-sheet__handle"></div>
      <h3 class="modal-title">🔗 Set ${lessonType.charAt(0).toUpperCase() + lessonType.slice(1)} Link</h3>
      <div class="form-group">
        <label class="form-label">${typeLabels[lessonType] || 'URL'} <span class="required">*</span></label>
        <input type="url" class="form-input" id="sl-url" placeholder="${placeholder}">
      </div>
      ${needsTime ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label class="form-label">Start Time <span class="required">*</span></label>
            <input type="datetime-local" class="form-input" id="sl-start">
          </div>
          <div class="form-group">
            <label class="form-label">End Time</label>
            <input type="datetime-local" class="form-input" id="sl-end">
          </div>
        </div>
        <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px">
          ⏱ Students see a countdown timer and receive a notification.
        </div>` : ''}
      ${canPublic ? `
        <label class="tc-wrap" style="margin-bottom:14px">
          <input type="checkbox" id="sl-public">
          <span style="font-size:13px">
            🌐 <strong>Public access</strong> — anyone browsing the course can open this link
            <span style="font-size:11px;color:var(--gray-400);display:block;margin-top:2px">
              Leave unchecked to restrict to enrolled batch students only
            </span>
          </span>
        </label>` : `
        <div style="font-size:12px;color:var(--gray-400);margin-bottom:12px">
          🔒 Link only visible to enrolled batch students.
        </div>`}
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost flex-1" onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">Cancel</button>
        <button class="btn btn-primary flex-1" onclick="doSetLessonLink('${lessonId}',${needsTime},${canPublic})">Save Link</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
};

window.doSetLessonLink = async function(lessonId, needsTime, canPublic) {
  const url = document.getElementById('sl-url')?.value?.trim();
  if (!url) { toast('URL required', 'error'); return; }
  if (needsTime && !document.getElementById('sl-start')?.value) {
    toast('Start time is required for live/exam lessons', 'error'); return;
  }
  const btn = document.querySelector('.modal-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const startVal = document.getElementById('sl-start')?.value;
    const endVal   = document.getElementById('sl-end')?.value;
    const isPublic = canPublic && document.getElementById('sl-public')?.checked;
    const { error } = await BatchLessons.setLink(lessonId, {
      url,
      liveStart: startVal ? new Date(startVal).toISOString() : null,
      liveEnd:   endVal   ? new Date(endVal).toISOString()   : null,
      isPublic,
    });
    if (error) throw error;
    document.querySelector('.modal-overlay')?.remove();
    document.body.style.overflow = '';
    toast(isPublic ? 'Link saved! Publicly accessible.' : 'Link saved! Students will be notified.', 'success');
    const batchTitle = document.querySelector('#course-detail-content h2')?.textContent || '';
    // Extract batchId from a nearby element's onclick
    const batchIdMatch = document.querySelector('[onclick*="openBatchLessons"]')?.getAttribute('onclick')?.match(/'([0-9a-f-]{36})'/);
    if (batchIdMatch?.[1]) await window.openBatchLessons(batchIdMatch[1], batchTitle);
  } catch (err) {
    toast(err.message || 'Failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Save Link'; }
  }
};

// ── MARK LESSON DONE ──────────────────────────────────────────
window.doCompleteLesson = async function(lessonId, batchId, lessonTitle) {
  if (!confirm(`Mark "${lessonTitle}" as completed?`)) return;
  try {
    const { error } = await BatchLessons.complete(lessonId);
    if (error) throw error;
    toast('Lesson marked complete!', 'success');
    const batchTitle = document.querySelector('#course-detail-content h2')?.textContent || '';
    await window.openBatchLessons(batchId, batchTitle);
  } catch (err) { toast(err.message || 'Failed', 'error'); }
};

// ── DELETE LESSON ─────────────────────────────────────────────
window.doDeleteLesson = async function(lessonId, batchId) {
  if (!confirm('Delete this lesson from the batch?')) return;
  try {
    const { error } = await BatchLessons.delete(lessonId);
    if (error) throw error;
    toast('Lesson deleted', 'success');
    const batchTitle = document.querySelector('#course-detail-content h2')?.textContent || '';
    await window.openBatchLessons(batchId, batchTitle);
  } catch (err) { toast(err.message || 'Failed', 'error'); }
};
