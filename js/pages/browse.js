// ============================================================
// EduGuru — Browse / Search Page
// ============================================================
import { Courses, Categories } from '../supabase.js';
import { AuthState } from '../auth.js';
import { courseCardHTML, renderSkeletonGrid, debounce, toast, escapeHTML } from '../utils.js';
import { GuestSearch } from '../utils.js';

let currentQuery    = '';
let currentCategory = null;
let currentCategoryName = '';
let currentPage     = 0;
let isLoading       = false;
let hasMore         = true;
let enrolledIds     = new Set();

export function renderBrowsePage() {
  return `
    <div class="browse-page page" id="browse-page">
      <!-- Search Bar -->
      <div class="search-wrap" style="padding-top:20px">
        <input type="text" class="search-bar" id="browse-search"
          placeholder="Search courses, teachers..." autocomplete="off">
        <svg class="search-icon" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div class="search-clear hidden" id="browse-clear">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>

      <!-- Filter Chips -->
      <div style="padding:0 16px 12px;overflow-x:auto;display:flex;gap:8px;scrollbar-width:none">
        <button class="chip chip-purple" id="filter-all" onclick="browseFilter('all')">All</button>
        <div id="category-chips" style="display:flex;gap:8px"></div>
      </div>

      <!-- Results Header -->
      <div class="section-header">
        <span class="section-title" id="browse-title">All Courses</span>
        <span class="text-gray text-sm" id="results-count"></span>
      </div>

      <!-- Course Grid -->
      <div class="courses-grid" id="browse-grid">
        ${renderSkeletonGrid(6)}
      </div>

      <div id="browse-sentinel" style="height:40px"></div>
      <div class="hidden" id="browse-loading" style="text-align:center;padding:16px">
        <svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="var(--purple-start)" fill="none" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>
    </div>`;
}

export async function initBrowsePage(params = {}) {
  currentQuery    = params.q     || '';
  currentCategory = params.categoryId   || null;
  currentCategoryName = params.categoryName || '';
  currentPage = 0;
  hasMore     = true;
  isLoading   = false;

  // Load enrolled IDs
  if (AuthState.isLoggedIn && AuthState.isStudent) {
    const { Enrollments } = await import('../supabase.js');
    const enrolled = await Enrollments.getByStudent(AuthState.user.id).catch(() => []);
    enrolledIds = new Set(enrolled.map(e => e.course_id));
  }

  // Set initial search value
  const searchInput = document.getElementById('browse-search');
  if (searchInput && currentQuery) searchInput.value = currentQuery;

  // Update title
  updateTitle();

  await Promise.all([
    loadCategoryChips(),
    loadBrowseCourses(true),
  ]);

  initBrowseSearch();
  initBrowseScroll();
}

// ── CATEGORY CHIPS ────────────────────────────────────────────
async function loadCategoryChips() {
  try {
    const cats = await Categories.getAll();
    const container = document.getElementById('category-chips');
    if (!container) return;

    container.innerHTML = cats.map(c => `
      <button class="chip ${currentCategory === c.id ? 'chip-purple' : ''}"
        onclick="browseFilter('${c.id}', '${escapeHTML(c.name)}')">
        ${escapeHTML(c.name)}
      </button>`).join('');

    if (currentCategory) {
      document.getElementById('filter-all')?.classList.remove('chip-purple');
    }
  } catch { /* silent */ }
}

window.browseFilter = async function(categoryId, categoryName = '') {
  currentCategory     = categoryId === 'all' ? null : categoryId;
  currentCategoryName = categoryName;
  currentPage = 0;
  hasMore = true;

  // Update chip active states
  document.getElementById('filter-all')?.classList.toggle('chip-purple', !currentCategory);
  document.querySelectorAll('#category-chips .chip').forEach(chip => {
    chip.classList.toggle('chip-purple', chip.textContent.trim() === categoryName);
  });

  updateTitle();
  await loadBrowseCourses(true);
};

function updateTitle() {
  const title = document.getElementById('browse-title');
  if (!title) return;
  if (currentQuery)    title.textContent = `Results for "${currentQuery}"`;
  else if (currentCategoryName) title.textContent = currentCategoryName;
  else                 title.textContent = 'All Courses';
}

// ── COURSES ───────────────────────────────────────────────────
async function loadBrowseCourses(reset = false) {
  if (isLoading || (!hasMore && !reset)) return;

  if (reset) {
    currentPage = 0;
    hasMore = true;
    const grid = document.getElementById('browse-grid');
    if (grid) grid.innerHTML = renderSkeletonGrid(6);
  }

  isLoading = true;
  const loadingEl = document.getElementById('browse-loading');
  if (loadingEl && !reset) loadingEl.classList.remove('hidden');

  try {
    const data = await Courses.list({
      search:     currentQuery,
      categoryId: currentCategory,
      page:       currentPage,
      limit:      12,
    });

    const grid = document.getElementById('browse-grid');
    if (!grid) return;

    if (reset) grid.innerHTML = '';

    if (data.length < 12) hasMore = false;

    if (!data.length && currentPage === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div class="empty-state__title">No Courses Found</div>
          <div class="empty-state__text">Try a different search or browse all categories</div>
          <button class="btn btn-primary btn--sm" onclick="browseFilter('all')">Browse All</button>
        </div>`;
      document.getElementById('results-count').textContent = '';
      return;
    }

    grid.insertAdjacentHTML('beforeend', data.map(c => courseCardHTML(c, enrolledIds.has(c.id))).join(''));

    if (reset) {
      const countEl = document.getElementById('results-count');
      if (countEl) countEl.textContent = data.length < 12 ? `${data.length} courses` : `${data.length}+ courses`;
    }

    currentPage++;
  } catch (err) {
    console.error(err);
    toast('Failed to load courses', 'error');
  } finally {
    isLoading = false;
    const loadingEl = document.getElementById('browse-loading');
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

// ── SEARCH ────────────────────────────────────────────────────
function initBrowseSearch() {
  const input = document.getElementById('browse-search');
  const clear = document.getElementById('browse-clear');
  if (!input) return;

  input.addEventListener('input', debounce(async () => {
    currentQuery = input.value.trim();
    clear?.classList.toggle('hidden', !currentQuery);
    updateTitle();
    await loadBrowseCourses(true);
  }, 400));

  clear?.addEventListener('click', async () => {
    input.value = '';
    currentQuery = '';
    clear.classList.add('hidden');
    updateTitle();
    await loadBrowseCourses(true);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') input.blur();
  });
}

// ── INFINITE SCROLL ───────────────────────────────────────────
function initBrowseScroll() {
  const sentinel = document.getElementById('browse-sentinel');
  if (!sentinel) return;

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) loadBrowseCourses(false);
  }, { threshold: 0.1 });

  observer.observe(sentinel);
}
