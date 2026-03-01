// ============================================================
// EduGuru — Utility Functions
// ============================================================

// ── FORMATTING ────────────────────────────────────────────────
export function formatLKR(amount, allowFree = true) {
  if (allowFree && amount === 0) return 'Free';
  return `LKR ${Number(amount).toLocaleString('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-LK', {
    year: 'month', month: 'short', day: 'numeric',
    timeZone: 'Asia/Colombo',
  });
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hrs   = Math.floor(mins / 60);
  const days  = Math.floor(hrs / 24);
  const weeks = Math.floor(days / 7);
  const months= Math.floor(days / 30);

  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hrs < 24)    return `${hrs}h ago`;
  if (days < 7)    return `${days}d ago`;
  if (weeks < 4)   return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return formatDate(dateStr);
}

export function formatDuration(minutes) {
  if (!minutes) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

export function formatHours(hours) {
  if (!hours) return '0h';
  return `${Number(hours).toFixed(1)}h`;
}

export function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function discountPercent(price, discountPrice) {
  if (!discountPrice || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

// ── VALIDATION ────────────────────────────────────────────────
export const Validate = {
  email(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  },
  mobile(v) {
    // Sri Lanka: 07XXXXXXXX or +947XXXXXXXX
    return /^(\+94|0)?[0-9]{9,10}$/.test(v.replace(/\s/g, ''));
  },
  password(v) {
    // min 8 chars, 1 number, 1 special
    return v.length >= 8 && /[0-9]/.test(v) && /[^a-zA-Z0-9]/.test(v);
  },
  name(v) {
    return v.trim().length >= 2;
  },
  required(v) {
    return v !== null && v !== undefined && String(v).trim().length > 0;
  },
};

export function validateForm(fields) {
  const errors = {};
  for (const [field, { value, rules }] of Object.entries(fields)) {
    for (const rule of rules) {
      if (rule.fn && !rule.fn(value)) {
        errors[field] = rule.message;
        break;
      }
    }
  }
  return errors;
}

// ── DOM HELPERS ───────────────────────────────────────────────
export function qs(sel, ctx = document)  { return ctx.querySelector(sel); }
export function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

export function el(tag, attrs = {}, ...children) {
  const elem = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') elem.className = v;
    else if (k === 'html') elem.innerHTML = v;
    else if (k.startsWith('on')) elem.addEventListener(k.slice(2), v);
    else elem.setAttribute(k, v);
  }
  children.forEach(c => {
    if (typeof c === 'string') elem.appendChild(document.createTextNode(c));
    else if (c) elem.appendChild(c);
  });
  return elem;
}

export function setHTML(selector, html, ctx = document) {
  const node = ctx.querySelector(selector);
  if (node) node.innerHTML = html;
}

export function show(selector, ctx = document) {
  const node = typeof selector === 'string' ? ctx.querySelector(selector) : selector;
  if (node) node.classList.remove('hidden');
}

export function hide(selector, ctx = document) {
  const node = typeof selector === 'string' ? ctx.querySelector(selector) : selector;
  if (node) node.classList.add('hidden');
}

export function toggle(selector, condition, ctx = document) {
  condition ? show(selector, ctx) : hide(selector, ctx);
}

// ── TOAST MESSAGES ────────────────────────────────────────────
let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.querySelector('.toast-container');
    if (!_toastContainer) {
      _toastContainer = el('div', { class: 'toast-container' });
      document.body.appendChild(_toastContainer);
    }
  }
  return _toastContainer;
}

export function toast(message, type = 'default', duration = 3000) {
  const container = getToastContainer();
  const icons = {
    success: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    default: '',
  };

  const t = el('div', { class: `toast toast-${type}` });
  t.innerHTML = `${icons[type] || ''}${message}`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// ── DEBOUNCE ──────────────────────────────────────────────────
export function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── SKELETON HELPERS ──────────────────────────────────────────
export function courseCardSkeleton() {
  return `
    <div class="skeleton-card">
      <div class="skeleton skeleton-thumb"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line w-80"></div>
        <div class="skeleton skeleton-line w-60"></div>
        <div class="skeleton skeleton-line w-40"></div>
      </div>
    </div>`;
}

export function renderSkeletonGrid(count = 6) {
  return Array(count).fill(0).map(courseCardSkeleton).join('');
}

// ── COURSE CARD HTML ──────────────────────────────────────────
export function courseCardHTML(course, isEnrolled = false) {
  const price    = course.discount_price || course.price;
  const isFire   = course.fire_priority > 0 && course.fire_expiry_date > new Date().toISOString();
  const isDisc   = course.discount_price && course.discount_price < course.price;
  const pct      = isDisc ? discountPercent(course.price, course.discount_price) : 0;
  const teacher  = course.teacher?.full_name || 'EduGuru Teacher';
  const thumb    = course.thumbnail_url;
  const rating   = Number(course.rating_average || 0).toFixed(1);
  const enrolls  = formatCount(course.total_enrollments || 0);

  return `
    <div class="course-card" data-id="${course.id}" onclick="App.navigate('course', '${course.id}')">
      <div class="course-card__thumb">
        ${thumb
          ? `<img src="${thumb}" alt="${escapeHTML(course.title)}" loading="lazy">`
          : `<div class="course-card__thumb-placeholder">
               <svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8,21 12,17 16,21"/></svg>
             </div>`
        }
        ${isFire  ? `<span class="course-card__badge badge-fire">🔥 Hot</span>` : ''}
        ${isDisc && !isFire ? `<span class="course-card__badge badge-discount">-${pct}%</span>` : ''}
      </div>
      <div class="course-card__body">
        <div class="course-card__title">${escapeHTML(course.title)}</div>
        <div class="course-card__teacher">
          <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          ${escapeHTML(teacher)}
        </div>
        <div class="course-card__meta">
          <span class="course-card__rating">
            <svg class="star filled" viewBox="0 0 24 24" width="11" height="11"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
            ${rating}
          </span>
          <span class="course-card__enrolls">
            <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" fill="none" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            ${enrolls}
          </span>
        </div>
        <div class="course-card__footer">
          <div class="course-card__price">
            ${formatLKR(price)}
            ${isDisc ? `<span class="original-price">${formatLKR(course.price)}</span>` : ''}
          </div>
          <button class="course-card__cta ${isEnrolled ? 'enrolled' : ''}"
            onclick="event.stopPropagation(); App.navigate('course','${course.id}')">
            ${isEnrolled ? 'Continue' : 'Join Now'}
          </button>
        </div>
      </div>
    </div>`;
}

// ── SECURITY ──────────────────────────────────────────────────
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeInput(str) {
  return String(str || '').trim().replace(/<[^>]*>/g, '');
}

// ── LOCAL STORAGE SEARCH HISTORY (guest) ─────────────────────
export const GuestSearch = {
  key: 'eduguru_search_history',
  get() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; }
    catch { return []; }
  },
  save(query) {
    if (!query.trim()) return;
    let hist = this.get().filter(q => q !== query.trim());
    hist.unshift(query.trim());
    hist = hist.slice(0, 10);
    localStorage.setItem(this.key, JSON.stringify(hist));
  },
  delete(query) {
    const hist = this.get().filter(q => q !== query);
    localStorage.setItem(this.key, JSON.stringify(hist));
  },
  clear() { localStorage.removeItem(this.key); },
};

// ── WHATSAPP LINK BUILDER ─────────────────────────────────────
export function buildWALink(phone, message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encoded}`;
}

// ── COPY TO CLIPBOARD ─────────────────────────────────────────
export async function copyToClipboard(text, successMsg = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMsg, 'success', 2000);
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(successMsg, 'success', 2000);
  }
}

// ── INFINITE SCROLL ───────────────────────────────────────────
export function createInfiniteScroll(container, loadMore) {
  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore(); },
    { threshold: 0.1 }
  );

  const sentinel = el('div', { class: 'scroll-sentinel', style: 'height:1px' });
  container.appendChild(sentinel);
  observer.observe(sentinel);

  return { destroy: () => observer.disconnect() };
}

// ── SHARE ─────────────────────────────────────────────────────
export async function shareCourse(course) {
  const url  = `${window.location.origin}${window.location.pathname}#course/${course.id}`;
  const data = {
    title: course.title,
    text:  `Check out "${course.title}" on EduGuru!`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(data); } catch { /* user cancelled */ }
  } else {
    await copyToClipboard(url, 'Link copied!');
  }
}

// ── STAR RENDERER ─────────────────────────────────────────────
export function renderStars(rating, size = 14) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= Math.round(rating);
    html += `<svg class="star ${filled ? 'filled' : 'empty'}" viewBox="0 0 24 24"
      width="${size}" height="${size}" style="color:#F59E0B">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        fill="${filled ? '#F59E0B' : '#E5E7EB'}" stroke="none"/>
    </svg>`;
  }
  return html;
}

// ── MODAL ─────────────────────────────────────────────────────
export function openModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(id);
  }, { once: true });
}

export function closeModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// ── CONFIRM DIALOG ────────────────────────────────────────────
export function confirm(message, onConfirm, onCancel = () => {}) {
  const id  = 'confirm-modal-' + Date.now();
  const div = el('div', { id, class: 'modal-overlay' });
  div.innerHTML = `
    <div class="modal-sheet" style="max-height:auto">
      <div class="modal-sheet__handle"></div>
      <p class="font-semi" style="font-size:16px;margin-bottom:8px">Are you sure?</p>
      <p class="text-gray text-sm" style="margin-bottom:24px">${escapeHTML(message)}</p>
      <div class="flex gap-sm">
        <button class="btn btn-ghost flex-1" id="confirm-cancel-${id}">Cancel</button>
        <button class="btn btn-danger flex-1" id="confirm-ok-${id}">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  requestAnimationFrame(() => div.classList.add('show'));

  const remove = () => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 400);
  };

  document.getElementById(`confirm-ok-${id}`).onclick = () => { remove(); onConfirm(); };
  document.getElementById(`confirm-cancel-${id}`).onclick = () => { remove(); onCancel(); };
  div.addEventListener('click', e => { if (e.target === div) { remove(); onCancel(); } });
}

// ── SERIAL ID CHIP ────────────────────────────────────────────
export function serialChip(id) {
  if (!id) return '';
  return `<span class="eg-id" onclick="event.stopPropagation();copySerialId(this,'${id}')" title="Click to copy">${id}</span>`;
}

// Global copy handler (set once)
if (!window.copySerialId) {
  window.copySerialId = function(el, id) {
    el.classList.add('eg-id--copied');
    setTimeout(() => el.classList.remove('eg-id--copied'), 1500);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(id).catch(() => _egFallbackCopy(id));
    } else {
      _egFallbackCopy(id);
    }
  };
  function _egFallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  }
}
