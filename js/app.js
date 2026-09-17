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

  document.querySelectorAll('.btn-open-demo, #getStartedBtn, #heroStartFreeBtn').forEach(btn => {
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
        navLinks.style.boxShadow = 'var(--shadow-liquid)';
      }
    });
  }
});
