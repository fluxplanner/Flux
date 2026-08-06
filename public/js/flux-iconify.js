/* ════════════════════════════════════════════════════════════════════
   FLUX · Iconify — emoji → monochrome SVG symbols, site-wide.
   Any emoji that reaches the DOM (icon registries, dynamic strings,
   old saved data) is swapped at render time for a stroke icon that
   matches the sidebar's visual language: 24×24 viewBox, currentColor
   stroke, width 2, round caps. Unmapped pictographs fall back to a
   neutral dot so no color emoji ever ships to the screen.

   Exports:
     window.fluxIcon(name)        → svg string for a named icon
     window.fluxIconForEmoji(e)   → svg string for an emoji
   Opt-out: add data-no-iconify to any element to leave its subtree.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__fluxIconify) return;
  window.__fluxIconify = true;

  /* ── Icon path library (Lucide-style, 24×24, stroke geometry) ──── */
  var P = {
    check: 'M20 6 9 17l-5-5',
    'check-square': 'M8 2h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Z M9 12l2 2 4-4',
    x: 'M18 6 6 18 M6 6l12 12',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    dot: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
    sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z M19 3v4 M21 5h-4 M5 17v4 M7 19H3',
    star: 'M12 3l2.5 5.3 5.5.8-4 4 1 5.9-5-2.8-5 2.8 1-5.9-4-4 5.5-.8Z',
    zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
    flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z',
    moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
    sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M6.3 17.7l-1.4 1.4 M19.1 4.9l-1.4 1.4',
    sunrise: 'M12 2v6 M8 6l4-4 4 4 M16 18a4 4 0 0 0-8 0 M2 18h2 M20 18h2 M22 22H2',
    cloud: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
    'cloud-sun': 'M12 2v2 M5.2 5.2l1.4 1.4 M20 12h2 M18.8 5.2l-1.4 1.4 M15.9 12.7a4 4 0 0 0-5.9-4.1 M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z',
    'cloud-rain': 'M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24 M16 14v6 M8 14v6 M12 16v6',
    'cloud-fog': 'M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24 M16 17H7 M17 21H9',
    'cloud-lightning': 'M6 16.3A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97 M13 12l-3 5h4l-3 5',
    snowflake: 'M12 2v20 M2 12h20 M5.5 5.5l13 13 M18.5 5.5l-13 13',
    thermometer: 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z',
    wind: 'M12.8 19.6A2 2 0 1 0 14 16H2 M17.5 8a2.5 2.5 0 1 1 2 4H2 M9.8 4.4A2 2 0 1 1 11 8H2',
    leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
    calendar: 'M8 2v4 M16 2v4 M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M3 10h18',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2',
    alarm: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 9v4l2 2 M5 3 2 6 M22 6l-3-3',
    timer: 'M10 2h4 M12 14l3-3 M12 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z',
    hourglass: 'M5 22h14 M5 2h14 M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22 M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2',
    'file-text': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M16 13H8 M16 17H8',
    'pen-line': 'M12 20h9 M16.4 3.6a2 2 0 0 1 2.8 2.8L7.5 18.1 3 19.5l1.4-4.5Z',
    pen: 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
    'book-open': 'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z',
    book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
    'book-stack': 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20 M8 7h8',
    scroll: 'M19 17V5a2 2 0 0 0-2-2H4 M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3',
    clipboard: 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    chart: 'M3 3v16a2 2 0 0 0 2 2h16 M18 17V9 M13 17V5 M8 17v-3',
    'trending-up': 'M22 7l-8.5 8.5-5-5L2 17 M16 7h6v6',
    'trending-down': 'M22 17l-8.5-8.5-5 5L2 7 M16 17h6v-6',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    paperclip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
    message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
    megaphone: 'M3 11h3l9-5v12l-9-5H3Z M15 8a4 4 0 0 1 0 8 M19 6.5a7 7 0 0 1 0 11',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
    pin: 'M12 17v5 M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1Z',
    'map-pin': 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    map: 'M14.1 5.55a2 2 0 0 0 1.8 0l3.65-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.56 2.27a2 2 0 0 1-1.78 0l-4.22-2.1a2 2 0 0 0-1.78 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.56-2.27a2 2 0 0 1 1.78 0Z M15 5.76v15 M9 3.24v15',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3a13.9 13.9 0 0 1 0 18 M12 3a13.9 13.9 0 0 0 0 18',
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36Z',
    landmark: 'M3 22h18 M6 18v-7 M10 18v-7 M14 18v-7 M18 18v-7 M12 2 3 8h18Z',
    school: 'M2 22h20 M6 22V10l6-6 6 6v12 M10 22v-5h4v5 M12 9h.01',
    briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16 M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z',
    backpack: 'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5 M8 10h8',
    'graduation-cap': 'M22 10 12 5 2 10l10 5Z M6 12.5V17a6 3 0 0 0 12 0v-4.5 M22 10v6',
    user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    'user-check': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M16 11l2 2 4-4',
    smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01',
    laugh: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M18 13a6 6 0 0 1-12 0Z M9 9h.01 M15 9h.01',
    meh: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M8 15h8 M9 9h.01 M15 9h.01',
    frown: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M16 16s-1.5-2-4-2-4 2-4 2 M9 9h.01 M15 9h.01',
    'frown-open': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 14a2 2 0 0 0-2 2h4a2 2 0 0 0-2-2Z M9 9h.01 M15 9h.01',
    sleep: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M8 15h8 M8 9h2 M14 9h2',
    brain: 'M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08A2.5 2.5 0 0 0 12 19.5Z M12 4.5a2.5 2.5 0 0 1 4.96-.46 2.5 2.5 0 0 1 1.98 3 2.5 2.5 0 0 1 1.32 4.24 3 3 0 0 1-.34 5.58 2.5 2.5 0 0 1-2.96 3.08A2.5 2.5 0 0 1 12 19.5Z',
    heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
    'heart-pulse': 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
    flag: 'M4 22V4c0-.6.4-1 1-1h14.8c.4 0 .7.5.4.9L17 9l3.2 5.1c.3.4 0 .9-.4.9H5',
    trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 15v2c0 .6-.5 1.2-1 1.5-1.2.6-2 2-2 3.5 M14 15v2c0 .6.5 1.2 1 1.5 1.2.6 2 2 2 3.5 M18 2H6v7a6 6 0 0 0 12 0Z',
    lightbulb: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
    search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M21 21l-4.3-4.3',
    settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M12 1v4 M12 19v4 M4.2 4.2l2.8 2.8 M17 17l2.8 2.8 M1 12h4 M19 12h4 M4.2 19.8 7 17 M17 7l2.8-2.8',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z',
    hammer: 'M15 12l-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9 M17.64 15 22 10.64 M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91',
    calculator: 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z M8 6h8 M8 11h.01 M12 11h.01 M16 11h.01 M8 15h.01 M12 15h.01 M16 15h.01 M8 19h.01 M12 19h.01 M16 19h.01',
    laptop: 'M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9 M2 16h20l-1.28 2.55a1 1 0 0 1-.9.45H4.18a1 1 0 0 1-.9-.45Z',
    bot: 'M12 8V4 M8 4h8 M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z M2 14h2 M20 14h2 M9 13v2 M15 13v2',
    camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3',
    music: 'M9 18V5l12-2v13 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    'music-sheet': 'M9 18V5l12-2v13 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    palette: 'M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2a2 2 0 0 0-2 2c0 .6.2 1.1.6 1.5.4.4.6.9.6 1.5a2 2 0 0 1-2 2Z M7 10h.01 M11 7h.01 M15 9h.01',
    scissors: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M20 4 8.12 15.88 M14.47 14.48 20 20 M8.12 8.12 12 12',
    languages: 'M5 8l6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6',
    repeat: 'M17 2l4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3',
    refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16 M3 21v-5h5',
    flask: 'M10 2v6.34L4.24 19.4A1 1 0 0 0 5.13 21h13.74a1 1 0 0 0 .89-1.6L14 8.34V2 M8.5 2h7 M7 15h10',
    atom: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z M3.8 20.2c-2.04-2.03-.02-7.36 4.5-11.9 4.54-4.52 9.87-6.54 11.9-4.5 2.04 2.03.02 7.36-4.5 11.9-4.54 4.52-9.87 6.54-11.9 4.5Z',
    dna: 'M2 15c6.67-6 13.33 0 20-6 M2 9c6.67 6 13.33 0 20 6 M8 6.6v2.8 M12 8.5v7 M16 14.6v2.8',
    orbit: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M20.34 6.66a2 2 0 1 0-2.83-2.83 M6.49 20.17a2 2 0 1 0-2.83-2.83 M17.75 17.72a9 9 0 0 0-11.5-11.44 M6.26 6.28a9 9 0 0 0 11.5 11.44',
    ruler: 'M21.3 8.7 15.3 2.7a2.41 2.41 0 0 0-3.4 0L2.7 11.9a2.41 2.41 0 0 0 0 3.4l6 6a2.41 2.41 0 0 0 3.4 0l9.2-9.2a2.41 2.41 0 0 0 0-3.4Z M7.5 10.5l2 2 M10.5 7.5l2 2 M13.5 4.5l2 2',
    folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
    package: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73Z M12 22V12 M3.3 7l8.7 5 8.7-5',
    puzzle: 'M14 7V4a2 2 0 0 0-4 0v3H7a2 2 0 0 0-2 2v3h3a2 2 0 0 1 0 4H5v3a2 2 0 0 0 2 2h3v-3a2 2 0 0 1 4 0v3h3a2 2 0 0 0 2-2v-3h3a2 2 0 0 0 0-4h-3V9a2 2 0 0 0-2-2Z',
    'help-circle': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 16v-4 M12 8h.01',
    'alert-triangle': 'M21.73 18l-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01',
    'alert-octagon': 'M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86Z M12 8v4 M12 16h.01',
    siren: 'M7 18v-6a5 5 0 1 1 10 0v6 M5 21h14a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1Z M12 2v2 M4.9 4.9l1.4 1.4 M19.1 4.9l-1.4 1.4',
    shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z M7 11V7a5 5 0 0 1 10 0v4',
    key: 'M15 2a7 7 0 0 0-6.8 8.7L2 17v5h5l6.3-6.2A7 7 0 1 0 15 2Z M16.5 7.5h.01',
    bell: 'M10.27 21a2 2 0 0 0 3.46 0 M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33Z',
    'bell-off': 'M10.27 21a2 2 0 0 0 3.46 0 M18 8a6 6 0 0 0-9.33-5 M6.16 6.16C6.06 6.75 6 7.36 6 8c0 4.5-1.41 5.96-2.74 7.33A1 1 0 0 0 4 17h13 M3 3l18 18',
    battery: 'M4 7h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z M22 11v2 M7 10v4 M11 10v4',
    plug: 'M12 22v-5 M9 8V2 M15 8V2 M6 8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z',
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
    coffee: 'M10 2v2 M14 2v2 M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1 M6 2v2',
    armchair: 'M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3 M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z M5 18v2 M19 18v2',
    'life-buoy': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M4.93 4.93l4.24 4.24 M14.83 14.83l4.24 4.24 M14.83 9.17l4.24-4.24 M9.17 14.83l-4.24 4.24',
    save: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7 M7 3v4a1 1 0 0 0 1 1h7',
    hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
    scale: 'M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z M7 21h10 M12 3v18 M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2',
    layers: 'M12 2 2 7l10 5 10-5Z M2 17l10 5 10-5 M2 12l10 5 10-5',
    grid: 'M3 3h7v7H3Z M14 3h7v7h-7Z M14 14h7v7h-7Z M3 14h7v7H3Z',
    printer: 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 9V3h12v6 M6 14h12v8H6Z',
    'id-card': 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Z M8 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M5 17c.5-1.5 1.7-2 3-2s2.5.5 3 2 M15 9h4 M15 13h4',
    dollar: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6'
  };

  /* ── emoji → icon-name map ─────────────────────────────────────── */
  var MAP = {
    '✅':'check-square','✔':'check','☑':'check-square','❌':'x','✖':'x','❎':'x',
    '➕':'plus','➖':'minus','⭐':'star','🌟':'star','✨':'sparkles','🎉':'sparkles','🎊':'sparkles',
    '⚡':'zap','🔥':'flame','🌙':'moon','☀':'sun','🌞':'sun','🌅':'sunrise','🌄':'sunrise',
    '🌤':'cloud-sun','⛅':'cloud-sun','☁':'cloud','🌦':'cloud-rain','🌧':'cloud-rain','🌨':'snowflake',
    '🌫':'cloud-fog','⛈':'cloud-lightning','❄':'snowflake','🌡':'thermometer','🌬':'wind','💨':'wind',
    '🌿':'leaf','🍃':'leaf','🌱':'leaf','🌸':'sparkles','🌊':'activity','🌌':'sparkles','🍬':'dot',
    '📅':'calendar','📆':'calendar','🗓':'calendar','⏰':'alarm','⏱':'timer','🕒':'clock','🕰':'clock','⌛':'hourglass','⏳':'hourglass',
    '📝':'pen-line','✍':'pen-line','🖊':'pen','🖋':'pen','✏':'pen','📄':'file-text','📃':'file-text','🗒':'file-text',
    '📖':'book-open','📚':'book-stack','📘':'book','📙':'book','📗':'book','📕':'book','📜':'scroll','📋':'clipboard',
    '📊':'chart','📈':'trending-up','📉':'trending-down','💹':'trending-up',
    '🔗':'link','📎':'paperclip','💬':'message','🗨':'message','💭':'message','📣':'megaphone','📢':'megaphone',
    '📥':'inbox','📤':'inbox','📨':'mail','✉':'mail','📧':'mail','📩':'mail',
    '📌':'pin','📍':'map-pin','🗺':'map','🌍':'globe','🌎':'globe','🌏':'globe','🌐':'globe','🧭':'compass',
    '🏛':'landmark','🏫':'school','🏢':'landmark','🏠':'school','🏡':'school',
    '💼':'briefcase','🎒':'backpack','🎓':'graduation-cap',
    '👤':'user','👥':'users','🧑':'user','👩':'user','👨':'user','🙋':'user-check','🤝':'users','👋':'user',
    '👩‍🏫':'users','🧑‍🎓':'graduation-cap','👨‍🏫':'users',
    '😊':'smile','🙂':'smile','😄':'laugh','😀':'laugh','😁':'laugh','😆':'laugh','🥳':'laugh',
    '😐':'meh','😌':'smile','😕':'frown','😞':'frown','😟':'frown','😔':'frown','😰':'frown-open','🤯':'frown-open',
    '😴':'sleep','🥱':'sleep','🤒':'thermometer','🧘':'smile','🫀':'heart-pulse',
    '🧠':'brain','💙':'heart','❤':'heart','💜':'heart','🖤':'heart','🤍':'heart','💛':'heart','💚':'heart',
    '🎯':'target','🚦':'flag','🚩':'flag','🏁':'flag','🏆':'trophy','🥇':'trophy','💡':'lightbulb',
    '🔍':'search','🔎':'search','⚙':'settings','🛠':'wrench','🔧':'wrench','🔨':'hammer',
    '🧮':'calculator','💻':'laptop','🖥':'laptop','🤖':'bot','📷':'camera','📸':'camera','🎥':'camera','🎤':'mic','🎙':'mic',
    '🎵':'music','🎶':'music','🎼':'music-sheet','🎧':'music','🎨':'palette','✂':'scissors',
    '🗣':'languages','🇪🇸':'languages','🇫🇷':'languages','🇩🇪':'languages','🇺🇸':'languages','🇬🇧':'languages','🇯🇵':'languages','🇨🇳':'languages',
    '🔁':'repeat','🔄':'refresh',
    '🧪':'flask','⚗':'flask','🧫':'flask','🧬':'dna','🪐':'orbit','🔭':'orbit','📐':'ruler','📏':'ruler',
    '📂':'folder','📁':'folder','🗂':'folder','📦':'package','🧩':'puzzle','🃏':'layers','🀄':'layers',
    '❓':'help-circle','❔':'help-circle','ℹ':'info','⚠':'alert-triangle','⛔':'alert-octagon','☢':'alert-triangle',
    '🚨':'siren','🛑':'alert-octagon','🛡':'shield','🔒':'lock','🔐':'lock','🔓':'lock','🗝':'key','🔑':'key',
    '🔔':'bell','🔕':'bell-off','🔋':'battery','🪫':'battery','🔌':'plug','🚀':'rocket',
    '☕':'coffee','🍵':'coffee','🛋':'armchair','🪑':'armchair','🛟':'life-buoy','💾':'save',
    '🔢':'hash','⚖':'scale','🅒':'layers','📵':'bell-off','🗑':'trash','💰':'dollar','💵':'dollar','💸':'dollar',
    '📛':'id-card','🪪':'id-card','🖨':'printer','💒':'landmark','🏷':'pin','🔖':'pin'
  };

  var FALLBACK = 'dot';

  function svgFor(name) {
    var d = P[name] || P[FALLBACK];
    return '<svg class="fxi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  var VS = /[︎️]/g;
  function stripVS(s) { return s.replace(VS, ''); }

  window.fluxIcon = svgFor;
  window.fluxIconForEmoji = function (e) {
    var n = MAP[stripVS(e)];
    return svgFor(n || FALLBACK);
  };

  /* Cluster matcher: mapped sequences (longest first) OR any pictograph
     cluster (base + modifiers/ZWJ chains/flags) OR VS16'd symbols. */
  var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
  var keyAlt = keys.map(function (k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('|');
  var PICTO = '(?:[\\u{1F000}-\\u{1FAFF}](?:[\\u{1F3FB}-\\u{1F3FF}]|\\uFE0F)?(?:\\u200D[\\u{1F000}-\\u{1FAFF}\\u2640-\\u2642](?:[\\u{1F3FB}-\\u{1F3FF}]|\\uFE0F)?)*)';
  var FLAGS = '(?:[\\u{1F1E6}-\\u{1F1FF}]{2})';
  var VSSYM = '(?:[\\u2100-\\u27BF\\u2B00-\\u2BFF\\u2300-\\u23FF]\\uFE0F)';
  var CLUSTER = new RegExp('(?:' + keyAlt + ')\\uFE0F?|' + FLAGS + '|' + PICTO + '|' + VSSYM, 'gu');
  var QUICK = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}️☀-➿⬀-⯿⌀-⏿℀-⇿]/u;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, IFRAME: 1, CANVAS: 1 };

  function skippable(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP_TAGS[n.tagName]) return true;
      if (n.isContentEditable) return true;
      if (n.hasAttribute && n.hasAttribute('data-no-iconify')) return true;
      if (n.namespaceURI && n.namespaceURI.indexOf('svg') !== -1) return true;
    }
    return false;
  }

  function processTextNode(node) {
    var text = node.nodeValue;
    if (!text || !QUICK.test(text)) return;
    var parent = node.parentNode;
    if (!parent || skippable(parent)) return;

    CLUSTER.lastIndex = 0;
    var m, last = 0, frag = null;
    while ((m = CLUSTER.exec(text)) !== null) {
      var tok = m[0];
      var mapped = MAP[stripVS(tok)];
      if (!frag) frag = document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      var span = document.createElement('span');
      span.className = 'fxi-wrap';
      span.setAttribute('data-no-iconify', '');
      span.innerHTML = svgFor(mapped || FALLBACK);
      frag.appendChild(span);
      last = m.index + tok.length;
    }
    if (!frag || last === 0) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    parent.replaceChild(frag, node);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { processTextNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && skippable(root)) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      if (QUICK.test(n.nodeValue || '')) nodes.push(n);
    }
    for (var i = 0; i < nodes.length; i++) processTextNode(nodes[i]);
  }

  /* ── styles ────────────────────────────────────────────────────── */
  var st = document.createElement('style');
  st.textContent =
    '.fxi-wrap{display:inline-flex;align-items:center;justify-content:center;vertical-align:-0.14em;line-height:0}' +
    '.fxi{width:1em;height:1em;display:inline-block;flex:0 0 auto;opacity:.92}' +
    '.fxi-wrap+.fxi-wrap{margin-left:.1em}';
  (document.head || document.documentElement).appendChild(st);

  /* ── observe ───────────────────────────────────────────────────── */
  var pending = new Set();
  var scheduled = false;
  function flush() {
    scheduled = false;
    pending.forEach(function (nd) {
      try { walk(nd); } catch (e) { /* never break the app over an icon */ }
    });
    pending.clear();
  }
  function schedule(node) {
    pending.add(node);
    if (!scheduled) {
      scheduled = true;
      // setTimeout, not rAF: rAF never fires in hidden/headless tabs,
      // which would leave emoji visible until the next paint.
      setTimeout(flush, 32);
    }
  }

  function start() {
    try { walk(document.body); } catch (e) {}
    // B5.2: same record loop, but riding the shared FluxDomWalker instead of
    // a second document-wide characterData observer.
    var handler = function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'characterData') { schedule(mu.target); continue; }
        for (var j = 0; j < mu.addedNodes.length; j++) schedule(mu.addedNodes[j]);
      }
    };
    if (window.FluxDomWalker && FluxDomWalker.subscribe('iconify', handler)) {
      window.__fluxIconifyObserver = { disconnect: function () { FluxDomWalker.unsubscribe('iconify'); } };
      return;
    }
    var mo = new MutationObserver(handler);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__fluxIconifyObserver = mo;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
