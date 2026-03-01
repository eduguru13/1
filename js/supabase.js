// ============================================================
// EduGuru — Supabase Client Singleton
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// ── TTL CACHE ─────────────────────────────────────────────────
// Lightweight in-memory cache to avoid re-fetching static/slow-changing data
const _cache = new Map();
function withCache(key, ttlMs, fetchFn) {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fetchFn().then(data => { _cache.set(key, { data, ts: Date.now() }); return data; });
}
export function bustCache(key) { if (key) _cache.delete(key); else _cache.clear(); }

// ── AUTH HELPERS ─────────────────────────────────────────────
const Auth = {
  async signUp({ email, password, full_name, mobile, role = 'student', ...extra }) {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, mobile, role, ...extra },
      },
    });
    if (error) throw error;

    // Update users table with extra teacher fields if any
    if (data.user && Object.keys(extra).length > 0) {
      await db.from('users').update(extra).eq('id', data.user.id);
    }
    return data;
  },

  async signIn({ email, password }) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await db.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email) {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/index.html#reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword) {
    const { error } = await db.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getSession() {
    const { data } = await db.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await db.auth.getUser();
    return data.user;
  },

  onAuthChange(callback) {
    return db.auth.onAuthStateChange(callback);
  },
};

// ── USER HELPERS ──────────────────────────────────────────────
const Users = {
  async getProfile(userId) {
    // Primary: SECURITY DEFINER RPC — bypasses RLS
    const { data: rpcData, error: rpcErr } = await db
      .rpc('get_my_profile')
      .maybeSingle();
    if (!rpcErr && rpcData) return rpcData;

    // Fallback: direct query
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) return data;

    // Last resort: create profile from auth metadata
    const { data: authData } = await db.auth.getUser();
    const u = authData?.user;
    if (!u) return null;
    const meta = u.user_metadata || {};
    const { data: created } = await db.from('users').upsert({
      id: u.id,
      full_name: meta.full_name || u.email?.split('@')[0] || 'User',
      email: u.email,
      mobile: meta.mobile || '',
      age: parseInt(meta.age) || 18,
      gender: meta.gender || '',
      province: meta.province || '',
      town: meta.town || '',
      role: meta.role || 'student',
      bio: meta.bio || '',
      expertise: meta.expertise || '',
      experience_years: parseInt(meta.experience_years) || 0,
    }, { onConflict: 'id', ignoreDuplicates: true })
    .select().maybeSingle();
    return created;
  },

  // Direct query by ID — used for viewing other users' public profiles
  async getPublicProfile(userId) {
    const { data, error } = await db
      .from('users')
      .select('id, full_name, profile_picture, bio, expertise, experience_years, is_verified, role, serial_id')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    const { data, error } = await db
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAvatar(userId, file) {
    // Always store as .jpg (compressAvatar outputs JPEG)
    const path = `avatars/${userId}.jpg`;
    const { error: upErr } = await db.storage
      .from('profiles')
      .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
    if (upErr) throw upErr;
    const { data } = db.storage.from('profiles').getPublicUrl(path);
    // Append cache-bust timestamp so browser fetches fresh image after each upload
    return `${data.publicUrl}?t=${Date.now()}`;
  },
};

// ── COURSE HELPERS ────────────────────────────────────────────
const Courses = {
  async list({ tab = 'popular', categoryId = null, search = '', page = 0, limit = 12 } = {}) {
    // Cache key includes all params so different filters get separate entries
    const cacheKey = `courses:list:${tab}:${categoryId}:${search}:${page}`;
    // Only cache first page of unfiltered queries (most common case)
    const canCache = !search && page === 0;
    const TTL = 2 * 60 * 1000; // 2 min

    const fetch = async () => {
      let query = db
        .from('courses')
        .select(`
          id, title, short_tagline, price, discount_price,
          thumbnail_url, total_enrollments, rating_average,
          rating_count, fire_priority, fire_expiry_date,
          level, language, status, created_at,
          teacher:users!teacher_id(id, full_name, profile_picture),
          category:categories(id, name)
        `)
        .eq('status', 'approved')
        .eq('is_active', true);

      if (search) {
        query = query.or(`title.ilike.%${search}%,short_tagline.ilike.%${search}%`);
      }
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      if (tab === 'fire') {
        query = query
          .gt('fire_priority', 0)
          .gt('fire_expiry_date', new Date().toISOString())
          .order('fire_priority', { ascending: false });
      } else if (tab === 'popular') {
        query = query.order('total_enrollments', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      const { data, error } = await query.range(page * limit, page * limit + limit - 1);
      if (error) throw error;
      return data;
    };

    return canCache ? withCache(cacheKey, TTL, fetch) : fetch();
  },

  async getById(id) {
    const { data, error } = await db
      .from('courses')
      .select(`
        *,
        teacher:users!teacher_id(
          id, full_name, profile_picture, bio, expertise,
          experience_years, serial_id
        ),
        category:categories(id, name),
        modules:course_modules(
          id, title, order_index,
          lessons:course_lessons(
            id, title, lesson_type, is_preview, is_mandatory_qa, order_index
          )
        )
      `)
      .eq('id', id)
      .single();
    if (error) throw error;

    // Sort modules and lessons by order_index
    data.modules?.sort((a, b) => a.order_index - b.order_index);
    data.modules?.forEach(m => m.lessons?.sort((a, b) => a.order_index - b.order_index));

    // Legacy alias so course.js can read either field
    data.sections = data.modules;

    return data;
  },

  async getByTeacher(teacherId) {
    const { data, error } = await db
      .from('courses')
      .select('*, category:categories(name)')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(payload) {
    const { data, error } = await db
      .from('courses')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, payload) {
    const { data, error } = await db
      .from('courses')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadThumbnail(courseId, file) {
    const ext  = file.name.split('.').pop();
    const path = `thumbnails/${courseId}.${ext}`;
    const { error } = await db.storage.from('courses').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = db.storage.from('courses').getPublicUrl(path);
    return data.publicUrl;
  },

  // Modules (formerly "sections" — updated for Phase 3)
  async addSection(courseId, title, orderIndex) {
    const { data, error } = await db
      .from('course_modules')
      .insert({ course_id: courseId, title, module_order: orderIndex })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSection(id, updates) {
    const { data, error } = await db
      .from('course_modules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteSection(id) {
    const { error } = await db.from('course_modules').delete().eq('id', id);
    if (error) throw error;
  },

  // Lessons
  async addLesson(sectionId, payload) {
    const { data, error } = await db
      .from('course_lessons')
      .insert({ section_id: sectionId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateLesson(id, updates) {
    const { data, error } = await db
      .from('course_lessons')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLesson(id) {
    const { error } = await db.from('course_lessons').delete().eq('id', id);
    if (error) throw error;
  },

  // Drive links — only for enrolled students / teacher / admin
  async getLesson(id) {
    const { data, error } = await db
      .from('course_lessons')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
};

// ── ENROLLMENT HELPERS ────────────────────────────────────────
const Enrollments = {
  async isEnrolled(studentId, courseId) {
    const { data } = await db
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .single();
    return !!data;
  },

  async getByStudent(studentId) {
    const { data, error } = await db
      .from('enrollments')
      .select(`
        *,
        course:courses(
          id, title, thumbnail_url, total_hours, rating_average,
          teacher:users!teacher_id(full_name)
        )
      `)
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateProgress(studentId, courseId, percent) {
    const updates = { progress_percent: percent };
    if (percent >= 100) updates.completed_at = new Date().toISOString();

    const { error } = await db
      .from('enrollments')
      .update(updates)
      .eq('student_id', studentId)
      .eq('course_id', courseId);
    if (error) throw error;
  },

  async getStudentsByCourse(courseId) {
    const { data, error } = await db
      .from('enrollments')
      .select(`
        *,
        student:users!student_id(id, full_name, profile_picture, email, mobile)
      `)
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ── TRANSACTION HELPERS ───────────────────────────────────────
const Transactions = {
  async submit({ studentId, courseId, batchId = null, amount, studentName, studentWhatsapp, note }) {
    const commission = amount * 0.25;
    const payload = {
      student_id:          studentId,
      course_id:           courseId,
      amount,
      platform_commission: commission,
      teacher_earning:     amount - commission,
      payment_method:      'bank_transfer',
      payment_status:      'pending',
      student_name:        studentName,
      student_whatsapp:    studentWhatsapp,
      note,
      proof_reference:     `${studentName}-${Date.now()}`,
    };
    if (batchId) payload.batch_id = batchId;
    const { data, error } = await db
      .from('transactions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByStudent(studentId) {
    const { data, error } = await db
      .from('transactions')
      .select(`*, course:courses(id, title, thumbnail_url)`)
      .eq('student_id', studentId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getPending() {
    const { data, error } = await db
      .from('transactions')
      .select(`
        *,
        student:users!student_id(full_name, email, mobile),
        course:courses(id, title, price)
      `)
      .eq('payment_status', 'pending')
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await db
      .from('transactions')
      .select(`
        *,
        student:users!student_id(full_name, email),
        course:courses(id, title, teacher:users!teacher_id(full_name))
      `)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async approve(txnId, adminId) {
    const { error } = await db.rpc('approve_transaction', {
      txn_id:   txnId,
      admin_id: adminId,
    });
    if (error) throw error;
  },

  async reject(txnId, adminId) {
    // Fetch transaction so we can notify the student
    const { data: txn } = await db
      .from('transactions')
      .select('student_id, course:courses(title)')
      .eq('id', txnId)
      .single();

    const { error } = await db
      .from('transactions')
      .update({
        payment_status: 'rejected',
        approved_at:    new Date().toISOString(),
        approved_by:    adminId,
      })
      .eq('id', txnId);
    if (error) throw error;

    // Notify student
    if (txn?.student_id) {
      await db.from('notifications').insert({
        user_id: txn.student_id,
        title:   'Payment Not Verified',
        message: `Your payment for "${txn.course?.title || 'the course'}" could not be verified. Please re-submit your payment proof via WhatsApp.`,
        type:    'warning',
      });
    }
  },

  async getTeacherEarnings(teacherId) {
    const { data, error } = await db
      .from('transactions')
      .select(`
        id, teacher_earning, amount, submitted_at, approved_at,
        course:courses!inner(id, title, teacher_id)
      `)
      .eq('courses.teacher_id', teacherId)
      .eq('payment_status', 'approved')
      .order('approved_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ── REVIEWS HELPERS ───────────────────────────────────────────
const Reviews = {
  async getByCourse(courseId) {
    const { data, error } = await db
      .from('reviews')
      .select(`
        *,
        user:users!user_id(full_name, profile_picture)
      `)
      .eq('course_id', courseId)
      .not('is_moderated', 'eq', true)   // show reviews where is_moderated = false OR null
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getUserReview(courseId, userId) {
    const { data } = await db
      .from('reviews')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .single();
    return data;
  },

  async upsert({ courseId, userId, rating, reviewText }) {
    const { data, error } = await db
      .from('reviews')
      .upsert({
        course_id:   courseId,
        user_id:     userId,
        rating,
        review_text: reviewText,
      }, { onConflict: 'course_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async moderate(reviewId) {
    const { error } = await db
      .from('reviews')
      .update({ is_moderated: true })
      .eq('id', reviewId);
    if (error) throw error;
  },
};

// ── CATEGORIES HELPERS ────────────────────────────────────────
const Categories = {
  async getAll() {
    return withCache('categories:all', 10 * 60 * 1000, async () => {
      const { data, error } = await db
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    });
  },

  async create(payload) {
    const { data, error } = await db
      .from('categories')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await db
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) throw error;
  },
};

// ── ADS HELPERS ───────────────────────────────────────────────
const Ads = {
  async getActive() {
    const now = new Date().toISOString();
    const { data, error } = await db
      .from('ads')
      .select('*')
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('priority_order');
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await db
      .from('ads')
      .select('*')
      .order('priority_order');
    if (error) throw error;
    return data;
  },

  async create(payload) {
    const { data, error } = await db.from('ads').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { error } = await db.from('ads').update(updates).eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await db.from('ads').delete().eq('id', id);
    if (error) throw error;
  },

  async uploadBanner(file) {
    const name = `banner-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await db.storage.from('ads').upload(name, file);
    if (error) throw error;
    const { data } = db.storage.from('ads').getPublicUrl(name);
    return data.publicUrl;
  },
};

// ── NOTIFICATIONS HELPERS ─────────────────────────────────────
const Notifications = {
  async get(userId) {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return data;
  },

  async markRead(userId) {
    await db.from('notifications').update({ is_read: true }).eq('user_id', userId);
  },

  async getUnreadCount(userId) {
    const { count } = await db
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    return count || 0;
  },

  subscribeToUser(userId, callback) {
    return db
      .channel(`notif-${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => callback(payload.new))
      .subscribe();
  },
};

// ── WISHLIST HELPERS ──────────────────────────────────────────
const Wishlist = {
  async get(userId) {
    const { data, error } = await db
      .from('wishlists')
      .select(`
        *,
        course:courses(
          id, title, price, discount_price, thumbnail_url,
          rating_average, total_enrollments,
          teacher:users!teacher_id(full_name)
        )
      `)
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },

  async toggle(userId, courseId) {
    const { data: existing } = await db
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();

    if (existing) {
      await db.from('wishlists').delete().eq('id', existing.id);
      return false;
    } else {
      await db.from('wishlists').insert({ user_id: userId, course_id: courseId });
      return true;
    }
  },

  async isWishlisted(userId, courseId) {
    const { data } = await db
      .from('wishlists')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();
    return !!data;
  },
};

// ── SEARCH HISTORY HELPERS ────────────────────────────────────
const SearchHistory = {
  async save(userId, query) {
    if (!query.trim()) return;
    await db.from('search_history').insert({ user_id: userId, query: query.trim() });
  },

  async get(userId) {
    const { data } = await db
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('searched_at', { ascending: false })
      .limit(10);
    return data || [];
  },

  async delete(id) {
    await db.from('search_history').delete().eq('id', id);
  },

  async clear(userId) {
    await db.from('search_history').delete().eq('user_id', userId);
  },
};

// ── CHAT HELPERS ──────────────────────────────────────────────
const Chat = {
  async getMessages(courseId, limit = 80) {
    const { data, error } = await db
      .from('chat_messages')
      .select('*, sender:users!sender_id(full_name, profile_picture, role)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async send(courseId, senderId, message) {
    const { data, error } = await db
      .from('chat_messages')
      .insert({ course_id: courseId, sender_id: senderId, message })
      .select('*, sender:users!sender_id(full_name, profile_picture, role)')
      .single();
    if (error) throw error;
    return data;
  },

  subscribe(courseId, callback) {
    return db
      .channel(`chat-${courseId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'chat_messages',
        filter: `course_id=eq.${courseId}`,
      }, payload => callback(payload.new))
      .subscribe();
  },
};

// ── BATCH CHAT ───────────────────────────────────────────────
const BatchChat = {
  async getMessages(batchId, limit = 100) {
    const { data, error } = await db
      .from('chat_messages')
      .select('id, message, created_at, sender_id, sender:users!sender_id(full_name, profile_picture, role)')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true })
      .limit(limit);
    return { data: data || [], error };
  },

  async send(batchId, senderId, message) {
    const { data, error } = await db
      .from('chat_messages')
      .insert({ batch_id: batchId, sender_id: senderId, message })
      .select('id, message, created_at, sender_id, sender:users!sender_id(full_name, profile_picture, role)')
      .single();
    return { data, error };
  },

  subscribe(batchId, callback) {
    return db
      .channel(`batch-chat-${batchId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'chat_messages',
        filter: `batch_id=eq.${batchId}`,
      }, payload => callback(payload.new))
      .subscribe();
  },

  unsubscribe(sub) {
    if (sub) db.removeChannel(sub);
  },
};

// ── BATCH HELPERS ─────────────────────────────────────────────
const Batches = {
  // ── Create / manage ─────────────────────────────────────────
  async create(courseId, { title, description, startDate, endDate, maxStudents = 30, price } = {}) {
    const { data, error } = await db.rpc('create_batch', {
      p_course_id:    courseId,
      p_title:        title,
      p_description:  description     || null,
      p_start_date:   startDate       || null,
      p_end_date:     endDate         || null,
      p_max_students: maxStudents,
      p_price:        price           || null,
    });
    if (error) throw error;
    return data; // UUID of new batch
  },

  async activate(batchId) {
    const { error } = await db.rpc('activate_batch', { p_batch_id: batchId });
    if (error) throw error;
  },

  async cancel(batchId, reason = 'Batch cancelled by organiser') {
    const { error } = await db.rpc('cancel_batch', { p_batch_id: batchId, p_reason: reason });
    if (error) throw error;
  },

  async setStatus(batchId, status) {
    const { error } = await db.rpc('set_batch_status', { p_batch_id: batchId, p_status: status });
    return { error };
  },

  // ── Read ─────────────────────────────────────────────────────
  async getByCourse(courseId) {
    const { data, error } = await db
      .from('batches')
      .select('*, sessions:batch_sessions(id, title, session_type, scheduled_at, duration_minutes, order_index, is_completed)')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    data?.forEach(b => b.sessions?.sort((a, b) => a.order_index - b.order_index));
    return data;
  },

  async getByTeacher(teacherId) {
    const { data, error } = await db
      .from('batches')
      .select(`
        *, course:courses(id, title, thumbnail_url)
      `)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(batchId) {
    const { data, error } = await db
      .from('batches')
      .select(`
        *,
        course:courses(id, title, thumbnail_url, teacher_id),
        sessions:batch_sessions(*)
      `)
      .eq('id', batchId)
      .single();
    if (error) throw error;
    data?.sessions?.sort((a, b) => a.order_index - b.order_index);
    return data;
  },

  // Batches open for enrollment (status = opening) — used on the payment/enroll page
  // Also filters out batches where enrolled + pending payments >= max_students (seat reservation)
  async getPublic(courseId) {
    const { data, error } = await db
      .from('batches')
      .select('id, title, start_at, end_at, max_students, enrolled_count, price, status')
      .eq('course_id', courseId)
      .eq('status', 'opening')
      .order('created_at', { ascending: true });
    if (error) throw error;
    if (!data?.length) return [];

    // Count pending transactions per batch (seat reservation)
    const batchIds = data.map(b => b.id);
    const { data: pendingTxns } = await db
      .from('transactions')
      .select('batch_id')
      .in('batch_id', batchIds)
      .eq('payment_status', 'pending');

    const pendingByBatch = {};
    (pendingTxns || []).forEach(t => {
      pendingByBatch[t.batch_id] = (pendingByBatch[t.batch_id] || 0) + 1;
    });

    // Return only batches that still have seats available
    return data.filter(b => {
      const totalTaken = (b.enrolled_count || 0) + (pendingByBatch[b.id] || 0);
      return totalTaken < (b.max_students || 30);
    });
  },

  // Batches a student is enrolled in
  async getByStudent(studentId) {
    const { data, error } = await db
      .from('enrollments')
      .select(`
        batch_id, enrolled_at,
        batch:batches(
          id, title, status, start_date, end_date,
          course:courses(id, title, thumbnail_url)
        )
      `)
      .eq('student_id', studentId)
      .not('batch_id', 'is', null)
      .order('enrolled_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // ── Sessions ─────────────────────────────────────────────────
  async addSession(batchId, {
    title, description, scheduledAt, durationMinutes = 60, sessionType = 'live',
  }) {
    const { data, error } = await db.rpc('add_batch_session', {
      p_batch_id:          batchId,
      p_title:             title,
      p_description:       description    || null,
      p_scheduled_at:      scheduledAt    || null,
      p_duration_minutes:  durationMinutes,
      p_session_type:      sessionType,
    });
    if (error) throw error;
    return data; // UUID of new session
  },

  async getSessions(batchId) {
    const { data, error } = await db
      .from('batch_sessions')
      .select('*')
      .eq('batch_id', batchId)
      .order('order_index');
    if (error) throw error;
    return data;
  },

  async setSessionLink(sessionId, url, linkType = 'live', expiresAt = null) {
    const { data, error } = await db.rpc('set_session_link', {
      p_session_id: sessionId,
      p_url:        url,
      p_link_type:  linkType,
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    return data; // UUID of link record
  },

  // Student: get the actual URL (checks enrollment + logs access)
  async getSessionAccess(sessionId) {
    const { data, error } = await db.rpc('get_session_access', { p_session_id: sessionId });
    if (error) throw error;
    return data; // URL string
  },

  async completeSession(sessionId) {
    const { error } = await db.rpc('complete_session', { p_session_id: sessionId });
    if (error) throw error;
  },

  async markQaDone(batchId) {
    const { error } = await db.rpc('mark_qa_done', { p_batch_id: batchId });
    if (error) throw error;
  },

  // Check eligibility string ('eligible' or error message)
  async checkWithdrawEligibility(batchId) {
    const { data, error } = await db.rpc('check_withdraw_eligibility', { p_batch_id: batchId });
    if (error) throw error;
    return data;
  },

  // Get latest batch for a course, optionally excluding a specific batch ID
  async getLatestForCourse(courseId, excludeBatchId = null) {
    let q = db.from('batches').select('id').eq('course_id', courseId)
      .order('created_at', { ascending: false }).limit(1);
    if (excludeBatchId) q = q.neq('id', excludeBatchId);
    const { data } = await q;
    return data?.[0]?.id || null;
  },
};

// ── WALLET HELPERS ────────────────────────────────────────────
const Wallet = {
  async getBalance(userId) {
    const { data, error } = await db
      .from('users')
      .select('wallet_balance, wallet_locked')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async getLedger(teacherId, limit = 50) {
    const { data, error } = await db
      .from('wallet_ledger')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async requestWithdrawal(batchId, amount) {
    const { data, error } = await db.rpc('request_withdrawal', {
      p_batch_id: batchId,
      p_amount:   amount,
    });
    if (error) throw error;
    return data; // withdrawal UUID
  },

  async approveWithdrawal(withdrawalId, note = null) {
    const { error } = await db.rpc('approve_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_note:          note,
    });
    if (error) throw error;
  },

  async rejectWithdrawal(withdrawalId, reason) {
    const { error } = await db.rpc('reject_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_reason:        reason,
    });
    if (error) throw error;
  },

  async getMyWithdrawals(teacherId) {
    const { data, error } = await db
      .from('withdrawals')
      .select('*, batch:batches(id, title, course:courses(title))')
      .eq('teacher_id', teacherId)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAllWithdrawals() {
    const { data, error } = await db
      .from('withdrawals')
      .select(`
        *,
        teacher:users!teacher_id(full_name, email, mobile),
        batch:batches(id, title, course:courses(title))
      `)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getPendingWithdrawals() {
    const { data, error } = await db
      .from('withdrawals')
      .select(`
        *,
        teacher:users!teacher_id(full_name, bank_name, bank_account, bank_holder),
        batch:batches(id, title, course:courses(title))
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (error) throw error;
    return data;
  },
};

// ── REFUND HELPERS ────────────────────────────────────────────
const Refunds = {
  async request(enrollmentId, reason = 'Student request') {
    const { data, error } = await db.rpc('request_refund', {
      p_enrollment_id: enrollmentId,
      p_reason:        reason,
    });
    if (error) throw error;
    return data; // refund UUID
  },

  async approve(refundId, note = null) {
    const { error } = await db.rpc('approve_refund', {
      p_refund_id: refundId,
      p_note:      note,
    });
    if (error) throw error;
  },

  async reject(refundId, reason) {
    const { error } = await db.rpc('reject_refund', {
      p_refund_id: refundId,
      p_reason:    reason,
    });
    if (error) throw error;
  },

  async getMyRefunds(studentId) {
    const { data, error } = await db
      .from('refunds')
      .select('*, batch:batches(title, course:courses(title, thumbnail_url))')
      .eq('student_id', studentId)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getPending() {
    const { data, error } = await db
      .from('refunds')
      .select(`
        *,
        student:users!student_id(full_name, email, mobile),
        batch:batches(title, course:courses(title))
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await db
      .from('refunds')
      .select(`
        *,
        student:users!student_id(full_name, email),
        batch:batches(title, course:courses(title))
      `)
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data;
  },
};

// ── WAITLIST HELPERS ──────────────────────────────────────────
const Waitlist = {
  async join(batchId) {
    const { error } = await db.rpc('join_waitlist', { p_batch_id: batchId });
    if (error) throw error;
  },

  async leave(batchId, studentId) {
    const { error } = await db
      .from('waitlist')
      .update({ status: 'cancelled' })
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .eq('status', 'waiting');
    if (error) throw error;
  },

  async isWaiting(batchId, studentId) {
    const { data } = await db
      .from('waitlist')
      .select('id')
      .eq('batch_id', batchId)
      .eq('student_id', studentId)
      .eq('status', 'waiting')
      .single();
    return !!data;
  },

  async getMyWaitlist(studentId) {
    const { data, error } = await db
      .from('waitlist')
      .select('*, batch:batches(id, title, status, start_date, course:courses(title, thumbnail_url))')
      .eq('student_id', studentId)
      .eq('status', 'waiting')
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getBatchWaitlist(batchId) {
    const { data, error } = await db
      .from('waitlist')
      .select('*, student:users!student_id(full_name, email, mobile)')
      .eq('batch_id', batchId)
      .eq('status', 'waiting')
      .order('position', { ascending: true });
    if (error) throw error;
    return data;
  },
};

// ── FIRE PROMOTIONS ───────────────────────────────────────────
const FirePromotions = {
  async request({ courseId, teacherId, feePaid }) {
    const { data, error } = await db
      .from('fire_promotions')
      .insert({
        course_id:     courseId,
        teacher_id:    teacherId,
        fee_paid:      feePaid,
        status:        'pending',
        priority_score: feePaid,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await db
      .from('fire_promotions')
      .select(`
        *,
        course:courses(id, title, thumbnail_url),
        teacher:users!teacher_id(full_name)
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async approve(id, durationDays = 7) {
    const startDate = new Date();
    const endDate   = new Date(startDate.getTime() + durationDays * 86400000);

    const { error } = await db
      .from('fire_promotions')
      .update({
        status:     'active',
        start_date: startDate.toISOString(),
        end_date:   endDate.toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    // Update course
    const promo = await db.from('fire_promotions').select('course_id, priority_score').eq('id', id).single();
    await db.from('courses').update({
      fire_priority:    promo.data.priority_score,
      fire_expiry_date: endDate.toISOString(),
    }).eq('id', promo.data.course_id);
  },
};

// ── ADMIN HELPERS ─────────────────────────────────────────────
const Admin = {
  async getPendingTeachers() {
    const { data, error } = await db
      .from('users')
      .select('*')
      .eq('role', 'teacher')
      .eq('is_verified', false);
    if (error) throw error;
    return data;
  },

  async approveTeacher(id) {
    const { error } = await db
      .from('users')
      .update({ is_verified: true })
      .eq('id', id);
    if (error) throw error;
    await db.from('notifications').insert({
      user_id: id,
      title:   'Teacher Account Approved!',
      message: 'Your teacher account has been approved. You can now create and publish courses.',
      type:    'success',
    });
  },

  async rejectTeacher(id, reason = '') {
    await db.from('notifications').insert({
      user_id: id,
      title:   'Account Verification',
      message: `Your teacher application was not approved. ${reason}`,
      type:    'warning',
    });
  },

  async getPendingCourses() {
    // Try with changes_requested (requires patch v14); fall back to pending-only
    let { data, error } = await db
      .from('courses')
      .select(`*, teacher:users!teacher_id(id, full_name, profile_picture)`)
      .in('status', ['pending', 'changes_requested'])
      .order('created_at', { ascending: true });
    if (error?.message?.includes('changes_requested')) {
      ({ data, error } = await db
        .from('courses')
        .select(`*, teacher:users!teacher_id(id, full_name, profile_picture)`)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }));
    }
    if (error) throw error;
    return data;
  },

  async approveCourse(id) {
    const { data: course } = await db.from('courses').select('teacher_id, title').eq('id', id).single();
    await db.from('courses').update({ status: 'approved' }).eq('id', id);
    await db.from('notifications').insert({
      user_id: course.teacher_id,
      title:   'Course Approved!',
      message: `Your course "${course.title}" has been approved and is now live.`,
      type:    'success',
    });
  },

  async rejectCourse(id, reason) {
    const { data: course } = await db.from('courses').select('teacher_id, title').eq('id', id).single();
    await db.from('courses').update({ status: 'rejected', rejection_reason: reason }).eq('id', id);
    await db.from('notifications').insert({
      user_id: course.teacher_id,
      title:   'Course Rejected',
      message: `Your course "${course.title}" was rejected. Reason: ${reason}`,
      type:    'warning',
    });
  },

  async getAllStudents(search = '') {
    let query = db
      .from('users')
      .select('id, full_name, email, mobile, is_active, is_verified, created_at, serial_id')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getAllTeachersFull() {
    const { data, error } = await db
      .from('users')
      .select('id, full_name, email, mobile, is_active, is_verified, expertise, created_at, serial_id')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async suspendUser(userId, suspend) {
    const { error } = await db
      .from('users')
      .update({ is_active: !suspend })
      .eq('id', userId);
    if (error) throw error;

    if (suspend) {
      await db.from('notifications').insert({
        user_id: userId,
        title:   'Account Suspended',
        message: 'Your EduGuru account has been suspended. Contact support for help.',
        type:    'warning',
      });
    }
  },

  async broadcastNotification(title, message, targetRole) {
    let query = db.from('users').select('id').eq('is_active', true);
    if (targetRole && targetRole !== 'all') query = query.eq('role', targetRole);
    const { data: users, error } = await query;
    if (error) throw error;
    if (!users || users.length === 0) return 0;

    const notifs = users.map(u => ({ user_id: u.id, title, message, type: 'info' }));
    // Batch insert in chunks of 100
    for (let i = 0; i < notifs.length; i += 100) {
      const { error: e } = await db.from('notifications').insert(notifs.slice(i, i + 100));
      if (e) throw e;
    }
    return users.length;
  },

  async deleteCourse(id) {
    // Fetch batch IDs for this course
    const { data: batches } = await db.from('batches').select('id').eq('course_id', id);
    const batchIds = (batches || []).map(b => b.id);

    // Null out batch refs on financial records (RESTRICT FK) before deleting batches
    if (batchIds.length > 0) {
      await db.from('withdrawals').update({ batch_id: null }).in('batch_id', batchIds);
      await db.from('refunds').update({ batch_id: null }).in('batch_id', batchIds);
      await db.from('batches').delete().in('id', batchIds);
    }

    // Delete the course — all other linked tables cascade automatically
    const { error } = await db.from('courses').delete().eq('id', id);
    if (error) throw error;
  },

  async requestCourseChanges(id, feedback) {
    const { data: course } = await db.from('courses').select('teacher_id, title').eq('id', id).single();
    const { error } = await db.from('courses')
      .update({ status: 'changes_requested', rejection_reason: feedback })
      .eq('id', id);
    if (error) throw error;
    if (course?.teacher_id) {
      await db.from('notifications').insert({
        user_id: course.teacher_id,
        title:   'Course Revision Requested',
        message: `Your course "${course.title}" needs changes before approval: ${feedback}`,
        type:    'warning',
      });
    }
  },

  async requestPaymentResubmit(txnId, note) {
    const { data: txn } = await db.from('transactions')
      .select('student_id, course:courses(title)')
      .eq('id', txnId).single();
    if (txn?.student_id) {
      await db.from('notifications').insert({
        user_id: txn.student_id,
        title:   'Payment Proof Required',
        message: `Please re-send your payment proof for "${txn.course?.title || 'the course'}". ${note || 'The image was unclear or incomplete.'}`,
        type:    'warning',
      });
    }
  },

  async searchBySerial(serialId) {
    const { data, error } = await db.rpc('admin_search_by_serial', { p_id: serialId });
    if (error) throw error;
    return data;
  },

  async getPendingPayments() {
    const { data, error } = await db
      .from('transactions')
      .select(`
        id, amount, payment_status, submitted_at, proof_url,
        student_name, student_whatsapp, batch_id,
        student:users!student_id(id, full_name, email),
        course:courses(id, title),
        batch:batches!batch_id(id, title)
      `)
      .eq('payment_status', 'pending')
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async getAllTransactions() {
    const { data, error } = await db
      .from('transactions')
      .select(`
        id, amount, platform_commission, teacher_earning, payment_status,
        student_name, student_whatsapp, submitted_at, approved_at,
        student:users!student_id(full_name, email),
        course:courses(id, title, teacher:users!teacher_id(full_name))
      `)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAnalytics() {
    const [
      { count: totalStudents },
      { count: totalTeachers },
      { count: totalCourses },
      { count: totalEnrollments },
      { data: revenue },
    ] = await Promise.all([
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      db.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      db.from('enrollments').select('*', { count: 'exact', head: true }),
      db.from('transactions')
        .select('amount, platform_commission, teacher_earning')
        .eq('payment_status', 'approved'),
    ]);

    const totalRevenue     = revenue?.reduce((s, t) => s + Number(t.amount), 0) || 0;
    const totalCommission  = revenue?.reduce((s, t) => s + Number(t.platform_commission), 0) || 0;
    const totalTeacherPaid = revenue?.reduce((s, t) => s + Number(t.teacher_earning), 0) || 0;

    return {
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      totalRevenue,
      totalCommission,
      totalTeacherPaid,
    };
  },
};

// ── Phase 3 — Curriculum + Lesson-based Batch System ─────────

const Curriculum = {
  // ── Course Modules ──────────────────────────────────────────
  async getModules(courseId) {
    const { data, error } = await db
      .from('course_modules')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index');
    return { data, error };
  },

  async addModule(courseId, title, orderIndex) {
    const { data, error } = await db
      .from('course_modules')
      .insert({ course_id: courseId, title, order_index: orderIndex })
      .select('id, title, order_index')
      .single();
    return { data, error };
  },

  async updateModule(moduleId, title) {
    const { error } = await db
      .from('course_modules')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', moduleId);
    return { error };
  },

  async deleteModule(moduleId) {
    const { error } = await db
      .from('course_modules')
      .delete()
      .eq('id', moduleId);
    return { error };
  },

  // ── Course Lessons ──────────────────────────────────────────
  async getLessons(moduleId) {
    const { data, error } = await db
      .from('course_lessons')
      .select('id, module_id, title, lesson_type, order_index, is_preview, is_mandatory_qa')
      .eq('module_id', moduleId)
      .order('order_index');
    return { data, error };
  },

  async getAllLessons(courseId) {
    const { data, error } = await db
      .from('course_lessons')
      .select('id, module_id, title, lesson_type, order_index, is_preview, is_mandatory_qa')
      .eq('course_id', courseId)
      .order('order_index');
    return { data, error };
  },

  async addLesson(moduleId, courseId, { title, lessonType = 'video', orderIndex = 0, isPreview = false, isMandatoryQa = false }) {
    const { data, error } = await db
      .from('course_lessons')
      .insert({
        module_id:       moduleId,
        course_id:       courseId,
        title,
        lesson_type:     lessonType,
        order_index:     orderIndex,
        is_preview:      isPreview,
        is_mandatory_qa: isMandatoryQa,
      })
      .select('id, title, lesson_type, order_index')
      .single();
    return { data, error };
  },

  async updateLesson(lessonId, updates) {
    const { error } = await db
      .from('course_lessons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', lessonId);
    return { error };
  },

  async deleteLesson(lessonId) {
    const { error } = await db
      .from('course_lessons')
      .delete()
      .eq('id', lessonId);
    return { error };
  },

  // Full curriculum (modules + nested lessons) for a course
  async getCurriculum(courseId) {
    const { data: modules, error: mErr } = await db
      .from('course_modules')
      .select(`
        id, title, order_index,
        course_lessons (
          id, title, lesson_type, order_index, is_preview, is_mandatory_qa
        )
      `)
      .eq('course_id', courseId)
      .order('order_index');
    return { data: modules, error: mErr };
  },
};

const BatchLessons = {
  // Get full batch curriculum grouped by module (RPC)
  async getCurriculum(batchId) {
    const { data, error } = await db.rpc('get_batch_curriculum', { p_batch_id: batchId });
    return { data, error };
  },

  // Add a lesson to a batch (teacher only, no new modules)
  async add(batchId, moduleId, { title, lessonType = 'video', isMandatoryQa = false }) {
    const { data, error } = await db.rpc('add_batch_lesson', {
      p_batch_id:       batchId,
      p_module_id:      moduleId,
      p_title:          title,
      p_lesson_type:    lessonType,
      p_is_mandatory_qa: isMandatoryQa,
    });
    return { data, error };
  },

  async edit(lessonId, { title, lessonType, isMandatoryQa } = {}) {
    const { error } = await db.rpc('edit_batch_lesson', {
      p_lesson_id:      lessonId,
      p_title:          title          || null,
      p_lesson_type:    lessonType     || null,
      p_is_mandatory_qa: isMandatoryQa ?? null,
    });
    return { error };
  },

  async delete(lessonId) {
    const { error } = await db.rpc('delete_batch_lesson', { p_lesson_id: lessonId });
    return { error };
  },

  // Set link for a lesson (teacher only); isPublic = video/resource open to all
  async setLink(lessonId, { url, liveStart = null, liveEnd = null, isPublic = false }) {
    const { error } = await db.rpc('set_lesson_link', {
      p_lesson_id:  lessonId,
      p_url:        url,
      p_live_start: liveStart,
      p_live_end:   liveEnd,
      p_is_public:  isPublic,
    });
    return { error };
  },

  // Student accesses a lesson → returns URL + logs access
  async access(lessonId) {
    const { data, error } = await db.rpc('access_lesson', { p_lesson_id: lessonId });
    return { data, error };
  },

  // Teacher marks lesson as completed (updates batch_lessons.is_completed)
  async complete(lessonId) {
    const { error } = await db.rpc('complete_lesson', { p_lesson_id: lessonId });
    return { error };
  },

  // Student marks lesson as done for themselves (inserts into lesson_completions)
  async studentMarkDone(lessonId) {
    const { error } = await db.rpc('student_mark_lesson', { p_lesson_id: lessonId });
    return { error };
  },

  // Check if batch can be marked completed
  async checkCompletion(batchId) {
    const { data, error } = await db.rpc('check_batch_complete_eligibility', { p_batch_id: batchId });
    return { data, error };
  },

  // Teacher marks batch as completed → triggers wallet credit
  async completeBatch(batchId) {
    const { error } = await db.rpc('mark_batch_completed', { p_batch_id: batchId });
    return { error };
  },

  // Set batch start date → auto moves opening→upcoming
  async setBatchStart(batchId, startAt) {
    const { error } = await db.rpc('set_batch_start', {
      p_batch_id: batchId,
      p_start_at: startAt,
    });
    return { error };
  },

  // Set batch start + end (Patch v2)
  async setBatchSchedule(batchId, startAt, endAt = null) {
    const { error } = await db.rpc('set_batch_schedule', {
      p_batch_id: batchId,
      p_start_at: startAt,
      p_end_at:   endAt,
    });
    return { error };
  },

  // Auto-spread lesson scheduled_at across start→end range
  async autoScheduleLessons(batchId, startAt, endAt) {
    const { data, error } = await db.rpc('auto_schedule_lessons', {
      p_batch_id: batchId,
      p_start_at: startAt,
      p_end_at:   endAt,
    });
    return { data, error };
  },

  // Auto-activate batches whose start_at has passed (call on app load)
  async autoActivate() {
    const { data, error } = await db.rpc('auto_activate_batches');
    return { data, error };
  },

  // Get batch + course + teacher detail for the dashboard
  async getBatchDetail(batchId) {
    const { data, error } = await db
      .from('batches')
      .select(`
        id, title, description, status, start_at, end_at,
        enrolled_count, max_students, price, teacher_id, course_id, serial_id,
        course:courses(
          id, title, thumbnail_url, description, language, level,
          total_hours, serial_id,
          teacher:users!teacher_id(id, full_name, profile_picture, bio, serial_id)
        )
      `)
      .eq('id', batchId)
      .single();
    return { data, error };
  },

  // Get all enrolled students with their progress (teacher/admin only)
  async getStudentsProgress(batchId) {
    const { data, error } = await db.rpc('get_batch_students_progress', { p_batch_id: batchId });
    return { data: data || [], error };
  },

  // Get batch financial summary (teacher/admin only)
  async getBatchFinancial(batchId) {
    const { data, error } = await db.rpc('get_batch_financial', { p_batch_id: batchId });
    return { data, error };
  },

  // Clone all lessons (incl. links) from one batch to another (used on new batch creation)
  async clone(sourceBatchId, targetBatchId) {
    const { data, error } = await db.rpc('clone_batch_lessons', {
      p_source_batch_id: sourceBatchId,
      p_target_batch_id: targetBatchId,
    });
    return { data, error };
  },
};

const WalletV2 = {
  async getSummary() {
    const { data, error } = await db.rpc('get_wallet_summary');
    return { data, error };
  },

  async requestWithdrawal(batchId, amount) {
    const { data, error } = await db.rpc('request_withdrawal', {
      p_batch_id: batchId,
      p_amount:   amount,
    });
    return { data, error };
  },

  async approveWithdrawal(withdrawalId, note = null) {
    const { error } = await db.rpc('approve_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_note:          note,
    });
    return { error };
  },

  async rejectWithdrawal(withdrawalId, reason) {
    const { error } = await db.rpc('reject_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_reason:        reason,
    });
    return { error };
  },

  async getPendingWithdrawals() {
    const { data, error } = await db
      .from('withdrawals')
      .select(`
        id, amount_requested, status, requested_at, bank_name, bank_account, bank_holder,
        teacher:teacher_id ( full_name, email ),
        batch:batch_id ( title )
      `)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    return { data, error };
  },

  async getMyWithdrawals() {
    const { data, error } = await db
      .from('withdrawals')
      .select('id, amount_requested, amount_approved, status, requested_at, reviewed_at, admin_note, paid_at, batch:batch_id(title)')
      .order('requested_at', { ascending: false });
    return { data, error };
  },

  async markPaid(withdrawalId, amountPaid = null) {
    const { error } = await db.rpc('mark_withdrawal_paid', {
      p_withdrawal_id: withdrawalId,
      p_amount_paid:   amountPaid,
    });
    return { error };
  },
};

// ── TEACHER BANK DETAILS ───────────────────────────────────────
const TeacherBank = {
  async get() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { data: null, error: new Error('Not logged in') };
    const { data, error } = await db
      .from('users')
      .select('bank_name, account_number, account_name, bank_branch, whatsapp_number, display_phone, contact_email')
      .eq('id', user.id)
      .maybeSingle();
    return { data, error };
  },

  async save(details) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { error: new Error('Not logged in') };
    const { error } = await db.from('users').update(details).eq('id', user.id);
    return { error };
  },

  hasBankDetails(u) {
    return !!(u?.bank_name?.trim() && u?.account_number?.trim() && u?.account_name?.trim());
  },
};

export {
  db,
  Auth,
  Users,
  Courses,
  Enrollments,
  Transactions,
  Reviews,
  Categories,
  Ads,
  Notifications,
  Wishlist,
  SearchHistory,
  Chat,
  FirePromotions,
  Admin,
  // Phase 2 — Batch system (legacy)
  Batches,
  Wallet,
  Refunds,
  Waitlist,
  // Phase 3 — Curriculum + Lesson-based system
  Curriculum,
  BatchLessons,
  WalletV2,
  BatchChat,
  TeacherBank,
};
