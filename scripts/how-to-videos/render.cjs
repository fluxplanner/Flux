// Renders scenes.html to public/videos/connect-*.mp4.
// Usage: FFMPEG=/path/to/ffmpeg node scripts/how-to-videos/render.cjs
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const FPS = 20;
const ROOT = path.join(__dirname, '../..');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + path.join(__dirname, 'scenes.html'));
  for (const name of ['schoology', 'canvas']) {
    const out = path.join(ROOT, 'public/videos', `connect-${name}.mp4`);
    const ff = spawn(process.env.FFMPEG || 'ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));
    const seconds = await page.evaluate((n) => window.duration(n), name);
    for (let f = 0; f < seconds * FPS; f++) {
      await page.evaluate(([n, t]) => window.seek(n, t), [name, f / FPS]);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 90 });
      if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await done;
    console.log(out, seconds + 's');
  }
  await browser.close();
})();
