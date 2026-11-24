// Stockfish 19 in a Web Worker, spoken to over UCI.
//
// Two builds:
//   lite — bundled here (≈1.8 MB), loads instantly, still far above any human.
//   full — the full NNUE network (≈95 MB). Too big for the repo, so only the
//          small loader script is bundled and the .wasm is fetched from unpkg;
//          the loader reads the wasm URL from its own #hash.
//
// Searches are serialised: starting a new one stops the running search and
// any search that was queued but not started yet resolves to null.

const V = '1';
const FULL_WASM = 'https://unpkg.com/stockfish@19.0.1/bin/stockfish-19-single.wasm';

export const ENGINES = {
  lite: { label: 'Stockfish 19 Lite', url: `vendor/stockfish/stockfish-19-lite-single.js?v=${V}` },
  full: { label: 'Stockfish 19 Full NNUE', url: `vendor/stockfish/stockfish-19-single.js?v=${V}#${encodeURIComponent(FULL_WASM)}` },
};

export class Engine {
  constructor(kind = 'lite') {
    this.kind = kind;
    this.listeners = new Set();
    this.chain = Promise.resolve();
    this.gen = 0;
    this.running = null;
    this.ready = this.boot();
  }

  boot() {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(ENGINES[this.kind].url);
      this.worker.onerror = (e) => reject(new Error(e.message || 'Engine failed to load'));
      this.worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (!line) {
          if (e.data && typeof e.data.percent === 'number') this.onProgress?.(e.data);
          return;
        }
        if (line === 'uciok') this.post('isready');
        if (line === 'readyok' && !this.booted) { this.booted = true; resolve(); }
        this.listeners.forEach((fn) => fn(line));
      };
      this.post('uci');
    });
  }

  post(cmd) { this.worker.postMessage(cmd); }

  terminate() {
    this.gen++;
    this.worker?.terminate();
  }

  stop() {
    this.gen++;
    if (this.running) this.post('stop');
  }

  // opts: { depth, movetime, infinite, multipv, elo, skill, onInfo(lines, depth) }
  // Resolves { best, lines } where each line is { multipv, depth, cp|mate, pv[] }
  // scored from the side to move — or null if superseded.
  search(fen, opts = {}) {
    const myGen = ++this.gen;
    if (this.running) this.post('stop');
    const job = this.chain.then(() => (myGen === this.gen ? this.run(fen, opts, myGen) : null));
    this.chain = job.catch(() => null);
    return job;
  }

  async run(fen, opts, myGen) {
    await this.ready;
    if (myGen !== this.gen) return null;
    const multipv = opts.multipv || 1;
    this.post(`setoption name MultiPV value ${multipv}`);
    if (opts.elo && opts.elo >= 1320) {
      this.post('setoption name Skill Level value 20');
      this.post('setoption name UCI_LimitStrength value true');
      this.post(`setoption name UCI_Elo value ${Math.min(3190, opts.elo)}`);
    } else {
      this.post('setoption name UCI_LimitStrength value false');
      this.post(`setoption name Skill Level value ${opts.skill ?? 20}`);
    }
    if (opts.hash) this.post(`setoption name Hash value ${opts.hash}`);
    return new Promise((resolve) => {
      const lines = [];
      let lastEmit = 0;
      const onLine = (line) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          const info = parseInfo(line);
          if (!info) return;
          lines[info.multipv - 1] = info;
          const now = performance.now();
          if (opts.onInfo && myGen === this.gen && now - lastEmit > 120) {
            lastEmit = now;
            opts.onInfo(lines.filter(Boolean), info.depth);
          }
        } else if (line.startsWith('bestmove')) {
          this.listeners.delete(onLine);
          this.running = null;
          const best = line.split(' ')[1];
          const done = lines.filter(Boolean);
          if (opts.onInfo && myGen === this.gen && done.length) opts.onInfo(done, done[0].depth);
          resolve(myGen === this.gen || opts.keep ? { best: best === '(none)' ? null : best, lines: done } : null);
        }
      };
      this.listeners.add(onLine);
      this.running = true;
      this.post(`position fen ${fen}`);
      if (opts.infinite) this.post('go infinite');
      else if (opts.movetime && opts.depth) this.post(`go depth ${opts.depth} movetime ${opts.movetime}`);
      else if (opts.movetime) this.post(`go movetime ${opts.movetime}`);
      else this.post(`go depth ${opts.depth || 18}`);
    });
  }
}

function parseInfo(line) {
  const t = line.split(' ');
  const out = { multipv: 1, pv: [] };
  for (let i = 1; i < t.length; i++) {
    switch (t[i]) {
      case 'depth': out.depth = +t[++i]; break;
      case 'seldepth': out.seldepth = +t[++i]; break;
      case 'multipv': out.multipv = +t[++i]; break;
      case 'nodes': out.nodes = +t[++i]; break;
      case 'nps': out.nps = +t[++i]; break;
      case 'score':
        if (t[i + 1] === 'cp') out.cp = +t[i + 2];
        else if (t[i + 1] === 'mate') out.mate = +t[i + 2];
        i += 2;
        if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') return null;
        break;
      case 'pv': out.pv = t.slice(i + 1); i = t.length; break;
      default: break;
    }
  }
  return out.depth ? out : null;
}
