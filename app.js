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
  await checkServerHealth();
  loadLogoFromUrl(logoUrlEl.value);
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

// ─── Logo loading ─────────────────────────────────────────────
// Strategy:
//  1. If the image is a data: URL or same-origin → load directly.
//  2. If the server is available → route through /proxy (bypasses CORS).
//  3. If the server is NOT available → try loading the image directly with
//     crossOrigin="anonymous" as a last resort (works only if the remote
//     server sends Access-Control-Allow-Origin: *).
//  In all failure cases, a clear, actionable error message is shown.
async function loadLogoFromUrl(src) {
  if (!src) return;

  // Update header preview (img tags are not subject to canvas CORS taint)
  document.getElementById('header-logo-img').src = src;

  const isDataUrl = src.startsWith('data:');
  const isExternal = /^https?:\/\//i.test(src) &&
    !src.startsWith(window.location.origin) &&
    !isDataUrl;

  // ── Case 1: data: URL or same-origin ──────────────────────
  if (!isExternal || isDataUrl) {
    return _loadImageDirect(src);
  }

  // ── Case 2: External URL with server available (use proxy) ─
  if (serverAvailable) {
    const proxyUrl = `/proxy?url=${encodeURIComponent(src)}`;
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Empty response');
      return _loadImageFromBlob(blob);
    } catch (err) {
      console.warn('[logo] proxy fetch failed:', err.message);
      showToast('⚠️ Error al cargar la imagen desde el proxy. Verifica la URL.');
      logoImage = null;
      return;
    }
  }

  // ── Case 3: No server → try direct load with CORS ──────────
  console.info('[logo] No server detected, trying direct crossOrigin load…');
  try {
    await _loadImageDirect(src, true /* crossOrigin */);
    // If we reach here, the image loaded. Test that we can use it in canvas.
    if (logoImage) {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = testCanvas.height = 10;
      testCanvas.getContext('2d').drawImage(logoImage, 0, 0);
      // drawImage on a tainted canvas throws — if it doesn't, we're good.
      showToast('✅ Logo cargado (CORS permitido por el servidor de la imagen).');
    }
  } catch (err) {
    // Canvas was tainted (CORS not allowed by remote server)
    logoImage = null;
    showToast(
      '🔴 Sin servidor activo. Para usar URLs externas ejecuta: node server.js',
      6000
    );
  }
}

/** Loads an image element from a src string. If crossOrigin is true, sets
 *  the crossOrigin attribute so the browser requests the image with CORS. */
function _loadImageDirect(src, crossOrigin = false) {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => {
      logoImage = img;
      resolve();
    };
    img.onerror = () => {
      logoImage = null;
      resolve(); // resolve (not reject) — caller decides how to handle
    };
    img.src = src;
  });
}

/** Creates a blob: URL from a Blob and loads it as an Image. */
function _loadImageFromBlob(blob) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      // Keep the objectUrl alive for 60s then release it
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      logoImage = null;
      showToast('⚠️ No se pudo decodificar la imagen. Comprueba que sea PNG o JPG.');
      resolve();
    };
    img.src = objectUrl;
  });
}

async function applyLogoUrl() {
  const src = logoUrlEl.value.trim();
  if (!src) return;

  // Visual feedback on the button
  const btn = document.querySelector('#logo-url-panel .btn-secondary');
  const original = btn ? btn.textContent : null;
  if (btn) { btn.textContent = '⏳ Cargando…'; btn.disabled = true; }

  logoImage = null;
  await loadLogoFromUrl(src);

  if (btn) { btn.textContent = original; btn.disabled = false; }

  if (logoImage) {
    showToast('✅ Logo cargado correctamente.');
  }
  // Error toasts are shown inside loadLogoFromUrl
}

function loadLogoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      logoImage = img;
      showToast('✅ Logo cargado desde archivo local.');
    };
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
  const darkColor = colorDarkEl.value;
  const lightColor = colorLightEl.value;

  const tempDiv = document.getElementById('qr-temp');
  tempDiv.innerHTML = '';

  new QRCode(tempDiv, {
    text,
    width: size,
    height: size,
    colorDark: darkColor,
    colorLight: lightColor,
    correctLevel: QRCode.CorrectLevel[errLevel],
  });

  // QRCode.js renders asynchronously. We wait for the <img> that it injects
  // to fire its "load" event instead of using a blind setTimeout.
  function onQRReady(qrImg) {
    const compositeCanvas = finalCanvas;
    compositeCanvas.width = size;
    compositeCanvas.height = size;
    const ctx = compositeCanvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(qrImg, 0, 0, size, size);

    if (showLogoEl.checked && logoImage) {
      try {
        drawLogoOverlay(ctx, size);
      } catch (canvasErr) {
        // Canvas tainted by cross-origin image — generate QR without logo
        console.warn('[canvas] Tainted by cross-origin image:', canvasErr.message);
        showToast('⚠️ Logo omitido: imagen con restricciones CORS. Usa el servidor.');
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(qrImg, 0, 0, size, size);
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

  // Wait for the QRCode.js <img> to be ready
  const qrImg = tempDiv.querySelector('img');
  if (qrImg) {
    if (qrImg.complete && qrImg.naturalWidth > 0) {
      onQRReady(qrImg);
    } else {
      qrImg.onload = () => onQRReady(qrImg);
      // Fallback: if the img never fires load (old browsers), use timeout
      setTimeout(() => {
        if (!qrGenerated || finalCanvas.style.display === 'none') {
          const fallbackImg = tempDiv.querySelector('img') || tempDiv.querySelector('canvas');
          if (fallbackImg) onQRReady(fallbackImg);
        }
      }, 600);
    }
  } else {
    // No img found yet — QRCode.js may still be building the DOM
    setTimeout(() => {
      const fallbackImg = tempDiv.querySelector('img') || tempDiv.querySelector('canvas');
      if (fallbackImg) {
        onQRReady(fallbackImg);
      } else {
        showToast('❌ No se pudo generar el QR.');
        btnGenerate.innerHTML = '<span>⚡</span> Generar QR';
        btnGenerate.disabled = false;
      }
    }, 500);
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
