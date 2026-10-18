/**
 * ELI5: A tiny playable round of Knuckles on the web page: you roll, drop a die in a column, and a simple rival answers.
 * What: Self-contained demo for the #try table in index.html. Same scoring as the app (each face counts value x copies in its column);
 *       a die knocks out matching faces in the rival's same column. No network, no storage.
 * Owns: The demo's board state, scoring, rival pick, and result overlay.
 * Depends on: index.html #try-table markup (#oppBoard, #myBoard, #rolled, #status, #rollBtn, #bang, #result, #again), art/die-1..6.svg, knuckles.css.
 */
(() => {
  const DIE_SRC = (v) => `./art/die-${v}.svg`;
  const COLS = 3;
  const COL_SIZE = 3;
  const START_STATUS = 'Roll a die, then tap one of your columns.';
  const boards = { me: [[], [], []], opp: [[], [], []] };
  let rolled = null;
  let busy = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const myBoard = $('myBoard'), oppBoard = $('oppBoard'), rollBtn = $('rollBtn'), status = $('status');
  const table = $('try-table');
  if (!table || !myBoard || !oppBoard) return;

  const colScore = (col) => col.reduce((s, v) => s + v * col.filter((x) => x === v).length, 0);
  const total = (b) => b.reduce((s, c) => s + colScore(c), 0);
  const full = (b) => b.every((c) => c.length === COL_SIZE);
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 120) : ms));
  const d6 = () => 1 + Math.floor(Math.random() * 6);

  function render() {
    for (const [who, el] of [['me', myBoard], ['opp', oppBoard]]) {
      el.innerHTML = '';
      boards[who].forEach((col, i) => {
        const canDrop = who === 'me' && rolled && col.length < COL_SIZE && !busy;
        const c = document.createElement(who === 'me' ? 'button' : 'div');
        c.className = 'tcol';
        if (who === 'me') {
          c.type = 'button';
          c.disabled = !canDrop;
          c.setAttribute('aria-label', `Column ${i + 1}: ${col.length ? col.join(', ') : 'empty'}, ${colScore(col)} points`);
          c.addEventListener('click', () => place(i));
        }
        // Your dice stack up from the bottom; the rival's stack down from their edge.
        const slots = [0, 1, 2].map((r) => col[r]);
        const order = who === 'me' ? slots.slice().reverse() : slots;
        order.forEach((v) => {
          const s = document.createElement('div');
          s.className = 'tslot';
          if (v) {
            const n = col.filter((x) => x === v).length;
            if (n === 2) s.classList.add('dbl');
            if (n === 3) s.classList.add('tri');
            s.innerHTML = `<img alt="${v}" src="${DIE_SRC(v)}">`;
          }
          c.appendChild(s);
        });
        const sc = document.createElement('div');
        sc.className = 'tcol-score';
        sc.textContent = col.length ? colScore(col) : '';
        const cell = document.createElement('div');
        cell.className = 'tcell';
        if (who === 'me') cell.append(c, sc); else cell.append(sc, c);
        el.appendChild(cell);
      });
    }
    $('myScore').textContent = total(boards.me);
    $('oppScore').textContent = total(boards.opp);
  }

  function showRolled(v) {
    const r = $('rolled');
    r.innerHTML = v ? `<img alt="You rolled a ${v}" src="${DIE_SRC(v)}">` : `<img alt="" src="${DIE_SRC(6)}" style="opacity:.25">`;
    if (v && !reduce) { r.classList.remove('spin'); void r.offsetWidth; r.classList.add('spin'); }
  }

  function bangAt(el) {
    const b = $('bang');
    const t = table.getBoundingClientRect(), r = el.getBoundingClientRect();
    b.style.left = `${r.left - t.left + r.width / 2}px`;
    b.style.top = `${r.top - t.top + r.height / 2}px`;
    b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  }

  // Drop v into column i for `who`; knock out matching dice in the rival's same column.
  async function drop(who, i, v) {
    boards[who][i].push(v);
    const rival = who === 'me' ? 'opp' : 'me';
    const hits = boards[rival][i].filter((x) => x === v).length;
    render();
    if (hits) {
      const colEl = (rival === 'me' ? myBoard : oppBoard).children[i];
      const doomed = [...colEl.querySelectorAll('.tslot img')].filter((img) => img.alt === String(v));
      bangAt(doomed[0] || colEl);
      if (!reduce) { doomed.forEach((d) => d.classList.add('smash')); await wait(340); }
      boards[rival][i] = boards[rival][i].filter((x) => x !== v);
      render();
    }
    return hits;
  }

  // Rival: prefer knocking out your dice, then matching its own, else the emptiest column.
  function aiPick(v) {
    const open = [0, 1, 2].filter((i) => boards.opp[i].length < COL_SIZE);
    const score = (i) => {
      const knock = boards.me[i].filter((x) => x === v).length * v * 3;
      const match = boards.opp[i].filter((x) => x === v).length * v * 2;
      return knock + match + (COL_SIZE - boards.opp[i].length) * 0.5 + Math.random();
    };
    return open.sort((a, b) => score(b) - score(a))[0];
  }

  async function maybeEnd() {
    if (!full(boards.me) && !full(boards.opp)) return false;
    const me = total(boards.me), opp = total(boards.opp);
    await wait(500);
    $('resultTitle').textContent = me > opp ? 'You win!' : me < opp ? 'Rival wins' : 'Dead heat';
    $('resultText').textContent = `${me} to ${opp}. The full game has smarter AI, friends, and a whole lot more.`;
    $('result').classList.add('show');
    rollBtn.disabled = true;
    return true;
  }

  async function place(i) {
    if (!rolled || busy || boards.me[i].length >= COL_SIZE) return;
    busy = true;
    const v = rolled; rolled = null; showRolled(null);
    const hits = await drop('me', i, v);
    status.textContent = hits ? `Knuckles! You smashed ${hits} of their ${v}s.` : `You dropped a ${v}.`;
    if (await maybeEnd()) return;
    await wait(650);
    const av = d6();
    status.textContent = `Rival rolled a ${av}…`;
    await wait(550);
    const ahits = await drop('opp', aiPick(av), av);
    status.textContent = ahits ? `Ouch. Rival smashed ${ahits} of your ${av}s. Your roll.` : `Rival dropped a ${av}. Your roll.`;
    if (await maybeEnd()) return;
    busy = false;
    rollBtn.disabled = false;
    render();
  }

  rollBtn.addEventListener('click', () => {
    if (busy || rolled) return;
    rolled = d6();
    showRolled(rolled);
    rollBtn.disabled = true;
    status.textContent = `You rolled a ${rolled}. Tap a column.`;
    render();
  });

  $('again').addEventListener('click', () => {
    boards.me = [[], [], []]; boards.opp = [[], [], []];
    rolled = null; busy = false; rollBtn.disabled = false;
    $('result').classList.remove('show');
    showRolled(null);
    status.textContent = START_STATUS;
    render();
  });

  render();
})();
