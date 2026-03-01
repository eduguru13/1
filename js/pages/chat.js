// ============================================================
// EduGuru — Course Group Chat Page
// ============================================================
import { Chat, Courses, Enrollments } from '../supabase.js';
import { AuthState } from '../auth.js';
import { escapeHTML, timeAgo, toast } from '../utils.js';

let chatSubscription = null;
let currentCourseId  = null;

// ── RENDER ────────────────────────────────────────────────────
export function renderChatPage() {
  return `
    <style>
      #chat-page {
        display: flex;
        flex-direction: column;
        height: calc(100dvh - 60px - 64px);
        overflow: hidden;
      }
      .chat-header {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255,255,255,0.9);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid var(--gray-100);
        flex-shrink: 0;
      }
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        -webkit-overflow-scrolling: touch;
      }
      .chat-input-bar {
        padding: 10px 16px;
        display: flex;
        gap: 10px;
        align-items: flex-end;
        background: rgba(255,255,255,0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-top: 1px solid var(--gray-100);
        flex-shrink: 0;
      }
      .chat-input {
        flex: 1;
        border: 1.5px solid var(--gray-200);
        border-radius: 22px;
        padding: 10px 16px;
        font-size: 14px;
        font-family: var(--font-body);
        outline: none;
        resize: none;
        max-height: 100px;
        background: var(--white);
        transition: border-color 0.2s;
      }
      .chat-input:focus { border-color: var(--purple-start); }
      .chat-send-btn {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: none;
        background: var(--gradient);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.15s, opacity 0.2s;
      }
      .chat-send-btn:active { transform: scale(0.88); }
      .chat-send-btn:disabled { opacity: 0.5; }
      .chat-msg-row { display: flex; gap: 8px; align-items: flex-end; }
      .chat-msg-row.own { flex-direction: row-reverse; }
      .chat-avatar-wrap { width: 30px; height: 30px; flex-shrink: 0; }
      .chat-bubble {
        max-width: 72%;
        padding: 9px 13px;
        border-radius: 18px;
        background: var(--gray-100);
        font-size: 14px;
        line-height: 1.45;
        word-break: break-word;
      }
      .chat-msg-row.own .chat-bubble {
        background: var(--gradient);
        color: white;
        border-bottom-right-radius: 5px;
      }
      .chat-msg-row:not(.own) .chat-bubble { border-bottom-left-radius: 5px; }
      .chat-msg-row.teacher-msg:not(.own) .chat-bubble {
        background: linear-gradient(135deg,#EDE9FE,#E0D9FB);
        border: 1px solid #C4B5FD;
      }
      .chat-sender-name {
        font-size: 11px;
        font-weight: 700;
        color: var(--purple-start);
        margin-bottom: 3px;
      }
      .teacher-chip {
        display: inline-block;
        background: var(--purple-start);
        color: white;
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
        vertical-align: middle;
      }
      .chat-time {
        font-size: 10px;
        opacity: 0.55;
        margin-top: 3px;
      }
      .chat-msg-row.own .chat-time { text-align: right; color: rgba(255,255,255,0.75); }
      .chat-date-divider {
        text-align: center;
        font-size: 11px;
        color: var(--gray-400);
        margin: 8px 0 4px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .chat-date-divider::before, .chat-date-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--gray-100);
      }
    </style>

    <div id="chat-page">
      <!-- Header -->
      <div class="chat-header">
        <button class="icon-btn" onclick="history.back()" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style="flex:1;min-width:0" id="chat-course-info">
          <div class="skeleton" style="width:150px;height:15px;border-radius:8px;margin-bottom:5px"></div>
          <div class="skeleton" style="width:80px;height:11px;border-radius:6px"></div>
        </div>
      </div>

      <!-- Messages -->
      <div class="chat-messages" id="chat-messages">
        <div style="text-align:center;padding:48px 16px">
          <svg class="spin" viewBox="0 0 24 24" width="28" height="28"
               stroke="var(--purple-start)" fill="none" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        </div>
      </div>

      <!-- Input -->
      <div class="chat-input-bar" id="chat-input-bar">
        <textarea class="chat-input" id="chat-input"
          placeholder="Type a message..." rows="1" maxlength="2000"></textarea>
        <button class="chat-send-btn" id="chat-send" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ── INIT ──────────────────────────────────────────────────────
export async function initChatPage(courseId) {
  currentCourseId = courseId;

  if (!AuthState.isLoggedIn) {
    App.navigate('auth');
    return;
  }

  // Clean up previous subscription
  if (chatSubscription) {
    try { chatSubscription.unsubscribe(); } catch {}
    chatSubscription = null;
  }

  try {
    const course = await Courses.getById(courseId);

    // Update header
    document.getElementById('chat-course-info').innerHTML = `
      <div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${escapeHTML(course.title)}
      </div>
      <div style="font-size:12px;color:var(--gray-500)">Group Chat</div>`;

    // Access check: teacher, admin, or enrolled student
    const isTeacher  = course.teacher_id === AuthState.user.id;
    const isAdmin    = AuthState.isAdmin;
    const isEnrolled = !isTeacher && !isAdmin
      ? await Enrollments.isEnrolled(AuthState.user.id, courseId).catch(() => false)
      : true;
    const hasAccess  = isTeacher || isAdmin || isEnrolled;

    if (!hasAccess) {
      document.getElementById('chat-messages').innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="empty-state__title">Enroll to Chat</div>
          <div class="empty-state__text">
            Join this course to participate in the group conversation
          </div>
          <button class="btn btn-primary" style="margin-top:12px"
            onclick="App.navigate('course','${courseId}')">
            View Course
          </button>
        </div>`;
      document.getElementById('chat-input-bar').style.display = 'none';
      return;
    }

    // Enable send button
    const sendBtn = document.getElementById('chat-send');
    sendBtn.disabled = false;

    // Load existing messages
    await loadMessages(courseId);

    // Subscribe to realtime
    chatSubscription = Chat.subscribe(courseId, async (rawMsg) => {
      // Skip own messages (already appended optimistically on send)
      if (rawMsg.sender_id === AuthState.user.id) return;
      try {
        const { db } = await import('../supabase.js');
        const { data } = await db.from('users')
          .select('full_name, profile_picture, role')
          .eq('id', rawMsg.sender_id).single();
        rawMsg.sender = data;
      } catch {}
      appendMessage(rawMsg);
      scrollToBottom();
    });

    // Send handler
    const input = document.getElementById('chat-input');

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      autoResizeInput(input);
      sendBtn.disabled = true;

      // Optimistic append
      const optimistic = {
        id:         'tmp-' + Date.now(),
        sender_id:  AuthState.user.id,
        course_id:  courseId,
        message:    text,
        created_at: new Date().toISOString(),
        sender: {
          full_name:       AuthState.profile?.full_name || 'You',
          profile_picture: AuthState.profile?.profile_picture || null,
          role:            AuthState.role,
        },
      };
      appendMessage(optimistic);
      scrollToBottom();

      try {
        await Chat.send(courseId, AuthState.user.id, text);
      } catch (err) {
        toast('Message failed to send', 'error');
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener('input', () => autoResizeInput(input));

  } catch (err) {
    toast('Failed to load chat', 'error');
    console.error('[Chat]', err);
  }
}

// ── LOAD MESSAGES ─────────────────────────────────────────────
async function loadMessages(courseId) {
  const container = document.getElementById('chat-messages');
  try {
    const messages = await Chat.getMessages(courseId);
    if (!messages || messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">
            <svg viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="empty-state__text">
            No messages yet — start the conversation!
          </div>
        </div>`;
      return;
    }

    container.innerHTML = '';
    let lastDate = null;
    for (const msg of messages) {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        container.insertAdjacentHTML('beforeend', dateDivider(msg.created_at));
        lastDate = msgDate;
      }
      container.insertAdjacentHTML('beforeend', messageHTML(msg));
    }
    scrollToBottom();
  } catch (err) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:#FF416C;font-size:13px">
        ${escapeHTML(err.message || 'Failed to load messages')}
      </div>`;
  }
}

function appendMessage(msg) {
  const container = document.getElementById('chat-messages');
  const emptyEl   = container.querySelector('.empty-state');
  if (emptyEl) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', messageHTML(msg));
}

// ── MESSAGE HTML ──────────────────────────────────────────────
function messageHTML(msg) {
  const isOwn     = msg.sender_id === AuthState.user.id;
  const isTeacher = msg.sender?.role === 'teacher' || msg.sender?.role === 'admin';
  const name      = msg.sender?.full_name || 'Unknown';
  const initials  = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return `
    <div class="chat-msg-row ${isOwn ? 'own' : ''} ${isTeacher && !isOwn ? 'teacher-msg' : ''}">
      ${!isOwn ? `
        <div class="chat-avatar-wrap">
          ${msg.sender?.profile_picture
            ? `<img src="${escapeHTML(msg.sender.profile_picture)}"
                 style="width:30px;height:30px;border-radius:50%;object-fit:cover">`
            : `<div class="avatar avatar-sm" style="background:var(--gradient);color:white;
                 font-size:10px;font-weight:700;width:30px;height:30px">${initials}</div>`
          }
        </div>` : ''}
      <div class="chat-bubble">
        ${!isOwn ? `
          <div class="chat-sender-name">
            ${escapeHTML(name)}
            ${isTeacher ? '<span class="teacher-chip">Teacher</span>' : ''}
          </div>` : ''}
        <div>${escapeHTML(msg.message)}</div>
        <div class="chat-time">${timeAgo(msg.created_at)}</div>
      </div>
    </div>`;
}

function dateDivider(ts) {
  const d = new Date(ts);
  const today     = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  let label;
  if (d.toDateString() === today) label = 'Today';
  else if (d.toDateString() === yesterday) label = 'Yesterday';
  else label = d.toLocaleDateString('en-LK', { month: 'short', day: 'numeric', year: 'numeric' });
  return `<div class="chat-date-divider">${label}</div>`;
}

// ── HELPERS ───────────────────────────────────────────────────
function scrollToBottom() {
  const el = document.getElementById('chat-messages');
  if (el) el.scrollTop = el.scrollHeight;
}

function autoResizeInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}
