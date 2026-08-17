/**
 * The crop editor.
 *
 * The character card is 4:3, so an upload must be too. Cropping from the
 * centre took the top off most faces, so the frame is placed by hand instead.
 *
 * Preview and export share one set of numbers. `base` is the scale at which
 * the picture just covers the frame; zoom multiplies it, and the offset is
 * held in *frame* pixels. Exporting is the same transform measured in a larger
 * frame, which is why what you see is what gets written.
 *
 * Kept in its own module so the arithmetic can be exercised on its own — the
 * page it lives on is behind a sign-in.
 */

const $ = id => document.getElementById(id);

export const OUT_W = 720, OUT_H = 540;      // what is stored
let ed = null;                       // live editor state

export function clampOffset(st) {
  const w = st.img.naturalWidth * st.base * st.zoom;
  const h = st.img.naturalHeight * st.base * st.zoom;
  // Never let the frame show past an edge.
  st.x = Math.min(0, Math.max(st.frameW - w, st.x));
  st.y = Math.min(0, Math.max(st.frameH - h, st.y));
}

function paint(st) {
  const s = st.base * st.zoom;
  st.img.style.transform = `translate(${st.x}px, ${st.y}px) scale(${s})`;
  $('edZoomVal').textContent = Math.round(st.zoom * 100) + '%';
  $('edZoom').value = String(st.zoom);
}

export function centre(st) {
  st.x = (st.frameW - st.img.naturalWidth * st.base * st.zoom) / 2;
  st.y = (st.frameH - st.img.naturalHeight * st.base * st.zoom) / 2;
  clampOffset(st);
}

/** Opens the editor and resolves with a JPEG data URI, or null if cancelled. */
export function openEditor(file, name) {
  return new Promise((resolve, reject) => {
    const stage = $('edStage'), img = $('edImg');
    const url = URL.createObjectURL(file);

    const done = value => {
      URL.revokeObjectURL(url);
      $('editor').hidden = true;
      ed = null;
      resolve(value);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      $('editor').hidden = true;
      reject(new Error('That file is not an image this browser can read.'));
    };

    img.onload = () => {
      const r = stage.getBoundingClientRect();
      const st = {
        img, frameW: r.width, frameH: r.height, zoom: 1,
        base: Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight),
        x: 0, y: 0, done,
      };
      centre(st);
      paint(st);
      ed = st;
    };

    $('edName').textContent = name;
    $('editor').hidden = false;
    img.src = url;

    // Cancel resolves null so the caller simply does nothing.
    ed = { done };
  });
}

/* ── editor interaction ──────────────────────────────────────────────────── */
{
  const stage = $('edStage');
  let dragging = false, lastX = 0, lastY = 0;

  stage.addEventListener('pointerdown', e => {
    if (!ed?.img) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging || !ed?.img) return;
    ed.x += e.clientX - lastX;
    ed.y += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    clampOffset(ed); paint(ed);
  });
  const stop = e => {
    dragging = false;
    if (e.pointerId != null && stage.hasPointerCapture?.(e.pointerId)) {
      stage.releasePointerCapture(e.pointerId);
    }
  };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);

  stage.addEventListener('wheel', e => {
    if (!ed?.img) return;
    e.preventDefault();
    zoomAround(e.deltaY < 0 ? 1.08 : 1 / 1.08, e);
  }, { passive: false });

  /** Keeps the point under the cursor put while the zoom changes. */
  function zoomAround(factor, e) {
    const r = stage.getBoundingClientRect();
    const px = (e?.clientX ?? r.left + r.width / 2) - r.left;
    const py = (e?.clientY ?? r.top + r.height / 2) - r.top;
    const before = ed.zoom;
    ed.zoom = Math.min(4, Math.max(1, ed.zoom * factor));
    const k = ed.zoom / before;
    ed.x = px - (px - ed.x) * k;
    ed.y = py - (py - ed.y) * k;
    clampOffset(ed); paint(ed);
  }

  $('edZoom').addEventListener('input', e => {
    if (!ed?.img) return;
    zoomAround(Number(e.target.value) / ed.zoom);
  });

  $('edReset').addEventListener('click', () => {
    if (!ed?.img) return;
    ed.zoom = 1; centre(ed); paint(ed);
  });
  $('edCancel').addEventListener('click', () => ed?.done?.(null));

  $('edSave').addEventListener('click', () => {
    if (!ed?.img) return;
    const st = ed;
    const k = OUT_W / st.frameW;              // frame pixels -> stored pixels
    const c = document.createElement('canvas');
    c.width = OUT_W; c.height = OUT_H;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      st.img,
      st.x * k, st.y * k,
      st.img.naturalWidth * st.base * st.zoom * k,
      st.img.naturalHeight * st.base * st.zoom * k,
    );

    let q = 0.82, out = c.toDataURL('image/jpeg', q);
    // Back off until it fits, rather than failing the write at the server.
    while (out.length > 700_000 && q > 0.4) {
      q -= 0.1;
      out = c.toDataURL('image/jpeg', q);
    }
    st.done(out);
  });
}


/** The scale at which an image just covers a frame. Exported for testing. */
export function coverScale(imgW, imgH, frameW, frameH) {
  return Math.max(frameW / imgW, frameH / imgH);
}

/**
 * The rectangle drawImage receives, in stored pixels. Preview and export must
 * agree, so both go through this.
 */
export function exportRect(st, outW = OUT_W) {
  const k = outW / st.frameW;
  return {
    dx: st.x * k,
    dy: st.y * k,
    dw: st.imgW * st.base * st.zoom * k,
    dh: st.imgH * st.base * st.zoom * k,
  };
}
