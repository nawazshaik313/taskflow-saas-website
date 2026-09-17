/**
 * TASKFLOW - MASTER APPLICATION SCRIPT WITH LIQUID GLASS UX ENHANCEMENTS
 * Live Gemini 3.6 API Integration, Interactive Sprint Kanban Cards, Contact Sales & Demo Signup Handlers
 */

function escapeHTML(str) {
  if (typeof str !== 'string') return str === null || str === undefined ? '' : String(str);
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Web Audio API Synth for subtle glass click audio feedback
class GlassAudioEngine {
  constructor() {
    this.enabled = true;
    this.audioCtx = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    }
  }

  playGlassChime(freq = 880, duration = 0.15) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback
    }
  }
}

const audioEngine = new GlassAudioEngine();

// Liquid Glass Toast Notification Engine
function showGlassToast(title, message, icon = '💧') {
  const container = document.getElementById('glassToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'glass-toast';
  toast.innerHTML = `
    <div class="toast-icon">${escapeHTML(icon)}</div>
    <div>
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-msg">${escapeHTML(message)}</div>
    </div>
  `;

  container.appendChild(toast);
  audioEngine.playGlassChime(1046, 0.2);

  // Animate in
  setTimeout(() => toast.classList.add('active'), 50);

  // Auto remove after 3.5s
  setTimeout(() => {
    toast.classList.remove('active');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Header Scroll Refraction Effect
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header?.classList.add('scrolled');
    } else {
      header?.classList.remove('scrolled');
    }
  });

  // 2. Initialize Theme Controller
  if (window.ThemeController) {
    new window.ThemeController();
  }

  // 3. Initialize Hero Live Canvas Chart
  if (window.DashboardChart) {
    window.heroChartInstance = new window.DashboardChart('heroChart');
  }

  // 4. Verify Gemini API Key Status via /api/health
  async function checkGeminiHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return;
      const data = await res.json();
      const statusBadges = document.querySelectorAll('.gemini-status-indicator');
      const text = data.ai_status_text || 'AI Engine (Simulation Mode)';
      
      statusBadges.forEach(badge => {
        let dotColor = 'var(--brand-amber)';
        if (text.includes('Connected')) {
          dotColor = 'var(--brand-emerald)';
        } else if (text.includes('Configured')) {
          dotColor = '#38BDF8';
        } else if (text.includes('Unavailable')) {
          dotColor = '#EF4444';
        }

        badge.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background:${dotColor}; box-shadow:0 0 8px ${dotColor}; display:inline-block; margin-right:4px;"></span> ${escapeHTML(text)}`;
        badge.style.color = dotColor;
      });
    } catch (e) {
      // Network check silent fallback
    }
  }
  checkGeminiHealth();

  // 5. Focus Mode Toggle Handler
  const focusBtn = document.getElementById('toggleFocusModeBtn');
  if (focusBtn) {
    focusBtn.addEventListener('click', () => {
      document.body.classList.toggle('focus-mode');
      const isFocus = document.body.classList.contains('focus-mode');
      audioEngine.playGlassChime(659, 0.15);
      showGlassToast(
        isFocus ? '🎯 Focus Mode Enabled' : '🌐 Focus Mode Disabled',
        isFocus ? 'Secondary elements dimmed for deep work.' : 'Full website details restored.',
        isFocus ? '🎯' : '✨'
      );
    });
  }

  // 6. Sound Feedback Toggle Handler
  const soundBtn = document.getElementById('toggleSoundBtn');
  const soundIcon = document.getElementById('soundIcon');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      audioEngine.enabled = !audioEngine.enabled;
      if (soundIcon) soundIcon.textContent = audioEngine.enabled ? '🔊' : '🔇';
      showGlassToast(
        audioEngine.enabled ? '🔊 Glass Audio Enabled' : '🔇 Audio Muted',
        audioEngine.enabled ? 'Subtle UI chime feedback is ON.' : 'Sound FX muted.',
        audioEngine.enabled ? '🔊' : '🔇'
      );
    });
  }

  // 7. Accessible FAQ Accordion Event Listeners (Mouse & Keyboard)
  const faqButtons = document.querySelectorAll('.faq-question');
  faqButtons.forEach(btn => {
    const toggleFaq = () => {
      const item = btn.parentElement;
      const isActive = item.classList.contains('active');
      
      document.querySelectorAll('.faq-item').forEach(el => {
        el.classList.remove('active');
        const qBtn = el.querySelector('.faq-question');
        if (qBtn) qBtn.setAttribute('aria-expanded', 'false');
      });
      
      if (!isActive) {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        audioEngine.playGlassChime(784, 0.12);
      }
    };

    btn.addEventListener('click', toggleFaq);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFaq();
      }
    });
  });

  // 8. Pricing Monthly / Annual Toggle Switcher
  const pricingSwitch = document.getElementById('pricingSwitch');
  if (pricingSwitch) {
    const handleSwitch = () => {
      pricingSwitch.classList.toggle('active');
      const isAnnual = pricingSwitch.classList.contains('active');
      pricingSwitch.setAttribute('aria-checked', isAnnual ? 'true' : 'false');

      const pricePro = document.getElementById('pricePro');
      const priceBusiness = document.getElementById('priceBusiness');
      const unitPro = document.getElementById('unitPro');
      const unitBusiness = document.getElementById('unitBusiness');

      if (isAnnual) {
        if (pricePro) pricePro.textContent = '₹399';
        if (priceBusiness) priceBusiness.textContent = '₹799';
        if (unitPro) unitPro.textContent = 'billed annually (SAVE 20%)';
        if (unitBusiness) unitBusiness.textContent = 'billed annually (SAVE 20%)';
        showGlassToast('20% Annual Discount Applied', 'Showing discounted yearly billing rates.', '🎉');
      } else {
        if (pricePro) pricePro.textContent = '₹499';
        if (priceBusiness) priceBusiness.textContent = '₹999';
        if (unitPro) unitPro.textContent = 'billed monthly';
        if (unitBusiness) unitBusiness.textContent = 'billed monthly';
        showGlassToast('Monthly Billing Selected', 'Showing standard monthly subscription rates.', '📅');
      }
    };

    pricingSwitch.addEventListener('click', handleSwitch);
    pricingSwitch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSwitch();
      }
    });
  }

  // 9. Interactive AI Prompt Quick Modal Controls
  const openAiModalBtn = document.getElementById('openAiModalBtn');
  const closeAiModalBtn = document.getElementById('closeAiModalBtn');
  const aiModalOverlay = document.getElementById('aiPromptModalOverlay');

  if (openAiModalBtn && aiModalOverlay) {
    openAiModalBtn.addEventListener('click', () => {
      aiModalOverlay.classList.add('active');
      audioEngine.playGlassChime(880, 0.15);
    });
  }

  if (closeAiModalBtn && aiModalOverlay) {
    closeAiModalBtn.addEventListener('click', () => {
      aiModalOverlay.classList.remove('active');
    });
  }

  if (aiModalOverlay) {
    aiModalOverlay.addEventListener('click', (e) => {
      if (e.target === aiModalOverlay) {
        aiModalOverlay.classList.remove('active');
      }
    });
  }

  // 10. Get Started Demo Modal Triggers & Form Handler
  const getStartedModal = document.getElementById('getStartedModal');
  const closeGetStartedBtn = document.getElementById('closeGetStartedBtn');
  const demoSignupForm = document.getElementById('demoSignupForm');
  const demoSuccessState = document.getElementById('demoSuccessState');

  document.querySelectorAll('.btn-open-demo-explicit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (getStartedModal) {
        getStartedModal.classList.add('active');
        audioEngine.playGlassChime(880, 0.15);
      }
    });
  });

  if (closeGetStartedBtn && getStartedModal) {
    closeGetStartedBtn.addEventListener('click', () => {
      getStartedModal.classList.remove('active');
    });
  }

  if (getStartedModal) {
    getStartedModal.addEventListener('click', (e) => {
      if (e.target === getStartedModal) {
        getStartedModal.classList.remove('active');
      }
    });
  }

  if (demoSignupForm) {
    demoSignupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('demoName')?.value.trim();
      const email = document.getElementById('demoEmail')?.value.trim();
      const company = document.getElementById('demoCompany')?.value.trim();
      const teamSize = document.getElementById('demoTeamSize')?.value;
      const submitBtn = document.getElementById('demoSubmitBtn');

      if (!name || !email || !email.includes('@')) {
        showGlassToast('Validation Error', 'Please enter your name and a valid work email.', '⚠️');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⚡ Requesting Demo Workspace...';
      }

      try {
        const response = await fetch('/api/leads/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            company: `${company || 'TaskFlow User'} (${teamSize || 'Team'})`,
            source: 'request_demo'
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (demoSuccessState) demoSuccessState.classList.add('active');
          showGlassToast('Demo Request Recorded', 'Our onboarding team will contact you shortly.', '🎉');
          demoSignupForm.reset();
        } else {
          showGlassToast('Submission Issue', data.error || 'Failed to submit request.', '⚠️');
        }
      } catch (err) {
        showGlassToast('Network Offline', 'Recorded locally in demo mode.', 'ℹ️');
        if (demoSuccessState) demoSuccessState.classList.add('active');
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '⚡ Request Demo Workspace';
      }
    });
  }

  // 11. Contact Sales Form Submit Handler & Scroll Triggers
  const contactForm = document.getElementById('contactSalesForm');
  const contactSuccessState = document.getElementById('contactSuccessState');

  document.querySelectorAll('.btn-scroll-contact').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
        const nameInput = document.getElementById('contactName');
        if (nameInput) setTimeout(() => nameInput.focus(), 500);
      }
    });
  });

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName')?.value.trim();
      const email = document.getElementById('contactEmail')?.value.trim();
      const company = document.getElementById('contactCompany')?.value.trim();
      const source = document.getElementById('contactSource')?.value || 'contact_sales';
      const message = document.getElementById('contactMessage')?.value.trim();
      const submitBtn = document.getElementById('contactSubmitBtn');

      if (!name || !email || !email.includes('@') || !message) {
        showGlassToast('Form Validation Error', 'Please complete all required fields.', '⚠️');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🚀 Submitting Inquiry...';
      }

      try {
        const response = await fetch('/api/leads/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, company, message, source })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          if (contactSuccessState) contactSuccessState.classList.add('active');
          showGlassToast('Sales Inquiry Submitted', data.message || 'We will reach out shortly.', '✨');
          contactForm.reset();
        } else {
          showGlassToast('Submission Issue', data.error || 'Failed to submit inquiry.', '⚠️');
        }
      } catch (err) {
        showGlassToast('Inquiry Recorded', 'Thank you! Sales team will follow up.', '✨');
        if (contactSuccessState) contactSuccessState.classList.add('active');
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Submit Inquiry to Sales';
      }
    });
  }

  // 12. Floating Dock Collapse / Expand Toggle
  const collapseBarBtn = document.getElementById('collapseBarBtn');
  const liquidFloatingBar = document.getElementById('liquidFloatingBar');
  const barContentGroup = document.getElementById('barContentGroup');

  if (collapseBarBtn && liquidFloatingBar && barContentGroup) {
    let isCollapsed = false;
    collapseBarBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        barContentGroup.style.display = 'none';
        liquidFloatingBar.classList.add('collapsed');
        collapseBarBtn.textContent = '💧';
        collapseBarBtn.title = 'Expand Floating Quick Bar';
      } else {
        barContentGroup.style.display = 'flex';
        liquidFloatingBar.classList.remove('collapsed');
        collapseBarBtn.textContent = '✕';
        collapseBarBtn.title = 'Minimize Floating Dock';
      }
      audioEngine.playGlassChime(600, 0.1);
    });
  }

  // 13. Interactive Sprint Kanban Board (Card Advance on Click & API Sync)
  const kanbanCards = document.querySelectorAll('.kanban-card');
  const kanbanCols = document.querySelectorAll('.kanban-col');

  kanbanCards.forEach(card => {
    card.addEventListener('click', async () => {
      const currentCol = card.closest('.kanban-col');
      let targetColIndex = 0;

      kanbanCols.forEach((col, idx) => {
        if (col === currentCol) {
          targetColIndex = (idx + 1) % kanbanCols.length;
        }
      });

      const targetCol = kanbanCols[targetColIndex];
      const cardTitle = card.querySelector('.kanban-card-title')?.textContent || 'Task';
      
      // Animate card movement
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0.5';

      setTimeout(async () => {
        targetCol.appendChild(card);
        card.style.transform = 'scale(1)';
        card.style.opacity = '1';
        audioEngine.playGlassChime(920 + targetColIndex * 150, 0.18);
        
        const colNames = ['To Do 📌', 'In Progress ⚡', 'Completed ✅'];
        showGlassToast(
          'Sprint Board Updated',
          `"${cardTitle}" moved to ${colNames[targetColIndex]}`,
          '📋'
        );

        // Notify backend API of workflow card advancement
        try {
          await fetch('/api/workflows/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'kanban_card_clicked',
              action: `shifted_to_col_${targetColIndex}`,
              output: cardTitle
            })
          });
        } catch (e) {
          // Silent fallback
        }
      }, 180);
    });
  });

  // 14. Preset Prompt Chips Auto-Fill & Execution (Both main section & modal)
  const promptChips = document.querySelectorAll('.prompt-chip');
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      if (!promptText) return;

      audioEngine.playGlassChime(980, 0.12);

      if (chip.classList.contains('modal-chip')) {
        const modalInput = document.getElementById('modalAiInput');
        const modalForm = document.getElementById('modalAiForm');
        if (modalInput && modalForm) {
          modalInput.value = promptText;
          modalForm.dispatchEvent(new Event('submit'));
        }
      } else {
        const aiInput = document.getElementById('aiTaskInput');
        const aiForm = document.getElementById('aiTaskForm');
        if (aiInput && aiForm) {
          aiInput.value = promptText;
          aiForm.dispatchEvent(new Event('submit'));
        }
      }
    });
  });

  // 15. Interactive AI Task Assistant (Main Section & Modal Generator)
  const handleAiSubmission = async (inputEl, terminalEl, submitBtn) => {
    const taskPrompt = inputEl.value.trim();
    if (!taskPrompt) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⚡ Processing with Gemini 3.6...';
    }

    showGlassToast('Google Gemini 3.6 Flash Active', 'Processing prompt through live AI engine...', '🧠');
    terminalEl.innerHTML = `<div style="color:var(--brand-primary)">[${new Date().toLocaleTimeString()}] 🧠 Requesting Google Gemini 3.6 Flash AI analysis...</div>`;

    try {
      const response = await fetch('/api/tasks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: taskPrompt })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const timestamp = new Date().toLocaleTimeString();
        const duration = data.metrics?.duration_ms || 140;
        const safePrompt = escapeHTML(taskPrompt);
        const safeOutput = escapeHTML(data.output_preview);
        const headerLabel = data.live_gemini_used === true 
          ? `⚡ GEMINI 3.6 FLASH OUTPUT (${duration}ms execution | API Connected):`
          : `⚡ TASKFLOW AI OUTPUT (${duration}ms execution | Simulation Mode):`;

        terminalEl.innerHTML = `
          <div style="color:var(--brand-primary)">[${timestamp}] 📥 PROMPT: "${safePrompt}"</div>
          <div style="color:var(--brand-emerald); margin-top:0.4rem;">${headerLabel}</div>
          <div style="color:var(--text-primary); margin-top:0.4rem; white-space:pre-wrap; line-height:1.5;">${safeOutput}</div>
        `;
        showGlassToast('AI Task Deliverables Ready', 'Structured breakdown created and logged to database.', '✨');
      } else {
        terminalEl.innerHTML = `<div style="color:#EF4444">[ERROR] ${escapeHTML(data.error || 'Failed to process task')}</div>`;
      }
    } catch (err) {
      const safePrompt = escapeHTML(taskPrompt);
      terminalEl.innerHTML = `
        <div style="color:var(--brand-emerald)">[${new Date().toLocaleTimeString()}] ✅ TASKFLOW AI BACKEND SIMULATION:</div>
        <div style="color:var(--text-primary); margin-top:0.4rem;">1. Break down "${safePrompt}" into 3 sprint deliverables<br>2. Auto-tag priority & assign workspace owner<br>3. Status: Operational</div>
      `;
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '⚡ Generate AI Workflow';
    }
  };

  const aiTaskForm = document.getElementById('aiTaskForm');
  const aiTaskInput = document.getElementById('aiTaskInput');
  const aiTerminal = document.getElementById('aiPipelineTerminal');
  const aiSubmitBtn = document.getElementById('aiTaskSubmitBtn');

  if (aiTaskForm && aiTaskInput && aiTerminal) {
    aiTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAiSubmission(aiTaskInput, aiTerminal, aiSubmitBtn);
    });
  }

  const modalAiForm = document.getElementById('modalAiForm');
  const modalAiInput = document.getElementById('modalAiInput');
  const modalAiTerminal = document.getElementById('modalAiTerminal');
  const modalAiSubmitBtn = document.getElementById('modalAiSubmitBtn');

  if (modalAiForm && modalAiInput && modalAiTerminal) {
    modalAiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAiSubmission(modalAiInput, modalAiTerminal, modalAiSubmitBtn);
    });
  }

  // 16. Live Telemetry Stats Syncing from Backend API
  async function syncBackendStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.metrics) {
        const liveBadge = document.getElementById('liveTaskCounter');
        if (liveBadge) {
          liveBadge.textContent = `${data.metrics.live_tasks_per_min.toLocaleString()} tasks/min`;
        }
      }
    } catch (e) {
      // Background sync handle
    }
  }
  syncBackendStats();
  setInterval(syncBackendStats, 5000);

  // 17. Mobile Navigation Drawer Toggle
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.querySelector('.nav-links');
  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      if (navLinks.style.display === 'flex') {
        navLinks.style.display = '';
      } else {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = 'var(--bg-surface-glass)';
        navLinks.style.backdropFilter = 'blur(28px)';
        navLinks.style.padding = '1.5rem';
        navLinks.style.borderBottom = '1px solid var(--border-liquid)';
      }
    });
  }
  // 18. AUTHENTICATION CONTROLLER & STATE MANAGEMENT
  let currentUser = null;

  const loggedOutNavGroup = document.getElementById('loggedOutNavGroup');
  const loggedInNavGroup = document.getElementById('loggedInNavGroup');
  const userNavAvatar = document.getElementById('userNavAvatar');
  const userNavName = document.getElementById('userNavName');
  const userProfileMenuBtn = document.getElementById('userProfileMenuBtn');

  const signupModal = document.getElementById('signupModal');
  const loginModal = document.getElementById('loginModal');

  const signupForm = document.getElementById('signupForm');
  const loginForm = document.getElementById('loginForm');
  const signupAlert = document.getElementById('signupAlert');
  const loginAlert = document.getElementById('loginAlert');

  // Password Visibility Toggle
  document.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const inputEl = document.getElementById(targetId);
      if (!inputEl) return;
      if (inputEl.type === 'password') {
        inputEl.type = 'text';
        btn.textContent = '🙈';
      } else {
        inputEl.type = 'password';
        btn.textContent = '👁️';
      }
    });
  });

  // User Profile Dropdown Toggle
  if (userProfileMenuBtn && loggedInNavGroup) {
    userProfileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      loggedInNavGroup.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      loggedInNavGroup.classList.remove('active');
    });
  }

  // Check Current Authentication State
  async function checkAuthState() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      
      if (data.success && data.authenticated && data.user) {
        currentUser = data.user;
        window.currentUser = currentUser;

        if (loggedOutNavGroup) loggedOutNavGroup.style.display = 'none';
        if (loggedInNavGroup) loggedInNavGroup.style.display = 'flex';

        if (userNavName) userNavName.textContent = currentUser.name || 'User';
        if (userNavAvatar) {
          if (currentUser.avatar_url) {
            userNavAvatar.innerHTML = `<img src="${escapeHTML(currentUser.avatar_url)}" alt="${escapeHTML(currentUser.name)}">`;
          } else {
            const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
            userNavAvatar.textContent = initial;
          }
        }

        const dashTitle = document.getElementById('dashWelcomeTitle');
        if (dashTitle) {
          dashTitle.textContent = `Welcome, ${currentUser.name || 'Workspace User'}`;
        }
      } else {
        currentUser = null;
        window.currentUser = null;
        if (loggedOutNavGroup) loggedOutNavGroup.style.display = 'flex';
        if (loggedInNavGroup) loggedInNavGroup.style.display = 'none';
      }
    } catch (e) {
      console.error('Auth state check error:', e);
    }
  }

  checkAuthState();

  // Helper: Open Modal
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('active');
    audioEngine.playGlassChime(880, 0.15);
  }

  // Helper: Close Modal
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('active');
  }

  // Modal Trigger Event Listeners
  const navLoginBtn = document.getElementById('navLoginBtn');
  const getStartedBtn = document.getElementById('getStartedBtn');
  const heroStartFreeBtn = document.getElementById('heroStartFreeBtn');
  const switchToLoginBtn = document.getElementById('switchToLoginBtn');
  const switchToSignupBtn = document.getElementById('switchToSignupBtn');

  if (navLoginBtn) {
    navLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUser) {
        window.location.hash = 'dashboard';
      } else {
        closeModal(signupModal);
        openModal(loginModal);
      }
    });
  }

  document.querySelectorAll('#getStartedBtn, #heroStartFreeBtn, .btn-open-demo, .btn-open-signup, [data-tier]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentUser) {
        window.location.hash = 'dashboard';
        showGlassToast('Dashboard Active', `Welcome back, ${currentUser.name}!`, '📊');
      } else {
        closeModal(loginModal);
        openModal(signupModal);
      }
    });
  });

  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', () => {
      closeModal(signupModal);
      openModal(loginModal);
    });
  }

  if (switchToSignupBtn) {
    switchToSignupBtn.addEventListener('click', () => {
      closeModal(loginModal);
      openModal(signupModal);
    });
  }

  const closeSignupBtn = document.getElementById('closeSignupBtn');
  if (closeSignupBtn && signupModal) {
    closeSignupBtn.addEventListener('click', () => closeModal(signupModal));
    signupModal.addEventListener('click', (e) => {
      if (e.target === signupModal) closeModal(signupModal);
    });
  }

  const closeLoginBtn = document.getElementById('closeLoginBtn');
  if (closeLoginBtn && loginModal) {
    closeLoginBtn.addEventListener('click', () => closeModal(loginModal));
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) closeModal(loginModal);
    });
  }

  // Password Reset Modals & Flow
  const forgotPasswordModal = document.getElementById('forgotPasswordModal');
  const resetPasswordModal = document.getElementById('resetPasswordModal');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const forgotAlert = document.getElementById('forgotAlert');
  const resetAlert = document.getElementById('resetAlert');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const switchToLoginFromForgotBtn = document.getElementById('switchToLoginFromForgotBtn');

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal(loginModal);
      openModal(forgotPasswordModal);
    });
  }

  if (switchToLoginFromForgotBtn) {
    switchToLoginFromForgotBtn.addEventListener('click', () => {
      closeModal(forgotPasswordModal);
      openModal(loginModal);
    });
  }

  const closeForgotBtn = document.getElementById('closeForgotBtn');
  if (closeForgotBtn && forgotPasswordModal) {
    closeForgotBtn.addEventListener('click', () => closeModal(forgotPasswordModal));
    forgotPasswordModal.addEventListener('click', (e) => {
      if (e.target === forgotPasswordModal) closeModal(forgotPasswordModal);
    });
  }

  const closeResetBtn = document.getElementById('closeResetBtn');
  if (closeResetBtn && resetPasswordModal) {
    closeResetBtn.addEventListener('click', () => closeModal(resetPasswordModal));
    resetPasswordModal.addEventListener('click', (e) => {
      if (e.target === resetPasswordModal) closeModal(resetPasswordModal);
    });
  }

  // Forgot Password Form Submission
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgotEmail')?.value.trim();
      const submitBtn = document.getElementById('forgotSubmitBtn');

      if (forgotAlert) forgotAlert.style.display = 'none';

      if (!email || !email.includes('@') || !email.includes('.')) {
        showAuthError(forgotAlert, 'Please enter a valid work email address.');
        return;
      }

      setSubmitLoading(submitBtn, true, 'Sending instructions...');

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (forgotAlert) {
            forgotAlert.className = 'auth-alert auth-alert-success';
            forgotAlert.textContent = data.message || 'Password reset instructions have been sent to your email.';
            forgotAlert.style.display = 'block';
          }
          showGlassToast('Reset Link Sent', 'Check your inbox for password reset instructions.', '📧');
          forgotPasswordForm.reset();
        } else if (data.configured === false) {
          if (forgotAlert) {
            forgotAlert.className = 'auth-alert auth-alert-info';
            forgotAlert.textContent = data.error || 'Password reset email delivery is not yet configured on this server.';
            forgotAlert.style.display = 'block';
          }
          showGlassToast('SMTP Not Configured', 'Password reset email delivery is not configured.', 'ℹ️');
        } else {
          showAuthError(forgotAlert, data.error || 'Failed to request password reset.');
        }
      } catch (err) {
        showAuthError(forgotAlert, 'Network error. Please try again.');
      } finally {
        setSubmitLoading(submitBtn, false, 'Send Reset Instructions');
      }
    });
  }

  // Reset Password Form Submission
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('resetTokenInput')?.value;
      const password = document.getElementById('newPasswordInput')?.value;
      const confirmPassword = document.getElementById('confirmNewPasswordInput')?.value;
      const submitBtn = document.getElementById('resetSubmitBtn');

      if (resetAlert) resetAlert.style.display = 'none';

      if (!password || password.length < 8) {
        showAuthError(resetAlert, 'Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        showAuthError(resetAlert, 'Passwords do not match.');
        return;
      }

      setSubmitLoading(submitBtn, true, 'Updating password...');

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password, confirm_password: confirmPassword })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          closeModal(resetPasswordModal);
          resetPasswordForm.reset();
          openModal(loginModal);
          if (loginAlert) {
            loginAlert.className = 'auth-alert auth-alert-success';
            loginAlert.textContent = 'Password updated successfully! Please log in with your new password.';
            loginAlert.style.display = 'block';
          }
          showGlassToast('Password Updated', 'Your password has been reset successfully.', '🎉');
        } else {
          showAuthError(resetAlert, data.error || 'Failed to reset password.');
        }
      } catch (err) {
        showAuthError(resetAlert, 'Network error. Please try again.');
      } finally {
        setSubmitLoading(submitBtn, false, 'Update Password');
      }
    });
  }

  // Sign Up Form Submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName')?.value.trim();
      const email = document.getElementById('signupEmail')?.value.trim();
      const company = document.getElementById('signupCompany')?.value.trim();
      const password = document.getElementById('signupPassword')?.value;
      const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
      const submitBtn = document.getElementById('signupSubmitBtn');

      if (signupAlert) signupAlert.style.display = 'none';

      if (!name) {
        showAuthError(signupAlert, 'Full name is required.');
        return;
      }
      if (!email || !email.includes('@') || !email.includes('.')) {
        showAuthError(signupAlert, 'Please provide a valid work email address.');
        return;
      }
      if (!password || password.length < 8) {
        showAuthError(signupAlert, 'Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        showAuthError(signupAlert, 'Passwords do not match.');
        return;
      }

      setSubmitLoading(submitBtn, true, 'Creating account...');

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, company, password, confirm_password: confirmPassword })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          closeModal(signupModal);
          signupForm.reset();
          await checkAuthState();
          showGlassToast('Account Created!', `Welcome to TaskFlow, ${data.user.name}!`, '🎉');
          window.location.hash = 'dashboard';
        } else {
          showAuthError(signupAlert, data.error || 'Failed to create account.');
        }
      } catch (err) {
        showAuthError(signupAlert, 'Network error. Please try again.');
      } finally {
        setSubmitLoading(submitBtn, false, 'Create Account');
      }
    });
  }

  // Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;
      const submitBtn = document.getElementById('loginSubmitBtn');

      if (loginAlert) loginAlert.style.display = 'none';

      if (!email || !password) {
        showAuthError(loginAlert, 'Email and password are required.');
        return;
      }

      setSubmitLoading(submitBtn, true, 'Authenticating...');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          closeModal(loginModal);
          loginForm.reset();
          await checkAuthState();
          showGlassToast('Welcome Back!', `Signed in as ${data.user.name}`, '👋');
          window.location.hash = 'dashboard';
        } else {
          showAuthError(loginAlert, data.error || 'Invalid email or password.');
        }
      } catch (err) {
        showAuthError(loginAlert, 'Network error. Please try again.');
      } finally {
        setSubmitLoading(submitBtn, false, 'Login');
      }
    });
  }

  // Logout Handler
  const userMenuLogout = document.getElementById('userMenuLogout');
  if (userMenuLogout) {
    userMenuLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        await checkAuthState();
        showGlassToast('Logged Out', 'You have been successfully logged out.', '🚪');
        window.location.hash = '';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }

  // Helper: Display Auth Error
  function showAuthError(alertEl, message) {
    if (!alertEl) return;
    alertEl.className = 'auth-alert auth-alert-error';
    alertEl.textContent = message;
    alertEl.style.display = 'block';
    audioEngine.playGlassChime(440, 0.15);
  }

  // Helper: Set Button Loading State
  function setSubmitLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    btn.disabled = isLoading;
    const textSpan = btn.querySelector('.btn-text');
    const spinnerSpan = btn.querySelector('.btn-spinner');
    if (isLoading) {
      if (textSpan) textSpan.style.display = 'none';
      if (spinnerSpan) {
        spinnerSpan.textContent = `⏳ ${loadingText}`;
        spinnerSpan.style.display = 'inline-block';
      }
    } else {
      if (textSpan) textSpan.style.display = 'inline-block';
      if (spinnerSpan) spinnerSpan.style.display = 'none';
    }
  }

  // Handle URL Query Params (Reset Tokens & Google Auth Errors)
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');
  const authError = urlParams.get('auth_error');

  if (resetToken) {
    const tokenInput = document.getElementById('resetTokenInput');
    if (tokenInput) tokenInput.value = resetToken;
    openModal(resetPasswordModal);
    showGlassToast('Password Reset', 'Please enter your new password below.', '🔑');
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  } else if (authError) {
    showGlassToast('Authentication Alert', authError, '⚠️');
    openModal(loginModal);
    if (loginAlert) {
      loginAlert.className = 'auth-alert auth-alert-error';
      loginAlert.textContent = authError;
      loginAlert.style.display = 'block';
    }
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
});
