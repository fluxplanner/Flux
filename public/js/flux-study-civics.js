/* ============================================================================
   FLUX STUDY HUB · Government & Civics module

   Added as its own subject rather than a tab inside History & Geo: that module
   is world dates and capital cities, and US government shares almost nothing
   with it beyond the word "history". Burying branches, amendments and case law
   under a timeline builder would mean nobody found them.

   Case law carries the year and, where it applies, what later overturned it —
   a civics reference that still lists Plessy or Roe as settled law is worse
   than no reference at all.

   Registers with fluxStudyHub. No storage — the drill score is per session.
   ========================================================================== */
(function () {
  'use strict';
  function boot() {
    const H = window.fluxStudyHub;
    if (!H || !H.register) { return setTimeout(boot, 60); }
    const esc = H.helpers.esc;

    const card = (title, sub, inner) =>
      `<div class="fsh-card" style="padding:20px"><h3 style="margin:0 0 4px;font-size:16px">${esc(title)}</h3>`
      + (sub ? `<p class="sub" style="color:var(--fsh-mut);font-size:12px;margin:0 0 14px">${sub}</p>` : '')
      + inner + '</div>';
    const refList = (rows) => `<div class="fsh-formula-list">${rows.map((r) =>
      `<div class="fsh-formula"><div class="fx" style="font-size:14px;font-family:inherit">${esc(r[0])}</div>`
      + `<div class="nm" style="margin-top:3px">${esc(r[1])}</div>`
      + (r[2] ? `<div class="nm" style="color:var(--fsh-ink-2)">${esc(r[2])}</div>` : '')
      + '</div>').join('')}</div>`;

    // ── The three branches ───────────────────────────────────────────────────
    const BRANCHES = [
      ['Legislative — Congress', 'Article I. Makes law.',
        'House (435, two-year terms, by population) and Senate (100, six-year terms, two per state). Declares war, controls spending, impeaches.'],
      ['Executive — President', 'Article II. Carries out law.',
        'Four-year terms, capped at two by the 22nd Amendment. Commander-in-chief, vetoes bills, makes treaties and nominations, pardons.'],
      ['Judicial — the courts', 'Article III. Interprets law.',
        'Supreme Court plus lower federal courts. Appointed for life. Judicial review comes from Marbury v. Madison, not from the text.'],
    ];
    const CHECKS = [
      ['Congress checks the President', 'Override a veto by two-thirds of both houses', 'Also confirms nominations, ratifies treaties, controls the purse, impeaches and removes.'],
      ['Congress checks the courts', 'Approves or rejects judges; can propose amendments', 'Can also change the size and jurisdiction of the lower courts.'],
      ['The President checks Congress', 'Veto a bill', 'Can also call special sessions.'],
      ['The President checks the courts', 'Nominates federal judges; grants pardons', ''],
      ['The courts check Congress', 'Declare a law unconstitutional', 'Judicial review.'],
      ['The courts check the President', 'Declare an executive act unconstitutional', 'United States v. Nixon is the clearest example.'],
    ];
    const BILL = [
      ['1. Introduction', 'A member introduces the bill in the House or Senate', 'Revenue bills must start in the House.'],
      ['2. Committee', 'Sent to committee, where most bills die', 'Hearings, mark-up, then a vote to report it out.'],
      ['3. Floor debate', 'Debated and voted on in that chamber', 'In the Senate a filibuster can be ended only by cloture — 60 votes.'],
      ['4. The other chamber', 'The whole process repeats', 'Both chambers must pass an identical text.'],
      ['5. Conference', 'Differences reconciled in a conference committee', 'The compromise goes back to both chambers.'],
      ['6. The President', 'Sign, veto, or do nothing', 'Doing nothing for 10 days while Congress sits makes it law; if Congress adjourns, it dies — a pocket veto.'],
    ];
    function renderStructure(body) {
      body.innerHTML = card('The three branches', 'What each one is and where it comes from.', refList(BRANCHES))
        + card('Checks and balances', 'Who can stop whom.', refList(CHECKS))
        + card('How a bill becomes law', 'The route almost no bill survives.', refList(BILL));
    }

    // ── Amendments ───────────────────────────────────────────────────────────
    const AMEND = [
      ['1st', 'Religion, speech, press, assembly, petition', 'No established religion, and no law abridging free exercise.'],
      ['2nd', 'Right to keep and bear arms', 'Applied to the states in McDonald v. Chicago (2010).'],
      ['3rd', 'No quartering of soldiers in your home', 'Almost never litigated.'],
      ['4th', 'No unreasonable searches or seizures', 'Warrants need probable cause. Evidence obtained in breach is excluded (Mapp v. Ohio).'],
      ['5th', 'Grand jury, double jeopardy, self-incrimination, due process, eminent domain', 'The "plead the Fifth" amendment. Property taken needs just compensation.'],
      ['6th', 'Speedy, public trial by an impartial jury', 'Right to confront witnesses and to counsel (Gideon v. Wainwright).'],
      ['7th', 'Jury trial in civil cases', 'Applies in federal civil suits above a threshold.'],
      ['8th', 'No excessive bail or fines, no cruel and unusual punishment', ''],
      ['9th', 'Rights not listed are still retained by the people', 'Listing some rights does not deny the rest.'],
      ['10th', 'Powers not given to the federal government are reserved', 'To the states, or to the people. The basis of most federalism arguments.'],
      ['13th (1865)', 'Abolished slavery', 'Except as punishment for a crime.'],
      ['14th (1868)', 'Citizenship, due process, equal protection', 'The route by which most of the Bill of Rights binds the states.'],
      ['15th (1870)', 'The vote cannot be denied by race', 'Evaded for a century by poll taxes and literacy tests.'],
      ['16th (1913)', 'Federal income tax', ''],
      ['17th (1913)', 'Direct election of senators', 'Previously chosen by state legislatures.'],
      ['18th (1919)', 'Prohibition', 'Repealed by the 21st in 1933 — the only amendment ever undone.'],
      ['19th (1920)', 'Women’s suffrage', ''],
      ['22nd (1951)', 'Two-term limit on the presidency', 'A response to Franklin Roosevelt’s four elections.'],
      ['24th (1964)', 'No poll tax in federal elections', ''],
      ['25th (1967)', 'Presidential succession and disability', 'How a Vice President takes over, and how a President can be found unable to serve.'],
      ['26th (1971)', 'Voting age lowered to 18', 'Argued from conscription in Vietnam.'],
    ];
    function renderAmendments(body) {
      body.innerHTML = card('Amendments', 'The Bill of Rights, then the later ones that come up most. Search by number or by right.',
        '<div class="fsh-field"><input id="cvAQ" class="fsh-input" placeholder="e.g. speech, search, vote, 14th" spellcheck="false"></div>'
        + '<div id="cvAList" style="margin-top:14px"></div>');
      const draw = (q) => {
        const t = q.trim().toLowerCase();
        const hits = !t ? AMEND : AMEND.filter((a) => (a[0] + ' ' + a[1] + ' ' + a[2]).toLowerCase().indexOf(t) >= 0);
        document.getElementById('cvAList').innerHTML = hits.length
          ? refList(hits) : `<p style="color:var(--fsh-mut)">Nothing matches &ldquo;${esc(q)}&rdquo;.</p>`;
      };
      document.getElementById('cvAQ').addEventListener('input', (e) => draw(e.target.value));
      draw('');
    }

    // ── Landmark cases ───────────────────────────────────────────────────────
    /* The third column carries the later history wherever there is any. A
       student revising from a list that still calls Plessy or Roe good law
       would walk into an exam with a wrong answer. */
    const CASES = [
      ['Marbury v. Madison (1803)', 'Established judicial review', 'The Court can strike down laws that conflict with the Constitution.'],
      ['McCulloch v. Maryland (1819)', 'Implied powers; states cannot tax the federal government', 'Read the necessary and proper clause broadly.'],
      ['Gibbons v. Ogden (1824)', 'Federal power over interstate commerce', ''],
      ['Dred Scott v. Sandford (1857)', 'Held that Black Americans were not citizens', 'Overturned by the 13th and 14th Amendments. Widely regarded as the Court’s worst decision.'],
      ['Plessy v. Ferguson (1896)', 'Allowed "separate but equal" segregation', 'Overturned for public schools by Brown v. Board (1954).'],
      ['Schenck v. United States (1919)', 'Speech creating a "clear and present danger" is unprotected', 'Largely superseded by Brandenburg v. Ohio (1969), which requires imminent lawless action.'],
      ['Brown v. Board of Education (1954)', 'Segregated public schools are unconstitutional', 'Overturned Plessy in education. Decided unanimously.'],
      ['Mapp v. Ohio (1961)', 'The exclusionary rule applies to the states', 'Evidence from an illegal search cannot be used.'],
      ['Engel v. Vitale (1962)', 'No official prayer in public schools', 'Establishment clause.'],
      ['Gideon v. Wainwright (1963)', 'Right to a lawyer in state felony cases', 'The state must provide one if you cannot pay.'],
      ['Miranda v. Arizona (1966)', 'Suspects must be told their rights before questioning', 'The Miranda warning.'],
      ['Tinker v. Des Moines (1969)', 'Students keep free speech at school', 'Black armbands. Speech may be restricted only if it substantially disrupts.'],
      ['New York Times v. United States (1971)', 'A heavy burden against prior restraint', 'The Pentagon Papers.'],
      ['Roe v. Wade (1973)', 'Found a constitutional right to abortion', 'OVERTURNED by Dobbs v. Jackson (2022), which returned the question to the states.'],
      ['United States v. Nixon (1974)', 'No absolute executive privilege', 'The President had to hand over the tapes.'],
      ['Texas v. Johnson (1989)', 'Flag burning is protected expression', ''],
      ['Shaw v. Reno (1993)', 'Race-based redistricting can violate equal protection', ''],
      ['United States v. Lopez (1995)', 'A limit on the commerce clause', 'Guns near schools were not interstate commerce.'],
      ['Citizens United v. FEC (2010)', 'Independent political spending is protected speech', 'Corporations and unions may spend without limit.'],
      ['McDonald v. Chicago (2010)', 'The 2nd Amendment binds the states', 'Through the 14th Amendment.'],
      ['Dobbs v. Jackson (2022)', 'Overturned Roe v. Wade', 'Abortion regulation returned to the states.'],
    ];
    function renderCases(body) {
      body.innerHTML = card('Landmark cases', 'With the year, and what later overturned them wherever anything did.',
        '<div class="fsh-field"><input id="cvCQ" class="fsh-input" placeholder="e.g. speech, school, search, 1954" spellcheck="false"></div>'
        + '<div id="cvCList" style="margin-top:14px"></div>');
      const draw = (q) => {
        const t = q.trim().toLowerCase();
        const hits = !t ? CASES : CASES.filter((c) => (c[0] + ' ' + c[1] + ' ' + c[2]).toLowerCase().indexOf(t) >= 0);
        document.getElementById('cvCList').innerHTML = hits.length
          ? refList(hits) : `<p style="color:var(--fsh-mut)">Nothing matches &ldquo;${esc(q)}&rdquo;.</p>`;
      };
      document.getElementById('cvCQ').addEventListener('input', (e) => draw(e.target.value));
      draw('');
    }

    // ── Drill ────────────────────────────────────────────────────────────────
    const BR3 = ['Legislative', 'Executive', 'Judicial'];
    const QS = [
      ['Which branch declares war?', 'Legislative', BR3, 'Congress declares war, though the President commands the armed forces.'],
      ['Which branch vetoes a bill?', 'Executive', BR3, 'The President. Congress can override with two-thirds of both houses.'],
      ['Which branch can declare a law unconstitutional?', 'Judicial', BR3, 'Judicial review, established in Marbury v. Madison.'],
      ['Which branch confirms Supreme Court nominees?', 'Legislative', BR3, 'The Senate confirms; the President nominates.'],
      ['Which branch grants pardons?', 'Executive', BR3, 'The President, for federal offences only.'],
      ['Which branch controls federal spending?', 'Legislative', BR3, 'The power of the purse belongs to Congress.'],
      ['Which amendment protects free speech?', '1st', ['1st', '4th', '5th', '14th'], 'The 1st: religion, speech, press, assembly, petition.'],
      ['Which amendment protects against unreasonable searches?', '4th', ['1st', '4th', '5th', '8th'], 'The 4th. Warrants require probable cause.'],
      ['Which amendment lets you refuse to incriminate yourself?', '5th', ['4th', '5th', '6th', '8th'], 'The 5th — "pleading the Fifth".'],
      ['Which amendment guarantees you a lawyer?', '6th', ['5th', '6th', '7th', '8th'], 'The 6th, applied to the states by Gideon v. Wainwright.'],
      ['Which amendment bars cruel and unusual punishment?', '8th', ['5th', '6th', '8th', '10th'], 'The 8th, along with excessive bail and fines.'],
      ['Which amendment carries equal protection?', '14th', ['10th', '13th', '14th', '15th'], 'The 14th — citizenship, due process and equal protection.'],
      ['Which case established judicial review?', 'Marbury v. Madison', ['Marbury v. Madison', 'McCulloch v. Maryland', 'Brown v. Board', 'Miranda v. Arizona'], 'Marbury v. Madison (1803).'],
      ['Which case ended segregation in public schools?', 'Brown v. Board', ['Plessy v. Ferguson', 'Brown v. Board', 'Shaw v. Reno', 'Mapp v. Ohio'], 'Brown v. Board of Education (1954), overturning Plessy in education.'],
      ['Which case requires suspects be told their rights?', 'Miranda v. Arizona', ['Gideon v. Wainwright', 'Mapp v. Ohio', 'Miranda v. Arizona', 'Tinker v. Des Moines'], 'Miranda v. Arizona (1966).'],
      ['Which case protects student speech at school?', 'Tinker v. Des Moines', ['Engel v. Vitale', 'Tinker v. Des Moines', 'Texas v. Johnson', 'Schenck v. US'], 'Tinker v. Des Moines (1969) — the armbands case.'],
    ];
    function renderDrill(body) {
      let score = 0, asked = 0, idx = -1;
      body.innerHTML = card('Civics drill', 'Branches, amendments and cases. Score: <b id="cvScore">0 / 0</b>',
        '<div class="fsh-out" style="margin:0 0 12px"><span class="big" style="font-size:16px;line-height:1.5" id="cvQ"></span></div>'
        + '<div id="cvOpts"></div><div id="cvWhy" style="margin-top:10px;font-size:12.5px;color:var(--fsh-mut);line-height:1.55"></div>');
      const $q = body.querySelector('#cvQ'), $o = body.querySelector('#cvOpts'),
        $w = body.querySelector('#cvWhy'), $s = body.querySelector('#cvScore');
      function ask() {
        let n = idx;
        while (n === idx && QS.length > 1) n = Math.floor(Math.random() * QS.length);
        idx = n;
        const it = QS[idx];
        $q.textContent = it[0];
        $w.textContent = '';
        $o.innerHTML = it[2].map((o) =>
          `<button type="button" class="fsh-btn ghost" data-opt="${esc(o)}" style="display:block;width:100%;text-align:left;margin-bottom:8px">${esc(o)}</button>`).join('');
        $o.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
          asked++;
          const right = b.dataset.opt === it[1];
          if (right) score++;
          b.style.background = right ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)';
          if (!right) {
            const c = $o.querySelector('[data-opt="' + CSS.escape(it[1]) + '"]');
            if (c) c.style.background = 'rgba(52,211,153,.25)';
          }
          $w.textContent = it[3];
          $s.textContent = score + ' / ' + asked;
          $o.querySelectorAll('[data-opt]').forEach((x) => { x.disabled = true; });
          setTimeout(ask, 2400);
        }));
      }
      ask();
    }

    H.register('civics', [
      { id: 'structure', name: 'Branches', icon: '🏛', desc: 'three branches checks balances bill becomes law congress president courts', render: renderStructure },
      { id: 'amendments', name: 'Amendments', icon: '📜', desc: 'bill of rights amendments constitution speech search vote', render: renderAmendments,
        ai: { name: 'amendment', description: 'What an amendment protects. Arg: number or right, e.g. "4th" or "speech".', params: { query: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.query).trim().toLowerCase();
            const m = AMEND.find((x) => (x[0] + ' ' + x[1]).toLowerCase().indexOf(q) >= 0);
            if (!m) throw new Error('No match');
            return { amendment: m[0], protects: m[1], detail: m[2] };
          } } },
      { id: 'cases', name: 'Landmark cases', icon: '⚖', desc: 'supreme court cases marbury brown miranda tinker precedent', render: renderCases,
        ai: { name: 'scotusCase', description: 'What a Supreme Court case decided. Arg: case name.', params: { name: 'string' },
          run: (a) => {
            const q = String(typeof a === 'string' ? a : a.name).trim().toLowerCase();
            const c = CASES.find((x) => x[0].toLowerCase().indexOf(q) >= 0);
            if (!c) throw new Error('No such case');
            return { case: c[0], held: c[1], note: c[2] };
          } } },
      { id: 'drill', name: 'Drill', icon: '🎯', desc: 'civics practice quiz branches amendments cases', render: renderDrill },
    ]);
  }
  boot();
})();
