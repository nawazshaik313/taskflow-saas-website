/**
 * TASKFLOW - THEME CONTROLLER WITH BACKEND PERSISTENCE
 */

class ThemeController {
  constructor() {
    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.initThemeBackend();
  }

  async initThemeBackend() {
    let currentTheme = localStorage.getItem('taskflow_theme') || 'light';

    // Try fetching user preference from SQLite backend
    try {
      const res = await fetch('/api/user/preferences');
      const data = await res.json();
      if (data.success && data.preferences && data.preferences.theme_mode) {
        currentTheme = data.preferences.theme_mode;
      }
    } catch (e) {
      // Local fallback
    }

    this.applyTheme(currentTheme);

    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', async () => {
        const activeTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
        
        this.applyTheme(nextTheme);

        // Sync with SQLite backend
        try {
          await fetch('/api/user/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme_mode: nextTheme })
          });
        } catch (e) {
          // Local fallback
        }
      });
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow_theme', theme);
    this.updateIcon(theme);

    if (window.heroChartInstance) {
      window.heroChartInstance.render();
    }
  }

  updateIcon(theme) {
    if (!this.themeToggleBtn) return;
    this.themeToggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
  }
}

window.ThemeController = ThemeController;
