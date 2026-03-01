// ============================================================
// EduGuru — Student Dashboard (My Courses) — Phase 3
// ============================================================
import { Enrollments, Transactions, Wishlist, BatchLessons, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { formatLKR, formatHours, formatDate, timeAgo, escapeHTML, toast } from '../utils.js';

const LESSON_ICON  = { video: '🎬', live: '📡', resource: '📄', exam: '📝' };
const LESSON_LABEL = { video: 'Video', live: 'Live Class', resource: 'Resource', exam: 'Exam' };

const BATCH_STATUS_COLOR = { opening: '#8B5CF6', upcoming: '#F59E0B', active: '#11CB6A', completed: '#6B7280' };
const BATCH_STATUS_BG    = { opening: '#F5F3FF', upcoming: '#FFF7ED', active: '#ECFDF5', completed: '#F9FAFB' };

// Context store for panel refresh
const _panelCtx = {};  // { enrollmentId: { batchId, courseId } }

export function renderStudentDashboard() {
  return `
    <div class="student-dashboard page" id="student-dashboard">
      <!-- Header -->
      <div style="padding:20px 16px 0">
        <h1 style="font-family:var(--font-display);font-weight:800;font-size:22px">My Learning</h1>
        <p style="color:var(--gray-500);font-size:14px;margin-top:4px">Track your progress</p>
      </div>

      <!-- Tabs -->
      <div class="tabs-wrap" style="margin-top:16px;margin-bottom:16px">
        <div class="tabs">
          <button class="tab-btn active" data-tab="enrolled">Enrolled</button>
          <button class="tab-btn" data-tab="wishlist">Wishlist</button>
          <button class="tab-btn" data-tab="payments">Payments</button>
        </div>
      </div>

      <!-- Content -->
      <div id="student-tab-content">
        <div style="text-align:center;padding:40px">
          <svg class="spin" viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      </div>
    </div>`;
}

export async function initStudentDashboard() {
  initStudentTabs();
  await loadEnrolled();
}

let currentStudentTab = 'enrolled';

function initStudentTabs() {
  document.querySelectorAll('#student-dashboard .tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('#student-dashboard .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStudentTab = btn.dataset.tab;
      if (currentStudentTab === 'enrolled')  await loadEnrolled();
      if (currentStudentTab === 'wishlist')  await loadWishlist();
      if (currentStudentTab === 'payments')  await loadPayments();
    });
  });
}

// ── ENROLLED COURSES ──────────────────────────────────────────
async function loadEnrolled() {
  const container = document.getElementById('student-tab-content');
  container.innerHTML = skeletonList(3);

  try {
    const enrollments = await Enrollments.getByStudent(AuthState.user.id);

    if (!enrollments.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <div class="empty-state__title">No Courses Yet</div>
          <div class="empty-state__text">Browse and enroll in courses to start learning</div>
          <button class="btn btn-primary btn--sm" onclick="App.navigate('browse')">Browse Courses</button>
        </div>`;
      return;
    }

    // Bulk-fetch batch status for enrolled batches
    const batchIds = [...new Set(enrollments.filter(e => e.batch_id).map(e => e.batch_id))];
    let batchMap = {};
    if (batchIds.length) {
      const { data: batches } = await db.from('batches')
        .select('id,title,status,start_at,end_at,enrolled_count,max_students')
        .in('id', batchIds);
      (batches || []).forEach(b => { batchMap[b.id] = b; });
    }

    container.innerHTML = `
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
        ${enrollments.map(e => enrolledCourseCard(e, batchMap[e.batch_id] || null)).join('')}
      </div>`;

  } catch (err) {
    container.innerHTML = errorState(err.message);
  }
}

function enrolledCourseCard(enrollment, batch) {
  const c   = enrollment.course;
  const pct = Math.round(enrollment.progress_percent || 0);
  const done = enrollment.completed_at;

  const batchBadge = batch ? `
    <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;
      background:${BATCH_STATUS_BG[batch.status] || '#F9FAFB'};
      color:${BATCH_STATUS_COLOR[batch.status] || '#6B7280'};flex-shrink:0">
      ${batch.status.toUpperCase()}
    </span>` : '';

  return `
    <div class="glass-card--flat" style="padding:14px;cursor:pointer" onclick="App.navigate('course','${c.id}')">
      <div style="display:flex;gap:12px">
        ${c.thumbnail_url
          ? `<img src="${escapeHTML(c.thumbnail_url)}" style="width:72px;height:50px;object-fit:cover;border-radius:10px;flex-shrink:0">`
          : `<div style="width:72px;height:50px;background:var(--gradient-soft);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
               <svg viewBox="0 0 24 24" width="24" height="24" stroke="var(--purple-start)" fill="none" stroke-width="1.5"><polygon points="5,3 19,12 5,21"/></svg>
             </div>`
        }
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(c.title)}</div>
            ${batchBadge}
          </div>
          <div style="color:var(--gray-500);font-size:12px">${escapeHTML(c.teacher?.full_name || '')}</div>
          ${done
            ? `<span class="chip" style="background:#ECFDF5;color:#059669;font-size:11px;margin-top:6px;display:inline-flex">✅ Completed</span>`
            : `<div style="margin-top:8px">
                 <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--gray-400);margin-bottom:4px">
                   <span>Progress</span><span>${pct}%</span>
                 </div>
                 <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
               </div>`
          }
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;margin-top:12px">
        ${enrollment.batch_id ? `
          <button class="btn btn-primary flex-1 btn--sm"
            onclick="event.stopPropagation();App.navigate('course-dashboard',{batchId:'${enrollment.batch_id}'})">
            📚 Open Dashboard
          </button>
        ` : `
          <button class="btn btn-primary flex-1 btn--sm"
            onclick="event.stopPropagation();App.navigate('course','${c.id}')">
            ${done ? 'Review Course' : (pct > 0 ? 'Continue' : 'Start Learning')}
          </button>`
        }
        ${c.total_hours && formatHours(c.total_hours) !== '0h'
          ? `<span class="chip" style="flex-shrink:0">${formatHours(c.total_hours)}</span>` : ''}
      </div>
    </div>`;
}

// ── BATCH LESSONS PANEL ───────────────────────────────────────
window.openStudentBatchLessons = async function(enrollmentId, batchId, courseId) {
  const panel = document.getElementById(`batch-lessons-${enrollmentId}`);
  if (!panel) return;

  // Toggle off
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.innerHTML = '';
    delete _panelCtx[enrollmentId];
    return;
  }

  // Save context for refresh
  _panelCtx[enrollmentId] = { batchId, courseId };

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="text-align:center;padding:16px">
      <svg class="spin" viewBox="0 0 24 24" width="20" height="20" stroke="var(--purple-start)" fill="none" stroke-width="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
    </div>`;

  try {
    // Fetch batch details
    const { data: batch, error: bErr } = await db.from('batches')
      .select('id,title,status,start_at,end_at,enrolled_count,max_students')
      .eq('id', batchId).single();
    if (bErr) throw bErr;

    // ── Opening: start date not set yet ──
    if (batch.status === 'opening') {
      panel.innerHTML = `
        <div style="text-align:center;padding:20px 12px">
          <div style="font-size:36px;margin-bottom:8px">🔜</div>
          <div style="font-weight:700;font-size:14px;color:var(--purple-start)">Batch Opening Soon</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:6px;line-height:1.5">
            Your teacher will set the start date shortly.<br>You're all set — just wait for the announcement!
          </div>
        </div>`;
      return;
    }

    // ── Upcoming: start date is set, not yet started ──
    if (batch.status === 'upcoming') {
      const cntdown = batch.start_at ? formatCountdown(batch.start_at) : 'soon';
      const startFmt = batch.start_at
        ? new Date(batch.start_at).toLocaleString('en-LK', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })
        : '';
      panel.innerHTML = `
        <div style="text-align:center;padding:20px 12px">
          <div style="font-size:36px;margin-bottom:8px">📅</div>
          <div style="font-weight:700;font-size:14px;color:#F59E0B">Batch starts ${cntdown}</div>
          ${startFmt ? `<div style="font-size:12px;color:var(--gray-500);margin-top:4px">${startFmt}</div>` : ''}
          <div style="font-size:12px;color:var(--gray-400);margin-top:8px;line-height:1.5">
            Lessons will be accessible once the batch begins.<br>Stay tuned!
          </div>
          <button class="btn btn-ghost btn--sm" style="margin-top:12px"
            onclick="App.navigate('chat',{courseId:'${courseId}'})">
            💬 Chat with Batch
          </button>
        </div>`;
      return;
    }

    // ── Active / Completed: show curriculum ──
    const { data: modules, error: cErr } = await BatchLessons.getCurriculum(batchId);
    if (cErr) throw cErr;

    if (!modules || !modules.length) {
      panel.innerHTML = `<div style="font-size:13px;color:var(--gray-400);text-align:center;padding:12px">No lessons added yet</div>`;
      return;
    }

    // Overall progress
    const allLessons  = modules.flatMap(m => m.lessons || []);
    const doneLessons = allLessons.filter(l => l.student_done).length;
    const totalLessons = allLessons.length;
    const overallPct  = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;

    panel.innerHTML = `
      <div>
        <!-- Batch header row -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.5px">
              ${escapeHTML(batch.title || 'Batch')}
            </div>
            <div style="font-size:11px;color:var(--gray-400);margin-top:1px">
              ${doneLessons}/${totalLessons} lessons done
            </div>
          </div>
          <span style="padding:3px 10px;border-radius:99px;font-size:11px;font-weight:700;
            background:${BATCH_STATUS_BG[batch.status] || '#F9FAFB'};
            color:${BATCH_STATUS_COLOR[batch.status] || '#6B7280'}">
            ${batch.status.toUpperCase()}
          </span>
        </div>

        <!-- Overall progress bar -->
        <div class="progress-bar" style="margin-bottom:14px">
          <div class="progress-fill" style="width:${overallPct}%"></div>
        </div>

        <!-- Study Schedule (collapsible) -->
        ${batch.start_at && batch.end_at ? studyScheduleHTML(batch, modules) : ''}

        <!-- Module blocks -->
        <div style="display:flex;flex-direction:column;gap:10px">
          ${modules.map(m => studentModuleBlock(m, batch.status, batchId, enrollmentId)).join('')}
        </div>

        <!-- Bottom actions -->
        <div style="display:flex;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--gray-100)">
          <button class="btn btn-ghost flex-1 btn--sm"
            onclick="App.navigate('chat',{courseId:'${courseId}'})">
            💬 Batch Chat
          </button>
          <button class="btn btn-ghost btn--sm" style="flex-shrink:0"
            onclick="openTeamSupport()">
            🆘 Support
          </button>
        </div>
      </div>`;

  } catch (err) {
    panel.innerHTML = `<div style="font-size:13px;color:#FF416C;text-align:center;padding:8px">${escapeHTML(err.message)}</div>`;
  }
};

// ── STUDY SCHEDULE ────────────────────────────────────────────
function studyScheduleHTML(batch, modules) {
  const allLessons = modules.flatMap(m =>
    (m.lessons || []).map(l => ({ ...l, module_title: m.module_title }))
  );
  if (!allLessons.length) return '';

  const startMs = new Date(batch.start_at).getTime();
  const endMs   = new Date(batch.end_at).getTime();
  const totalMs = endMs - startMs;
  const total   = allLessons.length;

  // Distribute lessons evenly across the period
  const schedule = allLessons.map((lesson, i) => {
    const offset = (i / total) * totalMs;
    return { ...lesson, scheduled_at: new Date(startMs + offset) };
  });

  // Group by week
  const weekMs = 7 * 24 * 3600 * 1000;
  const totalWeeks = Math.ceil(totalMs / weekMs) || 1;
  const weeks = [];
  for (let w = 0; w < Math.min(totalWeeks, 20); w++) {
    const weekStart = startMs + w * weekMs;
    const weekEnd   = weekStart + weekMs;
    const weekLessons = schedule.filter(l => {
      const t = l.scheduled_at.getTime();
      return t >= weekStart && t < weekEnd;
    });
    if (weekLessons.length) weeks.push({ week: w + 1, lessons: weekLessons });
  }

  const rows = weeks.map(wk => `
    <div style="margin-bottom:8px">
      <div style="font-size:11px;font-weight:700;color:var(--gray-500);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px">
        Week ${wk.week}
      </div>
      ${wk.lessons.map(l => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:${l.student_done ? '#F0FDF4' : '#fff'};margin-bottom:3px">
          <span style="font-size:12px">${LESSON_ICON[l.lesson_type] || '📋'}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(l.title)}</div>
            <div style="font-size:10px;color:var(--gray-400)">${escapeHTML(l.module_title)} • ${l.scheduled_at.toLocaleDateString('en-LK',{day:'numeric',month:'short'})}</div>
          </div>
          ${l.student_done ? `<span style="font-size:10px;color:#059669;font-weight:700">✓</span>` : ''}
        </div>`).join('')}
    </div>`).join('');

  return `
    <details style="margin-bottom:14px" id="study-schedule-details">
      <summary style="font-size:12px;font-weight:700;color:var(--purple-start);cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;padding:8px 10px;background:var(--gradient-soft);border-radius:10px;user-select:none">
        📅 <span>Study Schedule (${total} lessons over ${totalWeeks} week${totalWeeks!==1?'s':''})</span>
        <svg style="margin-left:auto" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>
      </summary>
      <div style="margin-top:8px;padding:8px;background:#FAFAFA;border-radius:10px;max-height:280px;overflow-y:auto">
        <div style="font-size:11px;color:var(--gray-400);margin-bottom:8px">
          🗓 ${new Date(batch.start_at).toLocaleDateString('en-LK',{day:'numeric',month:'long',year:'numeric'})}
          → ${new Date(batch.end_at).toLocaleDateString('en-LK',{day:'numeric',month:'long',year:'numeric'})}
        </div>
        ${rows}
      </div>
    </details>`;
}

// ── TEAM SUPPORT ──────────────────────────────────────────────
window.openTeamSupport = function() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-sheet__handle"></div>
      <h3 class="modal-title">🆘 Team Support</h3>
      <p style="font-size:13px;color:var(--gray-500);margin-bottom:20px;line-height:1.6">
        Need help? Our support team is available via WhatsApp or phone call.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <a href="https://wa.me/94789929233?text=${encodeURIComponent('Hi EduGuru! I need help with my course.')}"
          target="_blank" rel="noopener"
          class="btn btn-success btn--full"
          style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.115.554 4.103 1.523 5.824L0 24l6.352-1.498A11.933 11.933 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.741-.524-5.291-1.438l-.379-.225-3.931.926.984-3.844-.247-.395A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
          WhatsApp Support
        </a>
        <a href="tel:+94789929233"
          class="btn btn-outline btn--full"
          style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px">
          📞 Call Support
        </a>
      </div>
      <button class="btn btn-ghost btn--full" style="margin-top:10px"
        onclick="this.closest('.modal-overlay').remove();document.body.style.overflow=''">
        Close
      </button>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
};

// ── MODULE BLOCK ──────────────────────────────────────────────
function studentModuleBlock(mod, batchStatus, batchId, enrollmentId) {
  const lessons = mod.lessons || [];
  const doneCnt = lessons.filter(l => l.student_done).length;
  const allDone = lessons.length > 0 && doneCnt === lessons.length;

  return `
    <div style="background:var(--gray-50);border-radius:14px;padding:12px">
      <!-- Module header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:700;font-size:13px;color:var(--gray-700);flex:1;min-width:0;margin-right:8px">
          ${escapeHTML(mod.module_title)}
        </div>
        <span style="font-size:11px;font-weight:600;flex-shrink:0;color:${allDone ? '#059669' : 'var(--gray-400)'}">
          ${allDone ? '✅' : ''} ${doneCnt}/${lessons.length}
        </span>
      </div>
      <!-- Lessons -->
      ${lessons.length
        ? `<div style="display:flex;flex-direction:column;gap:6px">
             ${lessons.map(l => studentLessonCard(l, batchStatus, batchId, enrollmentId)).join('')}
           </div>`
        : `<div style="font-size:12px;color:var(--gray-300);text-align:center;padding:8px">No lessons in this module yet</div>`
      }
    </div>`;
}

// ── LESSON CARD ───────────────────────────────────────────────
function studentLessonCard(lesson, batchStatus, batchId, enrollmentId) {
  const icon  = LESSON_ICON[lesson.lesson_type]  || '📋';
  const label = LESSON_LABEL[lesson.lesson_type] || lesson.lesson_type;
  const isLive = lesson.lesson_type === 'live' || lesson.lesson_type === 'exam';

  // Countdown chip for live/exam lessons
  let timeChip = '';
  if (isLive && lesson.live_start_at) {
    const lStatus = getLiveStatus(lesson.live_start_at, lesson.live_end_at);
    if (lStatus === 'live') {
      timeChip = `<span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:#FEF2F2;color:#EF4444">🔴 LIVE NOW</span>`;
    } else if (lStatus === 'soon') {
      timeChip = `<span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;background:#FFF7ED;color:#F59E0B">⏱ ${formatCountdown(lesson.live_start_at)}</span>`;
    } else {
      timeChip = `<span style="padding:2px 8px;border-radius:99px;font-size:10px;color:var(--gray-400)">Ended</span>`;
    }
  }

  // Primary action button
  let actionBtn = '';
  if (lesson.student_done) {
    actionBtn = `<span style="font-size:11px;color:#059669;font-weight:600;white-space:nowrap">✓ Done</span>`;
  } else if (batchStatus === 'active' && lesson.meet_url) {
    const btnLabel = lesson.lesson_type === 'live' ? '📡 Join'
                   : lesson.lesson_type === 'exam' ? '📝 Start'
                   : '▶ Open';
    actionBtn = `
      <button class="btn btn-primary btn--sm" style="font-size:11px;padding:4px 10px;white-space:nowrap"
        onclick="studentAccessLesson('${lesson.id}','${batchId}','${enrollmentId}')">
        ${btnLabel}
      </button>`;
  } else if (batchStatus === 'active' && !lesson.meet_url) {
    actionBtn = `<span style="font-size:11px;color:var(--gray-300);white-space:nowrap">No link yet</span>`;
  } else if (batchStatus === 'upcoming') {
    actionBtn = `<span style="font-size:11px;color:var(--gray-400);white-space:nowrap">Soon</span>`;
  } else if (batchStatus === 'completed' && lesson.meet_url) {
    actionBtn = `
      <button class="btn btn-ghost btn--sm" style="font-size:11px;padding:4px 10px;white-space:nowrap"
        onclick="studentAccessLesson('${lesson.id}','${batchId}','${enrollmentId}')">
        ▶ Review
      </button>`;
  }

  // Secondary "Mark done" button
  const markDoneBtn = (!lesson.student_done && batchStatus === 'active')
    ? `<button style="background:none;border:none;font-size:10px;color:var(--gray-400);cursor:pointer;padding:2px 4px;white-space:nowrap;text-decoration:underline"
        onclick="studentMarkLessonDone('${lesson.id}','${batchId}','${enrollmentId}')">
        mark done
      </button>`
    : '';

  return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;border-radius:12px;
      background:${lesson.student_done ? '#F0FDF4' : '#fff'};
      border:1px solid ${lesson.student_done ? '#BBF7D0' : 'var(--gray-100)'}">
      <!-- Type icon -->
      <div style="width:32px;height:32px;border-radius:10px;flex-shrink:0;
        background:${lesson.student_done ? '#ECFDF5' : 'var(--gradient-soft)'};
        display:flex;align-items:center;justify-content:center;font-size:15px">
        ${lesson.student_done ? '✅' : icon}
      </div>
      <!-- Info -->
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${escapeHTML(lesson.title)}
        </div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">
          <span style="font-size:11px;color:var(--gray-400)">${label}</span>
          ${lesson.mandatory_qa
            ? `<span style="font-size:10px;padding:1px 6px;background:#EEF2FF;color:#6366F1;border-radius:99px">Q&A</span>` : ''}
          ${lesson.is_free_preview
            ? `<span style="font-size:10px;padding:1px 6px;background:#FFF7ED;color:#F59E0B;border-radius:99px">Preview</span>` : ''}
          ${timeChip}
        </div>
        ${isLive && lesson.live_start_at ? `
          <div style="font-size:11px;color:var(--gray-400);margin-top:3px">
            📅 ${new Date(lesson.live_start_at).toLocaleString('en-LK', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
          </div>` : ''}
        ${markDoneBtn}
      </div>
      <!-- Action -->
      <div style="flex-shrink:0;display:flex;align-items:center">
        ${actionBtn}
      </div>
    </div>`;
}

// ── LESSON ACTIONS ─────────────────────────────────────────────
window.studentAccessLesson = async function(lessonId, batchId, enrollmentId) {
  const btns = document.querySelectorAll(`[onclick*="studentAccessLesson('${lessonId}"]`);
  btns.forEach(b => { b.disabled = true; b.textContent = '...'; });

  try {
    const { data: result, error: aErr } = await BatchLessons.access(lessonId);
    if (aErr) throw aErr;
    if (!result?.url) throw new Error('Link not available yet');
    window.open(result.url, '_blank', 'noopener,noreferrer');
    toast('Opening ' + escapeHTML(result.lesson_title || 'lesson'), 'success', 2000);
    // Refresh panel to update access log / student_done state
    await _refreshPanel(enrollmentId);
  } catch (err) {
    toast(err.message || 'Cannot access lesson', 'error');
    btns.forEach(b => { b.disabled = false; });
  }
};

window.studentMarkLessonDone = async function(lessonId, batchId, enrollmentId) {
  if (!confirm('Mark this lesson as done?')) return;
  try {
    const { error: dErr } = await BatchLessons.complete(lessonId);
    if (dErr) throw dErr;
    toast('Lesson marked as done ✓', 'success', 2000);
    await _refreshPanel(enrollmentId);
  } catch (err) {
    toast(err.message || 'Failed to mark done', 'error');
  }
};

async function _refreshPanel(enrollmentId) {
  const ctx = _panelCtx[enrollmentId];
  if (!ctx) return;
  const panel = document.getElementById(`batch-lessons-${enrollmentId}`);
  if (!panel || panel.classList.contains('hidden')) return;
  // Close and reopen
  panel.classList.add('hidden');
  panel.innerHTML = '';
  await window.openStudentBatchLessons(enrollmentId, ctx.batchId, ctx.courseId);
}

// ── COUNTDOWN & LIVE STATUS HELPERS ───────────────────────────
function getLiveStatus(startAt, endAt) {
  const now   = Date.now();
  const start = new Date(startAt).getTime();
  const end   = endAt ? new Date(endAt).getTime() : start + 90 * 60 * 1000;
  if (now >= start && now <= end) return 'live';
  if (now < start) return 'soon';
  return 'ended';
}

function formatCountdown(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const days  = Math.floor(diff / (86400 * 1000));
  const hours = Math.floor((diff % (86400 * 1000)) / (3600 * 1000));
  const mins  = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  if (days > 0)  return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

// ── WISHLIST ──────────────────────────────────────────────────
async function loadWishlist() {
  const container = document.getElementById('student-tab-content');
  container.innerHTML = skeletonList(3);

  try {
    const items = await Wishlist.get(AuthState.user.id);

    if (!items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <div class="empty-state__title">Wishlist is Empty</div>
          <div class="empty-state__text">Save courses you want to take later</div>
          <button class="btn btn-primary btn--sm" onclick="App.navigate('browse')">Browse Courses</button>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
        ${items.map(item => wishlistCard(item)).join('')}
      </div>`;

  } catch (err) {
    container.innerHTML = errorState(err.message);
  }
}

function wishlistCard(item) {
  const c     = item.course;
  const price = c.discount_price || c.price;
  return `
    <div class="glass-card--flat" style="padding:14px">
      <div style="display:flex;gap:12px;align-items:center;cursor:pointer" onclick="App.navigate('course','${c.id}')">
        ${c.thumbnail_url
          ? `<img src="${escapeHTML(c.thumbnail_url)}" style="width:60px;height:42px;object-fit:cover;border-radius:10px;flex-shrink:0">`
          : `<div style="width:60px;height:42px;background:var(--gradient-soft);border-radius:10px;flex-shrink:0"></div>`
        }
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(c.title)}</div>
          <div style="color:var(--gray-500);font-size:12px">${escapeHTML(c.teacher?.full_name || '')}</div>
          <div style="font-weight:700;font-size:14px;margin-top:4px">${formatLKR(price)}</div>
        </div>
        <button class="icon-btn" onclick="event.stopPropagation();removeWishlist('${item.id}')" style="flex-shrink:0">
          <svg viewBox="0 0 24 24" stroke="#FF416C" fill="#FF416C" stroke-width="1">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <button class="btn btn-primary btn--full btn--sm" style="margin-top:10px"
        onclick="App.navigate('payment',{courseId:'${c.id}'})">
        Enroll Now
      </button>
    </div>`;
}

window.removeWishlist = async function(wishlistId) {
  try {
    await db.from('wishlists').delete().eq('id', wishlistId);
    toast('Removed from wishlist', 'success', 2000);
    await loadWishlist();
  } catch { toast('Failed to remove', 'error'); }
};

// ── PAYMENTS ──────────────────────────────────────────────────
async function loadPayments() {
  const container = document.getElementById('student-tab-content');
  container.innerHTML = skeletonList(3);

  try {
    const txns = await Transactions.getByStudent(AuthState.user.id);

    if (!txns.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div class="empty-state__title">No Payments Yet</div>
          <div class="empty-state__text">Your payment history will appear here</div>
        </div>`;
      return;
    }

    const statusColor = { pending: '#F59E0B', approved: '#11CB6A', rejected: '#FF416C' };
    const statusBg    = { pending: '#FFF7ED', approved: '#ECFDF5', rejected: '#FFF1F2' };

    container.innerHTML = `
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
        ${txns.map(t => `
          <div class="glass-card--flat" style="padding:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                  ${escapeHTML(t.course?.title || 'Course')}
                </div>
                <div style="color:var(--gray-400);font-size:12px;margin-top:2px">${timeAgo(t.submitted_at)}</div>
              </div>
              <span style="padding:4px 10px;border-radius:99px;font-size:11px;font-weight:700;flex-shrink:0;margin-left:8px;
                background:${statusBg[t.payment_status] || '#F9FAFB'};
                color:${statusColor[t.payment_status] || '#6B7280'}">
                ${t.payment_status.charAt(0).toUpperCase() + t.payment_status.slice(1)}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="color:var(--gray-500);font-size:13px">Amount Paid</span>
              <span style="font-weight:700;font-size:15px">${formatLKR(t.amount)}</span>
            </div>
            ${t.batch_id ? `
              <div style="margin-top:6px;font-size:12px;color:var(--gray-400)">
                Batch enrolled
              </div>` : ''}
            ${t.payment_status === 'rejected' ? `
              <div style="margin-top:8px;padding:8px 12px;background:#FFF1F2;border-radius:10px;font-size:12px;color:#FF416C">
                Payment rejected. Please contact support or re-submit.
              </div>` : ''}
          </div>`).join('')}
      </div>`;

  } catch (err) {
    container.innerHTML = errorState(err.message);
  }
}

// ── UI HELPERS ────────────────────────────────────────────────
function skeletonList(count = 3) {
  return `<div style="padding:0 16px;display:flex;flex-direction:column;gap:12px">
    ${Array(count).fill(0).map(() => `
      <div class="glass-card--flat" style="padding:14px;display:flex;gap:12px">
        <div class="skeleton" style="width:72px;height:50px;border-radius:10px;flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-line w-80" style="height:14px;margin-bottom:8px"></div>
          <div class="skeleton skeleton-line w-60" style="height:10px;margin-bottom:8px"></div>
          <div class="skeleton" style="height:6px;border-radius:99px"></div>
        </div>
      </div>`).join('')}
  </div>`;
}

function errorState(message) {
  return `
    <div class="empty-state">
      <div class="empty-state__text" style="color:#FF416C">${escapeHTML(message)}</div>
      <button class="btn btn-ghost btn--sm" onclick="location.reload()">Retry</button>
    </div>`;
}
