/* ============================================================
   QR Generator – Gaceta Universitaria UNACH
   app.js – Main application logic
   ============================================================ */

// ─── State ───────────────────────────────────────────────────
let logoImage = null;        // HTMLImageElement for the logo
let qrGenerated = false;     // Whether a QR has been generated
let serverAvailable = false; // Whether the local proxy server is reachable

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
window.addEventListener('DOMContentLoaded', async () => {
  setupRangeListeners();
  setupColorListeners();
  setupUIColorListeners();
  setupDropZone();
  setupRemoveLogo();
  checkServerHealth(); // Keep it for badge status, though less critical now
});

// ─── Server Health Check ──────────────────────────────────────
// Detects if the app is running through node server.js (localhost)
// or opened directly as a file. The proxy only works in the first case.
async function checkServerHealth() {
  const badge = document.getElementById('server-badge');
  if (!badge) return;

  // If we're not on http/https, we're definitely not served by node
  if (!window.location.protocol.startsWith('http')) {
    serverAvailable = false;
    badge.textContent = '🔴 Sin servidor';
    badge.title = 'Abre la app con: node server.js → http://localhost:3030';
    badge.classList.add('badge-offline');
    return;
  }

  try {
    // Probe the proxy endpoint with a dummy request (will return 400, but that
    // means the server IS running — a network error means it's not)
    const res = await fetch('/proxy?url=', { signal: AbortSignal.timeout(2000) });
    // Any HTTP response (even 400 Bad Request) means the server is up
    serverAvailable = true;
    badge.textContent = '🟢 Servidor activo';
    badge.title = 'El proxy CORS está disponible. Las URLs de logo funcionarán.';
    badge.classList.add('badge-online');
  } catch {
    serverAvailable = false;
    badge.textContent = '🔴 Sin servidor';
    badge.title = 'Inicia el servidor con: node server.js → http://localhost:3030';
    badge.classList.add('badge-offline');
  }
}

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
    document.documentElement.style.setProperty('--accent-light', val);
    document.documentElement.style.setProperty('--accent-glow', hexToRgba(val, 0.25));
    document.documentElement.style.setProperty('--border', hexToRgba(val, 0.18));
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

// ─── Logo Handling (Drag & Drop) ─────────────────────────────
function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('logo-file');

  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length) {
      handleLogoFile(fileInput.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => {
      dropZone.classList.remove('drop-zone--over');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');

    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleLogoFile(e.dataTransfer.files[0]);
    }
  });
}

function handleLogoFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('⚠️ Por favor, selecciona un archivo de imagen.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      updateLogoPreview(e.target.result);
      showToast('✅ Logo cargado correctamente.');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateLogoPreview(src) {
  const previewStrip = document.getElementById('logo-preview-strip');
  const miniPreview = document.getElementById('mini-logo-preview');
  const dropZone = document.getElementById('drop-zone');
  const headerLogo = document.getElementById('header-logo-img');

  miniPreview.src = src;
  headerLogo.src = src;
  previewStrip.classList.remove('hidden');
  dropZone.classList.add('hidden');
}

function setupRemoveLogo() {
  const btnRemove = document.getElementById('btn-remove-logo');
  btnRemove.addEventListener('click', () => {
    logoImage = null;
    document.getElementById('logo-preview-strip').classList.add('hidden');
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('logo-file').value = '';
    // Optional: revert header logo to default
    document.getElementById('header-logo-img').src = 'https://gaceta.unach.mx/images/headers/escudogaceta.jpg';
    showToast('🗑️ Logo eliminado.');
  });
}

// Logic for old tab switching and URL loading removed as per UX redesign

// ─── QR Generation ───────────────────────────────────────────
function generateQR() {
  const text = qrText();
  if (!text) {
    showToast('⚠️ Ingresa un texto o URL para generar el QR.');
    return;
  }

  btnGenerate.innerHTML = '<span class="generating">⚙️</span> Generando…';
  btnGenerate.disabled = true;

  // Use a small delay to let the UI repaint before heavy work
  setTimeout(() => {
    try {
      _doGenerate(text);
    } catch (e) {
      console.error(e);
      showToast('❌ Error al generar el QR. Intenta de nuevo.');
      btnGenerate.innerHTML = '<span>⚡</span> Generar QR';
      btnGenerate.disabled = false;
    }
  }, 50);
}

function _doGenerate(text) {
  const size = parseInt(qrSizeEl.value);
  const errLevel = errorLevelEl.value;
  const darkColor = colorDarkEl.value.replace('#', '');
  const lightColor = colorLightEl.value.replace('#', '');

  // GoQR.me API URL
  const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${darkColor}&bgcolor=${lightColor}&ecc=${errLevel}`;

  const qrImg = new Image();
  qrImg.crossOrigin = 'anonymous'; // Important for canvas drawing

  qrImg.onload = () => {
    onQRReady(qrImg);
  };

  qrImg.onerror = () => {
    showToast('❌ Error al obtener el QR de la API. Revisa tu conexión.');
    btnGenerate.innerHTML = '<span>⚡</span> Generar QR';
    btnGenerate.disabled = false;
  };

  qrImg.src = apiUrl;

  function onQRReady(img) {
    const compositeCanvas = finalCanvas;
    compositeCanvas.width = size;
    compositeCanvas.height = size;
    const ctx = compositeCanvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    if (showLogoEl.checked && logoImage) {
      try {
        drawLogoOverlay(ctx, size);
      } catch (canvasErr) {
        console.warn('[canvas] Tainted by cross-origin image:', canvasErr.message);
        showToast('⚠️ Logo omitido: imagen con restricciones CORS. Usa el servidor.');
        // Redraw only the QR if logo fails due to CORS
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
      }
    }

    placeholder.style.display = 'none';
    compositeCanvas.style.display = 'block';

    previewMeta.style.display = 'flex';
    document.getElementById('meta-size').textContent = `${size} × ${size} px`;
    document.getElementById('meta-level').textContent = `Corrección: ${errLevel}`;

    btnDownload.disabled = false;
    qrGenerated = true;

    btnGenerate.innerHTML = '<span>⚡</span> Generar QR';
    btnGenerate.disabled = false;

    showToast('✅ ¡Código QR generado!');
  }
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

  ctx.save();
  roundRect(ctx, x, y, boxSize, boxSize, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

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

  colorDarkEl.value = t.dark;
  colorLightEl.value = t.light;
  colorLogoBgEl.value = t.logoBg;
  colorLogoBorderEl.value = t.logoBorder;
  document.getElementById('color-dark-hex').textContent = t.dark;
  document.getElementById('color-light-hex').textContent = t.light;
  document.getElementById('color-logo-bg-hex').textContent = t.logoBg;
  document.getElementById('color-logo-border-hex').textContent = t.logoBorder;

  document.getElementById('ui-accent').value = t.accent;
  document.getElementById('ui-text').value = t.text;
  document.getElementById('ui-accent-hex').textContent = t.accent;
  document.getElementById('ui-text-hex').textContent = t.text;

  document.documentElement.style.setProperty('--accent', t.accent);
  document.documentElement.style.setProperty('--accent-light', t.accent);
  document.documentElement.style.setProperty('--accent-glow', hexToRgba(t.accent, 0.25));
  document.documentElement.style.setProperty('--border', hexToRgba(t.accent, 0.18));
  document.documentElement.style.setProperty('--text', t.text);

  document.querySelectorAll('input[type="range"]').forEach(updateRangeBackground);

  showToast(`🎨 Tema "${name}" aplicado`);
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(message, duration = 2800) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger entrance animation on next frame
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hidden');
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ─── Keyboard shortcut ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    generateQR();
  }
});
