/*
 * FluxFileSniff — check what a file really is before a parser touches it.
 *
 * Why: the importers trusted the file name and MIME type, both of which the
 * sender controls. A renamed file went straight into pdf.js or an <img>, and a
 * huge one could stall the tab. Reading the first bytes is cheap and tells us
 * whether it is actually a PDF or an image we know how to show.
 *
 * Shared by the planner's schedule importer (vendor bundle) and the Tutor
 * importer (teacher.html loads this file directly).
 */
(function () {
  'use strict';
  var MAX_BYTES = 15 * 1024 * 1024;
  var TOO_BIG = 'That file is over 15 MB. Try a smaller file, or a screenshot of just the page you need.';

  function startsWith(b, sig, at) {
    for (var i = 0; i < sig.length; i++) if (b[(at || 0) + i] !== sig[i]) return false;
    return true;
  }
  function ascii(s) { return s.split('').map(function (c) { return c.charCodeAt(0); }); }

  /** 'pdf' | 'image' | '' from the first bytes. */
  function kindOf(b) {
    if (startsWith(b, ascii('%PDF-'))) return 'pdf';
    if (startsWith(b, [0x89, 0x50, 0x4e, 0x47]) ||            // PNG
        startsWith(b, [0xff, 0xd8, 0xff]) ||                  // JPEG
        startsWith(b, ascii('GIF8')) ||                       // GIF
        startsWith(b, ascii('BM')) ||                         // BMP
        startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a]) || // TIFF
        (startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8)) ||
        (startsWith(b, ascii('ftyp'), 4) && /^(heic|heix|hevc|mif1|msf1|avif)$/.test(String.fromCharCode.apply(null, b.slice(8, 12))))) {
      return 'image';
    }
    return '';
  }

  /**
   * Resolves to 'pdf' or 'image', or rejects with a message fit to show the
   * student. `allow` lists the kinds this importer accepts.
   */
  async function check(file, allow) {
    if (!file || !file.size) throw new Error('That file is empty.');
    if (file.size > MAX_BYTES) throw new Error(TOO_BIG);
    var head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    var kind = kindOf(head);
    if (!kind || allow.indexOf(kind) < 0) {
      throw new Error(allow.length > 1
        ? 'That file is not a PDF or an image Flux can read. Try a PDF, PNG or JPEG.'
        : 'That file is not really a ' + (allow[0] === 'pdf' ? 'PDF' : 'picture') + ', so Flux can’t open it.');
    }
    return kind;
  }

  window.FluxFileSniff = Object.freeze({ check: check, kindOf: kindOf, MAX_BYTES: MAX_BYTES });
})();
