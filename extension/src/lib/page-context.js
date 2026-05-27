/**
 * page-context.js — light extractor that detects what kind of page we're on
 * and returns a structured summary. PII fields (email, password, card #) are
 * scrubbed before any text leaves the page.
 *
 * Loaded by content.js. Ported from flux-extension/content.js, slimmed down.
 */

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,                   // SSN
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,             // Card numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // emails
];

export function scrubText(s) {
  if (typeof s !== 'string') return '';
  let out = s;
  for (const p of PII_PATTERNS) out = out.replace(p, '[redacted]');
  return out;
}

export function detectPageType() {
  const h = location.hostname;
  if (/instructure\.com|canvaslms\.com/.test(h)) return 'canvas';
  if (/mail\.google\.com/.test(h)) return 'gmail';
  if (/docs\.google\.com/.test(h)) return 'gdocs';
  if (/calendar\.google\.com/.test(h)) return 'gcal';
  if (/classroom\.google\.com/.test(h)) return 'gclassroom';
  if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
  if (/wikipedia\.org/.test(h)) return 'wiki';
  if (/github\.com/.test(h)) return 'github';
  if (/khanacademy\.org/.test(h)) return 'khan';
  if (/quizlet\.com/.test(h)) return 'quizlet';
  return 'generic';
}

export function genericContext() {
  const title = document.title || '';
  const url = location.href;
  const headings = [...document.querySelectorAll('h1, h2, h3')].slice(0, 12).map((h) => ({
    level: parseInt(h.tagName.slice(1), 10),
    text: scrubText((h.textContent || '').trim().slice(0, 240)),
  }));
  // Visible main text — pluck the longest <article> / <main>, else body
  const main = document.querySelector('article, main, [role="main"]') || document.body;
  const text = scrubText((main.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 6000));
  const links = [...document.querySelectorAll('a[href]')].slice(0, 30).map((a) => ({
    text: (a.textContent || '').trim().slice(0, 120),
    href: a.href,
  })).filter((l) => l.text);
  return { type: 'generic', title, url, headings, text, links };
}

export function canvasContext() {
  const out = { type: 'canvas', title: document.title, url: location.href };
  const isQuiz = /\/quizzes\//.test(location.pathname);
  if (isQuiz) {
    out.kind = 'quiz';
    const qs = [...document.querySelectorAll('.question, .question_holder')].slice(0, 30).map((q, i) => ({
      n: i + 1,
      text: scrubText((q.querySelector('.question_text')?.textContent || '').trim().slice(0, 800)),
      points: q.querySelector('.points')?.textContent?.trim() || '',
    }));
    out.questions = qs;
  } else {
    out.kind = 'page';
    out.text = scrubText(document.body.innerText.replace(/\s+/g, ' ').slice(0, 6000));
  }
  return out;
}

export function gmailContext() {
  const subj = document.querySelector('h2[role="heading"]')?.textContent || '';
  const body = document.querySelector('[role="main"] .ii.gt, [role="main"]')?.innerText || '';
  return {
    type: 'gmail',
    subject: scrubText(subj),
    body: scrubText(body.replace(/\s+/g, ' ').slice(0, 6000)),
    url: location.href,
  };
}

export function gdocsContext() {
  const title = document.title.replace(' - Google Docs', '');
  const body = (document.querySelector('.kix-page-content-wrapper')?.innerText
    || document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
  return { type: 'gdocs', title, body: scrubText(body), url: location.href };
}

export function youtubeContext() {
  const title = (document.querySelector('h1.ytd-video-primary-info-renderer, h1.title') || {}).textContent || document.title;
  const channel = (document.querySelector('#owner-text a, ytd-channel-name a') || {}).textContent || '';
  const desc = (document.querySelector('#description-inline-expander, #description') || {}).innerText || '';
  return {
    type: 'youtube',
    title: scrubText(title.trim()),
    channel: scrubText(channel.trim()),
    description: scrubText(desc.replace(/\s+/g, ' ').slice(0, 4000)),
    url: location.href,
  };
}

export function extractContext() {
  const t = detectPageType();
  switch (t) {
    case 'canvas': return canvasContext();
    case 'gmail': return gmailContext();
    case 'gdocs': return gdocsContext();
    case 'youtube': return youtubeContext();
    default: return genericContext();
  }
}
