// ============================================================
// EduGuru — Contact Us Page
// ============================================================

export function renderContactPage() {
  return `
    <div class="page" id="contact-page" style="padding-bottom:32px">
      <!-- Header -->
      <div style="padding:20px 16px 4px;display:flex;align-items:center;gap:12px">
        <button class="icon-btn" onclick="App.navigate('menu')">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 style="font-family:var(--font-display);font-weight:800;font-size:22px">Contact Us</h1>
          <p style="color:var(--gray-500);font-size:13px;margin-top:2px">We're here to help you 24/7</p>
        </div>
      </div>

      <!-- Phone -->
      <div class="glass-card" style="margin:16px 16px 12px;padding:20px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:52px;height:52px;border-radius:16px;background:var(--gradient);
               display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.6 4.38 2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.72 17z"/>
            </svg>
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--gray-500);margin-bottom:3px">Phone / WhatsApp</div>
            <a href="tel:0789929233"
               style="font-family:var(--font-display);font-weight:800;font-size:20px;
                      color:var(--purple-start);text-decoration:none">
              0789929233
            </a>
          </div>
          <a href="tel:0789929233" class="btn btn-primary btn--sm">Call</a>
        </div>
      </div>

      <!-- Email -->
      <div class="glass-card--flat" style="margin:0 16px 20px;padding:16px;display:flex;align-items:center;gap:14px">
        <div style="width:44px;height:44px;border-radius:14px;background:#EDE9FE;
             display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--purple-start)" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:3px">Email</div>
          <a href="mailto:eduguru1@gmail.com"
             style="font-weight:700;font-size:14px;color:var(--purple-start);text-decoration:none">
            eduguru1@gmail.com
          </a>
        </div>
        <a href="mailto:eduguru1@gmail.com" class="btn btn-outline btn--sm">Email</a>
      </div>

      <!-- Social Media -->
      <div style="padding:0 16px">
        <h2 style="font-weight:700;font-size:16px;margin-bottom:14px">Follow Us</h2>
        <div style="display:flex;flex-direction:column;gap:10px">

          <!-- WhatsApp -->
          <a href="https://wa.me/94789929233" target="_blank" rel="noopener" style="text-decoration:none">
            <div class="glass-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;border-radius:14px;background:#25D366;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                </svg>
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary)">WhatsApp</div>
                <div style="font-size:12px;color:var(--gray-500)">Chat with us directly</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </a>

          <!-- Instagram -->
          <a href="#" target="_blank" rel="noopener" style="text-decoration:none">
            <div class="glass-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;border-radius:14px;
                   background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="white" stroke-width="1.5"/>
                  <circle cx="12" cy="12" r="4" fill="none" stroke="white" stroke-width="1.5"/>
                  <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                </svg>
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary)">Instagram</div>
                <div style="font-size:12px;color:var(--gray-500)">Follow our page</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </a>

          <!-- TikTok -->
          <a href="#" target="_blank" rel="noopener" style="text-decoration:none">
            <div class="glass-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;border-radius:14px;background:#000;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.77 1.52V6.75a4.85 4.85 0 0 1-1-.06z"/>
                </svg>
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary)">TikTok</div>
                <div style="font-size:12px;color:var(--gray-500)">Watch our content</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </a>

          <!-- Facebook -->
          <a href="#" target="_blank" rel="noopener" style="text-decoration:none">
            <div class="glass-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;border-radius:14px;background:#1877F2;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary)">Facebook</div>
                <div style="font-size:12px;color:var(--gray-500)">Like our page</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </a>

          <!-- YouTube -->
          <a href="#" target="_blank" rel="noopener" style="text-decoration:none">
            <div class="glass-card--flat" style="padding:14px;display:flex;align-items:center;gap:12px">
              <div style="width:44px;height:44px;border-radius:14px;background:#FF0000;
                   display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#FF0000"/>
                </svg>
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px;color:var(--text-primary)">YouTube</div>
                <div style="font-size:12px;color:var(--gray-500)">Subscribe to our channel</div>
              </div>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--gray-300)" fill="none" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </a>

        </div>
      </div>

      <!-- Hours -->
      <div class="glass-card--flat" style="margin:20px 16px 0;padding:16px;text-align:center">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px">Operating Hours</div>
        <div style="font-size:13px;color:var(--gray-500)">Monday – Saturday: 9:00 AM – 9:00 PM</div>
        <div style="font-size:13px;color:var(--gray-500)">Sunday: 10:00 AM – 6:00 PM (Sri Lanka Time)</div>
      </div>
    </div>`;
}
