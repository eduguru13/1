// ============================================================
// EduGuru — Course Create / Edit Page (Phase 3 Redesign)
// Multi-step: Basics → Details → Curriculum → Pricing
// ============================================================
import { Courses, Categories, Curriculum, db } from '../supabase.js';
import { AuthState } from '../auth.js';
import { toast, escapeHTML, sanitizeInput, Validate } from '../utils.js';

let courseId      = null;
let courseData    = null;
let modules       = [];   // local curriculum state
let categories    = [];
let thumbFileRef  = null; // keeps file reference even after preview replaces input

// ── IMAGE COMPRESSION ─────────────────────────────────────────
// Draws image onto a canvas at target max width, exports as JPEG at 0.82 quality
function compressImage(file, maxWidthKB = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      // Target: keep 3:2 crop, scale down so width ≤ 1200px
      const MAX_W = 1200;
      let w = img.width, h = img.height;
      if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Compression failed')); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ── RENDER ────────────────────────────────────────────────────
export function renderCourseCreate() {
  return `
    <div class="course-create page" id="course-create">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--gray-100)">
        <button class="icon-btn" onclick="App.navigate('courses')">
          <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <h1 style="font-family:var(--font-display);font-weight:700;font-size:17px" id="create-title">Create Course</h1>
        <div style="flex:1"></div>
        <button class="btn btn-ghost btn--sm" id="btn-save-draft" onclick="saveCourse('draft')">Save Draft</button>
      </div>

      <!-- Step Tabs -->
      <div class="tabs-wrap" style="margin:12px 0">
        <div class="tabs">
          <button class="tab-btn active" data-step="basics">Basics</button>
          <button class="tab-btn" data-step="details">Details</button>
          <button class="tab-btn" data-step="curriculum">Curriculum</button>
          <button class="tab-btn" data-step="pricing">Pricing</button>
        </div>
      </div>

      <!-- Step Content -->
      <div style="padding:0 16px 120px">

        <!-- ── STEP: BASICS ── -->
        <div id="step-basics">
          <div class="form-group">
            <label class="form-label">Course Title <span class="required">*</span></label>
            <input type="text" class="form-input" id="c-title" maxlength="120"
              placeholder="e.g., Complete A/L Mathematics Course 2025">
            <span class="form-hint">Max 120 characters. Make it descriptive and searchable.</span>
          </div>

          <div class="form-group">
            <label class="form-label">Short Tagline</label>
            <input type="text" class="form-input" id="c-tagline" maxlength="180"
              placeholder="One-line summary of your course">
          </div>

          <div class="form-group">
            <label class="form-label">Category <span class="required">*</span></label>
            <select class="form-select" id="c-category">
              <option value="">Select category...</option>
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Level <span class="required">*</span></label>
              <select class="form-select" id="c-level">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Language</label>
              <select class="form-select" id="c-language">
                <option value="Sinhala">Sinhala</option>
                <option value="Tamil">Tamil</option>
                <option value="English" selected>English</option>
                <option value="Sinhala & English">Sinhala & English</option>
                <option value="Tamil & English">Tamil & English</option>
              </select>
            </div>
          </div>

          <!-- Total hours + Duration (in Basics for upfront planning) -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label class="form-label">Total Hours <span class="required">*</span></label>
              <div class="input-wrap">
                <svg class="input-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
                <input type="number" class="form-input" id="c-hours" min="0.5" step="0.5" placeholder="e.g., 12">
              </div>
              <span class="form-hint">Total teaching hours</span>
            </div>
            <div class="form-group">
              <label class="form-label">Course Duration <span class="required">*</span></label>
              <div style="display:flex;gap:6px">
                <input type="number" class="form-input" id="c-duration-val" min="1" step="1"
                  placeholder="e.g., 3" style="flex:1;min-width:0">
                <select class="form-select" id="c-duration-unit" style="width:90px;flex-shrink:0">
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months" selected>Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <span class="form-hint">How long the course runs</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Course Thumbnail <span class="required">*</span></label>
            <div id="thumb-upload-area" onclick="document.getElementById('c-thumb').click()" style="cursor:pointer;border:2px dashed var(--gray-200);border-radius:16px;overflow:hidden;transition:border-color 0.2s" onmouseenter="this.style.borderColor='var(--purple-start)'" onmouseleave="this.style.borderColor='var(--gray-200)'">
              <div id="thumb-placeholder" style="padding:32px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;background:var(--gradient-soft)">
                <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#6A11CB22,#2575FC22);display:flex;align-items:center;justify-content:center">
                  <svg viewBox="0 0 24 24" width="28" height="28" stroke="var(--purple-start)" fill="none" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style="text-align:center">
                  <div style="font-weight:600;font-size:14px;color:var(--black);margin-bottom:4px">Click to upload thumbnail</div>
                  <div style="font-size:12px;color:var(--gray-400)">JPG, PNG or WebP · <strong style="color:var(--purple-start)">3:2 ratio recommended</strong> · 500–800KB · Auto-compressed if over 1MB</div>
                </div>
                <div style="background:white;border:1.5px solid var(--gray-200);border-radius:20px;padding:6px 20px;font-size:13px;font-weight:600;color:var(--purple-start)">Browse file</div>
              </div>
              <img id="thumb-preview" src="" alt="Thumbnail preview"
                style="display:none;width:100%;aspect-ratio:3/2;object-fit:cover">
              <input type="file" id="c-thumb" accept="image/*" class="hidden">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Preview Video URL (optional)</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
              <input type="url" class="form-input" id="c-preview" placeholder="Google Drive / YouTube embed URL">
            </div>
            <span class="form-hint">Embed URL only (e.g., Google Drive share link)</span>
          </div>
        </div>

        <!-- ── STEP: DETAILS ── -->
        <div id="step-details" class="hidden">
          <div class="form-group">
            <label class="form-label">Full Description <span class="required">*</span></label>
            <textarea class="form-textarea" id="c-description" rows="5"
              placeholder="Describe your course thoroughly. Include what students will learn, topics covered, and who it's for."></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">What Students Will Learn</label>
            <div id="learn-items"></div>
            <button type="button" class="btn btn-ghost btn--sm btn--full" style="margin-top:8px" onclick="addLearnItem()">
              + Add Learning Outcome
            </button>
          </div>

          <div class="form-group" style="margin-top:20px">
            <label class="form-label">Requirements</label>
            <div id="requirement-items"></div>
            <button type="button" class="btn btn-ghost btn--sm btn--full" style="margin-top:8px" onclick="addRequirement()">
              + Add Requirement
            </button>
          </div>

          <div class="form-group" style="margin-top:20px">
            <label class="form-label">Bonuses (optional)</label>
            <div id="bonus-items"></div>
            <button type="button" class="btn btn-ghost btn--sm btn--full" style="margin-top:8px" onclick="addBonus()">
              + Add Bonus
            </button>
          </div>

          <label class="tc-wrap" style="margin-bottom:16px">
            <input type="checkbox" id="c-certificate">
            <span>Certificate available on completion</span>
          </label>
        </div>

        <!-- ── STEP: CURRICULUM ── -->
        <div id="step-curriculum" class="hidden">
          <div style="margin-bottom:16px;padding:14px;background:var(--gradient-soft);border-radius:14px">
            <p style="font-size:13px;color:var(--gray-600);line-height:1.6;margin:0">
              📚 <strong>Build your curriculum.</strong> Add modules (chapters) and lessons inside each module.
              Lesson URLs are set later per batch — focus on structure here.
            </p>
          </div>

          <div id="modules-container"></div>

          <button class="btn btn-outline btn--full" onclick="addModule()" style="margin-top:8px">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Module
          </button>
        </div>

        <!-- ── STEP: PRICING ── -->
        <div id="step-pricing" class="hidden">
          <div class="form-group">
            <label class="form-label">Course Price (LKR) <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input type="number" class="form-input" id="c-price" min="0" step="50" placeholder="e.g., 2500"
                oninput="updateRevenuePreview()">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Discounted Price (optional)</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input type="number" class="form-input" id="c-discount" min="0" step="50"
                placeholder="Leave empty for no discount" oninput="updateRevenuePreview()">
            </div>
            <span class="form-hint">Must be less than the original price</span>
          </div>

          <!-- Revenue split -->
          <div class="glass-card" style="padding:16px;margin-top:8px">
            <h3 style="font-weight:700;font-size:14px;margin-bottom:12px">💰 Revenue Breakdown</h3>
            <div id="revenue-preview">
              <div style="color:var(--gray-400);font-size:13px">Enter a price to see the breakdown</div>
            </div>
          </div>

          <!-- Platform value prop -->
          <div style="margin-top:16px;padding:16px;border-radius:16px;border:1.5px solid var(--purple-start)20;background:var(--gradient-soft)">
            <p style="font-size:13px;color:var(--gray-600);line-height:1.7;margin:0">
              🚀 <strong>EduGuru grows when you grow.</strong> Our platform handles payments, student management,
              and support — so you focus only on teaching. The more students join your course, the more you earn.
              We guide your course to success together.
            </p>
          </div>

          <!-- Submit -->
          <div class="glass-card" style="padding:16px;margin-top:20px">
            <h3 style="font-weight:700;font-size:14px;margin-bottom:8px">Ready to Publish?</h3>
            <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px;line-height:1.5">
              Once submitted, our admin team will review your course within 24 hours.
              After approval, a batch will be automatically created for you.
            </p>
            <button class="btn btn-primary btn--full btn--lg" id="btn-submit" onclick="saveCourse('pending')">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="white" fill="none" stroke-width="2">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
              Submit for Review
            </button>
          </div>
        </div>

      </div>

      <!-- Fixed Bottom Nav -->
      <div style="position:fixed;bottom:var(--bottomnav-h);left:50%;transform:translateX(-50%);width:100%;max-width:var(--max-w);background:var(--glass-bg);backdrop-filter:var(--blur);border-top:1px solid var(--glass-border);padding:12px 16px;display:flex;gap:8px;z-index:var(--z-sticky)">
        <button class="btn btn-ghost flex-1" id="btn-prev-step" onclick="prevStep()" style="display:none">← Back</button>
        <button class="btn btn-primary flex-1" id="btn-next-step" onclick="nextStep()">Next →</button>
      </div>
    </div>`;
}

// ── INIT ──────────────────────────────────────────────────────
export async function initCourseCreate(editId = null) {
  courseId     = editId;
  modules      = [];
  currentStep  = 0;
  thumbFileRef = null;

  // Load categories
  try {
    categories = await Categories.getAll();
  } catch (err) {
    categories = [];
  }
  const catSelect = document.getElementById('c-category');
  if (catSelect) {
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  }

  // Editing existing course
  if (courseId) {
    document.getElementById('create-title').textContent = 'Edit Course';
    try {
      courseData = await Courses.getById(courseId);
      populateForm(courseData);
      // Load curriculum from DB
      const { data: curric } = await Curriculum.getCurriculum(courseId);
      if (curric) {
        modules = curric.map(m => ({
          id:      m.id,
          title:   m.title,
          lessons: (m.course_lessons || []).map(l => ({
            id:            l.id,
            title:         l.title,
            lesson_type:   l.lesson_type,
            is_preview:    l.is_preview,
            is_mandatory_qa: l.is_mandatory_qa,
          })),
        }));
      }
    } catch (err) {
      toast(err.message || 'Failed to load course', 'error');
    }
  } else {
    addLearnItem('');
    addLearnItem('');
    addRequirement('');
  }

  renderModules();

  // Step tab switching
  document.querySelectorAll('[data-step]').forEach(btn => {
    btn.addEventListener('click', () => goToStep(btn.dataset.step));
  });

  // Thumbnail upload preview — auto-compress if > 1MB
  document.getElementById('c-thumb')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;

    const preview     = document.getElementById('thumb-preview');
    const placeholder = document.getElementById('thumb-placeholder');

    // Show preview immediately using original file
    if (preview)     { preview.src = URL.createObjectURL(file); preview.style.display = 'block'; }
    if (placeholder) { placeholder.style.display = 'none'; }

    // Auto-compress if > 1MB
    const ONE_MB = 1 * 1024 * 1024;
    if (file.size > ONE_MB) {
      toast('Image is large — compressing…', 'info', 2000);
      try {
        const compressed = await compressImage(file, 800);
        thumbFileRef = compressed;
        const sizeKB = Math.round(compressed.size / 1024);
        toast(`Compressed to ${sizeKB}KB`, 'success', 2500);
      } catch {
        thumbFileRef = file; // fallback to original
      }
    } else {
      thumbFileRef = file;
    }
  });
}

// ── STEP NAVIGATION ───────────────────────────────────────────
const STEPS = ['basics', 'details', 'curriculum', 'pricing'];
let currentStep = 0;

function goToStep(stepName) {
  const idx = STEPS.indexOf(stepName);
  if (idx === -1) return;

  STEPS.forEach(s => document.getElementById(`step-${s}`)?.classList.add('hidden'));
  document.getElementById(`step-${stepName}`)?.classList.remove('hidden');
  document.querySelectorAll('[data-step]').forEach((b, i) => b.classList.toggle('active', i === idx));

  currentStep = idx;
  const prevBtn = document.getElementById('btn-prev-step');
  const nextBtn = document.getElementById('btn-next-step');
  if (prevBtn) prevBtn.style.display = idx === 0 ? 'none' : '';
  if (nextBtn) nextBtn.textContent   = idx === STEPS.length - 1 ? 'Save Draft' : 'Next →';
}

window.nextStep = function() {
  if (currentStep < STEPS.length - 1) goToStep(STEPS[currentStep + 1]);
  else saveCourse('draft');
};
window.prevStep = function() {
  if (currentStep > 0) goToStep(STEPS[currentStep - 1]);
};

// ── FORM POPULATION ───────────────────────────────────────────
function populateForm(c) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('c-title',    c.title);
  set('c-tagline',  c.short_tagline);
  set('c-category', c.category_id);
  set('c-level',    c.level);
  set('c-language', c.language);
  set('c-preview',  c.preview_video_url);
  set('c-description', c.description);
  set('c-hours',        c.total_hours);
  set('c-duration-val', c.duration_value || c.duration_weeks || '');
  if (c.duration_unit) {
    const unitEl = document.getElementById('c-duration-unit');
    if (unitEl) unitEl.value = c.duration_unit;
  }
  set('c-price',    c.price);
  set('c-discount', c.discount_price || '');
  if (document.getElementById('c-certificate')) {
    document.getElementById('c-certificate').checked = c.certificate_available;
  }
  if (c.thumbnail_url) {
    const preview     = document.getElementById('thumb-preview');
    const placeholder = document.getElementById('thumb-placeholder');
    if (preview)     { preview.src = escapeHTML(c.thumbnail_url); preview.style.display = 'block'; }
    if (placeholder) { placeholder.style.display = 'none'; }
  }
  (c.what_you_learn || []).forEach(item => addLearnItem(item));
  (c.requirements   || []).forEach(item => addRequirement(item));
  (c.bonuses        || []).forEach(item => addBonus(item));
  updateRevenuePreview();
}

// ── DYNAMIC LIST ITEMS ────────────────────────────────────────
function addDynamicItem(containerId, placeholder) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  div.innerHTML = `
    <input type="text" class="form-input" style="flex:1" placeholder="${escapeHTML(placeholder)}">
    <button type="button" class="icon-btn" onclick="this.parentElement.remove()" style="flex-shrink:0">
      <svg viewBox="0 0 24 24" stroke="#FF416C" fill="none" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;
  container.appendChild(div);
  return div.querySelector('input');
}

window.addLearnItem  = function(value = '') { const i = addDynamicItem('learn-items',       'e.g., Master calculus concepts');     if (i && value) i.value = value; };
window.addRequirement= function(value = '') { const i = addDynamicItem('requirement-items', 'e.g., Basic mathematics knowledge'); if (i && value) i.value = value; };
window.addBonus      = function(value = '') { const i = addDynamicItem('bonus-items',       'e.g., Free practice papers');        if (i && value) i.value = value; };

// ── CURRICULUM — MODULES + LESSONS ───────────────────────────
const LESSON_TYPES = [
  { value: 'video',    label: '🎬 Video',    color: '#6A11CB' },
  { value: 'live',     label: '📡 Live',     color: '#2575FC' },
  { value: 'resource', label: '📄 Resource', color: '#11CB6A' },
  { value: 'exam',     label: '📝 Exam',     color: '#FF9500' },
];

function lessonTypeIcon(type) {
  return { video: '🎬', live: '📡', resource: '📄', exam: '📝' }[type] || '🎬';
}

function renderModules() {
  const container = document.getElementById('modules-container');
  if (!container) return;

  if (!modules.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:var(--gray-400)">
        <div style="font-size:36px;margin-bottom:8px">📚</div>
        <div style="font-size:14px">No modules yet. Add your first module!</div>
      </div>`;
    return;
  }

  container.innerHTML = modules.map((m, mi) => `
    <div class="glass-card--flat" style="margin-bottom:12px;overflow:hidden" id="module-el-${mi}">
      <!-- Module Header -->
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;background:var(--gradient-soft)">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--purple-start)" fill="none" stroke-width="2" style="flex-shrink:0">
          <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
        <input type="text" value="${escapeHTML(m.title)}" class="form-input"
          style="height:36px;flex:1;font-weight:600;font-size:14px"
          placeholder="Module title"
          oninput="updateModuleTitle(${mi},this.value)">
        <button class="icon-btn" style="width:30px;height:30px;flex-shrink:0" onclick="removeModule(${mi})">
          <svg viewBox="0 0 24 24" stroke="#FF416C" fill="none" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      <!-- Lessons -->
      <div style="padding:4px 14px 4px" id="lessons-${mi}">
        ${(m.lessons || []).map((l, li) => lessonRowHTML(mi, li, l)).join('')}
        ${!(m.lessons || []).length ? `<div style="text-align:center;padding:12px;font-size:12px;color:var(--gray-300)">No lessons yet</div>` : ''}
      </div>

      <div style="padding:8px 14px 12px">
        <button class="btn btn-ghost btn--sm btn--full" onclick="addLesson(${mi})">
          + Add Lesson
        </button>
      </div>
    </div>`).join('');
}

function lessonRowHTML(mi, li, lesson) {
  const type = lesson.lesson_type || 'video';
  const icon = lessonTypeIcon(type);
  return `
    <div style="display:flex;gap:8px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--gray-100)" id="lesson-${mi}-${li}">
      <span style="margin-top:10px;font-size:14px;flex-shrink:0">${icon}</span>
      <div style="flex:1;min-width:0">
        <input type="text" value="${escapeHTML(lesson.title || '')}" placeholder="Lesson title"
          style="width:100%;border:none;background:none;font-size:13px;font-weight:500;outline:none;color:var(--black);padding:4px 0"
          oninput="updateLessonTitle(${mi},${li},this.value)">
        <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap">
          <select style="border:1.5px solid var(--gray-200);border-radius:8px;padding:3px 6px;font-size:11px;background:white"
            onchange="updateLessonType(${mi},${li},this.value)">
            ${LESSON_TYPES.map(t => `<option value="${t.value}" ${type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--gray-500);cursor:pointer">
            <input type="checkbox" ${lesson.is_preview ? 'checked' : ''}
              onchange="updateLessonPreview(${mi},${li},this.checked)"
              style="accent-color:var(--purple-start)">
            Free preview
          </label>
          ${type === 'live' ? `
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#FF9500;cursor:pointer">
            <input type="checkbox" ${lesson.is_mandatory_qa ? 'checked' : ''}
              onchange="updateLessonMandatoryQA(${mi},${li},this.checked)"
              style="accent-color:#FF9500">
            Mandatory Q&A
          </label>` : ''}
        </div>
      </div>
      <button onclick="removeLesson(${mi},${li})" style="background:none;border:none;cursor:pointer;flex-shrink:0;margin-top:6px">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="#FF416C" fill="none" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>`;
}

window.addModule = function() {
  modules.push({ title: `Module ${modules.length + 1}`, lessons: [] });
  renderModules();
};

window.removeModule = function(mi) {
  if (!confirm(`Remove module "${modules[mi]?.title}"? This will also remove its lessons.`)) return;
  modules.splice(mi, 1);
  renderModules();
};

window.addLesson = function(mi) {
  modules[mi].lessons = modules[mi].lessons || [];
  modules[mi].lessons.push({
    title:          '',
    lesson_type:    'video',
    is_preview:     false,
    is_mandatory_qa:false,
    order_index:    modules[mi].lessons.length,
  });
  renderModules();
};

window.removeLesson = function(mi, li) {
  modules[mi].lessons.splice(li, 1);
  renderModules();
};

// ── INLINE-HANDLER UPDATE HELPERS ────────────────────────────
// IMPORTANT: inline HTML event handlers (oninput=, onchange=) execute in the
// GLOBAL scope and CANNOT access ES-module-scoped variables like `modules`.
// These window-attached functions are closures that bridge the gap.

window.updateModuleTitle = function(mi, value) {
  if (modules[mi]) modules[mi].title = value;
};

window.updateLessonTitle = function(mi, li, value) {
  if (modules[mi]?.lessons?.[li] != null) modules[mi].lessons[li].title = value;
};

window.updateLessonType = function(mi, li, value) {
  if (modules[mi]?.lessons?.[li] != null) {
    modules[mi].lessons[li].lesson_type = value;
    renderModules();
  }
};

window.updateLessonPreview = function(mi, li, checked) {
  if (modules[mi]?.lessons?.[li] != null) modules[mi].lessons[li].is_preview = checked;
};

window.updateLessonMandatoryQA = function(mi, li, checked) {
  if (modules[mi]?.lessons?.[li] != null) modules[mi].lessons[li].is_mandatory_qa = checked;
};

// ── REVENUE PREVIEW ───────────────────────────────────────────
window.updateRevenuePreview = function() {
  const price    = parseFloat(document.getElementById('c-price')?.value || 0);
  const discount = parseFloat(document.getElementById('c-discount')?.value || 0);
  const effective = discount && discount < price ? discount : price;
  const preview = document.getElementById('revenue-preview');
  if (!preview) return;

  if (!effective) {
    preview.innerHTML = `<div style="color:var(--gray-400);font-size:13px">Enter a price to see the breakdown</div>`;
    return;
  }

  const commission = Math.round(effective * 0.25);
  const earning    = Math.round(effective * 0.75);

  preview.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;font-size:14px">
        <span style="color:var(--gray-500)">Student Pays</span>
        <span style="font-weight:700">LKR ${effective.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px">
        <span style="color:var(--gray-500)">Platform Commission (25%)</span>
        <span style="color:#FF416C;font-weight:600">− LKR ${commission.toLocaleString()}</span>
      </div>
      <div style="border-top:1.5px dashed var(--gray-100);padding-top:10px;display:flex;justify-content:space-between;font-size:16px">
        <span style="font-weight:700">You Receive (75%)</span>
        <span style="font-weight:800;color:#11CB6A">LKR ${earning.toLocaleString()}</span>
      </div>
      <div style="background:#11CB6A15;border-radius:10px;padding:10px;font-size:12px;color:#11CB6A;line-height:1.5;text-align:center">
        Per student enrolled · Credited to wallet after batch completes
      </div>
    </div>`;
};

// ── SAVE COURSE ───────────────────────────────────────────────
window.saveCourse = async function(status = 'draft') {
  const title       = sanitizeInput(document.getElementById('c-title')?.value || '');
  const description = sanitizeInput(document.getElementById('c-description')?.value || '');
  const categoryId  = document.getElementById('c-category')?.value;
  const price       = parseFloat(document.getElementById('c-price')?.value) || 0;
  const hours        = parseFloat(document.getElementById('c-hours')?.value) || null;
  const durationVal  = parseInt(document.getElementById('c-duration-val')?.value) || null;
  const durationUnit = document.getElementById('c-duration-unit')?.value || 'months';
  // Convert to weeks for backward-compat
  const unitToWeeks  = { days: 1/7, weeks: 1, months: 4.33, years: 52 };
  const durationWks  = durationVal ? Math.round(durationVal * (unitToWeeks[durationUnit] || 1)) : null;

  // Validation
  if (!title) {
    toast('Course title is required', 'error'); goToStep('basics');
    document.getElementById('c-title')?.focus(); return;
  }
  if (!categoryId) {
    toast('Please select a category', 'error'); goToStep('basics');
    const el = document.getElementById('c-category');
    if (el) { el.style.borderColor = '#FF416C'; setTimeout(() => el.style.borderColor = '', 2500); } return;
  }
  if (status !== 'draft' && !hours) {
    toast('Total hours is required', 'error'); goToStep('basics');
    document.getElementById('c-hours')?.focus(); return;
  }
  if (status !== 'draft' && !durationVal) {
    toast('Course duration is required', 'error'); goToStep('basics');
    document.getElementById('c-duration-val')?.focus(); return;
  }
  if (status !== 'draft' && !description) {
    toast('Course description is required', 'error'); goToStep('details');
    document.getElementById('c-description')?.focus(); return;
  }
  if (status !== 'draft' && price <= 0) {
    toast('Enter a course price to submit for review', 'error'); goToStep('pricing');
    const el = document.getElementById('c-price');
    if (el) { el.style.borderColor = '#FF416C'; el.focus(); setTimeout(() => el.style.borderColor = '', 2500); } return;
  }
  if (status !== 'draft' && modules.length === 0) {
    toast('Add at least one module to your curriculum', 'error'); goToStep('curriculum'); return;
  }

  const discount = parseFloat(document.getElementById('c-discount')?.value) || null;
  if (discount && discount >= price) { toast('Discount must be less than price', 'error'); return; }

  const what_you_learn = [...document.querySelectorAll('#learn-items input')].map(i => sanitizeInput(i.value)).filter(Boolean);
  const requirements   = [...document.querySelectorAll('#requirement-items input')].map(i => sanitizeInput(i.value)).filter(Boolean);
  const bonuses        = [...document.querySelectorAll('#bonus-items input')].map(i => sanitizeInput(i.value)).filter(Boolean);

  const payload = {
    teacher_id:            AuthState.user?.id,
    title,
    description:           description || '',
    short_tagline:         sanitizeInput(document.getElementById('c-tagline')?.value || ''),
    category_id:           categoryId || null,
    level:                 document.getElementById('c-level')?.value || 'beginner',
    language:              document.getElementById('c-language')?.value || 'English',
    preview_video_url:     sanitizeInput(document.getElementById('c-preview')?.value || '') || null,
    total_hours:           hours,
    duration_value:        durationVal,
    duration_unit:         durationUnit,
    duration_weeks:        durationWks,
    price,
    discount_price:        discount || null,
    certificate_available: document.getElementById('c-certificate')?.checked || false,
    status,
    what_you_learn,
    requirements,
    bonuses,
  };

  const saveBtn   = document.getElementById('btn-save-draft');
  const submitBtn = document.getElementById('btn-submit');
  const activeBtn = status === 'pending' ? (submitBtn || saveBtn) : saveBtn;
  if (activeBtn) { activeBtn.disabled = true; activeBtn.textContent = status === 'pending' ? 'Submitting...' : 'Saving...'; }

  try {
    let savedCourse;
    if (courseId) {
      savedCourse = await Courses.update(courseId, payload);
    } else {
      savedCourse = await Courses.create(payload);
      if (!savedCourse?.id) throw new Error('Course creation failed — check your internet or try again');
      courseId = savedCourse.id;
    }

    // Upload thumbnail — use stored ref (input may be re-rendered after preview)
    const thumbFile = thumbFileRef || document.getElementById('c-thumb')?.files?.[0];
    if (thumbFile) {
      try {
        const url = await Courses.uploadThumbnail(courseId, thumbFile);
        await Courses.update(courseId, { thumbnail_url: url });
      } catch (thumbErr) {
        const msg = thumbErr?.message || JSON.stringify(thumbErr);
        toast(`Thumbnail failed: ${msg}`, 'error', 6000);
      }
    }

    // Save curriculum to DB
    if (modules.length > 0) {
      await saveCurriculumToDB(courseId);
    }

    toast(
      status === 'pending'
        ? 'Course submitted! Admin will review within 24h. A batch will auto-create on approval.'
        : 'Course saved as draft!',
      'success', 4000
    );

    if (status === 'pending') {
      App.navigate('courses');
    } else {
      if (saveBtn) {
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.color = '#11CB6A';
        setTimeout(() => { saveBtn.textContent = 'Save Draft'; saveBtn.style.color = ''; }, 2500);
      }
    }

  } catch (err) {
    console.error('[saveCourse]', err);
    const msg = err.message?.includes('violates row-level security')
      ? 'Permission denied — make sure your account is a verified teacher'
      : (err.message || 'Failed to save. Check your internet and try again.');
    toast(msg, 'error', 5000);
  } finally {
    if (activeBtn) {
      activeBtn.disabled = false;
      if (activeBtn === submitBtn) activeBtn.textContent = 'Submit for Review';
      else activeBtn.textContent = 'Save Draft';
    }
  }
};

async function saveCurriculumToDB(cId) {
  // Delete existing modules for this course (CASCADE deletes lessons)
  await db.from('course_modules').delete().eq('course_id', cId);

  for (const [mi, mod] of modules.entries()) {
    if (!mod.title?.trim()) continue;

    const { data: savedMod, error: mErr } = await Curriculum.addModule(cId, mod.title.trim(), mi);
    if (mErr || !savedMod?.id) {
      console.error('[saveCurriculum] module error:', mErr);
      continue;
    }

    for (const [li, lesson] of (mod.lessons || []).entries()) {
      if (!lesson.title?.trim()) continue;
      await Curriculum.addLesson(savedMod.id, cId, {
        title:          lesson.title.trim(),
        lessonType:     lesson.lesson_type || 'video',
        orderIndex:     li,
        isPreview:      lesson.is_preview     || false,
        isMandatoryQa:  lesson.is_mandatory_qa || false,
      });
    }
  }
}
