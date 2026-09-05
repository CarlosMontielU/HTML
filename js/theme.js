window.Playground = window.Playground || {};

window.Playground.ThemeManager = class ThemeManager {
  constructor(onConfigChange) {
    this.config = window.Playground.storage.loadConfig();
    this.onConfigChange = onConfigChange;
  }

  applyConfig() {
    const { THEMES } = window.Playground;
    const t = THEMES[this.config.theme] || THEMES.violet;
    const docEl = document.documentElement;

    docEl.style.setProperty('--primary', t.primary);
    docEl.style.setProperty('--primary-hover', t.primaryHover);
    docEl.style.setProperty('--accent', t.accent);
    docEl.style.setProperty('--accent-tag', `${t.accent}14`);
    docEl.style.setProperty('--accent-tag-border', `${t.accent}33`);
    docEl.style.setProperty('--card-rgb', t.cardRgb);
    docEl.style.setProperty('--theme-soft-bg', `${t.primary}1f`);
    docEl.style.setProperty('--theme-soft-border', `${t.primary}4d`);
    docEl.style.setProperty('--theme-soft-text', t.accent);
    docEl.style.setProperty('--card-opacity', this.config.opacity);

    this.syncUI();
  }

  // En js/theme.js
  syncUI() {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setVal('slider-opacity', this.config.opacity);
    setText('label-opacity', `${Math.round(this.config.opacity * 100)}%`);

    setVal('slider-star-density', this.config.starDensity);
    setText('label-star-density', `${this.config.starDensity.toFixed(1)}x`);

    setVal('slider-star-speed', this.config.starSpeed);
    setText('label-star-speed', `${this.config.starSpeed.toFixed(1)}x`);

    setVal('slider-star-size', this.config.starSize);
    setText('label-star-size', `${this.config.starSize.toFixed(1)}x`);

    this.renderThemeButtons();
  }

  renderThemeButtons() {
    const { THEMES } = window.Playground;
    const container = document.getElementById('theme-buttons');
    container.innerHTML = '';
    Object.keys(THEMES).forEach(k => {
      const item = THEMES[k];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `theme-btn ${this.config.theme === k ? 'active' : ''}`;
      btn.innerHTML = `<span class="theme-swatch" style="background: ${item.color};"></span><span>${item.name}</span>`;
      btn.addEventListener('click', () => {
        this.config.theme = k;
        this.saveAndNotify();
      });
      container.appendChild(btn);
    });
  }

  saveAndNotify() {
    window.Playground.storage.saveConfig(this.config);
    this.applyConfig();
    if (this.onConfigChange) this.onConfigChange(this.config);
  }
};