window.Playground = window.Playground || {};

window.Playground.SpaceBackground = class SpaceBackground {
  constructor(canvasElement, getConfig) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.getConfig = getConfig;
    this.stars = [];
    this.shootingStars = [];
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => this.handleVisibility());
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.fov = this.height * 0.8;
    this.maxDepth = Math.max(this.width, this.height) * 1.5;
    this.initStars();
  }

  initStars() {
    this.stars = [];
    const config = this.getConfig();
    const baseDensity = Math.floor((this.width * this.height) / 2800);
    const count = Math.floor(baseDensity * (config.starDensity || 1.0));

    for (let i = 0; i < count; i++) {
      this.stars.push(this.createStar(true));
    }
  }

  createStar(randomZ = false) {
    const spread = this.maxDepth;
    const initialZ = randomZ ? Math.random() * this.maxDepth : this.maxDepth;
    return {
      x: (Math.random() - 0.5) * spread * 2,
      y: (Math.random() - 0.5) * spread * 2,
      z: initialZ,
      prevZ: initialZ,
      baseSize: Math.random() * 1.2 + 0.8
    };
  }

  spawnShootingStar() {
    const config = this.getConfig();
    if (Math.random() < 0.006 && this.shootingStars.length < 2) {
      this.shootingStars.push({
        x: Math.random() * this.width * 0.8,
        y: Math.random() * this.height * 0.4,
        len: Math.random() * 70 + 40,
        speed: (Math.random() * 8 + 6) * (config.starSpeed || 1.0) * 1.5,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
        alpha: 0.9
      });
    }
  }

  animate() {
    const config = this.getConfig();
    const { THEMES } = window.Playground;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Fondo degradado
    const activeTheme = (THEMES && THEMES[config.theme]) || (THEMES && THEMES.violet) || {
      bgGradient: ['#0a0814', '#040207', '#000000']
    };

    const cx = this.width / 2;
    const cy = this.height / 2;

    const bgGrad = this.ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(cx, cy));
    bgGrad.addColorStop(0, activeTheme.bgGradient[0]);
    bgGrad.addColorStop(0.6, activeTheme.bgGradient[1]);
    bgGrad.addColorStop(1, activeTheme.bgGradient[2]);
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const speedFactor = (config.starSpeed || 1.0) * 1.0;
    const sizeFactor = config.starSize || 1.0;

    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];

      s.prevZ = s.z;
      s.z -= speedFactor;

      // Proyección perspectiva actual
      const k = this.fov / Math.max(0.1, s.z);
      const x = cx + s.x * k;
      const y = cy + s.y * k;

      // Reaparecer al fondo si rebasa la pantalla o pasa la cámara
      if (s.z <= 1 || x < 0 || x > this.width || y < 0 || y > this.height) {
        this.stars[i] = this.createStar(false);
        continue;
      }

      // Proyección perspectiva anterior
      const prevK = this.fov / Math.max(0.1, s.prevZ);
      const px = cx + s.x * prevK;
      const py = cy + s.y * prevK;

      const depthProgress = 1 - (s.z / this.maxDepth);
      const radius = Math.max(0.4, (s.baseSize * k * 0.5) * sizeFactor);
      const alpha = Math.min(1, Math.max(0.1, depthProgress * 1.5));

      this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;

      const dist = Math.hypot(x - px, y - py);
      if (dist > 0.8) {
        this.ctx.lineWidth = radius * 1.8;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(px, py);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Estrellas fugaces
    this.spawnShootingStar();
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i];
      const endX = ss.x - Math.cos(ss.angle) * ss.len;
      const endY = ss.y - Math.sin(ss.angle) * ss.len;

      const grad = this.ctx.createLinearGradient(ss.x, ss.y, endX, endY);
      grad.addColorStop(0, `rgba(186, 230, 253, ${ss.alpha})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = 1.2 * sizeFactor;
      this.ctx.beginPath();
      this.ctx.moveTo(ss.x, ss.y);
      this.ctx.lineTo(endX, endY);
      this.ctx.stroke();

      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;
      ss.alpha -= 0.02;
      if (ss.alpha <= 0) this.shootingStars.splice(i, 1);
    }

    if (!document.hidden) {
      this.animationFrameId = requestAnimationFrame(() => this.animate());
    }
  }

  handleVisibility() {
    if (!document.hidden) {
      cancelAnimationFrame(this.animationFrameId);
      this.animate();
    } else {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
};