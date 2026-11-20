/**
 * quizlet.js — the "Send to Flux" button on Quizlet sets.
 *
 * Quizlet will not let Flux fetch a set from its link (a captcha), and Dia
 * and Arc will not run the Send to Flux bookmark, so the extension does the
 * same job: on a Quizlet set page it shows one button that reads the set
 * (public/js/flux-quizlet.js, shared with the bookmark) and asks the
 * background to open Flux Flashcards with it as a share link.
 *
 * Quizlet moves between pages without reloading, so the button is checked
 * on a light timer rather than only at load.
 */
import { ext } from './lib/browser-shim.js';
import '../../public/js/flux-quizlet.js';

const Q = globalThis.FluxQuizlet;
const IS_QUIZLET = /(^|\.)quizlet\.com$/.test(location.hostname.replace(/^www\./, ''));

/** A set page: quizlet.com/123456789/slug/ (optionally /gb/…), or …-123456789. */
function onSetPage() {
  const p = location.pathname;
  return /\/\d{3,}(\/|$)/.test(p) || /-\d{3,}\/?$/.test(p);
}

let host = null;
let label = null;

function mount() {
  host = document.createElement('div');
  host.id = 'flux-quizlet-send';
  // A shadow root keeps Quizlet's styles off the button and ours off Quizlet.
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font: 600 14px/1.3 system-ui, -apple-system, Segoe UI, sans-serif; }
      button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 999px; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.25); }
      button:hover { filter: brightness(1.08); }
      button:focus-visible { outline: 3px solid #facc15; outline-offset: 2px; }
      button[disabled] { opacity: .7; cursor: default; }
      .note { max-width: 280px; padding: 10px 12px; border-radius: 12px; background: #111827; color: #f9fafb; box-shadow: 0 8px 24px rgba(0,0,0,.25); }
      .note[hidden] { display: none; }
      svg { width: 18px; height: 18px; }
    </style>
    <div class="wrap">
      <div class="note" role="status" hidden></div>
      <button type="button" aria-label="Send this Quizlet set to Flux Flashcards">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
        <span>Send to Flux</span>
      </button>
    </div>`;
  const btn = shadow.querySelector('button');
  const note = shadow.querySelector('.note');
  label = shadow.querySelector('span');
  let noteTimer = 0;
  const say = (text) => {
    clearTimeout(noteTimer);
    note.textContent = text;
    note.hidden = !text;
    if (text) noteTimer = setTimeout(() => { note.hidden = true; }, 6000);
  };
  btn.addEventListener('click', async () => {
    const r = Q.read(Q.cards);
    const msg = Q.message(r);
    if (r.error) { say(msg); return; }
    btn.disabled = true;
    label.textContent = 'Opening Flux…';
    try {
      const res = await ext.runtime.sendMessage({ type: 'FLUX_OPEN_QUIZLET', code: r.code });
      if (!res || !res.ok) throw new Error((res && res.error) || 'no answer');
      say((msg ? msg + ' ' : '') + `Sent ${r.count} card${r.count === 1 ? '' : 's'} to Flux.`);
    } catch (e) {
      say('Flux could not open. Reload this page and try again.');
    } finally {
      btn.disabled = false;
      label.textContent = 'Send to Flux';
    }
  });
  document.documentElement.appendChild(host);
}

function sync() {
  const want = onSetPage();
  if (want && !host) mount();
  if (host) host.style.display = want ? '' : 'none';
}

if (IS_QUIZLET && Q) {
  sync();
  setInterval(sync, 1000);
}
