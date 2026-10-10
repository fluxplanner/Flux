/* Flux Tutor beta — a private, source-guided study session. This page is
   intentionally self-contained: it organizes material the student supplies
   and never pretends a local heuristic is an AI tutor. */
(function () {
  'use strict';

  const KEY = 'flux_teacher.beta.v1';
  const LIMIT = 12000;
  const MAX_ATTACHMENTS = 8;
  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const MAX_PDF_PAGES = 12;
  const PDFJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  const MAMMOTH_SRC = 'https://cdn.jsdelivr.net/npm/mammoth@1.13.0/mammoth.browser.min.js';
  const root = document.getElementById('teacherApp');
  const libraryLoads = Object.create(null);
  let ocrWorkerPromise = null;
  let importBusy = false;
  const fresh = () => ({
    draft: { topic: '', subject: '', sourceTitle: '', sourceUrl: '', material: '', question: '', attachments: [] },
    session: null,
  });

  function cleanAttachments(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === 'object' && typeof item.name === 'string')
      .slice(0, MAX_ATTACHMENTS)
      .map((item) => ({
        name: item.name.slice(0, 180),
        kind: typeof item.kind === 'string' ? item.kind.slice(0, 30) : 'File',
      }));
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || typeof saved !== 'object') return fresh();
      const out = fresh();
      if (saved.draft && typeof saved.draft === 'object') {
        Object.keys(out.draft).forEach((k) => {
          if (typeof saved.draft[k] === 'string') out.draft[k] = saved.draft[k].slice(0, LIMIT);
        });
        out.draft.attachments = cleanAttachments(saved.draft.attachments);
      }
      if (saved.session && typeof saved.session === 'object' && typeof saved.session.topic === 'string') {
        out.session = {
          topic: saved.session.topic.slice(0, 160),
          subject: typeof saved.session.subject === 'string' ? saved.session.subject.slice(0, 100) : '',
          sourceTitle: typeof saved.session.sourceTitle === 'string' ? saved.session.sourceTitle.slice(0, 180) : '',
          sourceUrl: safeUrl(saved.session.sourceUrl),
          material: typeof saved.session.material === 'string' ? saved.session.material.slice(0, LIMIT) : '',
          attachments: cleanAttachments(saved.session.attachments),
          question: typeof saved.session.question === 'string' ? saved.session.question.slice(0, 700) : '',
          warmup: typeof saved.session.warmup === 'string' ? saved.session.warmup.slice(0, 2000) : '',
          teachback: typeof saved.session.teachback === 'string' ? saved.session.teachback.slice(0, 2400) : '',
          explain: saved.session.explain && typeof saved.session.explain === 'object' ? saved.session.explain : {},
          answers: saved.session.answers && typeof saved.session.answers === 'object' ? saved.session.answers : {},
          confidence: ['again', 'getting-there', 'teach-it'].includes(saved.session.confidence) ? saved.session.confidence : '',
          step: Math.max(0, Math.min(3, Number(saved.session.step) || 0)),
          noteIndex: Math.max(0, Number(saved.session.noteIndex) || 0),
          questionIndex: Math.max(0, Number(saved.session.questionIndex) || 0),
          showSource: saved.session.showSource === true,
          completedAt: typeof saved.session.completedAt === 'string' ? saved.session.completedAt : '',
        };
      }
      return out;
    } catch (_) {
      return fresh();
    }
  }

  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) { return ''; }
  }

  const data = load();
  let toastTimer = 0;
  let saveTimer = 0;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
        const status = document.getElementById('ftSaveStatus');
        if (status) status.textContent = 'Saved on this device';
      } catch (_) {
        const status = document.getElementById('ftSaveStatus');
        if (status) status.textContent = 'Could not save here — browser storage may be full or blocked.';
      }
    }, 140);
  }

  function toast(message) {
    document.querySelector('.ft-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'ft-toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2400);
  }

  function icon(name, size = 18) {
    const paths = {
      sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z"/><path d="M4 17a2.5 2.5 0 0 1 2.5-2.5H20"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
      arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  function hero() {
    return `<section class="ft-hero">
      <div class="ft-kicker">A study session that starts with you</div>
      <h1>Learn it. <span>Then explain it.</span></h1>
      <p>Bring the topic, notes and questions you are working on. Flux Tutor turns them into a clear path through the material and a chance to practise from memory.</p>
      <div class="ft-beta-note">${icon('info', 17)}<span><strong>Early beta:</strong> Flux Tutor organizes the material you provide into a guided study flow. It does not generate lessons with AI or grade your answers. Photos and files are read in this browser and are not sent to Flux AI. Photo OCR reads English best and can miss handwriting, equations and diagram details, so review the text before you study.</span></div>
    </section>`;
  }

  function inputField(id, label, value, placeholder, options = {}) {
    const wide = options.wide ? ' ft-field--wide' : '';
    const required = options.required ? ' required' : '';
    const max = options.max || 180;
    if (options.textarea) {
      return `<div class="ft-field${wide}"><label class="ft-label" for="${id}">${label}</label>
        <textarea class="ft-textarea${options.notes ? ' ft-textarea--notes' : ''}" id="${id}" name="${id}" maxlength="${max}" placeholder="${esc(placeholder)}"${required}>${esc(value)}</textarea>
        ${options.help ? `<span class="ft-help">${options.help}</span>` : ''}</div>`;
    }
    return `<div class="ft-field${wide}"><label class="ft-label" for="${id}">${label}</label>
      <input class="ft-input" id="${id}" name="${id}"${options.type ? ` type="${options.type}"` : ' type="text"'} maxlength="${max}" value="${esc(value)}" placeholder="${esc(placeholder)}"${required}>
      ${options.help ? `<span class="ft-help">${options.help}</span>` : ''}</div>`;
  }

  function loadLibrary(globalName, src) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (libraryLoads[globalName]) return libraryLoads[globalName];
    libraryLoads[globalName] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.ftLibrary = globalName;
      script.onload = () => window[globalName]
        ? resolve(window[globalName])
        : reject(new Error(`The ${globalName} reader did not start.`));
      script.onerror = () => reject(new Error(`Could not load the ${globalName} reader. Check your connection and try again.`));
      document.head.appendChild(script);
    }).catch((error) => {
      libraryLoads[globalName] = null;
      throw error;
    });
    return libraryLoads[globalName];
  }

  function setImportStatus(message, state = '') {
    const status = document.getElementById('ftUploadStatus');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.dataset.state = state;
  }

  function updateImportControls() {
    root.querySelectorAll('[data-action="pick-photo"], [data-action="pick-file"]').forEach((button) => {
      button.disabled = importBusy || data.draft.attachments.length >= MAX_ATTACHMENTS;
    });
    const submit = root.querySelector('#ftForm button[type="submit"]');
    if (submit) submit.disabled = importBusy;
  }

  function hasDraggedFiles(event) {
    return !!(event.dataTransfer && event.dataTransfer.types
      && Array.from(event.dataTransfer.types).includes('Files'));
  }

  function setDropHighlight(zone, active) {
    if (!zone) return;
    zone.classList.toggle('is-dragging', active);
    const prompt = zone.querySelector('.ft-drop-prompt strong');
    if (prompt) prompt.textContent = active ? 'Release to add your files' : 'Drop photos or files here';
  }

  function attachmentMarkup(attachments) {
    if (!attachments || !attachments.length) return '';
    return attachments.map((item) => `<li><span class="ft-file-kind">${esc(item.kind)}</span><span class="ft-file-name" title="${esc(item.name)}">${esc(item.name)}</span></li>`).join('');
  }

  function refreshAttachmentList() {
    const list = document.getElementById('ftAttachmentList');
    if (!list) return;
    list.innerHTML = attachmentMarkup(data.draft.attachments);
    list.hidden = !data.draft.attachments.length;
    updateImportControls();
  }

  function readFileText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read this file.'));
      reader.readAsText(file);
    });
  }

  function normalizeExtractedText(text) {
    return String(text || '').replace(/\r\n?/g, '\n').replace(/[\t ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  async function getOcrWorker() {
    if (!ocrWorkerPromise) {
      ocrWorkerPromise = loadLibrary('Tesseract', TESSERACT_SRC).then((tesseract) => {
        if (typeof tesseract.createWorker !== 'function') throw new Error('The OCR reader is unavailable.');
        return tesseract.createWorker('eng', 1, {
          logger(message) {
            if (message && message.status === 'recognizing text' && typeof message.progress === 'number') {
              const label = document.getElementById('ftUploadStatus')?.dataset.currentFile || 'Reading image';
              setImportStatus(`${label} · ${Math.round(message.progress * 100)}%`);
            }
          },
        });
      }).catch((error) => {
        ocrWorkerPromise = null;
        throw error;
      });
    }
    return ocrWorkerPromise;
  }

  window.addEventListener('pagehide', () => {
    if (!ocrWorkerPromise) return;
    ocrWorkerPromise.then((worker) => worker.terminate()).catch(() => {});
    ocrWorkerPromise = null;
  });

  async function recognizeImage(source, label) {
    const status = document.getElementById('ftUploadStatus');
    if (status) status.dataset.currentFile = `${label} · reading on this device`;
    setImportStatus(`${label} · loading local OCR reader…`);
    const worker = await getOcrWorker();
    const result = await worker.recognize(source);
    return normalizeExtractedText(result && result.data && result.data.text);
  }

  async function extractPhotoText(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('This photo could not be opened. Try a JPG or PNG image.'));
        element.src = url;
      });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo has no readable image data.');
      const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not prepare this photo for OCR.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        return await recognizeImage(canvas, file.name);
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function loadPdfReader() {
    const pdfjs = await loadLibrary('pdfjsLib', PDFJS_SRC);
    try { pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; } catch (_) {}
    return pdfjs;
  }

  async function extractPdfText(file) {
    const pdfjs = await loadPdfReader();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages = [];
    try {
      for (let number = 1; number <= pageCount; number++) {
        setImportStatus(`Reading ${file.name} · page ${number} of ${pageCount}…`);
        const page = await pdf.getPage(number);
        try {
          const textContent = await page.getTextContent();
          let text = normalizeExtractedText(textContent.items.map((item) => item.str || '').join(' '));
          if (text.replace(/\s/g, '').length < 24) {
            const natural = page.getViewport({ scale: 1 });
            const scale = Math.min(1.6, 2200 / Math.max(natural.width, natural.height));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error(`Could not prepare page ${number} of ${file.name} for OCR.`);
            try {
              await page.render({ canvasContext: context, viewport }).promise;
              text = await recognizeImage(canvas, `${file.name} · page ${number}`);
            } finally {
              canvas.width = 0;
              canvas.height = 0;
            }
          }
          if (text) pages.push(`Page ${number}\n${text}`);
        } finally {
          page.cleanup();
        }
      }
      if (pdf.numPages > MAX_PDF_PAGES) pages.push(`[Only the first ${MAX_PDF_PAGES} pages were read.]`);
      return pages.join('\n\n');
    } finally {
      await pdf.destroy();
    }
  }

  async function extractWordText(file) {
    const mammoth = await loadLibrary('mammoth', MAMMOTH_SRC);
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return normalizeExtractedText(result && result.value);
  }

  function fileKind(file) {
    const name = String(file.name || '').toLowerCase();
    if ((file.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif)$/.test(name)) return 'Photo';
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'Word';
    if (/\.(txt|md|markdown|csv|json|html?|xml)$/.test(name) || (file.type || '').startsWith('text/')) return 'Text';
    return '';
  }

  async function extractFileText(file, kind) {
    if (kind === 'Photo') return extractPhotoText(file);
    if (kind === 'PDF') return extractPdfText(file);
    if (kind === 'Word') return extractWordText(file);
    if (kind === 'Text') {
      const raw = await readFileText(file);
      if (/\.html?$/i.test(file.name)) {
        const parsed = new DOMParser().parseFromString(raw, 'text/html');
        parsed.querySelectorAll('script, style, template').forEach((node) => node.remove());
        return normalizeExtractedText(parsed.body.textContent);
      }
      return normalizeExtractedText(raw);
    }
    throw new Error('Use a photo, PDF, Word document, or text-based file.');
  }

  function appendImportedText(file, kind, text) {
    const area = document.getElementById('ftMaterial');
    const current = String(area ? area.value : data.draft.material || '');
    const separator = `${current.trim() ? '\n\n' : ''}[${file.name}]\n`;
    const room = LIMIT - current.length - separator.length;
    if (room < 1) throw new Error('Your notes have reached the 12,000-character limit. Remove some text before adding this file.');
    const body = normalizeExtractedText(text);
    if (!body) throw new Error(`No readable text found in ${file.name}.`);
    const shortened = body.length > room;
    data.draft.material = (current + separator + body.slice(0, room)).slice(0, LIMIT);
    data.draft.attachments = cleanAttachments([...data.draft.attachments, { name: file.name, kind }]);
    if (area) area.value = data.draft.material;
    refreshAttachmentList();
    save();
    return shortened;
  }

  async function importFiles(fileList, expectedKind) {
    if (importBusy) return;
    const selected = Array.from(fileList || []);
    if (!selected.length) return;
    const room = Math.max(0, MAX_ATTACHMENTS - data.draft.attachments.length);
    const files = selected.slice(0, room);
    const errors = [];
    let added = 0;
    let truncated = 0;
    importBusy = true;
    updateImportControls();
    if (!files.length) {
      importBusy = false;
      updateImportControls();
      setImportStatus(`You can add up to ${MAX_ATTACHMENTS} source files to one session.`, 'error');
      return;
    }
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      try {
        const kind = fileKind(file);
        if (!kind || (expectedKind === 'Photo' && kind !== 'Photo') || (expectedKind === 'File' && kind === 'Photo')) {
          throw new Error('This file type is not supported. Try a photo, PDF, DOCX, TXT, MD, CSV, JSON, HTML or XML file.');
        }
        if (file.size > MAX_FILE_BYTES) throw new Error('Files must be 15 MB or smaller.');
        if (file.size === 0) throw new Error('This file is empty.');
        setImportStatus(`Reading ${file.name} (${index + 1} of ${files.length})…`);
        const text = await extractFileText(file, kind);
        if (appendImportedText(file, kind, text)) truncated++;
        added++;
      } catch (error) {
        errors.push(`${file.name}: ${error && error.message ? error.message : 'Could not read this file.'}`);
      }
    }
    importBusy = false;
    updateImportControls();
    const omitted = selected.length - files.length;
    const summary = [];
    if (added) summary.push(`${added} ${added === 1 ? 'file' : 'files'} added to your notes.`);
    if (truncated) summary.push('Some text was shortened to fit the study-note limit.');
    if (omitted) summary.push(`Only ${MAX_ATTACHMENTS} source files can be added to one session.`);
    if (errors.length) summary.push(errors.join('\n'));
    setImportStatus(summary.join(' '), errors.length && !added ? 'error' : '');
  }

  function formView() {
    const d = data.draft;
    return `${hero()}<section class="ft-card ft-form-card" aria-labelledby="ft-form-title">
      <div class="ft-form-head"><h2 id="ft-form-title">What are you learning?</h2><p>A few details help make this session fit the thing you actually need to know.</p></div>
      <form id="ftForm" novalidate>
        <div class="ft-grid">
          ${inputField('ftTopic', 'Topic or learning goal', d.topic, 'e.g. How natural selection changes a population', { wide: true, required: true, max: 160 })}
          ${inputField('ftSubject', 'Class or subject', d.subject, 'e.g. Biology · Unit 4', { max: 100 })}
          ${inputField('ftSourceTitle', 'Source name', d.sourceTitle, 'e.g. Class slides, chapter 6', { max: 180 })}
          ${inputField('ftSourceUrl', 'Source link (optional)', d.sourceUrl, 'https://…', { type: 'url', wide: true, max: 500, help: 'Flux Tutor keeps the link beside your lesson. It does not fetch or upload the page.' })}
          ${inputField('ftMaterial', 'Class notes or extracted material', d.material, 'Paste notes here, or add a photo or file below. You can also start with just a topic.', { textarea: true, notes: true, wide: true, max: LIMIT, help: 'Imported text appears here so you can correct it before building your session.' })}
          <div class="ft-importer ft-field--wide" role="group" aria-label="Add study material from a photo or file">
            <div class="ft-import-copy"><strong>Have a photo or file?</strong><span>Photos and scanned PDF pages use English OCR on this device. PDFs, Word documents and text files are read in your browser. First-time OCR downloads a reader; your material is not uploaded.</span></div>
            <div class="ft-drop-prompt" aria-live="polite"><strong>Drop photos or files here</strong><span>or choose one below</span></div>
            <div class="ft-import-actions">
              <button class="ft-btn ft-btn--quiet" type="button" data-action="pick-photo">Add a photo</button>
              <button class="ft-btn ft-btn--quiet" type="button" data-action="pick-file">Choose files</button>
              <input class="ft-visually-hidden" id="ftPhotoFiles" type="file" accept="image/*" multiple tabindex="-1" aria-label="Choose photos of your study material">
              <input class="ft-visually-hidden" id="ftMaterialFiles" type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple tabindex="-1" aria-label="Choose study material files">
            </div>
            <div class="ft-upload-status" id="ftUploadStatus" role="status" aria-live="polite" hidden></div>
            <ul class="ft-attachment-list" id="ftAttachmentList" aria-label="Source files read into your notes"${d.attachments.length ? '' : ' hidden'}>${attachmentMarkup(d.attachments)}</ul>
            <span class="ft-help">Up to ${MAX_ATTACHMENTS} files · 15 MB each · 12,000 characters of notes. Review OCR text for handwriting, equations and diagrams.</span>
          </div>
          ${inputField('ftQuestion', 'A question you need to answer (optional)', d.question, 'e.g. Explain how a change in the environment affects allele frequency.', { textarea: true, wide: true, max: 700 })}
        </div>
        <div class="ft-status" id="ftFormError" role="alert"></div>
        <div class="ft-actions"><button class="ft-btn" type="submit">${icon('sparkle', 17)} Build my study session</button><span class="ft-help">About 10 minutes · you can change the session any time</span></div>
        <p class="ft-storage" id="ftSaveStatus" aria-live="polite">Saved on this device</p>
      </form>
    </section>`;
  }

  function paragraphs(text) {
    const blocks = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const lines = blocks.length ? blocks : String(text || '').split(/\n/).map((p) => p.trim()).filter(Boolean);
    return lines.slice(0, 16);
  }

  const STOP = new Set(('about above after again against all also another any are around because been before being between both came can cannot could did does doing down each enough even every few from further get give goes good great had has have having here how into its itself just like made make many may might more most much must near need neither never not now off often only other our out over own rather really same should since some such than that the their them then there these they thing this through too under until upon very was way were what when where which while who why will with would your you and but for nor yet she his her him their this those then than once your our').split(' '));

  function keyTerms(text) {
    const counts = new Map();
    const words = String(text || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
    for (const word of words) {
      if (STOP.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([word]) => word);
  }

  function sourceQuestions(session) {
    const found = [];
    if (session.question.trim()) found.push(session.question.trim());
    const matches = session.material.match(/[^\n.!?]{3,240}\?/g) || [];
    matches.forEach((q) => found.push(q.trim()));
    return [...new Map(found.map((q) => [q.toLowerCase(), q])).values()].slice(0, 6);
  }

  function prompts(session) {
    const supplied = sourceQuestions(session).map((text) => ({ text, kind: 'Your question' }));
    const topic = session.topic.trim();
    const generated = [
      { text: `Explain “${topic}” in your own words, without copying the source.`, kind: 'Recall' },
      { text: 'Which detail or example from your material best supports your explanation?', kind: 'Use the source' },
      { text: 'What part still feels unclear, and what would you ask your teacher about it?', kind: 'Find the gap' },
    ];
    return [...supplied, ...generated].slice(0, 8);
  }

  function sessionHeader(s) {
    const stepNames = ['Warm up', 'Learn', 'Practice', 'Wrap up'];
    return `<section class="ft-card ft-session-head">
      <div class="ft-session-top"><div>
        <div class="ft-kicker">Your study session</div>
        <h1 class="ft-session-title">${esc(s.topic)}</h1>
        <div class="ft-session-meta">${s.subject ? `<span class="ft-chip">${esc(s.subject)}</span>` : ''}${s.sourceTitle ? `<span class="ft-chip">${icon('book', 13)} ${esc(s.sourceTitle)}</span>` : ''}${(s.attachments || []).map((item) => `<span class="ft-chip ft-chip--file" title="${esc(item.name)}">${esc(item.kind)} · ${esc(item.name)}</span>`).join('')}${s.completedAt ? '<span class="ft-chip">Session complete</span>' : '<span class="ft-chip">Saved on this device</span>'}</div>
      </div><div class="ft-session-actions"><button type="button" class="ft-btn ft-btn--quiet" data-action="edit">Edit session</button><button type="button" class="ft-link-btn" data-action="new">New session</button></div></div>
      <nav class="ft-step-tabs" aria-label="Study session steps">${stepNames.map((name, i) => `<button type="button" class="ft-step-tab" data-action="step" data-step="${i}" aria-current="${s.step === i ? 'step' : 'false'}"><span class="ft-step-num">${i + 1}</span>${name}</button>`).join('')}</nav>
      <div class="ft-progress" role="progressbar" aria-label="Study session progress" aria-valuemin="1" aria-valuemax="4" aria-valuenow="${s.step + 1}"><span style="width:${((s.step + 1) / 4) * 100}%"></span></div>
    </section>`;
  }

  function sourceLink(s) {
    const url = safeUrl(s.sourceUrl);
    return url ? `<a class="ft-link-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open source ${icon('link', 14)}</a>` : '';
  }

  function warmupPanel(s) {
    const blocks = paragraphs(s.material);
    const question = sourceQuestions(s)[0];
    return `<section class="ft-card ft-panel" aria-labelledby="ft-step-heading">
      <div class="ft-section-head"><div><h2 id="ft-step-heading" tabindex="-1">Start with what you already know</h2><p>Try a rough answer first. It gives you something to compare your understanding against later.</p></div></div>
      <p class="ft-goal"><b>By the end:</b> explain ${esc(s.topic)} in your own words and support it with a detail from your class material.</p>
      ${question ? `<div class="ft-source-block"><h3>Your question to study</h3><p>${esc(question)}</p></div>` : ''}
      <div class="ft-field ft-reflection"><label class="ft-label" for="ftWarmup">What do you think you know so far?</label><textarea class="ft-textarea" id="ftWarmup" data-session-field="warmup" maxlength="2000" placeholder="A few words is enough. You can come back to this at the end.">${esc(s.warmup || '')}</textarea></div>
      <div class="ft-card-nav"><span class="ft-help">${blocks.length ? `${blocks.length} source ${blocks.length === 1 ? 'section' : 'sections'} ready` : 'No source material added yet'}</span><button type="button" class="ft-btn" data-action="step" data-step="1">Start learning ${icon('arrow', 16)}</button></div>
    </section>`;
  }

  function learnPanel(s) {
    const blocks = paragraphs(s.material);
    const terms = keyTerms(s.material);
    if (!blocks.length) {
      return `<section class="ft-card ft-panel" aria-labelledby="ft-step-heading">
        <div class="ft-section-head"><div><h2 id="ft-step-heading" tabindex="-1">Build a lesson from your material</h2><p>Flux Tutor keeps the lesson tied to your class, so add the relevant notes or excerpt here.</p></div></div>
        <div class="ft-no-source"><b>There is no source text in this session yet.</b>Open <button class="ft-link-btn" type="button" data-action="edit">Edit session</button> and paste a short part of your notes, slides or reading. Flux Tutor will break it into manageable sections for active recall.</div>
        <div class="ft-card-nav"><span></span><button type="button" class="ft-btn" data-action="step" data-step="2">Go to practice ${icon('arrow', 16)}</button></div>
      </section>`;
    }
    const index = Math.min(s.noteIndex || 0, blocks.length - 1);
    const note = blocks[index];
    const label = blocks.length === 1 ? 'Main idea' : index === 0 ? 'Start with the main idea' : index === blocks.length - 1 ? 'Put it together' : `Support and detail · ${index + 1} of ${blocks.length}`;
    return `<section class="ft-card ft-panel" aria-labelledby="ft-step-heading">
      <div class="ft-section-head"><div><h2 id="ft-step-heading" tabindex="-1">Learn one piece at a time</h2><p>Read a section, look away, then explain it simply before moving on.</p></div>${sourceLink(s)}</div>
      <div class="ft-source-row"><h3 class="ft-notes-h">${label}</h3><span class="ft-question-count">${index + 1} / ${blocks.length}</span></div>
      <article class="ft-source-block"><h3>${s.sourceTitle ? esc(s.sourceTitle) : 'Your class material'}</h3><p>${esc(note)}</p></article>
      ${terms.length ? `<div class="ft-key-terms" aria-label="Repeated key terms">${terms.map((t) => `<span class="ft-chip">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="ft-field ft-reflection"><label class="ft-label" for="ftExplain">Explain this part without copying it</label><textarea class="ft-textarea" id="ftExplain" data-note-answer="${index}" maxlength="1800" placeholder="What is the idea, and how would you say it to a friend?">${esc(s.explain && s.explain[index] || '')}</textarea><span class="ft-help">A short attempt is useful. You can revise it after practice.</span></div>
      <div class="ft-card-nav"><button type="button" class="ft-btn ft-btn--quiet" data-action="note-prev" ${index === 0 ? 'disabled' : ''}>Back a section</button>${index < blocks.length - 1 ? `<button type="button" class="ft-btn" data-action="note-next">Next section ${icon('arrow', 16)}</button>` : `<button type="button" class="ft-btn" data-action="step" data-step="2">Practice this ${icon('arrow', 16)}</button>`}</div>
    </section>`;
  }

  function practicePanel(s) {
    const list = prompts(s);
    const index = Math.min(s.questionIndex || 0, list.length - 1);
    const q = list[index];
    const answer = s.answers && typeof s.answers[index] === 'string' ? s.answers[index] : '';
    const evidence = paragraphs(s.material);
    return `<section class="ft-card ft-panel" aria-labelledby="ft-step-heading">
      <div class="ft-section-head"><div><h2 id="ft-step-heading" tabindex="-1">Practise from memory</h2><p>Try the question before opening your notes. These prompts are for practice, not grading.</p></div><span class="ft-question-count">${index + 1} / ${list.length}</span></div>
      <div class="ft-question-kind">${esc(q.kind)}</div><h3 class="ft-question">${esc(q.text)}</h3>
      <div class="ft-field"><label class="ft-label" for="ftAnswer">Your answer</label><textarea class="ft-textarea ft-answer" id="ftAnswer" data-answer="${index}" maxlength="2400" placeholder="Write what you remember. It does not need to be perfect.">${esc(answer)}</textarea></div>
      ${evidence.length ? `<button type="button" class="ft-link-btn" data-action="source-toggle" aria-expanded="${s.showSource}">${s.showSource ? 'Hide' : 'Compare with'} your source material</button>${s.showSource ? `<div class="ft-check-source"><strong>Look for evidence that supports or changes your answer.</strong>${evidence.slice(0, 4).map((p, i) => `<p><b>${i + 1}.</b> ${esc(p)}</p>`).join('')}</div>` : ''}` : '<p class="ft-help">Add source material to compare your answer with the class notes.</p>'}
      <div class="ft-card-nav"><button type="button" class="ft-btn ft-btn--quiet" data-action="question-prev" ${index === 0 ? 'disabled' : ''}>Previous question</button>${index < list.length - 1 ? `<button type="button" class="ft-btn" data-action="question-next">Next question ${icon('arrow', 16)}</button>` : `<button type="button" class="ft-btn" data-action="step" data-step="3">Wrap up ${icon('arrow', 16)}</button>`}</div>
    </section>`;
  }

  function wrapPanel(s) {
    const explained = Object.values(s.explain || {}).filter((v) => String(v).trim()).length;
    const answered = Object.values(s.answers || {}).filter((v) => String(v).trim()).length;
    const confidence = [
      ['again', 'I need to revisit it'],
      ['getting-there', 'I am getting there'],
      ['teach-it', 'I could teach this'],
    ];
    const doneCopy = s.completedAt ? 'You finished this study session.' : 'A useful stopping point is when you can explain the idea without looking and point to evidence that backs it up.';
    return `<section class="ft-card ft-panel" aria-labelledby="ft-step-heading">
      <div class="ft-section-head"><div><h2 id="ft-step-heading" tabindex="-1">Can you teach it back?</h2><p>Compare your first attempt with what you can explain now. It is okay if the answer is still “not yet.”</p></div></div>
      <div class="ft-source-block"><h3>${esc(s.topic)}</h3><p>${s.warmup.trim() ? `Your first thought: ${esc(s.warmup.trim())}` : 'You left the first-thought prompt blank. That is fine — use the check below as your recap.'}</p></div>
      <ul class="ft-checklist"><li>${explained} ${explained === 1 ? 'source section' : 'source sections'} explained in your own words</li><li>${answered} ${answered === 1 ? 'practice prompt' : 'practice prompts'} attempted</li><li>Check whether you can explain the idea and support it with a detail from your material</li></ul>
      <div class="ft-field ft-reflection"><label class="ft-label" for="ftTeachback">Now explain the main idea in a few sentences</label><textarea class="ft-textarea" id="ftTeachback" data-session-field="teachback" maxlength="2400" placeholder="What do you understand now that was fuzzy before?">${esc(s.teachback || '')}</textarea></div>
      <p class="ft-label">How ready do you feel?</p><div class="ft-confidence" role="group" aria-label="Confidence after studying">${confidence.map(([id, label]) => `<button type="button" data-action="confidence" data-value="${id}" aria-pressed="${s.confidence === id}">${label}</button>`).join('')}</div>
      <div class="ft-finish">${icon('check', 19)}<span><strong>${s.completedAt ? 'Session saved' : 'Keep the next step small'}</strong>${doneCopy}</span></div>
      <div class="ft-card-nav"><button type="button" class="ft-btn ft-btn--quiet" data-action="step" data-step="2">Back to practice</button><button type="button" class="ft-btn" data-action="finish">${s.completedAt ? 'Update session' : 'Finish session'} ${icon('check', 16)}</button></div>
    </section>`;
  }

  function sessionView() {
    const s = data.session;
    const panel = s.step === 0 ? warmupPanel(s) : s.step === 1 ? learnPanel(s) : s.step === 2 ? practicePanel(s) : wrapPanel(s);
    return `${hero()}<div class="ft-session">${sessionHeader(s)}${panel}<div class="ft-storage" id="ftSaveStatus" aria-live="polite">Saved on this device</div></div>`;
  }

  function render() {
    root.innerHTML = data.session ? sessionView() : formView();
    updateImportControls();
  }

  function syncDraft(form) {
    const fields = { topic: 'ftTopic', subject: 'ftSubject', sourceTitle: 'ftSourceTitle', sourceUrl: 'ftSourceUrl', material: 'ftMaterial', question: 'ftQuestion' };
    Object.keys(fields).forEach((key) => {
      const el = form.elements[fields[key]];
      if (el) data.draft[key] = String(el.value || '').slice(0, LIMIT);
    });
    save();
  }

  function startSession(form) {
    syncDraft(form);
    const d = data.draft;
    const error = document.getElementById('ftFormError');
    if (!d.topic.trim()) {
      error.textContent = 'Add the topic or question you want to learn first.';
      document.getElementById('ftTopic')?.focus();
      return;
    }
    if (d.sourceUrl.trim() && !safeUrl(d.sourceUrl)) {
      error.textContent = 'Enter a complete http or https link, or leave the source link blank.';
      document.getElementById('ftSourceUrl')?.focus();
      return;
    }
    data.session = {
      topic: d.topic.trim(), subject: d.subject.trim(), sourceTitle: d.sourceTitle.trim(), attachments: cleanAttachments(d.attachments),
      sourceUrl: safeUrl(d.sourceUrl), material: d.material.slice(0, LIMIT), question: d.question.trim(),
      warmup: '', teachback: '', explain: {}, answers: {}, confidence: '', step: 0,
      noteIndex: 0, questionIndex: 0, showSource: false, completedAt: '',
    };
    save();
    render();
    root.querySelector('#ftWarmup')?.focus({ preventScroll: true });
  }

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!target.matches('input, textarea')) return;
    if (target.form && target.form.id === 'ftForm') syncDraft(target.form);
    const s = data.session;
    if (!s) return;
    if (target.dataset.sessionField) s[target.dataset.sessionField] = target.value;
    if (target.dataset.noteAnswer != null) s.explain[target.dataset.noteAnswer] = target.value;
    if (target.dataset.answer != null) s.answers[target.dataset.answer] = target.value;
    save();
  });

  root.addEventListener('submit', (event) => {
    if (event.target.id !== 'ftForm') return;
    event.preventDefault();
    startSession(event.target);
  });

  root.addEventListener('change', (event) => {
    const input = event.target;
    if (input.id !== 'ftPhotoFiles' && input.id !== 'ftMaterialFiles') return;
    const expectedKind = input.id === 'ftPhotoFiles' ? 'Photo' : 'File';
    importFiles(input.files, expectedKind);
    input.value = '';
  });

  root.addEventListener('dragenter', (event) => {
    const zone = event.target.closest && event.target.closest('.ft-importer');
    if (!zone || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setDropHighlight(zone, true);
  });

  root.addEventListener('dragover', (event) => {
    const zone = event.target.closest && event.target.closest('.ft-importer');
    if (!zone || !hasDraggedFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setDropHighlight(zone, true);
  });

  root.addEventListener('dragleave', (event) => {
    const zone = event.target.closest && event.target.closest('.ft-importer');
    if (!zone || (event.relatedTarget && zone.contains(event.relatedTarget))) return;
    setDropHighlight(zone, false);
  });

  root.addEventListener('drop', (event) => {
    const zone = event.target.closest && event.target.closest('.ft-importer');
    if (!zone || !hasDraggedFiles(event)) return;
    event.preventDefault();
    setDropHighlight(zone, false);
    importFiles(event.dataTransfer.files, 'Any');
  });

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button)) return;
    const s = data.session;
    switch (button.dataset.action) {
      case 'pick-photo':
        document.getElementById('ftPhotoFiles')?.click();
        break;
      case 'pick-file':
        document.getElementById('ftMaterialFiles')?.click();
        break;
      case 'step':
        if (!s) return;
        s.step = Math.max(0, Math.min(3, Number(button.dataset.step) || 0));
        save(); render(); root.querySelector('#ft-step-heading')?.focus({ preventScroll: true });
        break;
      case 'edit':
        if (s) {
          data.draft = { topic: s.topic, subject: s.subject, sourceTitle: s.sourceTitle, sourceUrl: s.sourceUrl, material: s.material, question: s.question, attachments: cleanAttachments(s.attachments) };
          data.session = null;
          save();
          render();
          document.getElementById('ftTopic')?.focus({ preventScroll: true });
        }
        break;
      case 'new':
        if (window.confirm('Start fresh? Your current session and saved notes will be removed from this browser.')) {
          data.session = null; data.draft = fresh().draft; save(); render(); document.getElementById('ftTopic')?.focus({ preventScroll: true });
        }
        break;
      case 'note-next':
        if (s) { s.noteIndex = Math.min(paragraphs(s.material).length - 1, s.noteIndex + 1); save(); render(); document.getElementById('ftExplain')?.focus({ preventScroll: true }); }
        break;
      case 'note-prev':
        if (s) { s.noteIndex = Math.max(0, s.noteIndex - 1); save(); render(); document.getElementById('ftExplain')?.focus({ preventScroll: true }); }
        break;
      case 'question-next':
        if (s) { s.questionIndex = Math.min(prompts(s).length - 1, s.questionIndex + 1); s.showSource = false; save(); render(); document.getElementById('ftAnswer')?.focus({ preventScroll: true }); }
        break;
      case 'question-prev':
        if (s) { s.questionIndex = Math.max(0, s.questionIndex - 1); s.showSource = false; save(); render(); document.getElementById('ftAnswer')?.focus({ preventScroll: true }); }
        break;
      case 'source-toggle':
        if (s) { s.showSource = !s.showSource; save(); render(); root.querySelector('[data-action="source-toggle"]')?.focus({ preventScroll: true }); }
        break;
      case 'confidence':
        if (s) { s.confidence = button.dataset.value || ''; save(); render(); root.querySelector(`[data-action="confidence"][data-value="${esc(s.confidence)}"]`)?.focus({ preventScroll: true }); }
        break;
      case 'finish':
        if (s) { s.completedAt = new Date().toISOString(); save(); render(); root.querySelector('#ft-step-heading')?.focus({ preventScroll: true }); toast('Study session saved on this device.'); }
        break;
    }
  });

  render();
  if (window.FluxHub && typeof window.FluxHub.mountAll === 'function') window.FluxHub.mountAll();
})();
