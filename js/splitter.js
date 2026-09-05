window.Playground = window.Playground || {};

window.Playground.WorkspaceSplitter = class WorkspaceSplitter {
  constructor() {
    this.container = document.getElementById('split-workspace');
    this.g1 = document.getElementById('gutter-1');
    this.g2 = document.getElementById('gutter-2');
    this.p1 = document.getElementById('panel-features');
    this.p2 = document.getElementById('panel-timeline');
    this.p3 = document.getElementById('panel-notes');
    this.percentages = window.Playground.storage.loadSplitPercentages();

    this.init();
  }

  init() {
    if (!this.container || !this.g1 || !this.g2) return;
    this.bindGutter(this.g1, this.p1, this.p2);
    this.bindGutter(this.g2, this.p2, this.p3);
    this.applyWidths();
    window.addEventListener('resize', () => this.applyWidths());
  }

  applyWidths() {
    if (window.innerWidth <= 1080) {
      this.p1.style.width = '';
      this.p2.style.width = '';
      this.p3.style.width = '';
      return;
    }
    // Compensación exacta de los 16px (2 divisores de 8px) para evitar overflow horizontal
    this.p1.style.width = `calc(${this.percentages[0]}% - ${(16 * this.percentages[0]) / 100}px)`;
    this.p2.style.width = `calc(${this.percentages[1]}% - ${(16 * this.percentages[1]) / 100}px)`;
    this.p3.style.width = `calc(${this.percentages[2]}% - ${(16 * this.percentages[2]) / 100}px)`;
  }

  bindGutter(gutter, leftPanel, rightPanel) {
    let isDragging = false;
    let startX = 0, startLeftW = 0, totalPairW = 0;

    gutter.addEventListener('pointerdown', (e) => {
      isDragging = true;
      gutter.setPointerCapture(e.pointerId);
      gutter.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      startX = e.clientX;
      startLeftW = leftPanel.getBoundingClientRect().width;
      const startRightW = rightPanel.getBoundingClientRect().width;
      totalPairW = startLeftW + startRightW;
    });

    gutter.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const minPx = 100;
      const newLeftW = Math.min(Math.max(minPx, startLeftW + dx), totalPairW - minPx);
      const newRightW = totalPairW - newLeftW;
      leftPanel.style.width = `${newLeftW}px`;
      rightPanel.style.width = `${newRightW}px`;
    });

    const stopDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      try { gutter.releasePointerCapture(e.pointerId); } catch (err) {}
      gutter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const containerWidth = this.container.getBoundingClientRect().width - 16;
      if (containerWidth > 0) {
        const w1 = this.p1.getBoundingClientRect().width;
        const w2 = this.p2.getBoundingClientRect().width;
        const w3 = this.p3.getBoundingClientRect().width;

        this.percentages[0] = (w1 / containerWidth) * 100;
        this.percentages[1] = (w2 / containerWidth) * 100;
        this.percentages[2] = (w3 / containerWidth) * 100;

        const sum = this.percentages[0] + this.percentages[1] + this.percentages[2];
        this.percentages = this.percentages.map(v => (v / sum) * 100);

        window.Playground.storage.saveSplitPercentages(this.percentages);
      }
      this.applyWidths();
    };

    gutter.addEventListener('pointerup', stopDrag);
    gutter.addEventListener('pointercancel', stopDrag);
  }
};