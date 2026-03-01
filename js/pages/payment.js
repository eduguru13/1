// ============================================================
// EduGuru — Payment / Enrollment Flow
// ============================================================
import { Courses, Transactions, Enrollments, Batches } from '../supabase.js';
import { AuthState } from '../auth.js';
import { formatLKR, toast, escapeHTML, sanitizeInput, Validate, copyToClipboard, buildWALink } from '../utils.js';
import { CONFIG } from '../config.js';

let courseData      = null;
let availableBatches = [];
let selectedBatchId  = null;

export function renderPaymentPage() {
  return `
    <div class="payment-page page" id="payment-page">
      <!-- Back header -->
      <div style="display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid var(--gray-100)">
        <button class="icon-btn" onclick="App.navigate('browse')" style="flex-shrink:0">
          <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <h1 style="font-family:var(--font-display);font-weight:700;font-size:17px">Complete Enrollment</h1>
      </div>

      <div id="payment-skeleton" style="padding:20px">
        <div class="skeleton" style="height:80px;border-radius:16px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:150px;border-radius:16px"></div>
      </div>

      <div id="payment-content" class="hidden" style="padding:0 16px 24px"></div>
    </div>`;
}

export async function initPaymentPage(courseId) {
  try {
    courseData       = await Courses.getById(courseId);
    availableBatches = [];
    selectedBatchId  = null;
    if (!courseData) throw new Error('Course not found');

    // Check if already enrolled
    const enrolled = await Enrollments.isEnrolled(AuthState.user.id, courseId);
    if (enrolled) {
      toast('You are already enrolled in this course!', 'info');
      App.navigate('courses');
      return;
    }

    // Check pending/rejected transaction FIRST — before loading batches.
    // This ensures students with pending payments always see their payment state
    // even after the batch moves from 'opening' to 'active' or 'completed'.
    const { db } = await import('../supabase.js');
    const { data: txnRows } = await db
      .from('transactions')
      .select('id, payment_status, batch_id, batch:batches!batch_id(title)')
      .eq('student_id', AuthState.user.id)
      .eq('course_id', courseId)
      .in('payment_status', ['pending', 'rejected'])
      .order('submitted_at', { ascending: false })
      .limit(1);

    const existingTxn = txnRows?.[0] || null;
    if (existingTxn) {
      if (existingTxn.payment_status === 'rejected') {
        renderRejectedState();
      } else {
        renderPendingState(existingTxn);
      }
      return;
    }

    // No existing transaction — load open batches for new enrollment
    try { availableBatches = await Batches.getPublic(courseId); } catch (e) { console.error('getPublic failed:', e?.message); availableBatches = []; }

    // Block if no open batches
    if (!availableBatches.length) {
      document.getElementById('payment-skeleton').classList.add('hidden');
      document.getElementById('payment-content').classList.remove('hidden');
      document.getElementById('payment-content').innerHTML = `
        <div class="empty-state" style="padding-top:40px">
          <div class="empty-state__icon" style="background:linear-gradient(135deg,rgba(107,117,153,0.15),rgba(107,117,153,0.05))">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#6B7599" fill="none" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="empty-state__title">No Open Batches</div>
          <div class="empty-state__text">
            <strong>${escapeHTML(courseData.title)}</strong> has no batches open for enrollment right now.
            Check back later or contact the teacher on WhatsApp.
          </div>
          <button class="btn btn-primary btn--sm" onclick="App.navigate('course','${courseId}')">Back to Course</button>
        </div>`;
      return;
    }

    // Auto-select if only one batch available
    if (availableBatches.length === 1) selectedBatchId = availableBatches[0].id;

    renderPaymentContent();
    initPaymentEvents();

  } catch (err) {
    document.getElementById('payment-page').innerHTML = `
      <div class="empty-state" style="padding-top:80px">
        <div class="empty-state__title">Error</div>
        <div class="empty-state__text">${escapeHTML(err.message)}</div>
        <button class="btn btn-primary btn--sm" onclick="App.navigate('browse')">Browse Courses</button>
      </div>`;
  }
}

function renderPendingState(txn) {
  document.getElementById('payment-skeleton').classList.add('hidden');
  const content = document.getElementById('payment-content');
  content.classList.remove('hidden');
  // batch title comes directly from the transaction join (availableBatches may not be loaded yet)
  const batch = txn?.batch || (txn?.batch_id ? availableBatches.find(b => b.id === txn.batch_id) : null);
  content.innerHTML = `
    <div class="empty-state" style="padding-top:40px">
      <div class="empty-state__icon" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05))">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="#F59E0B" fill="none" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div class="empty-state__title">Payment Pending</div>
      <div class="empty-state__text">
        Your payment for <strong>${escapeHTML(courseData.title)}</strong> is under review.
        ${batch ? `<br><span style="font-size:13px;color:var(--gray-500)">Batch: ${escapeHTML(batch.title)}</span>` : ''}
        <br>Our admin will approve it within 24 hours.
      </div>
      <button class="btn btn-ghost" onclick="App.navigate('courses')">View My Courses</button>
    </div>`;
}

function renderRejectedState() {
  document.getElementById('payment-skeleton').classList.add('hidden');
  const content = document.getElementById('payment-content');
  content.classList.remove('hidden');
  content.innerHTML = `
    <div class="empty-state" style="padding-top:40px">
      <div class="empty-state__icon" style="background:linear-gradient(135deg,rgba(255,65,108,0.15),rgba(255,65,108,0.05))">
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="#FF416C" fill="none" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div class="empty-state__title">Payment Not Verified</div>
      <div class="empty-state__text">
        Your payment for <strong>${escapeHTML(courseData.title)}</strong> could not be verified.
        Please re-submit your payment proof via WhatsApp.
      </div>
      <button class="btn btn-primary" id="btn-resubmit">Re-submit Payment</button>
      <button class="btn btn-ghost" onclick="App.navigate('courses')" style="margin-top:8px">Back to My Courses</button>
    </div>`;
  document.getElementById('btn-resubmit')?.addEventListener('click', async () => {
    // Load open batches first — availableBatches is empty when rejected state was shown
    try { availableBatches = await Batches.getPublic(courseData.id); } catch (e) { availableBatches = []; }
    if (!availableBatches.length) {
      toast('No batches are currently open for enrollment. Please contact support.', 'error');
      return;
    }
    selectedBatchId = availableBatches.length === 1 ? availableBatches[0].id : null;
    renderPaymentContent();
    initPaymentEvents();
  });
}

function renderPaymentContent() {
  const c     = courseData;
  const price = c.discount_price || c.price;
  const bank  = CONFIG.platform;

  document.getElementById('payment-skeleton').classList.add('hidden');
  const content = document.getElementById('payment-content');
  content.classList.remove('hidden');

  content.innerHTML = `
    <!-- Batch Selector (shown only if batches exist) -->
    ${availableBatches.length > 0 ? `
    <div style="margin-bottom:20px">
      <h2 style="font-family:var(--font-display);font-weight:700;font-size:16px;margin-bottom:12px">
        Select a Batch
      </h2>
      <div style="display:flex;flex-direction:column;gap:8px" id="batch-selector">
        ${availableBatches.map(b => `
          <label style="cursor:pointer">
            <div class="glass-card--flat batch-option" style="padding:12px;border:2px solid ${selectedBatchId===b.id?'var(--purple-start)':'var(--gray-100)'};border-radius:16px;transition:border 0.2s"
              id="batch-opt-${b.id}">
              <div style="display:flex;align-items:center;gap:10px">
                <input type="radio" name="batch" value="${b.id}" ${selectedBatchId===b.id?'checked':''} style="accent-color:var(--purple-start)">
                <div style="flex:1">
                  <div style="font-weight:600;font-size:14px">${escapeHTML(b.title)}</div>
                  <div style="font-size:12px;color:var(--gray-500);margin-top:2px">
                    ${b.start_at ? `Starts ${new Date(b.start_at).toLocaleDateString('en-LK', {day:'numeric',month:'short',year:'numeric'})}` : 'Date TBA'}
                    ${b.end_at ? ` — ${new Date(b.end_at).toLocaleDateString('en-LK', {day:'numeric',month:'short'})}` : ''}
                  </div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-weight:800;font-size:15px">${formatLKR(b.price)}</div>
                  <div style="font-size:11px;color:var(--gray-400)">${b.enrolled_count}/${b.max_students} seats</div>
                </div>
              </div>
            </div>
          </label>`).join('')}
      </div>
    </div>` : ''}

    <!-- Course Summary -->
    <div class="glass-card--flat" style="padding:14px;margin-bottom:20px;display:flex;gap:12px;align-items:center">
      ${c.thumbnail_url
        ? `<img src="${escapeHTML(c.thumbnail_url)}" style="width:64px;height:44px;object-fit:cover;border-radius:10px;flex-shrink:0">`
        : `<div style="width:64px;height:44px;background:var(--gradient-soft);border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center">
             <svg viewBox="0 0 24 24" width="20" height="20" stroke="var(--purple-start)" fill="none" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
           </div>`
      }
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(c.title)}</div>
        <div style="color:var(--gray-500);font-size:12px">${escapeHTML(c.teacher?.full_name || '')}</div>
      </div>
      <div style="font-weight:800;font-size:16px;flex-shrink:0">${formatLKR(price)}</div>
    </div>

    <!-- Steps -->
    <div style="display:flex;gap:0;margin-bottom:24px">
      ${['Bank Transfer', 'WhatsApp Proof', 'Get Access'].map((s, i) => `
        <div style="flex:1;text-align:center;position:relative">
          <div style="width:28px;height:28px;border-radius:50%;background:${i === 0 ? 'var(--gradient)' : 'var(--gray-100)'};color:${i === 0 ? 'white' : 'var(--gray-400)'};display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:12px;font-weight:700">${i + 1}</div>
          <div style="font-size:11px;color:${i === 0 ? 'var(--black)' : 'var(--gray-400)'};font-weight:${i === 0 ? '600' : '400'}">${s}</div>
          ${i < 2 ? `<div style="position:absolute;top:14px;left:60%;width:80%;height:2px;background:var(--gray-200)"></div>` : ''}
        </div>`).join('')}
    </div>

    <!-- Bank Details -->
    <div style="margin-bottom:20px">
      <h2 style="font-family:var(--font-display);font-weight:700;font-size:16px;margin-bottom:12px">
        Step 1: Bank Transfer
      </h2>
      <div class="glass-card" style="padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-weight:700;font-size:15px">${escapeHTML(bank.bankName)}</span>
          <span class="chip chip-purple">LKR Account</span>
        </div>
        ${bankDetail('Account Number', bank.bankAccount)}
        ${bankDetail('Account Name', bank.bankHolder)}
        ${bankDetail('Branch', bank.bankBranch)}
        ${bankDetail('Amount', formatLKR(price))}
        <div style="margin-top:12px;padding:10px 12px;background:rgba(245,158,11,0.1);border-radius:12px;font-size:12px;color:#B45309;line-height:1.5">
          ⚠️ Transfer the exact amount <strong>${formatLKR(price)}</strong> and keep your receipt.
        </div>
      </div>
    </div>

    <!-- Proof Form -->
    <div style="margin-bottom:20px">
      <h2 style="font-family:var(--font-display);font-weight:700;font-size:16px;margin-bottom:12px">
        Step 2: Submit Proof via WhatsApp
      </h2>

      <div class="glass-card--flat" style="padding:16px">
        <form id="payment-form" novalidate>
          <div class="form-group">
            <label class="form-label">Your Full Name <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input type="text" class="form-input" id="pay-name" value="${escapeHTML(AuthState.profile?.full_name || '')}"
                placeholder="Full name as on transfer">
            </div>
            <span class="form-error hidden" id="err-pay-name"></span>
          </div>

          <div class="form-group">
            <label class="form-label">WhatsApp Number <span class="required">*</span></label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              <input type="tel" class="form-input" id="pay-whatsapp" value="${escapeHTML(AuthState.profile?.mobile || '')}"
                placeholder="07XXXXXXXX">
            </div>
            <span class="form-error hidden" id="err-pay-whatsapp"></span>
          </div>

          <div class="form-group">
            <label class="form-label">Transfer Amount (optional)</label>
            <div class="input-wrap">
              <svg class="input-icon" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <input type="text" class="form-input" id="pay-amount" value="${formatLKR(price)}" placeholder="Amount transferred">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reference / Note (optional)</label>
            <textarea class="form-textarea" id="pay-note" rows="2"
              placeholder="Transaction ID, slip number or any note..."></textarea>
          </div>

          <!-- WA Message Preview -->
          <div style="background:var(--gradient-soft);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--gray-600);line-height:1.6">
            <div style="font-weight:700;margin-bottom:6px;color:var(--purple-start)">WhatsApp Message Preview:</div>
            <div id="wa-preview">Loading...</div>
          </div>

          <button type="submit" class="btn btn-primary btn--full btn--lg" id="btn-wa-submit">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            Submit via WhatsApp
          </button>
        </form>
      </div>
    </div>

    <!-- Step 3 Info -->
    <div class="glass-card" style="padding:16px;margin-bottom:24px">
      <h3 style="font-weight:700;font-size:14px;margin-bottom:8px">Step 3: Get Access</h3>
      <p style="font-size:13px;color:var(--gray-500);line-height:1.6">
        After our admin reviews your payment proof, you'll receive a notification and full access to all course materials within <strong>24 hours</strong>.
      </p>
    </div>
  `;

  // Batch radio selection
  document.querySelectorAll('input[name="batch"]').forEach(radio => {
    radio.addEventListener('change', () => {
      selectedBatchId = radio.value;
      const selectedBatch = availableBatches.find(b => b.id === selectedBatchId);
      // Update border highlights
      availableBatches.forEach(b => {
        const opt = document.getElementById(`batch-opt-${b.id}`);
        if (opt) opt.style.borderColor = b.id === selectedBatchId ? 'var(--purple-start)' : 'var(--gray-100)';
      });
      // Update price display if batch has different price
      if (selectedBatch) {
        const priceEl = document.querySelector('#payment-content .glass-card--flat span[style*="font-size:16px"]');
        if (priceEl) priceEl.textContent = formatLKR(selectedBatch.price);
      }
      updateWAPreview();
    });
  });

  // Live WA message update
  ['pay-name', 'pay-whatsapp', 'pay-amount', 'pay-note'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateWAPreview);
  });
  updateWAPreview();
}

function bankDetail(label, value) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100)">
      <span style="color:var(--gray-500);font-size:13px">${label}</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:600;font-size:14px">${escapeHTML(value)}</span>
        <button class="icon-btn" style="width:28px;height:28px"
          onclick="copyToClipboard('${escapeHTML(value)}','Copied!')">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>`;
}

function buildWAMessage() {
  const name        = document.getElementById('pay-name')?.value?.trim()     || '';
  const wa          = document.getElementById('pay-whatsapp')?.value?.trim() || '';
  const amount      = document.getElementById('pay-amount')?.value?.trim()   || formatLKR(courseData.discount_price || courseData.price);
  const note        = document.getElementById('pay-note')?.value?.trim()     || '';
  const selectedBatch = availableBatches.find(b => b.id === selectedBatchId);

  return `Hi EduGuru Team, I have paid for the course: ${courseData.title} (ID: ${courseData.id.slice(0,8)}).
Batch: ${selectedBatch ? selectedBatch.title : 'N/A'}
Name: ${name}
WhatsApp: ${wa}
Amount: ${amount}${note ? `\nNote: ${note}` : ''}`;
}

function updateWAPreview() {
  const preview = document.getElementById('wa-preview');
  if (preview) preview.innerHTML = escapeHTML(buildWAMessage()).replace(/\n/g, '<br>');
}

function initPaymentEvents() {
  document.getElementById('payment-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    // Clear errors
    ['pay-name', 'pay-whatsapp'].forEach(id => {
      const errEl = document.getElementById(`err-${id}`);
      if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
      document.getElementById(id)?.classList.remove('error');
    });

    const name     = sanitizeInput(document.getElementById('pay-name').value);
    const whatsapp = sanitizeInput(document.getElementById('pay-whatsapp').value);
    const note     = sanitizeInput(document.getElementById('pay-note')?.value || '');
    let hasError = false;

    if (!Validate.name(name)) {
      showPayError('err-pay-name', 'pay-name', 'Enter your full name');
      hasError = true;
    }
    if (!Validate.mobile(whatsapp)) {
      showPayError('err-pay-whatsapp', 'pay-whatsapp', 'Enter a valid WhatsApp number');
      hasError = true;
    }
    // If batches exist, one must be selected
    if (availableBatches.length > 0 && !selectedBatchId) {
      toast('Please select a batch to continue', 'error');
      return;
    }
    if (hasError) return;

    const selectedBatch = availableBatches.find(b => b.id === selectedBatchId);
    const price = selectedBatch?.price ?? (courseData.discount_price || courseData.price);
    const message = buildWAMessage();

    const btn = document.getElementById('btn-wa-submit');
    btn.disabled = true;
    btn.innerHTML = 'Saving...';

    try {
      // Save pending transaction to DB first
      await Transactions.submit({
        studentId:       AuthState.user.id,
        courseId:        courseData.id,
        batchId:         selectedBatchId || null,
        amount:          price,
        studentName:     name,
        studentWhatsapp: whatsapp,
        note,
      });

      // Open WhatsApp
      const waLink = buildWALink(CONFIG.platform.whatsapp, message);
      window.open(waLink, '_blank', 'noopener');

      // Show success state
      document.getElementById('payment-content').innerHTML = `
        <div class="empty-state" style="padding-top:40px">
          <div class="empty-state__icon" style="background:linear-gradient(135deg,rgba(17,203,106,0.15),rgba(10,158,82,0.05))">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="#11CB6A" fill="none" stroke-width="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div class="empty-state__title">Payment Submitted!</div>
          <div class="empty-state__text">
            Your payment for <strong>${escapeHTML(courseData.title)}</strong> has been submitted.
            Our team will review and grant access within 24 hours.
          </div>
          <button class="btn btn-primary" onclick="App.navigate('home')">Back to Home</button>
          <button class="btn btn-ghost" onclick="App.navigate('courses')" style="margin-top:8px">View My Courses</button>
        </div>`;

    } catch (err) {
      toast(err.message || 'Failed to submit payment', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Submit via WhatsApp';
    }
  });
}

function showPayError(errId, inputId, message) {
  const errEl = document.getElementById(errId);
  if (errEl) { errEl.textContent = message; errEl.classList.remove('hidden'); }
  document.getElementById(inputId)?.classList.add('error');
}

// Expose copyToClipboard globally for inline onclick
window.copyToClipboard = copyToClipboard;
