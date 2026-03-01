// ============================================================
// EduGuru — Supabase Configuration
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
// ============================================================

const SUPABASE_URL  = 'https://uibkecvhzexksfjxbjbu.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpYmtlY3ZoemV4a3NmanhiamJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwOTY1MTgsImV4cCI6MjA4NzY3MjUxOH0.MUABrlsZrU7wKkHIpAo2DR2O6a5g7ll8mjem1mKsols';

// Load admin-saved overrides from localStorage
function _loadSaved() {
  try { return JSON.parse(localStorage.getItem('eduguru_settings') || '{}'); } catch { return {}; }
}
const _s = _loadSaved();

// Platform config
const CONFIG = {
  platform: {
    name:         _s.platformName  || 'EduGuru',
    tagline:      _s.tagline       || "Sri Lanka's Education Marketplace",
    currency:     'LKR',
    locale:       'en-LK',
    timezone:     'Asia/Colombo',
    commission:   0.25,          // 25% platform cut
    teacherShare: 0.75,          // 75% to teacher
    whatsapp:     _s.whatsapp    || '94789929233',
    email:        _s.email       || 'eduguru1@gmail.com',
    phone:        _s.phone       || '0789929233',
    bankName:     _s.bankName    || 'HNB Bank',
    bankAccount:  _s.bankAccount || '250020397954',
    bankHolder:   _s.bankHolder  || 'MOHAMED MI I',
    bankBranch:   _s.bankBranch  || 'Kattankudy',
  },
  search: {
    maxHistory: 10,
    debounceMs: 350,
  },
  pagination: {
    coursesPerPage: 12,
  },
  fire: {
    badgeLabel: '🔥 Hot',
  },
};

export { SUPABASE_URL, SUPABASE_ANON, CONFIG };
