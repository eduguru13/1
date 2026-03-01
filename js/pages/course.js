// ============================================================
// EduGuru — Course Detail Page
// ============================================================
import { Courses, Enrollments, Reviews, Wishlist, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { formatLKR, formatDuration, formatCount, formatDate, timeAgo,
         renderStars, discountPercent, toast, escapeHTML, shareCourse,
         copyToClipboard, serialChip } from '../utils.js';

let courseData   = null;
let isEnrolled   = false;
let isWishlisted = false;

export function renderCourseDetail() {
  return `
    <div class="course-detail page" id="course-detail">
      <!-- Skeleton -->
      <div id="course-skeleton">
        <div class="skeleton" style="width:100%;aspect-ratio:16/9"></div>
        <div style="padding:20px">
          <div class="skeleton skeleton-line w-80" style="height:20px;margin-bottom:12px"></div>
          <div class="skeleton skeleton-line w-60" style="height:14px;margin-bottom:8px"></div>
          <div class="skeleton skeleton-line w-40" style="height:14px"></div>
        </div>
      </div>
      <div id="course-content" class="hidden"></div>
    </div>`;
}

export async function initCourseDetail(courseId) {
  try {
    courseData = await Courses.getById(courseId);
    if (!courseData) throw new Error('Course not found');

    // Check enrollment
    if (AuthState.isLoggedIn) {
      isEnrolled   = await Enrollments.isEnrolled(AuthState.user.id, courseId);
      isWishlisted = await Wishlist.isWishlisted(AuthState.user.id, courseId);
    }

    renderDetail();
    initDetailEvents();

    // Load reviews async
    loadReviews();

    // Load related courses
    loadRelatedCourses();

  } catch (err) {
    const el = document.getElementById('course-detail');
    if (!el) return; // page navigated away — ignore stale error
    el.innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <div class="empty-state__icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="empty-state__title">Course Not Found</div>
        <div class="empty-state__text">${escapeHTML(err.message)}</div>
        <button class="btn btn-primary btn--sm" onclick="App.navigate('browse')">Browse Courses</button>
      </div>`;
  }
}

function renderDetail() {
  const c = courseData;
  const price       = c.discount_price || c.price;
  const isDiscount  = c.discount_price && c.discount_price < c.price;
  const discPct     = isDiscount ? discountPercent(c.price, c.discount_price) : 0;
  const teacher     = c.teacher;
  const sections    = c.sections || [];
  const totalLessons= sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0);
  const freePreviewCount = sections.reduce((sum, s) =>
    sum + (s.lessons?.filter(l => l.is_preview || l.is_free_preview).length || 0), 0);

  const learnItems  = Array.isArray(c.what_you_learn) ? c.what_you_learn : [];
  const requirements= Array.isArray(c.requirements)   ? c.requirements   : [];
  const bonuses     = Array.isArray(c.bonuses)         ? c.bonuses        : [];

  document.getElementById('course-skeleton').classList.add('hidden');
  const content = document.getElementById('course-content');
  content.classList.remove('hidden');

  content.innerHTML = `
    <!-- Hero Thumbnail / Preview -->
    <div style="position:relative">
      ${c.preview_video_url
        ? `<div style="aspect-ratio:16/9;background:#000;position:relative">
             <iframe src="${escapeHTML(c.preview_video_url)}"
               style="width:100%;height:100%;border:none" allowfullscreen></iframe>
           </div>`
        : c.thumbnail_url
          ? `<img src="${escapeHTML(c.thumbnail_url)}" alt="${escapeHTML(c.title)}"
               style="width:100%;aspect-ratio:16/9;object-fit:cover">`
          : `<div style="width:100%;aspect-ratio:16/9;background:var(--gradient);display:flex;align-items:center;justify-content:center">
               <svg viewBox="0 0 24 24" width="48" height="48" stroke="white" fill="none" stroke-width="1.5">
                 <polygon points="5,3 19,12 5,21"/>
               </svg>
             </div>`
      }
      ${c.fire_priority > 0 ? `<span class="course-card__badge badge-fire" style="top:12px;left:12px;font-size:13px;padding:4px 12px">🔥 Hot Course</span>` : ''}
    </div>

    <div style="padding:20px">

      <!-- Title & Category -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        ${c.category ? `<span class="chip chip-purple">${escapeHTML(c.category.name)}</span>` : ''}
        <span class="chip">${escapeHTML(c.level)}</span>
        ${c.certificate_available ? `<span class="chip" style="background:#FFF7ED;color:#D97706">🏆 Certificate</span>` : ''}
      </div>

      <h1 style="font-family:var(--font-display);font-size:20px;font-weight:700;line-height:1.3;margin-bottom:8px">
        ${escapeHTML(c.title)}
      </h1>
      ${c.serial_id ? `<div style="margin-bottom:8px">${serialChip(c.serial_id)}</div>` : ''}

      ${c.short_tagline ? `<p style="color:var(--gray-500);font-size:14px;margin-bottom:12px">${escapeHTML(c.short_tagline)}</p>` : ''}

      <!-- Stats row -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:4px" id="course-rating-row">
          <span id="course-rating-stars">${renderStars(c.rating_average)}</span>
          <span id="course-rating-avg" style="font-weight:700;font-size:14px;margin-left:4px">${Number(c.rating_average || 0).toFixed(1)}</span>
          <span id="course-rating-cnt" style="color:var(--gray-400);font-size:13px">(${formatCount(c.rating_count)})</span>
        </div>
        <span style="color:var(--gray-400);font-size:13px">
          <strong style="color:var(--black)">${formatCount(c.total_enrollments)}</strong> students
        </span>
        <span style="color:var(--gray-400);font-size:13px">
          ${escapeHTML(c.language)} • ${escapeHTML(c.level)}
        </span>
      </div>

      <!-- Pricing Card -->
      <div class="glass-card" style="padding:20px;margin-bottom:24px">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:16px">
          <span style="font-family:var(--font-display);font-size:26px;font-weight:800">${formatLKR(price)}</span>
          ${isDiscount ? `
            <span style="color:var(--gray-400);text-decoration:line-through;font-size:16px">${formatLKR(c.price)}</span>
            <span class="chip" style="background:#FFF0E0;color:#D97706;font-size:12px">-${discPct}% OFF</span>` : ''}
        </div>

        ${isEnrolled
          ? `<button class="btn btn-success btn--full btn--lg" onclick="App.navigate('courses')">
               <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
               Go to Course
             </button>`
          : `<button class="btn btn-primary btn--full btn--lg" id="btn-enroll-main" onclick="handleEnroll()">
               <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
                 <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
               </svg>
               Join Now — ${formatLKR(price)}
             </button>`
        }

        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost flex-1" id="btn-wishlist" onclick="toggleWishlist()">
            <svg viewBox="0 0 24 24" width="16" height="16"
              stroke="${isWishlisted ? '#FF416C' : 'currentColor'}"
              fill="${isWishlisted ? '#FF416C' : 'none'}" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            Wishlist
          </button>
          <button class="btn btn-ghost flex-1" onclick="handleShare()">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>

        <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;color:var(--gray-400);font-size:12px">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Secure bank transfer • Approved by admin
        </div>
      </div>

      <!-- Teacher Card -->
      ${teacher ? `
        <div class="glass-card--flat" style="padding:16px;margin-bottom:24px;cursor:pointer"
          onclick="App.navigate('profile', {id:'${escapeHTML(teacher.id)}'})">
          <div style="display:flex;gap:14px;align-items:center">
            ${teacher.profile_picture
              ? `<img src="${escapeHTML(teacher.profile_picture)}" class="avatar avatar-lg" alt="${escapeHTML(teacher.full_name)}">`
              : `<div class="avatar avatar-lg">${getInitials(teacher.full_name)}</div>`
            }
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--font-display);font-weight:700;font-size:15px">${escapeHTML(teacher.full_name)}</div>
              ${teacher.serial_id ? `<div style="margin-top:3px">${serialChip(teacher.serial_id)}</div>` : ''}
              ${teacher.expertise ? `<div style="color:var(--gray-500);font-size:13px">${escapeHTML(teacher.expertise)}</div>` : ''}
              ${teacher.experience_years ? `<div style="color:var(--gray-400);font-size:12px;margin-top:2px">${teacher.experience_years} years experience</div>` : ''}
            </div>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="var(--gray-300)" fill="none" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
          ${teacher.bio ? `<p style="margin-top:12px;font-size:13px;color:var(--gray-500);line-height:1.6;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHTML(teacher.bio)}</p>` : ''}
        </div>` : ''}

      <!-- What You'll Learn -->
      ${learnItems.length > 0 ? `
        <div style="margin-bottom:24px">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:12px">What You'll Learn</h2>
          <div style="background:var(--gradient-soft);border:1px solid rgba(106,17,203,0.1);border-radius:16px;padding:16px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              ${learnItems.map(item => `
                <div style="display:flex;gap:8px;align-items:flex-start;font-size:13px">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--purple-start)" fill="none" stroke-width="2.5" style="flex-shrink:0;margin-top:1px">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>${escapeHTML(item)}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>` : ''}

      <!-- Course Stats -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px">
        ${statCard('📚', totalLessons, 'Lessons')}
        ${statCard('⏱️', `${c.total_hours}h`, 'Total Hours')}
        ${statCard('👥', formatCount(c.total_enrollments), 'Students')}
        ${statCard('🌐', c.language, 'Language')}
        ${statCard('📊', c.level, 'Level')}
        ${statCard('🏆', c.certificate_available ? 'Yes' : 'No', 'Certificate')}
      </div>

      <!-- Curriculum -->
      ${sections.length > 0 ? `
        <div style="margin-bottom:24px">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:4px">Course Curriculum</h2>
          <p style="color:var(--gray-400);font-size:13px;margin-bottom:12px">
            ${sections.length} sections • ${totalLessons} lessons
            ${freePreviewCount > 0 ? `• ${freePreviewCount} free previews` : ''}
          </p>
          <div id="curriculum-accordion">
            ${sections.map((section, si) => renderSection(section, si)).join('')}
          </div>
        </div>` : ''}

      <!-- Requirements -->
      ${requirements.length > 0 ? `
        <div style="margin-bottom:24px">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:12px">Requirements</h2>
          <ul style="padding:0;display:flex;flex-direction:column;gap:8px">
            ${requirements.map(r => `
              <li style="display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--gray-600)">
                <span style="color:var(--purple-start);margin-top:1px">•</span>
                ${escapeHTML(r)}
              </li>`).join('')}
          </ul>
        </div>` : ''}

      <!-- Bonuses -->
      ${bonuses.length > 0 ? `
        <div style="margin-bottom:24px">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:12px">Bonuses</h2>
          <div style="background:linear-gradient(135deg,rgba(17,203,106,0.08),rgba(10,158,82,0.08));border:1px solid rgba(17,203,106,0.2);border-radius:16px;padding:16px">
            ${bonuses.map(b => `
              <div style="display:flex;gap:8px;align-items:flex-start;font-size:14px;margin-bottom:6px">
                <span>🎁</span><span>${escapeHTML(b)}</span>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Reviews -->
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px">Reviews</h2>
          ${isEnrolled && !AuthState.isTeacher ? `
            <button class="btn btn-outline btn--sm" onclick="openReviewModal()">
              Write Review
            </button>` : ''}
        </div>

        <!-- Rating overview -->
        <div class="glass-card--flat" style="padding:16px;margin-bottom:16px;display:flex;gap:16px;align-items:center">
          <div style="text-align:center">
            <div id="course-big-avg" style="font-size:40px;font-weight:800;font-family:var(--font-display)">${Number(c.rating_average || 0).toFixed(1)}</div>
            <div id="course-big-stars" style="display:flex;justify-content:center">${renderStars(c.rating_average, 16)}</div>
            <div id="course-big-cnt" style="color:var(--gray-400);font-size:12px;margin-top:4px">${formatCount(c.rating_count)} reviews</div>
          </div>
          <div style="flex:1" id="rating-bars">
            ${[5,4,3,2,1].map(star => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:12px;width:8px">${star}</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="#F59E0B"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
                <div class="progress-bar" style="flex:1">
                  <div class="progress-fill" style="width:0%;transition:width 0.8s ease" data-star="${star}"></div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div id="reviews-list">
          <div style="text-align:center;padding:20px">
            <svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="var(--purple-start)" fill="none" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Related Courses -->
      <div style="margin-bottom:24px">
        <h2 style="font-family:var(--font-display);font-weight:700;font-size:17px;margin-bottom:12px;padding:0">Related Courses</h2>
        <div class="scroll-row" id="related-courses">
          ${Array(3).fill(0).map(() => `<div class="skeleton-card" style="min-width:180px"><div class="skeleton skeleton-thumb" style="height:120px"></div><div class="skeleton-body"><div class="skeleton skeleton-line w-80" style="height:10px"></div></div></div>`).join('')}
        </div>
      </div>

    </div>

    <!-- Review Modal -->
    <div class="modal-overlay" id="review-modal">
      <div class="modal-sheet">
        <div class="modal-sheet__handle"></div>
        <h3 class="modal-title">Write a Review</h3>
        <div style="display:flex;justify-content:center;gap:8px;margin-bottom:20px" id="star-selector">
          ${[1,2,3,4,5].map(i => `
            <svg class="star-select" data-rating="${i}" viewBox="0 0 24 24" width="36" height="36" style="cursor:pointer;transition:var(--transition)">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                fill="var(--gray-200)" stroke="#F59E0B" stroke-width="1"/>
            </svg>`).join('')}
        </div>
        <div class="form-group">
          <label class="form-label">Your Review</label>
          <textarea class="form-textarea" id="review-text" placeholder="Share your experience with this course..." rows="4"></textarea>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost flex-1" onclick="closeReviewModal()">Cancel</button>
          <button class="btn btn-primary flex-1" onclick="submitReview()">Submit Review</button>
        </div>
      </div>
    </div>
  `;
}

function statCard(icon, value, label) {
  return `
    <div class="glass-card--flat" style="padding:12px;text-align:center">
      <div style="font-size:20px;margin-bottom:4px">${icon}</div>
      <div style="font-weight:700;font-size:14px">${escapeHTML(String(value))}</div>
      <div style="color:var(--gray-400);font-size:11px">${label}</div>
    </div>`;
}

function renderSection(section, index) {
  const lessons = section.lessons || [];
  const totalDuration = lessons.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const lessonTypes = [...new Set(lessons.map(l => l.lesson_type).filter(Boolean))];
  const typeSummary = lessonTypes.length ? ' • ' + lessonTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : '';

  return `
    <div class="accordion-item ${index === 0 ? 'open' : ''}" id="section-${section.id}">
      <div class="accordion-header" onclick="toggleSection('${section.id}')">
        <div>
          <div class="accordion-title">${escapeHTML(section.title)}</div>
          <div style="font-size:12px;color:var(--gray-400);margin-top:2px">
            ${lessons.length} lesson${lessons.length !== 1 ? 's' : ''}${totalDuration > 0 ? ' • ' + formatDuration(totalDuration) : typeSummary}
          </div>
        </div>
        <svg class="accordion-icon" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="accordion-body ${index === 0 ? 'open' : ''}">
        <div class="accordion-content">
          ${lessons.map(lesson => renderLesson(lesson)).join('')}
        </div>
      </div>
    </div>`;
}

function renderLesson(lesson) {
  const isFree  = lesson.is_preview || lesson.is_free_preview;
  const canView = isEnrolled || isFree;
  const typeIcon = { video:'▶', live:'📡', resource:'📄', exam:'📝' }[lesson.lesson_type] || '▶';
  return `
    <div class="lesson-item" style="${canView ? 'cursor:default' : ''}">
      <div class="lesson-icon ${!canView ? 'locked' : ''}">
        <svg viewBox="0 0 24 24">
          ${!canView
            ? `<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`
            : `<polygon points="5,3 19,12 5,21"/>`
          }
        </svg>
      </div>
      <div class="lesson-info">
        <div class="lesson-title">${escapeHTML(lesson.title)}</div>
        <div class="lesson-meta">${lesson.lesson_type ? lesson.lesson_type.charAt(0).toUpperCase() + lesson.lesson_type.slice(1) : 'Lesson'}</div>
      </div>
      ${isFree ? `<span class="lesson-free-tag">Preview</span>` : ''}
    </div>`;
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── EVENT HANDLERS ────────────────────────────────────────────
function initDetailEvents() {
  // Accordion toggles
  window.toggleSection = function(id) {
    const item = document.getElementById(`section-${id}`);
    if (!item) return;
    const body = item.querySelector('.accordion-body');
    item.classList.toggle('open');
    body.classList.toggle('open');
  };
}

// ── REVIEWS ───────────────────────────────────────────────────
async function loadReviews() {
  try {
    const reviews = await Reviews.getByCourse(courseData.id);
    renderReviewsList(reviews);
    renderRatingBars(reviews);
  } catch { /* silent */ }
}

async function refreshRatingUI() {
  try {
    const { data } = await db
      .from('courses')
      .select('rating_average, rating_count')
      .eq('id', courseData.id)
      .single();
    if (!data) return;

    courseData.rating_average = data.rating_average;
    courseData.rating_count   = data.rating_count;

    const avg = Number(data.rating_average || 0).toFixed(1);
    const cnt = formatCount(data.rating_count);

    // Update header stats row
    const starsEl = document.getElementById('course-rating-stars');
    const avgEl   = document.getElementById('course-rating-avg');
    const cntEl   = document.getElementById('course-rating-cnt');
    if (starsEl) starsEl.innerHTML = renderStars(data.rating_average);
    if (avgEl)   avgEl.textContent  = avg;
    if (cntEl)   cntEl.textContent  = `(${cnt})`;

    // Update big rating overview
    const bigAvg   = document.getElementById('course-big-avg');
    const bigStars = document.getElementById('course-big-stars');
    const bigCnt   = document.getElementById('course-big-cnt');
    if (bigAvg)   bigAvg.textContent  = avg;
    if (bigStars) bigStars.innerHTML  = renderStars(data.rating_average, 16);
    if (bigCnt)   bigCnt.textContent  = `${cnt} reviews`;
  } catch { /* silent */ }
}

function renderRatingBars(reviews) {
  const total = reviews.length || 1;
  const counts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
  reviews.forEach(r => counts[r.rating]++);

  document.querySelectorAll('[data-star]').forEach(bar => {
    const star = parseInt(bar.dataset.star);
    const pct  = Math.round((counts[star] / total) * 100);
    bar.style.width = pct + '%';
  });
}

function renderReviewsList(reviews) {
  const container = document.getElementById('reviews-list');
  if (!container) return;

  if (!reviews || !reviews.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px">
        <div class="empty-state__icon"><svg viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></div>
        <p class="text-gray text-sm">No reviews yet. Be the first!</p>
      </div>`;
    return;
  }

  container.innerHTML = reviews.map(r => {
    const user = r.user;
    return `
      <div class="glass-card--flat" style="padding:14px;margin-bottom:10px">
        <div style="display:flex;gap:10px;align-items:flex-start">
          ${user?.profile_picture
            ? `<img src="${escapeHTML(user.profile_picture)}" class="avatar avatar-sm">`
            : `<div class="avatar avatar-sm">${getInitials(user?.full_name)}</div>`
          }
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:600;font-size:14px">${escapeHTML(user?.full_name || 'Student')}</span>
              <span style="color:var(--gray-400);font-size:11px">${timeAgo(r.created_at)}</span>
            </div>
            <div style="display:flex;gap:2px;margin:4px 0">${renderStars(r.rating, 13)}</div>
            ${r.review_text ? `<p style="font-size:13px;color:var(--gray-600);line-height:1.5">${escapeHTML(r.review_text)}</p>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── RELATED COURSES ───────────────────────────────────────────
async function loadRelatedCourses() {
  try {
    const related = await Courses.list({
      categoryId: courseData.category_id,
      limit: 6,
    });
    const filtered = related.filter(c => c.id !== courseData.id).slice(0, 5);
    const container = document.getElementById('related-courses');
    if (!container) return;

    if (!filtered.length) {
      container.innerHTML = `<p class="text-gray text-sm" style="padding:8px">No related courses yet</p>`;
      return;
    }

    const { courseCardHTML: ccHTML } = await import('../utils.js');
    container.innerHTML = filtered.map(c => ccHTML(c, false)).join('');
  } catch { /* silent */ }
}

// ── ENROLL HANDLER ────────────────────────────────────────────
window.handleEnroll = function() {
  if (!AuthState.isLoggedIn) {
    toast('Please sign in to enroll', 'info');
    App.navigate('auth');
    return;
  }
  App.navigate('payment', { courseId: courseData.id });
};

// ── WISHLIST ──────────────────────────────────────────────────
window.toggleWishlist = async function() {
  if (!AuthState.isLoggedIn) {
    toast('Sign in to wishlist courses', 'info');
    App.navigate('auth');
    return;
  }

  const { Wishlist } = await import('../supabase.js');
  const added = await Wishlist.toggle(AuthState.user.id, courseData.id);
  isWishlisted = added;

  const btn = document.getElementById('btn-wishlist');
  if (btn) {
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('stroke', added ? '#FF416C' : 'currentColor');
      svg.setAttribute('fill',   added ? '#FF416C' : 'none');
    }
  }
  toast(added ? 'Added to wishlist' : 'Removed from wishlist', 'success', 2000);
};

// ── SHARE ─────────────────────────────────────────────────────
window.handleShare = async function() {
  await shareCourse(courseData);
};

// ── LESSON OPEN ───────────────────────────────────────────────
window.openLesson = async function(lessonId) {
  if (!isEnrolled) {
    toast('Enroll to access lessons', 'info');
    return;
  }
  const lesson = await Courses.getLesson(lessonId);
  if (lesson?.drive_link) {
    window.open(lesson.drive_link, '_blank', 'noopener');
  }
};

// ── REVIEW MODAL ──────────────────────────────────────────────
let selectedRating = 0;

window.openReviewModal = async function() {
  if (!isEnrolled) {
    toast('You must be enrolled to review', 'info');
    return;
  }

  // Reset state
  selectedRating = 0;
  const textEl = document.getElementById('review-text');
  if (textEl) textEl.value = '';
  updateStarUI(0);

  // Pre-fill if existing review
  try {
    const existing = await Reviews.getUserReview(courseData.id, AuthState.user.id);
    if (existing) {
      selectedRating = existing.rating;
      if (textEl) textEl.value = existing.review_text || '';
      updateStarUI(existing.rating);
    }
  } catch { /* no existing review — start fresh */ }

  document.getElementById('review-modal')?.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Star click handlers
  document.querySelectorAll('.star-select').forEach(star => {
    star.onclick = () => {
      selectedRating = parseInt(star.dataset.rating);
      updateStarUI(selectedRating);
    };
  });
};

window.closeReviewModal = function() {
  document.getElementById('review-modal')?.classList.remove('show');
  document.body.style.overflow = '';
};

window.submitReview = async function() {
  if (!selectedRating) {
    toast('Please select a star rating', 'error');
    return;
  }
  const reviewText = document.getElementById('review-text')?.value?.trim() || '';

  const btn = document.querySelector('#review-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    await Reviews.upsert({
      courseId:   courseData.id,
      userId:     AuthState.user.id,
      rating:     selectedRating,
      reviewText,
    });
    toast('Review submitted! Thank you 🎉', 'success');
    window.closeReviewModal();
    await loadReviews();
    await refreshRatingUI(); // update stars + count in header
  } catch (err) {
    toast(err.message || 'Failed to submit review', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Review'; }
  }
};

function updateStarUI(rating) {
  document.querySelectorAll('.star-select').forEach(star => {
    const r = parseInt(star.dataset.rating);
    const poly = star.querySelector('polygon');
    if (poly) poly.setAttribute('fill', r <= rating ? '#F59E0B' : 'var(--gray-200)');
  });
}
