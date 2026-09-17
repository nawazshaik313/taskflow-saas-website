/**
 * PULSEFLOW AI - HERO DASHBOARD REAL-TIME CANVAS CHART
 */

class DashboardChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.dataPoints = [35, 42, 58, 49, 72, 68, 89, 95, 110, 105, 134, 142];
    this.labels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Periodically update last data point to simulate real-time live activity
    setInterval(() => this.simulateLivePulse(), 2500);
    this.render();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
    this.render();
  }

  simulateLivePulse() {
    const last = this.dataPoints[this.dataPoints.length - 1];
    const variation = Math.floor(Math.random() * 15) - 6;
    const nextVal = Math.min(160, Math.max(110, last + variation));
    
    this.dataPoints.shift();
    this.dataPoints.push(nextVal);
    
    // Update live counter badge in hero mockup
    const liveCounterEl = document.getElementById('liveTaskCounter');
    if (liveCounterEl) {
      liveCounterEl.textContent = (nextVal * 12).toLocaleString() + ' tasks/min';
    }

    this.render();
  }

  render() {
    if (!this.ctx || !this.width || !this.height) return;
    const ctx = this.ctx;
    const padding = 20;
    const w = this.width - padding * 2;
    const h = this.height - padding * 2;
    
    ctx.clearRect(0, 0, this.width, this.height);

    const maxVal = Math.max(...this.dataPoints) * 1.15;
    const minVal = Math.min(...this.dataPoints) * 0.85;

    const getX = (i) => padding + (i / (this.dataPoints.length - 1)) * w;
    const getY = (val) => padding + h - ((val - minVal) / (maxVal - minVal)) * h;

    // Gradient Fill under area
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gradientFill = ctx.createLinearGradient(0, padding, 0, padding + h);
    if (isDark) {
      gradientFill.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
      gradientFill.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
    } else {
      gradientFill.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
      gradientFill.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
    }

    // Draw Smooth Curve Area
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(this.dataPoints[0]));
    
    for (let i = 0; i < this.dataPoints.length - 1; i++) {
      const x1 = getX(i);
      const y1 = getY(this.dataPoints[i]);
      const x2 = getX(i + 1);
      const y2 = getY(this.dataPoints[i + 1]);
      const cpX = (x1 + x2) / 2;
      ctx.bezierCurveTo(cpX, y1, cpX, y2, x2, y2);
    }

    ctx.lineTo(getX(this.dataPoints.length - 1), padding + h);
    ctx.lineTo(getX(0), padding + h);
    ctx.closePath();
    ctx.fillStyle = gradientFill;
    ctx.fill();

    // Draw Main Gradient Stroke Line
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(this.dataPoints[0]));
    for (let i = 0; i < this.dataPoints.length - 1; i++) {
      const x1 = getX(i);
      const y1 = getY(this.dataPoints[i]);
      const x2 = getX(i + 1);
      const y2 = getY(this.dataPoints[i + 1]);
      const cpX = (x1 + x2) / 2;
      ctx.bezierCurveTo(cpX, y1, cpX, y2, x2, y2);
    }
    
    const lineGradient = ctx.createLinearGradient(0, 0, this.width, 0);
    lineGradient.addColorStop(0, '#6366F1');
    lineGradient.addColorStop(1, '#06B6D4');
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Glowing Active Endpoint Dot
    const lastX = getX(this.dataPoints.length - 1);
    const lastY = getY(this.dataPoints[this.dataPoints.length - 1]);
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#06B6D4';
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0; // Reset
  }
}

window.DashboardChart = DashboardChart;
