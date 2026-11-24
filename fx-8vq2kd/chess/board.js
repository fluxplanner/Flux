// Flux Chess board: renders a position, handles click-to-move and
// drag-to-move, highlights and arrows. It knows nothing about the rules —
// the caller passes `legal(square)` which returns chess.js verbose moves.

const FILES = 'abcdefgh';
const PIECE_SRC = (color, type) => `vendor/pieces/${color}${type.toUpperCase()}.svg`;

export class Board {
  constructor(el, opts) {
    this.el = el;
    this.opts = opts; // { legal(sq) -> moves[], onMove(from, to, promotion) }
    this.state = { fen: null, orientation: 'white', lastMove: null, check: null, arrows: [], movable: false };
    this.selected = null;
    this.drag = null;
    el.classList.add('fx-board');
    el.innerHTML = '<div class="fx-squares"></div><svg class="fx-arrows" viewBox="0 0 800 800" aria-hidden="true"></svg><div class="fx-promo" hidden></div>';
    this.squaresEl = el.querySelector('.fx-squares');
    this.arrowsEl = el.querySelector('.fx-arrows');
    this.promoEl = el.querySelector('.fx-promo');
    this.squaresEl.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMoveDrag(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', () => this.cancelDrag());
  }

  set(patch) {
    Object.assign(this.state, patch);
    if ('fen' in patch || 'movable' in patch) this.selected = null;
    this.render();
  }

  squareAt(clientX, clientY) {
    const r = this.squaresEl.getBoundingClientRect();
    const x = Math.floor(((clientX - r.left) / r.width) * 8);
    const y = Math.floor(((clientY - r.top) / r.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return this.state.orientation === 'white' ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);
  }

  pieceMap() {
    const map = {};
    if (!this.state.fen) return map;
    const rows = this.state.fen.split(' ')[0].split('/');
    rows.forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) fi += Number(ch);
        else {
          map[FILES[fi] + (8 - ri)] = { color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase() };
          fi++;
        }
      }
    });
    return map;
  }

  render() {
    const { orientation, lastMove, check } = this.state;
    const pieces = this.pieceMap();
    const dests = new Set(this.selected ? this.opts.legal(this.selected).map((m) => m.to) : []);
    const html = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const sq = orientation === 'white' ? FILES[x] + (8 - y) : FILES[7 - x] + (y + 1);
        const dark = (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1;
        const cls = ['fx-sq', dark ? 'dark' : 'light'];
        if (lastMove && (lastMove[0] === sq || lastMove[1] === sq)) cls.push('last');
        if (this.selected === sq) cls.push('sel');
        if (check === sq) cls.push('check');
        if (dests.has(sq)) cls.push(pieces[sq] ? 'cap' : 'dest');
        const p = pieces[sq];
        let inner = '';
        if (x === 0) inner += `<span class="fx-coord rank">${sq[1]}</span>`;
        if (y === 7) inner += `<span class="fx-coord file">${sq[0]}</span>`;
        if (p && !(this.drag && this.drag.from === sq && this.drag.started)) {
          inner += `<img class="fx-piece" draggable="false" alt="" src="${PIECE_SRC(p.color, p.type)}">`;
        }
        html.push(`<div class="${cls.join(' ')}" data-sq="${sq}">${inner}</div>`);
      }
    }
    this.squaresEl.innerHTML = html.join('');
    this.renderArrows();
  }

  center(sq) {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    const x = this.state.orientation === 'white' ? f : 7 - f;
    const y = this.state.orientation === 'white' ? 7 - r : r;
    return [x * 100 + 50, y * 100 + 50];
  }

  renderArrows() {
    const parts = [];
    (this.state.arrows || []).forEach((a, i) => {
      const [x1, y1] = this.center(a.from);
      const [x2, y2] = this.center(a.to);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const len = Math.hypot(x2 - x1, y2 - y1) - 30;
      const ex = x1 + Math.cos(ang) * len;
      const ey = y1 + Math.sin(ang) * len;
      const w = a.width || 16;
      const color = a.color || 'rgba(21,120,27,.75)';
      parts.push(`<defs><marker id="ah${i}" markerWidth="4" markerHeight="4" refX="1.2" refY="2" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L4,2 L0,4 z" fill="${color}"/></marker></defs>`);
      parts.push(`<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" marker-end="url(#ah${i})" opacity="${a.opacity ?? 1}"/>`);
    });
    this.arrowsEl.innerHTML = parts.join('');
  }

  ownPiece(sq) {
    const p = this.pieceMap()[sq];
    const turn = this.state.fen ? this.state.fen.split(' ')[1] : 'w';
    return p && p.color === turn;
  }

  onDown(e) {
    if (e.button !== 0 || !this.state.movable) return;
    const sq = this.squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (this.selected && this.selected !== sq && this.opts.legal(this.selected).some((m) => m.to === sq)) {
      e.preventDefault();
      this.tryMove(this.selected, sq);
      return;
    }
    if (!this.ownPiece(sq)) {
      this.selected = null;
      this.render();
      return;
    }
    e.preventDefault();
    const wasSelected = this.selected === sq;
    this.selected = sq;
    this.drag = { from: sq, x: e.clientX, y: e.clientY, started: false, wasSelected, piece: this.pieceMap()[sq] };
    this.render();
  }

  onMoveDrag(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.started && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    if (!d.started) {
      d.started = true;
      const size = this.squaresEl.getBoundingClientRect().width / 8;
      d.ghost = document.createElement('img');
      d.ghost.src = PIECE_SRC(d.piece.color, d.piece.type);
      d.ghost.className = 'fx-ghost';
      d.ghost.style.width = d.ghost.style.height = size + 'px';
      document.body.appendChild(d.ghost);
      this.render();
    }
    const size = parseFloat(d.ghost.style.width);
    d.ghost.style.transform = `translate(${e.clientX - size / 2}px, ${e.clientY - size / 2}px)`;
    this.squaresEl.querySelectorAll('.hover').forEach((n) => n.classList.remove('hover'));
    const over = this.squareAt(e.clientX, e.clientY);
    if (over) this.squaresEl.querySelector(`[data-sq="${over}"]`)?.classList.add('hover');
  }

  onUp(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.ghost) d.ghost.remove();
    if (!d.started) {
      if (d.wasSelected) { this.selected = null; this.render(); }
      return;
    }
    const to = this.squareAt(e.clientX, e.clientY);
    if (to && to !== d.from && this.opts.legal(d.from).some((m) => m.to === to)) this.tryMove(d.from, to);
    else this.render();
  }

  cancelDrag() {
    if (!this.drag) return;
    if (this.drag.ghost) this.drag.ghost.remove();
    this.drag = null;
    this.render();
  }

  tryMove(from, to) {
    const moves = this.opts.legal(from).filter((m) => m.to === to);
    this.selected = null;
    if (moves.some((m) => m.promotion)) {
      this.askPromotion().then((promo) => {
        if (promo) this.opts.onMove(from, to, promo);
        else this.render();
      });
      return;
    }
    this.opts.onMove(from, to);
  }

  askPromotion() {
    const color = this.state.fen.split(' ')[1];
    return new Promise((resolve) => {
      this.promoEl.hidden = false;
      this.promoEl.innerHTML = ['q', 'r', 'b', 'n']
        .map((t) => `<button type="button" data-p="${t}" aria-label="Promote"><img alt="" src="${PIECE_SRC(color, t)}"></button>`)
        .join('') + '<button type="button" class="x" data-p="" aria-label="Cancel">✕</button>';
      this.promoEl.onclick = (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        this.promoEl.hidden = true;
        resolve(b.dataset.p || null);
      };
    });
  }
}
