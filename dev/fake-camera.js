// Test ohne echte Kamera: ersetzt getUserMedia durch einen Canvas-Stream aus einem Foto (leichtes Wackeln wie Handhaltung).
// In der Browser-Konsole von app/index.html?debug=1:
//   (await import('./dev/fake-camera.js')).install('../Fotos/IMG_6831.jpeg')
export async function install(src, { width = 720, height = 1280, wobble = 0.006 } = {}) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = width; cv.height = height;
  const g = cv.getContext('2d');
  const s = Math.max(width / img.width, height / img.height);   // "cover" wie eine Handykamera
  const t0 = performance.now();
  (function draw() {
    const t = (performance.now() - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(width / 2 + Math.sin(t * 1.3) * width * wobble, height / 2 + Math.cos(t * 0.9) * height * wobble);
    g.rotate(Math.sin(t * 0.7) * wobble);
    g.drawImage(img, (-img.width * s) / 2, (-img.height * s) / 2, img.width * s, img.height * s);
    requestAnimationFrame(draw);
  })();
  const stream = cv.captureStream(30);
  navigator.mediaDevices.getUserMedia = async () => cv.captureStream(30);
  window.__fakeCam = { canvas: cv, stream };
  return cv;
}
