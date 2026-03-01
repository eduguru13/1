// ============================================================
// EduGuru — Home Page
// ============================================================
import { Ads, Courses, Categories, SearchHistory } from '../supabase.js';
import { AuthState } from '../auth.js';
import { courseCardHTML, renderSkeletonGrid, debounce, toast, escapeHTML, formatLKR, GuestSearch } from '../utils.js';

const CATEGORY_ICONS = {
  'Mathematics': '📐', 'Science': '🔬', 'English': '🔤',
  'Sinhala': '🇱🇰', 'Tamil': '🔠', 'ICT': '💻',
  'Commerce': '💰', 'Art': '🎨', 'Music': '🎵',
  'Languages': '🌐', 'Technology': '⚙️', 'Business': '📊',
};

let bannerInterval = null;
let currentBanner  = 0;
let allBanners     = [];
let currentTab     = 'popular';
let currentPage    = 0;
let isLoading      = false;
let hasMore        = true;
let enrolledIds    = new Set();

// ── RENDER ────────────────────────────────────────────────────
export function renderHomePage() {
  return `
    <div class="home-page page" id="home-page">

      <!-- Search Bar -->
      <div class="search-wrap" style="padding-top:20px">
        <input type="text" class="search-bar" id="home-search"
          placeholder="Search courses, teachers..." autocomplete="off" spellcheck="false">
        <svg class="search-icon" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <div class="search-clear hidden" id="search-clear">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <div class="search-dropdown" id="search-dropdown"></div>
      </div>

      <!-- Ad Banners -->
      <div class="banner-wrap" id="banner-section">
        <div class="banner-carousel" id="banner-carousel">
          <div class="banner-slides" id="banner-slides">
            <!-- skeleton -->
            <div class="banner-slide">
              <div class="placeholder-banner skeleton" style="width:100%;height:100%"></div>
            </div>
          </div>
        </div>
        <div class="banner-dots" id="banner-dots"></div>
      </div>

      <!-- Tabs -->
      <div class="tabs-wrap" style="margin-bottom:16px">
        <div class="tabs">
          <button class="tab-btn" data-tab="foryou">For You</button>
          <button class="tab-btn active" data-tab="popular">Popular</button>
          <button class="tab-btn" data-tab="fire">🔥 Fire</button>
          <button class="tab-btn" data-tab="categories">Categories</button>
        </div>
      </div>

      <!-- Section Header -->
      <div class="section-header" id="courses-header">
        <span class="section-title" id="tab-title">Popular Courses</span>
        <span class="section-link" onclick="App.navigate('browse')">See all</span>
      </div>

      <!-- Categories Grid (hidden by default) -->
      <div id="categories-section" class="hidden">
        <div class="categories-grid" id="categories-grid">
          ${Array(6).fill(0).map(() => `
            <div class="category-card">
              <div class="category-icon skeleton" style="width:48px;height:48px;border-radius:12px"></div>
              <div class="skeleton skeleton-line w-60" style="height:10px;margin:0"></div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Course Grid -->
      <div class="courses-grid" id="courses-grid">
        ${renderSkeletonGrid(6)}
      </div>

      <!-- Load more sentinel -->
      <div id="load-sentinel" style="height:40px;margin-bottom:8px"></div>

      <!-- Loading indicator -->
      <div class="hidden" id="loading-more" style="text-align:center;padding:16px">
        <svg class="spin" viewBox="0 0 24 24" width="24" height="24" stroke="var(--purple-start)" fill="none" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
      </div>

    </div>`;
}

// ── INIT ──────────────────────────────────────────────────────
export async function initHomePage() {
  currentPage = 0;
  hasMore     = true;
  isLoading   = false;
  currentTab  = 'popular';

  // Load enrolled course IDs for logged-in student
  if (AuthState.isLoggedIn && AuthState.isStudent) {
    const { Enrollments } = await import('../supabase.js');
    const enrolled = await Enrollments.getByStudent(AuthState.user.id).catch(() => []);
    enrolledIds = new Set(enrolled.map(e => e.course_id));
  }

  await Promise.all([
    loadBanners(),
    loadCourses(true),
  ]);

  initSearch();
  initTabs();
  initInfiniteScroll();
}

// ── BANNERS ───────────────────────────────────────────────────
async function loadBanners() {
  try {
    allBanners = await Ads.getActive();
  } catch { allBanners = []; }

  const slides = document.getElementById('banner-slides');
  const dots   = document.getElementById('banner-dots');
  if (!slides || !dots) return;

  if (allBanners.length === 0) {
    slides.innerHTML = `
      <div class="banner-slide">
        <div class="placeholder-banner" style="background:var(--gradient);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:white;height:100%">
          <svg viewBox="0 0 24 24" width="40" height="40" stroke="white" fill="none" stroke-width="1.5">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span style="font-family:var(--font-display);font-size:18px;font-weight:700">Welcome to EduGuru</span>
          <span style="font-size:13px;opacity:0.85">Learn from Sri Lanka's best teachers</span>
        </div>
      </div>`;
    return;
  }

  slides.innerHTML = allBanners.map((ad, i) => `
    <div class="banner-slide" onclick="${ad.redirect_url ? `window.open('${escapeHTML(ad.redirect_url)}','_blank')` : ''}">
      <img src="${escapeHTML(ad.image_url)}" alt="${escapeHTML(ad.title || 'EduGuru Ad')}" loading="lazy"
           onerror="this.parentElement.innerHTML='<div class=placeholder-banner style=background:var(--gradient);height:100%;display:flex;align-items:center;justify-content:center><span style=color:white;font-weight:700>${escapeHTML(ad.title || 'EduGuru')}</span></div>'">
    </div>`).join('');

  dots.innerHTML = allBanners.map((_, i) =>
    `<div class="banner-dot ${i === 0 ? 'active' : ''}" onclick="goToBanner(${i})"></div>`
  ).join('');

  if (allBanners.length > 1) startBannerAutoplay();

  // Touch/swipe support
  initBannerSwipe();
}

window.goToBanner = function(index) {
  currentBanner = index;
  updateBannerPosition();
};

function startBannerAutoplay() {
  clearInterval(bannerInterval);
  bannerInterval = setInterval(() => {
    currentBanner = (currentBanner + 1) % allBanners.length;
    updateBannerPosition();
  }, 4000);
}

function updateBannerPosition() {
  const slides = document.getElementById('banner-slides');
  if (slides) slides.style.transform = `translateX(-${currentBanner * 100}%)`;

  document.querySelectorAll('.banner-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentBanner);
  });
}

function initBannerSwipe() {
  const carousel = document.getElementById('banner-carousel');
  if (!carousel) return;

  let startX = 0;
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  carousel.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) {
      currentBanner = Math.min(currentBanner + 1, allBanners.length - 1);
    } else {
      currentBanner = Math.max(currentBanner - 1, 0);
    }
    updateBannerPosition();
    clearInterval(bannerInterval);
    startBannerAutoplay();
  });
}

// ── COURSES ───────────────────────────────────────────────────
async function loadCourses(reset = false) {
  if (isLoading || (!hasMore && !reset)) return;

  if (reset) {
    currentPage = 0;
    hasMore = true;
    const grid = document.getElementById('courses-grid');
    if (grid) grid.innerHTML = renderSkeletonGrid(6);
  }

  isLoading = true;
  toggleLoadingMore(true);

  try {
    const tab  = currentTab === 'categories' ? 'popular' : currentTab === 'foryou' ? 'latest' : currentTab;
    const data = await Courses.list({ tab, page: currentPage, limit: 12 });

    const grid = document.getElementById('courses-grid');
    if (!grid) return;

    if (reset) grid.innerHTML = '';

    if (!data || data.length === 0) {
      hasMore = false;
      if (currentPage === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-state__icon">
              <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="empty-state__title">No Courses Yet</div>
            <div class="empty-state__text">Be the first to publish a course on EduGuru!</div>
          </div>`;
      }
      return;
    }

    if (data.length < 12) hasMore = false;

    grid.insertAdjacentHTML('beforeend',
      data.map(c => courseCardHTML(c, enrolledIds.has(c.id))).join(''));

    currentPage++;
  } catch (err) {
    console.error('loadCourses:', err?.message || err?.code || JSON.stringify(err), err);
    toast('Failed to load courses', 'error');
  } finally {
    isLoading = false;
    toggleLoadingMore(false);
  }
}

function toggleLoadingMore(show) {
  const el = document.getElementById('loading-more');
  if (el) el.classList.toggle('hidden', !show);
}

// ── TABS ──────────────────────────────────────────────────────
function initTabs() {
  const tabTitles = {
    foryou:     'For You',
    popular:    'Popular Courses',
    fire:       '🔥 Hot Courses',
    categories: 'Browse Categories',
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTab = btn.dataset.tab;
      document.getElementById('tab-title').textContent = tabTitles[currentTab];

      const catSection  = document.getElementById('categories-section');
      const gridSection = document.getElementById('courses-grid');
      const sentinel    = document.getElementById('load-sentinel');

      if (currentTab === 'categories') {
        catSection.classList.remove('hidden');
        gridSection.classList.add('hidden');
        sentinel.classList.add('hidden');
        await loadCategories();
      } else {
        catSection.classList.add('hidden');
        gridSection.classList.remove('hidden');
        sentinel.classList.remove('hidden');
        await loadCourses(true);
      }
    });
  });
}

// ── CATEGORIES ────────────────────────────────────────────────
async function loadCategories() {
  try {
    const cats = await Categories.getAll();
    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = cats.map(cat => `
      <div class="category-card" onclick="App.navigate('browse', {categoryId:'${cat.id}',categoryName:'${escapeHTML(cat.name)}'})">
        <div class="category-icon">${CATEGORY_ICONS[cat.name] || '📚'}</div>
        <div class="category-name">${escapeHTML(cat.name)}</div>
      </div>`).join('');
  } catch {
    toast('Failed to load categories', 'error');
  }
}

// ── SEARCH ────────────────────────────────────────────────────
function initSearch() {
  const input    = document.getElementById('home-search');
  const dropdown = document.getElementById('search-dropdown');
  const clearBtn = document.getElementById('search-clear');
  if (!input || !dropdown) return;

  // Show history on focus
  input.addEventListener('focus', () => showSearchHistory());

  // Live search with debounce
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);

    if (!q) {
      showSearchHistory();
      return;
    }

    dropdown.classList.add('show');
    dropdown.innerHTML = `
      <div class="search-dropdown__header">Searching...</div>`;

    try {
      const results = await Courses.list({ search: q, limit: 5 });
      if (!results.length) {
        dropdown.innerHTML = `
          <div class="search-dropdown__header">No results for "${escapeHTML(q)}"</div>`;
        return;
      }

      dropdown.innerHTML = `
        <div class="search-dropdown__header">Results</div>
        ${results.map(c => `
          <div class="search-history-item" onclick="submitSearch('${escapeHTML(c.title)}')">
            <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            <span>${escapeHTML(c.title)}</span>
            <svg class="delete-history" viewBox="0 0 24 24" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
          </div>`).join('')}`;
    } catch { /* silent */ }
  }, 400));

  // Clear button
  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    dropdown.classList.remove('show');
    input.focus();
  });

  // Submit search on Enter
  input.addEventListener('keydown', async e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) submitSearch(q);
    }
    if (e.key === 'Escape') {
      dropdown.classList.remove('show');
      input.blur();
    }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

async function showSearchHistory() {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;

  let history = [];
  if (AuthState.isLoggedIn) {
    const { SearchHistory } = await import('../supabase.js');
    history = await SearchHistory.get(AuthState.user.id).catch(() => []);
  } else {
    history = GuestSearch.get().map(q => ({ query: q }));
  }

  if (!history.length) {
    dropdown.classList.remove('show');
    return;
  }

  dropdown.classList.add('show');
  dropdown.innerHTML = `
    <div class="search-dropdown__header">Recent Searches</div>
    ${history.map(h => `
      <div class="search-history-item">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span onclick="submitSearch('${escapeHTML(h.query || h)}')">${escapeHTML(h.query || h)}</span>
        <svg class="delete-history" viewBox="0 0 24 24" width="14" height="14"
          onclick="event.stopPropagation();deleteSearchHistory('${escapeHTML(h.id || h.query || h)}')">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>`).join('')}`;
}

window.submitSearch = async function(query) {
  document.getElementById('home-search').value = query;
  document.getElementById('search-dropdown')?.classList.remove('show');

  // Save to history
  if (AuthState.isLoggedIn) {
    const { SearchHistory } = await import('../supabase.js');
    await SearchHistory.save(AuthState.user.id, query).catch(() => {});
  } else {
    GuestSearch.save(query);
  }

  App.navigate('browse', { q: query });
};

window.deleteSearchHistory = async function(idOrQuery) {
  if (AuthState.isLoggedIn) {
    const { SearchHistory } = await import('../supabase.js');
    await SearchHistory.delete(idOrQuery).catch(() => {});
  } else {
    GuestSearch.delete(idOrQuery);
  }
  showSearchHistory();
};

// ── INFINITE SCROLL ───────────────────────────────────────────
function initInfiniteScroll() {
  const sentinel = document.getElementById('load-sentinel');
  if (!sentinel) return;

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && currentTab !== 'categories') {
      loadCourses(false);
    }
  }, { threshold: 0.1 });

  observer.observe(sentinel);
}
