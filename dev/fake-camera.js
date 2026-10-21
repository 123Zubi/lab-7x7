// Test ohne echte Kamera: ersetzt getUserMedia durch einen Canvas-Stream aus einem Foto (leichtes Wackeln wie Handhaltung).
// In der Browser-Konsole von app/index.html?debug=1:
//   (await import('./dev/fake-camera.js')).install('../Fotos/IMG_6831.jpeg')
// Latenztest: __fakeCam.dx / .dy (Pixel) verschieben, __fakeCam.rot (rad) dreht das Foto, install(src, { wobble: 0 }) schaltet das Wackeln ab.
export async function install(src, { width = 720, height = 1280, wobble = 0.006, noise = 0 } = {}) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Foto nicht ladbar: ' + src)); img.src = src; });   // decode() hängt in Hintergrund-Tabs
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const g = cv.getContext('2d');
  const s = Math.max(width / img.width, height / img.height);   // "cover" wie eine Handykamera
  const t0 = performance.now();
  // noise (0..1): Bildrauschen wie ein Handy-Sensor bei Raumlicht, damit MindAR realistisch zittert (Jitter-Messung)
  const grain = noise ? Array.from({ length: 6 }, () => {
    const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), x = c.getContext('2d'), d = x.createImageData(256, 256);
    for (let k = 0; k < d.data.length; k += 4) d.data[k] = d.data[k + 1] = d.data[k + 2] = Math.random() * 255, d.data[k + 3] = 255;
    x.putImageData(d, 0, 0);
    return g.createPattern(c, 'repeat');
  }) : null;
  (function draw() {
    const t = (performance.now() - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate((cv.dx || 0) + width / 2 + Math.sin(t * 1.3) * width * wobble, (cv.dy || 0) + height / 2 + Math.cos(t * 0.9) * height * wobble);
    g.rotate(Math.sin(t * 0.7) * wobble + (cv.rot || 0));
    if (cv.blank) { g.fillStyle = '#333'; g.fillRect(-width, -height, width * 2, height * 2); }   // __fakeCam.blank = true → Ziel verloren
    else g.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    if (grain) {
      g.setTransform(1, 0, 0, 1, Math.random() * 256, Math.random() * 256);
      g.globalAlpha = noise; g.fillStyle = grain[(Math.random() * grain.length) | 0]; g.fillRect(-256, -256, width + 256, height + 256); g.globalAlpha = 1;
    }
    requestAnimationFrame(draw);
  })();
  navigator.mediaDevices.getUserMedia = async () => cv.captureStream(30);
  window.__fakeCam = cv;
  return cv;
}
