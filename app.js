/* ============================================================
   QR Generator – Gaceta Universitaria UNACH
   app.js – Main application logic
   ============================================================ */

// ─── State ───────────────────────────────────────────────────
let logoImage = null;        // HTMLImageElement for the logo
let qrGenerated = false;     // Whether a QR has been generated

// ─── DOM refs ────────────────────────────────────────────────
const qrText = () => document.getElementById('qr-text').value.trim();
const qrSizeEl = document.getElementById('qr-size');
const errorLevelEl = document.getElementById('error-level');
const colorDarkEl = document.getElementById('color-dark');
const colorLightEl = document.getElementById('color-light');
const colorLogoBgEl = document.getElementById('color-logo-bg');
const colorLogoBorderEl = document.getElementById('color-logo-border');
const logoSizeEl = document.getElementById('logo-size');
const logoPadEl = document.getElementById('logo-padding');
const logoRadEl = document.getElementById('logo-radius');
const showLogoEl = document.getElementById('show-logo');
const logoUrlEl = document.getElementById('logo-url');
const finalCanvas = document.getElementById('qr-final-canvas');
const placeholder = document.getElementById('qr-placeholder');
const previewMeta = document.getElementById('preview-meta');
const btnDownload = document.getElementById('btn-download');
const btnGenerate = document.getElementById('btn-generate');

// ─── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  setupRangeListeners();
  setupColorListeners();
  setupUIColorListeners();
  loadLogoFromUrl(logoUrlEl.value);
});

// ─── Range sliders ────────────────────────────────────────────
function setupRangeListeners() {
  const ranges = [
    { el: qrSizeEl, out: 'qr-size-val', suffix: 'px' },
    { el: logoSizeEl, out: 'logo-size-val', suffix: '%' },
    { el: logoPadEl, out: 'logo-padding-val', suffix: 'px' },
    { el: logoRadEl, out: 'logo-radius-val', suffix: 'px' },
  ];
  ranges.forEach(({ el, out, suffix }) => {
    const display = document.getElementById(out);
    const update = () => {
      display.textContent = el.value + suffix;
      updateRangeBackground(el);
    };
    el.addEventListener('input', update);
    update();
  });
}

function updateRangeBackground(el) {
  const min = +el.min, max = +el.max, val = +el.value;
  const pct = ((val - min) / (max - min)) * 100;
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent').trim() || '#1a237e';
  el.style.background = `linear-gradient(to right, ${accent} ${pct}%, rgba(26,35,126,0.15) ${pct}%)`;
}

// ─── Color pickers ────────────────────────────────────────────
function setupColorListeners() {
  const pairs = [
    { input: colorDarkEl, hex: 'color-dark-hex' },
    { input: colorLightEl, hex: 'color-light-hex' },
    { input: colorLogoBgEl, hex: 'color-logo-bg-hex' },
    { input: colorLogoBorderEl, hex: 'color-logo-border-hex' },
  ];
  pairs.forEach(({ input, hex }) => {
    const display = document.getElementById(hex);
    input.addEventListener('input', () => {
      display.textContent = input.value;
    });
  });
}

// ─── UI color customization ───────────────────────────────────
function setupUIColorListeners() {
  const accentEl = document.getElementById('ui-accent');
  const textEl = document.getElementById('ui-text');
  const accentHex = document.getElementById('ui-accent-hex');
  const textHex = document.getElementById('ui-text-hex');

  accentEl.addEventListener('input', () => {
    const val = accentEl.value;
    accentHex.textContent = val;
    document.documentElement.style.setProperty('--accent', val);
    // Derive a lighter accent
    document.documentElement.style.setProperty('--accent-light', val);
    document.documentElement.style.setProperty('--accent-glow', hexToRgba(val, 0.25));
    document.documentElement.style.setProperty('--border', hexToRgba(val, 0.18));
    // Update all range backgrounds
    document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);
  });

  textEl.addEventListener('input', () => {
    const val = textEl.value;
    textHex.textContent = val;
    document.documentElement.style.setProperty('--text', val);
  });
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Logo loading ─────────────────────────────────────────────
// Routes external URLs through the local /proxy endpoint so the server
// fetches the image (no browser CORS restrictions apply server-side).
// For data: URLs or same-origin paths, loads directly.
async function loadLogoFromUrl(src) {
  if (!src) return;

  // Update header preview (img tags are not subject to canvas CORS taint)
  document.getElementById('header-logo-img').src = src;

  // Determine the URL to actually fetch
  let fetchUrl = src;
  const isExternal = /^https?:\/\//i.test(src) &&
    !src.startsWith(window.location.origin);

  if (isExternal) {
    // Route through our local proxy to avoid CORS
    fetchUrl = `/proxy?url=${encodeURIComponent(src)}`;
  }

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Empty response');
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      logoImage = null;
      showToast('⚠️ No se pudo cargar el logo. Usa "Archivo local".');
    };
    img.src = objectUrl;
  } catch (err) {
    console.warn('[logo] fetch failed:', err.message);
    logoImage = null;
    showToast('⚠️ No se pudo cargar el logo desde la URL. Usa "Archivo local".');
  }
}

function applyLogoUrl() {
  const url = logoUrlEl.value.trim();
  if (!url) return;
  logoImage = null;
  loadLogoFromUrl(url);
}

function loadLogoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => { logoImage = img; };
    img.src = e.target.result;
    document.getElementById('header-logo-img').src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function switchLogoTab(tab) {
  document.getElementById('logo-url-panel').classList.toggle('hidden', tab !== 'url');
  document.getElementById('logo-file-panel').classList.toggle('hidden', tab !== 'file');
  document.getElementById('tab-url').classList.toggle('active', tab === 'url');
  document.getElementById('tab-file').classList.toggle('active', tab === 'file');
}

// ─── QR Generation ───────────────────────────────────────────
function generateQR() {
  const text = qrText();
  if (!text) {
    showToast('⚠️ Ingresa un texto o URL para generar el QR.');
    return;
  }

  // Show loading state
  btnGenerate.innerHTML = '<span class="generating">⚙️</span> Generando…';
  btnGenerate.disabled = true;

  // Small delay to let UI update
  setTimeout(() => {
    try {
      _doGenerate(text);
    } catch (e) {
      console.error(e);
      showToast('❌ Error al generar el QR. Intenta de nuevo.');
    } finally {
      btnGenerate.innerHTML = '<span>⚡</span> Generar QR';
      btnGenerate.disabled = false;
    }
  }, 50);
}

function _doGenerate(text) {
  const size = parseInt(qrSizeEl.value);
  const errLevel = errorLevelEl.value;
  const darkColor = colorDarkEl.value;
  const lightColor = colorLightEl.value;

  // Clear temp container
  const tempDiv = document.getElementById('qr-temp');
  tempDiv.innerHTML = '';

  // Generate QR into a temporary canvas via QRCode.js
  const qr = new QRCode(tempDiv, {
    text: text,
    width: size,
    height: size,
    colorDark: darkColor,
    colorLight: lightColor,
    correctLevel: QRCode.CorrectLevel[errLevel],
  });

  // QRCode.js renders asynchronously (it creates an img tag)
  // We wait for the img to load then composite
  setTimeout(() => {
    const qrImg = tempDiv.querySelector('img') || tempDiv.querySelector('canvas');
    if (!qrImg) {
      showToast('❌ No se pudo generar el QR.');
      return;
    }

    const compositeCanvas = finalCanvas;
    compositeCanvas.width = size;
    compositeCanvas.height = size;
    const ctx = compositeCanvas.getContext('2d');

    // Draw QR
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(qrImg, 0, 0, size, size);

    // Overlay logo if enabled
    if (showLogoEl.checked && logoImage) {
      drawLogoOverlay(ctx, size);
    }

    // Show canvas, hide placeholder
    placeholder.style.display = 'none';
    compositeCanvas.style.display = 'block';

    // Update meta
    previewMeta.style.display = 'flex';
    document.getElementById('meta-size').textContent = `${size} × ${size} px`;
    document.getElementById('meta-level').textContent = `Corrección: ${errLevel}`;

    // Enable download
    btnDownload.disabled = false;
    qrGenerated = true;

    showToast('✅ ¡Código QR generado!');
  }, 300);
}

function drawLogoOverlay(ctx, qrSize) {
  const logoPct = parseInt(logoSizeEl.value) / 100;
  const padding = parseInt(logoPadEl.value);
  const radius = parseInt(logoRadEl.value);
  const bgColor = colorLogoBgEl.value;
  const borderColor = colorLogoBorderEl.value;

  const logoSize = Math.round(qrSize * logoPct);
  const boxSize = logoSize + padding * 2;
  const x = Math.round((qrSize - boxSize) / 2);
  const y = Math.round((qrSize - boxSize) / 2);

  // Draw background box with rounded corners
  ctx.save();
  roundRect(ctx, x, y, boxSize, boxSize, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // Draw logo image clipped to rounded rect
  ctx.save();
  roundRect(ctx, x + padding, y + padding, logoSize, logoSize, Math.max(0, radius - padding));
  ctx.clip();
  ctx.drawImage(logoImage, x + padding, y + padding, logoSize, logoSize);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Download ─────────────────────────────────────────────────
function downloadQR() {
  if (!qrGenerated) return;
  const filename = (document.getElementById('export-filename').value.trim() || 'qr-gaceta-unach') + '.png';
  const link = document.createElement('a');
  link.download = filename;
  link.href = finalCanvas.toDataURL('image/png');
  link.click();
}

// ─── Preset Themes ────────────────────────────────────────────
const themes = {
  institucional: {
    dark: '#1a237e', light: '#ffffff',
    logoBg: '#ffffff', logoBorder: '#1a237e',
    accent: '#1a237e', text: '#1e293b',
  },
  dorado: {
    dark: '#b8860b', light: '#fffde7',
    logoBg: '#fffde7', logoBorder: '#b8860b',
    accent: '#b8860b', text: '#3e2723',
  },
  verde: {
    dark: '#1b5e20', light: '#f1f8e9',
    logoBg: '#f1f8e9', logoBorder: '#1b5e20',
    accent: '#1b5e20', text: '#1b5e20',
  },
  oscuro: {
    dark: '#e0e0e0', light: '#121212',
    logoBg: '#1e1e1e', logoBorder: '#e0e0e0',
    accent: '#90caf9', text: '#e0e0e0',
  },
  rojo: {
    dark: '#b71c1c', light: '#fff8f8',
    logoBg: '#fff8f8', logoBorder: '#b71c1c',
    accent: '#b71c1c', text: '#3e0000',
  },
  morado: {
    dark: '#4a148c', light: '#f3e5f5',
    logoBg: '#f3e5f5', logoBorder: '#4a148c',
    accent: '#4a148c', text: '#1a0033',
  },
};

function applyTheme(name) {
  const t = themes[name];
  if (!t) return;

  // QR colors
  colorDarkEl.value = t.dark;
  colorLightEl.value = t.light;
  colorLogoBgEl.value = t.logoBg;
  colorLogoBorderEl.value = t.logoBorder;
  document.getElementById('color-dark-hex').textContent = t.dark;
  document.getElementById('color-light-hex').textContent = t.light;
  document.getElementById('color-logo-bg-hex').textContent = t.logoBg;
  document.getElementById('color-logo-border-hex').textContent = t.logoBorder;

  // UI colors
  document.getElementById('ui-accent').value = t.accent;
  document.getElementById('ui-text').value = t.text;
  document.getElementById('ui-accent-hex').textContent = t.accent;
  document.getElementById('ui-text-hex').textContent = t.text;

  // Apply CSS vars
  document.documentElement.style.setProperty('--accent', t.accent);
  document.documentElement.style.setProperty('--accent-light', t.accent);
  document.documentElement.style.setProperty('--accent-glow', hexToRgba(t.accent, 0.25));
  document.documentElement.style.setProperty('--border', hexToRgba(t.accent, 0.18));
  document.documentElement.style.setProperty('--text', t.text);

  // Update range backgrounds
  document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);

  showToast(`🎨 Tema "${name}" aplicado`);
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(message) {
  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: rgba(15, 23, 42, 0.92);
    color: white;
    padding: 12px 24px;
    border-radius: 50px;
    font-size: 0.88rem;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    z-index: 9999;
    backdrop-filter: blur(12px);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ─── Keyboard shortcut ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    generateQR();
  }
});
