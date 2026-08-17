#!/usr/bin/env node
/* ============================================================================
   Certification question-bank validator — dual stack.

   Copy this file into the target repo and edit ONLY the CONFIG block.
   Never edit a check body to make a bank pass.

     vanilla stack →  <repo>/tools/check-bank.mjs
     json stack    →  <repo>/scripts/check-bank.mjs   (+ "check:bank" in package.json)

     node tools/check-bank.mjs            report; exits 1 on errors only
     node tools/check-bank.mjs --strict   also fails on under-target counts

   Why .mjs and not .js: the vanilla reference repo has no package.json, so a
   CommonJS `require` works there — but a repo with "type": "module" throws
   `require is not defined`. The .mjs extension is unambiguous in both.
   `node:vm` imports fine from ESM, so the vanilla loader still works.
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

/** Reads `--name=value` from argv. Cross-platform, unlike an env-var prefix. */
function argOf(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const CERT_ID = argOf("cert") ?? "sc500";

/* Blueprint traceability table for THIS certification, kept beside this file as
   `skill-refs-<certId>.mjs`. The bullets are per-exam, so the file must be too:
   loading one certification's table while checking another reports every bullet
   as undeclared, which looks like a broken bank and is really a broken lookup.
   Absent for a certification not yet mapped to its skills bullets, in which case
   the skillRef checks are skipped rather than failing the run. */
let SKILL_REFS = null;
try {
  const p = path.join(import.meta.dirname, `skill-refs-${CERT_ID}.mjs`);
  if (fs.existsSync(p)) SKILL_REFS = await import(pathToFileURL(p).href);
} catch (e) {
  console.error(`WARN: skill-refs-${CERT_ID}.mjs present but failed to load — ${e.message}`);
}

/* ==========================================================================
   CONFIG — the only block you edit
   ========================================================================== */
const CONFIG = {
  stack: "json",                     // 'vanilla' | 'json'

  // ---- vanilla stack -----------------------------------------------------
  files: ["questions.js", "data.js"], // evaluated in order, relative to repo root
  namespace: "CCDV",                  // window.<namespace> = { QUESTIONS, DOMAINS }

  // ---- json stack --------------------------------------------------------
  contentDir: "src/content",
  // Read from `--cert=<id>` rather than an env var: `CERT_ID=x node ...` is a
  // POSIX-only prefix, and this repo is developed on Windows and built on Ubuntu.
  certId: CERT_ID,

  // ---- both --------------------------------------------------------------
  /** Bank composition targets. Keys must match the referential's domain ids.
      Left empty deliberately: the bank predates blueprint-proportional sizing
      (d1 is over-weighted, d2 under-weighted), and the aggregate section reports
      the actual per-domain counts either way. What governs exam validity is the
      weighted draw, not the bank's own proportions — so the number to chase is
      the expected-overlap figure printed under expectedAlloc, not these. */
  domainTarget: {},                   // e.g. { 1: 51, 2: 25 }  or  { d1: 120 }
  subTarget: {},                      // e.g. { "Claude API Mechanics": 12 } or { "o1-1": 40 }
  /** Exam lengths to assert the weighted allocation against — filled from
      PER_CERT below, because every certification has its own weights. Asserting
      one cert's allocation against another's is a config bug that looks exactly
      like a broken allocator, so this must never be a single shared table. */
  expectedAlloc: {},

  // Measured over the 543-item SC-500 bank: every choice item has exactly 4
  // options, except the 39 Yes/No solution-goal items, which are exempt.
  optionCounts: { single: [4, 4], multiple: [4, 4] },
  maxOptions: 6,                      // QuestionCard's LETTERS array has 6 entries and no guard
  lengthRatioMax: 1.6,
  longestIsCorrectMaxPct: 40,
  scenarioSharePct: null,             // AZ-Study-Guide items carry no `kind` field

  /** Legacy content predates these rules: the provenance rules and the length
      rule are reported as warnings instead of errors. Never set this on new
      content — it is an amnesty for an existing backlog, not an opt-out.

      SC-500 remediation status: `src` has been backfilled across the bank, so
      requireSrc is enforced. `outdated` is only assertable where a distractor
      genuinely names an outdated practice from the fact sheet's stock table;
      backfilling it across 543 items would mean rewriting an option in most of
      them, which is a rewrite and not a remediation. It is therefore enforced on
      new content and reported as a backlog below. */
  legacy: !process.argv.includes("--no-legacy"),
  requireSrc: true,
  requireOutdated: false,

  /** Objectives whose content has been remediated to the current standard. The
      legacy amnesty does NOT apply to these, so a regression in a finished file
      fails CI. Add an objective the moment `show-tells.mjs` reports 0 for it —
      that is what turns the gate into a ratchet instead of a permanent warning. */
  strictObjectives: [],
};

/* ==========================================================================
   Per-certification overrides. Everything above is shared; anything that
   depends on a specific blueprint belongs here.

   `expectedAlloc` is a regression test on allocateByWeight, not on the bank:
   40 and 60 bracket the estimated item-count range, 55 is the app's
   DEFAULT_EXAM_QUESTION_COUNT. SC-500's midpoints are 22.5/27.5/22.5/22.5, so
   three domains tie EXACTLY and these numbers only hold with the 3-key
   tie-break — which is precisely why they are asserted.
   ========================================================================== */
const PER_CERT = {
  sc500: {
    expectedAlloc: {
      40: { d1: 10, d2: 12, d3: 9, d4: 9 },
      55: { d1: 13, d2: 16, d3: 13, d4: 13 },
      60: { d1: 14, d2: 18, d3: 14, d4: 14 },
    },
    // The SC-500 rework backfilled src across the bank; az500 has none yet.
    requireSrc: true,
    // Remediated: 0 option-length tells, 0 short explanations. Add an objective
    // the moment `show-tells.mjs` reports 0 for it — the amnesty stops applying
    // to it from then on, so a regression in a finished file fails CI.
    strictObjectives: [
      "o1-1", "o1-2", "o1-3", "o1-4", "o2-1", "o2-2", "o2-3",
      "o3-1", "o3-2", "o3-3",
      "o4-1", "o4-2", "o4-3",
    ],
  },
  az500: {
    expectedAlloc: {
      40: { d1: 7, d2: 10, d3: 9, d4: 14 },
      55: { d1: 10, d2: 13, d3: 13, d4: 19 },
      60: { d1: 11, d2: 14, d3: 14, d4: 21 },
    },
    // Not yet reworked: no fact sheet, so no src to require. Reported, not failed.
    requireSrc: false,
  },
};
Object.assign(CONFIG, PER_CERT[CONFIG.certId] ?? {});

/* ==========================================================================
   Loaders
   ========================================================================== */
const ROOT = process.cwd();
const STRICT = process.argv.includes("--strict");
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
/**
 * Provenance, length and explanation rules downgrade to warnings on legacy
 * content — but the amnesty is per objective, not global. An objective listed in
 * `strictObjectives` has been remediated, so its rules are errors again.
 *
 * That makes the CI gate a RATCHET: it lands today over an existing backlog, and
 * every file finished tightens it permanently. A global flag would instead have
 * to stay off until the last of 543 items was fixed, which is how a gate ends up
 * never being enabled at all.
 */
const strictFor = (objId) =>
  !CONFIG.legacy || (objId !== undefined && (CONFIG.strictObjectives ?? []).includes(objId));
const rule = (m, objId) => (strictFor(objId) ? err(m) : warn(`[legacy] ${m}`));

/** Strips a trailing "(6.8%)" from a sub-skill label. Anchored and
    non-ambiguous so it cannot backtrack. */
const stripPct = (s) => s.replace(/\(\d+(?:\.\d+)?%\)$/, "").trimEnd();

function loadVanilla() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  for (const f of CONFIG.files) {
    const p = path.join(ROOT, f);
    try {
      // NOSONAR javascript:S1523 — deliberate. These are first-party files from
      // the repo being validated, evaluated in a bare sandbox with no fs, no
      // net and no process, purely to read the bank they declare on `window`.
      vm.runInNewContext(fs.readFileSync(p, "utf8"), sandbox, { filename: f });
    } catch (e) {
      console.error(`FATAL: ${f} failed to evaluate — ${e.message}`);
      process.exit(1);
    }
  }
  const ns = sandbox.window[CONFIG.namespace];
  if (!ns) { console.error(`FATAL: window.${CONFIG.namespace} is undefined`); process.exit(1); }

  const domains = ns.DOMAINS.map((d) => ({
    id: d.id,
    name: d.nom ?? d.name,
    weight: d.poids ?? d.weight,
    subs: (d.skills ?? []).map((s) => stripPct(s.nom ?? s.name)),
  }));
  const items = ns.QUESTIONS.map((q, i) => ({ ...q, _where: `${CONFIG.namespace}[${i}]` }));
  return { domains, items, caseStudies: new Map() };
}

function loadJson() {
  const dir = path.join(ROOT, CONFIG.contentDir, CONFIG.certId);
  const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  let ref;
  try {
    ref = read(path.join(dir, "domains.json"));
  } catch (e) {
    console.error(`FATAL: cannot read ${dir}/domains.json — ${e.message}`);
    process.exit(1);
  }

  const objByDomain = {};
  for (const o of ref.objectives ?? []) {
    objByDomain[o.domainId] ??= [];
    objByDomain[o.domainId].push(o.id);
  }
  const domains = ref.domains.map((d) => ({
    id: d.id,
    name: d.name,
    // Microsoft publishes ranges; allocateByWeight normalises by the sum, so
    // the midpoint is the faithful collapse.
    weight: d.weightPercent ? (d.weightPercent.min + d.weightPercent.max) / 2 : d.weight,
    raw: d.weightPercent,
    subs: objByDomain[d.id] ?? [],
  }));

  const quizDir = path.join(dir, "quiz");
  const items = fs.readdirSync(quizDir).filter((f) => f.endsWith(".json")).flatMap((f) =>
    read(path.join(quizDir, f)).map((q, i) => ({ ...q, _file: f, _where: `${f}[${i}]` })));

  const caseStudies = new Map();
  const csPath = path.join(dir, "case-studies.json");
  if (fs.existsSync(csPath)) for (const cs of read(csPath)) caseStudies.set(cs.id, cs);

  return { domains, items, caseStudies, exam: ref.exam, objectives: ref.objectives ?? [] };
}

/* ==========================================================================
   Normaliser — both stacks collapse to one record.
   This function is itself a test: see correctIdx below.
   ========================================================================== */
/** `outdated` may be authored as a bare index or a list; absent means absent. */
function toIdxList(v) {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v : [v];
}

function normalise(raw, ctx) {
  const isVanilla = CONFIG.stack === "vanilla";
  const objDomain = new Map((ctx.objectives ?? []).map((o) => [o.id, o.domainId]));

  return raw.map((q) => {
    const rawType = q.type ?? "single";
    const options = q.options ?? q.choices ?? null;

    let correctIdx;
    if (isVanilla) {
      correctIdx = Array.isArray(q.correct) ? q.correct.slice() : [q.correct];
    } else if (options && q.correctAnswers) {
      // The most valuable line in this file. AZ-Study-Guide keys answers by
      // literal choice STRING, so a typo, a trailing space or a curly
      // apostrophe yields a permanently ungradable item with no error message.
      // Mapping to indices turns that into a hard -1.
      correctIdx = q.correctAnswers.map((a) => options.indexOf(a));
    } else {
      correctIdx = [];
    }

    let type;
    if (rawType === "reorder") type = "order";
    else if (rawType === "active-screen") type = "fields";
    else if (isVanilla) type = rawType === "multi" ? "multiple" : "single";
    else type = correctIdx.length > 1 ? "multiple" : "single";

    return {
      id: q.id,
      groupId: isVanilla ? q.domain : objDomain.get(q.objectiveId),
      subGroupId: isVanilla ? q.skill : q.objectiveId,
      rawType, type, options, correctIdx,
      stem: q.q ?? q.prompt ?? "",
      explanation: q.expl ?? q.explanation ?? "",
      src: q.src,
      official: !!q.official,
      outdated: toIdxList(q.outdated),
      kind: q.kind,
      group: q.caseStudyId,
      reorderItems: q.reorderItems,
      fields: q.fields,
      // the four interactive formats
      statements: q.statements,
      sources: q.sources,
      targets: q.targets,
      template: q.template,
      blanks: q.blanks,
      poolItems: q.poolItems,
      correctOrder: q.correctOrder,
      skillRef: q.skillRef,
      // Carried through because the draw's constraint quota reads it. This object
      // is a WHITELIST: a field omitted here is invisible to every check below,
      // which is how `decision` and `exam` were both silently dropped once.
      decision: q.decision,
      file: q._file,
      where: q._where,
    };
  });
}

/* ==========================================================================
   Allocation — must mirror the app's implementation, tie-break included
   ========================================================================== */
function allocateByWeight(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / sum) * total);
  const counts = raw.map(Math.floor);
  const remainder = total - counts.reduce((a, b) => a + b, 0);
  // Explicit tie-break: without it, exact ties (SC-500's 22.5/27.5/22.5/22.5)
  // are resolved by Array.prototype.sort internals rather than a stated rule.
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r), w: weights[i] }))
    .sort((a, b) => (b.frac - a.frac) || (b.w - a.w) || (a.i - b.i));
  for (let k = 0; k < remainder; k++) counts[order[k % order.length].i] += 1;
  return counts;
}

/* ==========================================================================
   Checks
   ========================================================================== */
const CONTRAST = ["not ", "n't", "whereas", "unlike", "rather than", "fails", "tempting",
  "but ", "however", "trap", "closest miss", "misses", "cannot", "never", "instead",
  // `neither X nor Y` states why the alternatives fail as directly as "unlike"
  // does; leaving it out rejected explanations that were doing the job.
  "neither"];
const BANNED = ["all of the above", "none of the above", "toutes les réponses",
  "aucune des réponses", "both a and b"];
const WORD_N = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

function stemCount(stem) {
  let m = /\(Select (\d+)\)/i.exec(stem);
  if (m) return +m[1];
  m = /\(Choose (\w+)\.?\)/i.exec(stem);
  if (m) return WORD_N[m[1].toLowerCase()] ?? (Number.isFinite(+m[1]) ? +m[1] : null);
  return null;
}

function checkItem(q, seen, ctx) {
  const at = q.id || q.where;

  if (!q.id) err(`${at}: missing id`);
  else if (seen.has(q.id)) err(`${at}: duplicate id`);
  else seen.add(q.id);

  if (!q.stem) err(`${at}: missing stem`);
  if (!q.explanation) err(`${at}: missing explanation`);
  if (q.groupId === undefined || !ctx.domainIds.has(q.groupId))
    err(`${at}: domain "${q.groupId}" is not declared in the referential`);
  if (q.subGroupId !== undefined && !ctx.subIds.has(q.subGroupId))
    err(`${at}: sub-group "${q.subGroupId}" is not declared in the referential`);
  if (q.file && q.subGroupId && !q.file.startsWith(q.subGroupId))
    warn(`${at}: lives in ${q.file} but declares ${q.subGroupId}`);

  /* explanation quality */
  if (q.explanation.length < 120)
    rule(`${at}: explanation is ${q.explanation.length} chars, minimum 120`, q.subGroupId);
  /* Under `rule()`, not `warn()`. As an unconditional warning this check sat
     outside `strictObjectives`, so an objective could be listed as remediated
     while still carrying explanations that cleared 120 characters by padding and
     named no distractor — which made "remédié" mean two different things
     depending on which check you looked at. It is the same amnesty as the others:
     a warning on the backlog, an error on a finished objective. */
  if (!CONTRAST.some((c) => q.explanation.toLowerCase().includes(c)))
    rule(`${at}: explanation has no contrast marker — does it say why a distractor fails?`,
      q.subGroupId);
  // Options are shuffled at draw time, so "(A)" points at a random option.
  if (/\(\s*[A-F]\s*\)/.test(q.explanation))
    err(`${at}: explanation references an option letter`);

  if (CONFIG.requireSrc && !q.src && !q.official) rule(`${at}: missing src`, q.subGroupId);

  /* `decision` drives the exam draw's constraint quota, so it must mean exactly
     what the stem says — asserted in BOTH directions. A marker with no clause
     manufactures a hollow quota: the draw reports 17% while the learner reads
     ordinary recall questions. A clause with no marker makes the item invisible
     to the draw, so the quota silently under-fills from a smaller pool. */
  const hasClause = /least privilege|minimi[sz]e cost|lowest cost|highest level of workload|leave no gaps/i
    .test(q.stem);
  if (q.decision && !hasClause)
    err(`${at}: decision="${q.decision}" but the stem carries no constraint clause`);
  if (hasClause && !q.decision)
    err(`${at}: stem carries a constraint clause but no decision marker — the exam draw cannot see it`);
  if (q.decision && !["least-privilege", "cost", "coverage"].includes(q.decision))
    err(`${at}: decision="${q.decision}" is not least-privilege, cost or coverage`);

  /* Blueprint traceability: a skillRef that does not resolve, or that names a
     bullet belonging to a different objective, makes the coverage report lie —
     which is worse than having no skillRef at all. */
  if (q.skillRef && SKILL_REFS?.BULLETS) {
    const bullet = SKILL_REFS.BULLETS[q.skillRef];
    if (!bullet) err(`${at}: skillRef "${q.skillRef}" is not a known skills-measured bullet`);
    else if (bullet.objectiveId !== q.subGroupId)
      err(`${at}: skillRef "${q.skillRef}" belongs to ${bullet.objectiveId}, not ${q.subGroupId}`);
  }

  if (!q.options) return;   // reorder / active-screen handled in checkTyped

  /* ---- choice-based ---- */
  // A Yes/No item (solution-goal, statement row) legitimately has two options
  // and is exempt from the option-count range.
  const isBoolean = q.options.length === 2 &&
    q.options.every((o) => /^(yes|no|true|false|on|off|oui|non)$/i.test(o.trim()));
  const [lo, hi] = CONFIG.optionCounts[q.type] ?? [2, CONFIG.maxOptions];
  if (!isBoolean && (q.options.length < lo || q.options.length > hi))
    err(`${at}: ${q.options.length} options, expected ${lo}-${hi} for ${q.type}`);
  if (q.options.length > CONFIG.maxOptions)
    err(`${at}: ${q.options.length} options exceeds the renderer's answer-letter capacity`);

  q.correctIdx.forEach((c) => {
    if (c === -1) err(`${at}: a correctAnswers entry is absent from choices — ungradable`);
    else if (!Number.isInteger(c) || c < 0 || c >= q.options.length)
      err(`${at}: correct index ${c} out of range`);
  });
  if (!q.correctIdx.length) err(`${at}: no correct answer`);
  if (new Set(q.correctIdx).size !== q.correctIdx.length) err(`${at}: duplicate correct index`);
  // Breaks React key={choice}, makes indexOf ambiguous, corrupts set comparison.
  if (new Set(q.options).size !== q.options.length) err(`${at}: duplicate choice text`);

  if (q.type === "single" && q.correctIdx.length !== 1)
    err(`${at}: single-answer with ${q.correctIdx.length} correct`);
  if (q.type === "multiple") {
    if (q.correctIdx.length < 2) err(`${at}: multiple-response with < 2 correct`);
    const n = stemCount(q.stem);
    if (n === null) err(`${at}: multiple-response stem does not state how many to select`);
    else if (n !== q.correctIdx.length)
      err(`${at}: stem says ${n} but has ${q.correctIdx.length} correct`);
  } else if (stemCount(q.stem) !== null) {
    err(`${at}: single-answer stem states a selection count`);
  }

  if (CONFIG.requireOutdated && !q.official) {
    if (q.outdated === undefined) rule(`${at}: missing outdated distractor`, q.subGroupId);
    else q.outdated.forEach((i) => {
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length)
        err(`${at}: outdated index ${i} out of range`);
      if (q.correctIdx.includes(i)) err(`${at}: outdated index ${i} is also a correct answer`);
    });
  }

  q.options.forEach((o, i) => {
    if (BANNED.some((b) => o.toLowerCase().includes(b)))
      err(`${at}: option ${i} uses a banned catch-all`);
  });
  q.correctIdx.filter((c) => c >= 0).forEach((c) => {
    const o = q.options[c];
    if (/claude-[a-z]+-\d|gpt-\d|gemini-\d/i.test(o)) err(`${at}: correct option names a model ID`);
    if (/_\d{8}\b/.test(o)) err(`${at}: correct option names a dated tool-type string`);
    if (/-\d{4}-\d{2}-\d{2}\b/.test(o)) err(`${at}: correct option names a dated beta header`);

    /* A whole command LINE — a command plus its parameters — must not be a
       choice-set answer. Two reasons, and the second is the structural one:

         churn    parameter names and required arguments change across CLI and
                  module versions, so the item rots while still looking correct.

         the tell a correct command carries every required parameter, while a
                  wrong one is wrong precisely by omitting or mangling one. The
                  correct answer is therefore inherently the longest: measured
                  across both banks, on 82% of such items, median length ratio
                  1.88. Padding distractors cannot fix that without inventing
                  plausible long wrong commands.

       Choosing WHICH command does the job is fine and stays a choice item —
       `az storage account create` vs `az storage account keys renew` neither
       churns nor leaks. Parameters and values belong in a `dropdown-sentence`,
       where each blank's options are naturally the same length class, and command
       SEQUENCES belong in a `build-list`. */
    const isCommand = /^\s*(az\s+[a-z][a-z-]+|(New|Set|Get|Update|Remove|Add|Enable|Disable|Grant|Revoke)-Az[A-Za-z]+)/.test(o);
    const hasParameters = /\s(--[a-z][a-z-]{2,}|-[A-Z][A-Za-z]{2,})\b/.test(o);
    if (isCommand && hasParameters)
      rule(`${at}: correct answer is a full command line with parameters — test the parameters` +
        ` with a dropdown-sentence, or a sequence with a build-list`, q.subGroupId);
  });

  /* The tell that survives shuffling. Yes/No items are exempt — two-word
     options cannot be balanced for length and carry no such tell. */
  if (!q.official && !isBoolean) {
    const lens = q.options.map((o) => o.length);
    const ratio = Math.max(...lens) / Math.min(...lens);
    if (ratio > CONFIG.lengthRatioMax)
      rule(`${at}: option length ratio ${ratio.toFixed(2)} exceeds ${CONFIG.lengthRatioMax}` +
        ` (longest ${Math.max(...lens)}, shortest ${Math.min(...lens)})`, q.subGroupId);
  }
}

function checkTyped(items, ctx) {
  for (const q of items) {
    const at = q.id || q.where;

    if (q.rawType === "reorder") {
      const it = q.reorderItems;
      if (!Array.isArray(it) || it.length < 3) { err(`${at}: reorder needs >= 3 items`); continue; }
      if (new Set(it).size !== it.length) err(`${at}: reorder has duplicate items`);
      if (q.options) err(`${at}: reorder must not declare choices`);
      const alpha = [...it].sort((a, b) => a.localeCompare(b));
      const byLen = [...it].sort((a, b) => a.length - b.length);
      if (it.every((v, i) => v === alpha[i])) err(`${at}: reorder answer is alphabetical — free tell`);
      if (it.every((v, i) => v === byLen[i])) err(`${at}: reorder answer is length-sorted — free tell`);
    }

    if (q.rawType === "active-screen") {
      const f = q.fields;
      if (!Array.isArray(f) || f.length < 2) { err(`${at}: active-screen needs >= 2 fields`); continue; }
      if (new Set(f.map((x) => x.id)).size !== f.length) err(`${at}: duplicate field id`);
      for (const fld of f) {
        if (fld.kind === "select") {
          if (!Array.isArray(fld.options) || fld.options.length < 2)
            err(`${at}: field "${fld.id}" is a select with < 2 options`);
          else if (!fld.options.includes(fld.correctValue))
            err(`${at}: field "${fld.id}" correctValue is not among its options`);
        } else if (fld.kind === "toggle") {
          if (!["On", "Off"].includes(fld.correctValue))
            err(`${at}: field "${fld.id}" toggle correctValue must be On or Off`);
        } else err(`${at}: field "${fld.id}" has unknown kind "${fld.kind}"`);
      }
    }

    /* ---- statement-grid: "select Yes if the statement is true" ---- */
    if (q.rawType === "statement-grid") {
      const st = q.statements;
      if (!Array.isArray(st) || st.length < 3) { err(`${at}: statement-grid needs >= 3 statements`); continue; }
      if (new Set(st.map((s) => s.id)).size !== st.length) err(`${at}: duplicate statement id`);
      if (new Set(st.map((s) => s.text)).size !== st.length) err(`${at}: duplicate statement text`);
      for (const s of st)
        if (!["Yes", "No"].includes(s.correctValue))
          err(`${at}: statement "${s.id}" correctValue must be Yes or No, got "${s.correctValue}"`);
      // An all-Yes or all-No grid is answerable without reading the statements.
      const yes = st.filter((s) => s.correctValue === "Yes").length;
      if (yes === 0 || yes === st.length)
        err(`${at}: statement-grid answers are all ${yes ? "Yes" : "No"} — free tell`);
    }

    /* ---- drag-match: drag each source onto its target ---- */
    if (q.rawType === "drag-match") {
      const tg = q.targets, sc = q.sources;
      if (!Array.isArray(tg) || tg.length < 3) { err(`${at}: drag-match needs >= 3 targets`); continue; }
      if (!Array.isArray(sc) || sc.length < 2) { err(`${at}: drag-match needs a source pool`); continue; }
      if (new Set(tg.map((t) => t.id)).size !== tg.length) err(`${at}: duplicate target id`);
      if (new Set(sc).size !== sc.length) err(`${at}: duplicate source text`);
      /* The renderer calls renderInline(target.label). A batch authored with
         `text` instead passed every check here — id and correctSource were both
         present and gradable — and then threw at mount on undefined.length,
         which surfaced as "the objective renders a blank page". Assert the field
         the component actually reads. */
      for (const t of tg)
        if (typeof t.label !== "string" || !t.label.trim())
          err(`${at}: target "${t.id}" has no label — the renderer reads label, not text`);
      for (const t of tg)
        if (!sc.includes(t.correctSource))
          err(`${at}: target "${t.id}" correctSource "${t.correctSource}" is not in sources — ungradable`);
      // Without distractors the item degenerates into a permutation puzzle:
      // every source must be used, so the last target answers itself.
      const used = new Set(tg.map((t) => t.correctSource)).size;
      if (sc.length <= used)
        err(`${at}: source pool of ${sc.length} has no distractors beyond the ${used} needed`);
    }

    /* ---- dropdown-sentence: inline selects completing a statement ---- */
    if (q.rawType === "dropdown-sentence") {
      const bl = q.blanks, tpl = q.template ?? "";
      if (!Array.isArray(bl) || bl.length < 2) { err(`${at}: dropdown-sentence needs >= 2 blanks`); continue; }
      if (!tpl) { err(`${at}: dropdown-sentence has no template`); continue; }
      if (new Set(bl.map((b) => b.id)).size !== bl.length) err(`${at}: duplicate blank id`);
      const refs = [...tpl.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim());
      if (new Set(refs).size !== refs.length) err(`${at}: template references a blank more than once`);
      for (const r of refs)
        if (!bl.some((b) => b.id === r)) err(`${at}: template references unknown blank "${r}"`);
      for (const b of bl) {
        if (!refs.includes(b.id)) err(`${at}: blank "${b.id}" is never placed in the template`);
        if (!Array.isArray(b.options) || b.options.length < 2)
          err(`${at}: blank "${b.id}" needs >= 2 options`);
        else {
          if (new Set(b.options).size !== b.options.length)
            err(`${at}: blank "${b.id}" has duplicate options`);
          if (!b.options.includes(b.correctValue))
            err(`${at}: blank "${b.id}" correctValue is not among its options — ungradable`);
        }
      }
    }

    /* ---- build-list: order a subset drawn from a larger pool ---- */
    if (q.rawType === "build-list") {
      const pool = q.poolItems, ans = q.correctOrder;
      if (!Array.isArray(ans) || ans.length < 3) { err(`${at}: build-list needs >= 3 items in correctOrder`); continue; }
      if (!Array.isArray(pool)) { err(`${at}: build-list has no poolItems`); continue; }
      if (new Set(pool).size !== pool.length) err(`${at}: build-list has duplicate poolItems`);
      if (new Set(ans).size !== ans.length) err(`${at}: build-list has duplicate correctOrder items`);
      for (const a of ans)
        if (!pool.includes(a)) err(`${at}: correctOrder item "${a}" is not in poolItems — ungradable`);
      // The distractors ARE the format. Equal length makes it a plain reorder.
      if (pool.length <= ans.length)
        err(`${at}: poolItems (${pool.length}) must exceed correctOrder (${ans.length}) — that gap is the format`);
      const alpha = [...ans].sort((a, b) => a.localeCompare(b));
      const byLen = [...ans].sort((a, b) => a.length - b.length);
      if (ans.every((v, i) => v === alpha[i])) err(`${at}: build-list answer is alphabetical — free tell`);
      if (ans.every((v, i) => v === byLen[i])) err(`${at}: build-list answer is length-sorted — free tell`);
    }

    if (q.group && ctx.caseStudies.size && !ctx.caseStudies.has(q.group))
      err(`${at}: caseStudyId "${q.group}" does not resolve`);
  }

  /* statement-grid Yes/No patterns must not repeat across items, for the same
     reason solution-goal patterns must not: in a per-objective quiz the rows are
     shown in authored order, so a repeated pattern is learnable. */
  const grids = items.filter((q) => q.rawType === "statement-grid" && Array.isArray(q.statements));
  if (grids.length >= 5) {
    const pat = new Map();
    for (const q of grids) {
      const key = q.statements.map((s) => s.correctValue).join(",");
      pat.set(key, (pat.get(key) ?? 0) + 1);
    }
    for (const [key, n] of pat)
      if (n / grids.length > 0.4)
        err(`statement-grid answer pattern [${key}] used by ${n}/${grids.length} items — a learnable tell`);
  }

  /* solution-goal groups: exactly one Yes, and no dominant Yes-position pattern */
  const sg = new Map();
  for (const q of items) {
    if (q.rawType !== "solution-goal" || !q.group) continue;
    (sg.get(q.group) ?? sg.set(q.group, []).get(q.group)).push(q);
  }
  const patterns = new Map();
  for (const [gid, group] of sg) {
    if (group.length < 3) warn(`${gid}: solution-goal group has only ${group.length} items`);
    const yes = group.filter((q) => q.options && /^yes$/i.test(q.options[q.correctIdx[0]] ?? ""));
    if (yes.length !== 1) err(`${gid}: solution-goal group has ${yes.length} Yes answers, expected 1`);
    const key = group.map((q) => (q.options?.[q.correctIdx[0]] ?? "?")).join(",");
    patterns.set(key, (patterns.get(key) ?? 0) + 1);
  }
  if (sg.size >= 5) {
    for (const [key, n] of patterns) {
      if (n / sg.size > 0.6)
        err(`solution-goal answer pattern [${key}] used by ${n}/${sg.size} groups — a learnable tell`);
    }
  }

  /* case studies must amortise their scenario */
  const csCount = new Map();
  for (const q of items) if (q.group?.startsWith("cs-")) csCount.set(q.group, (csCount.get(q.group) ?? 0) + 1);
  for (const [id, n] of csCount)
    if (n < 4) warn(`${id}: only ${n} questions against this case study — scenario cost not amortised`);
}

/* ==========================================================================
   Aggregate
   ========================================================================== */
function aggregate(items, ctx) {
  const out = [];
  const say = (s) => out.push(s);

  /* composition */
  say("\nComposition by domain");
  const byDomain = {};
  for (const q of items) byDomain[q.groupId] = (byDomain[q.groupId] ?? 0) + 1;
  const targets = Object.keys(CONFIG.domainTarget);
  for (const d of (targets.length ? targets : Object.keys(byDomain))) {
    const have = byDomain[d] ?? 0;
    const want = CONFIG.domainTarget[d];
    if (want === undefined) { say(`  ${d}  ${String(have).padStart(4)}`); continue; }
    if (have > want) err(`domain ${d}: ${have} items exceeds the target of ${want}`);
    else if (have < want && STRICT) err(`domain ${d}: ${have}/${want} items`);
    let flag = "ok";
    if (have < want) flag = "TODO";
    else if (have > want) flag = "OVER";
    say(`  ${d}  ${String(have).padStart(4)}/${String(want).padEnd(4)} ${flag}`);
  }
  const bySub = {};
  for (const q of items) bySub[q.subGroupId] = (bySub[q.subGroupId] ?? 0) + 1;
  for (const [s, want] of Object.entries(CONFIG.subTarget)) {
    const have = bySub[s] ?? 0;
    if (have > want) err(`sub-group "${s}": ${have} exceeds target ${want}`);
    else if (have < want && STRICT) err(`sub-group "${s}": ${have}/${want}`);
    // Informational: a very small sub-skill is legitimate when the blueprint
    // weight is tiny, but a targeted quiz over it will be thin.
    if (have < 8) warn(`sub-group "${s}": ${have} items — a targeted quiz over it will be thin`);
  }

  /* weights + allocation */
  const weights = ctx.domains.map((d) => d.weight);
  const wSum = +weights.reduce((a, b) => a + b, 0).toFixed(4);
  if (ctx.domains[0]?.raw) {
    const lo = ctx.domains.reduce((a, d) => a + d.raw.min, 0);
    const hi = ctx.domains.reduce((a, d) => a + d.raw.max, 0);
    say(`\nPublished weight ranges sum to ${lo}-${hi} (midpoints ${wSum}) — normalised by the allocator, not a defect`);
    if (lo > 100 || hi < 100) warn(`published ranges ${lo}-${hi} do not bracket 100`);
  } else if (wSum !== 100) {
    err(`domain weights sum to ${wSum}, expected 100`);
  }

  for (const [n, want] of Object.entries(CONFIG.expectedAlloc)) {
    const got = allocateByWeight(weights, +n);
    if (got.reduce((a, b) => a + b, 0) !== +n) err(`allocation for n=${n} does not sum to ${n}`);
    ctx.domains.forEach((d, i) => {
      if (want[d.id] !== undefined && got[i] !== want[d.id])
        err(`allocation n=${n}: ${d.id} got ${got[i]}, expected ${want[d.id]}`);
    });
    const shape = ctx.domains.map((d, i) => d.id + ":" + got[i]).join(" ");
    say(`  n=${n} → ${shape}`);
    // Freshness is what pool headroom is actually for, so measure that directly
    // rather than asserting a headroom multiple. For a domain, the chance a
    // drawn item repeats next time is allocation/pool; weight by allocation.
    let expOverlap = 0;
    ctx.domains.forEach((d, i) => {
      const pool = byDomain[d.id] ?? 0;
      if (pool < got[i]) err(`domain ${d.id}: pool of ${pool} cannot fill its n=${n} allocation of ${got[i]}`);
      else if (pool > 0) expOverlap += (got[i] * got[i]) / pool;
    });
    const pctOverlap = (expOverlap / +n) * 100;
    say(`       expected overlap between two consecutive n=${n} exams: ${pctOverlap.toFixed(0)}%`);
    if (pctOverlap > 50)
      warn(`two consecutive n=${n} exams would share ~${pctOverlap.toFixed(0)}% of their items — pools too thin`);
  }
  const a1 = allocateByWeight(weights, 20).join(",");
  for (let k = 0; k < 200; k++)
    if (allocateByWeight(weights, 20).join(",") !== a1) { err("allocation is not deterministic"); break; }

  /* the tells */
  const choice = items.filter((q) => q.options && q.correctIdx.every((c) => c >= 0));
  const singles = choice.filter((q) => q.type === "single" && !q.official);
  if (singles.length >= 20) {
    const hist = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const q of singles) if (q.correctIdx[0] < 8) hist[q.correctIdx[0]]++;
    say("\nAuthored correct-answer position (runtime shuffles anyway)");
    hist.slice(0, Math.max(...singles.map((q) => q.options.length))).forEach((n, i) =>
      say(`  index ${i}  ${String(n).padStart(4)}  ${(n / singles.length * 100).toFixed(1).padStart(5)}%`));

    const longestCorrect = singles.filter((q) => {
      const lens = q.options.map((o) => o.length);
      return lens.indexOf(Math.max(...lens)) === q.correctIdx[0];
    }).length;
    const pct = (longestCorrect / singles.length) * 100;
    say(`  longest option is the correct one: ${pct.toFixed(1)}% (target <= ${CONFIG.longestIsCorrectMaxPct}%)`);
    if (pct > CONFIG.longestIsCorrectMaxPct)
      rule(`the longest option is correct on ${pct.toFixed(1)}% of single-answer items`);
  }

  /* headline: what a candidate scores knowing nothing */
  if (choice.length >= 20) {
    let hit = 0;
    for (const q of choice) {
      const n = q.correctIdx.length;
      const pick = q.options
        .map((o, i) => ({ i, len: o.length }))
        .sort((a, b) => b.len - a.len || a.i - b.i)
        .slice(0, n).map((x) => x.i);
      if (pick.length === n && pick.every((i) => q.correctIdx.includes(i))) hit++;
    }
    const score = (hit / choice.length) * 100;
    say(`\n  ALWAYS-PICK-THE-LONGEST SCORE: ${hit}/${choice.length} = ${score.toFixed(1)}%`);
    say("  (a candidate who reads nothing; compare against the exam's raw pass threshold)");
    if (score > 45) rule(`always-pick-the-longest scores ${score.toFixed(1)}% — the bank leaks its answers`);

    // The figure stored in domains.json is what the UI shows the learner, and it
    // decides whether the reliability notice appears at all. Remediating the bank
    // without updating it leaves the app overstating — or understating — its own
    // unreliability. Both banks shipped that defect once; this is why they can't again.
    const declared = ctx.exam?.bankStatus?.freeScorePercent;
    if (typeof declared === "number" && Math.abs(declared - score) > 0.15)
      err(
        `exam.bankStatus.freeScorePercent is ${declared.toFixed(1)}% but the measured ` +
          `always-pick-the-longest score is ${score.toFixed(1)}% — update domains.json ` +
          `(and measuredOn), because this figure is rendered to the learner`,
      );
  }

  /* blueprint coverage — the measure the whole referential exists to support */
  if (SKILL_REFS?.BULLETS && (ctx.objectives ?? []).length) {
    const refs = Object.keys(SKILL_REFS.BULLETS);
    // The table and the referential must not drift: a bullet declared in one and
    // not the other means coverage is being measured against the wrong outline.
    const declared = new Set((ctx.objectives ?? []).flatMap((o) => o.skillRefs ?? []));
    for (const r of refs)
      if (!declared.has(r)) err(`skill-refs.mjs declares "${r}" but no objective lists it in skillRefs`);
    for (const r of declared)
      if (!SKILL_REFS.BULLETS[r]) err(`domains.json lists skillRef "${r}" but skill-refs.mjs does not define it`);

    const claimed = new Map();
    for (const q of items) if (q.skillRef) claimed.set(q.skillRef, (claimed.get(q.skillRef) ?? 0) + 1);
    const unclaimed = refs.filter((r) => !claimed.has(r));
    const untraced = items.filter((q) => !q.skillRef).length;
    say(`\nBlueprint coverage: ${refs.length - unclaimed.length}/${refs.length} skills-measured bullets claimed by >= 1 item`);
    say(`  items with no skillRef: ${untraced}`);
    for (const r of unclaimed)
      warn(`bullet ${r} is claimed by no item — "${SKILL_REFS.BULLETS[r].label}"`);
    // A bullet with a single item cannot be practised; the exam samples freely.
    for (const [r, n] of claimed)
      if (n < 2) warn(`bullet ${r} is claimed by only ${n} item — "${SKILL_REFS.BULLETS[r].label}"`);
  }

  /* multi patterns */
  const multis = items.filter((q) => q.type === "multiple");
  if (multis.length) {
    say(`\nMultiple-response: ${multis.length} items (${(multis.length / items.length * 100).toFixed(1)}% of bank)`);

    /* A repeated correct-index set is only a tell if it repeats MORE than chance
       requires. With 4 options and 2 correct answers there are just C(4,2) = 6
       distinct sets, so 40 items cannot hold any pattern below 3 uses: the old
       absolute "max 2" was unreachable for this bank shape, and a rule that can
       never pass is a rule that gets ignored. Compare against the uniform
       expectation for each shape instead, and allow twice it. */
    const choose = (n, k) => {
      let r = 1;
      for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
      return Math.round(r);
    };
    const byShape = new Map();
    for (const q of multis) {
      const key = `${q.options.length}c${q.correctIdx.length}`;
      if (!byShape.has(key)) byShape.set(key, []);
      byShape.get(key).push(q);
    }
    for (const [shape, group] of byShape) {
      const [nOptions, nCorrect] = shape.split("c").map(Number);
      const distinct = choose(nOptions, nCorrect);
      const uniform = group.length / distinct;
      const allowed = Math.max(2, Math.ceil(uniform * 2));
      const pat = new Map();
      for (const q of group) {
        const key = [...q.correctIdx].sort((a, b) => a - b).join(",");
        pat.set(key, (pat.get(key) ?? 0) + 1);
      }
      const prefix = [...Array(nCorrect).keys()].join(",");
      say(`  ${shape}: ${group.length} items · ${distinct} possible sets · ${pat.size} used` +
        ` · uniform ${uniform.toFixed(1)}, allowed ${allowed}` +
        ` · leading prefix [${prefix}] on ${pat.get(prefix) ?? 0}`);
      for (const [k, n] of pat)
        if (n > allowed)
          warn(`multi correct-set pattern [${k}] used ${n}/${group.length} of the ${shape} items` +
            ` — over twice the uniform expectation of ${uniform.toFixed(1)}`);
      // The leading prefix is reported above rather than flagged per item. It is
      // one legitimate set out of `distinct`, so a share of it is unavoidable —
      // what matters is the bank not being ALL prefix, which the rule above
      // already catches. Flagging each prefix item produced one warning per
      // correctly-distributed item, which trained the reader to ignore the list.
      if (pat.size < Math.min(distinct, 3))
        warn(`${shape} items use only ${pat.size} of ${distinct} possible correct-index sets`);
    }
  }

  /* scenario/recall mix */
  if (CONFIG.scenarioSharePct && items.some((q) => q.kind)) {
    const s = items.filter((q) => q.kind === "scenario").length;
    const r = (s / items.length) * 100;
    say(`\nScenario/recall mix: ${r.toFixed(0)}/${(100 - r).toFixed(0)}`);
    const [minS, maxS] = CONFIG.scenarioSharePct;
    if (r < minS || r > maxS) warn(`scenario share ${r.toFixed(0)}% outside ${minS}-${maxS}%`);
  }

  /* near-duplicate stems */
  const STOP = new Set("a an the of to in on for and or is are that which with what when it its this these those be as by at from you your".split(" "));
  const toks = items.map((q) => new Set(q.stem.toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))));
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const inter = [...toks[i]].filter((w) => toks[j].has(w)).length;
      const union = new Set([...toks[i], ...toks[j]]).size;
      if (union && inter / union > 0.6)
        warn(`near-duplicate stems: ${items[i].id} / ${items[j].id} (Jaccard ${(inter / union).toFixed(2)})`);
    }

  /* runtime shuffle fairness */
  const probe = singles[0];
  if (probe) {
    const N = 4000, hist = new Array(probe.options.length).fill(0);
    for (let k = 0; k < N; k++) {
      const o = probe.options.map((_, i) => i);
      for (let i = o.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [o[i], o[j]] = [o[j], o[i]];
      }
      hist[o.indexOf(probe.correctIdx[0])]++;
    }
    const ideal = 1 / probe.options.length;
    const dev = Math.max(...hist.map((n) => Math.abs(n / N - ideal)));
    say(`\nRuntime shuffle over ${N} draws: ${hist.map((n) => (n / N * 100).toFixed(1) + "%").join("  ")}`);
    if (dev > 0.03) err(`shuffle is not uniform — max deviation ${(dev * 100).toFixed(1)} points`);
  }

  /* official samples: measured, never enforced */
  const officials = items.filter((q) => q.official && q.options);
  if (officials.length) {
    say(`\nOfficial samples (verbatim, exempt from the length rule) — ${officials.length}`);
    for (const q of officials) {
      const lens = q.options.map((o) => o.length);
      say(`  ${String(q.id).padEnd(16)} ratio ${(Math.max(...lens) / Math.min(...lens)).toFixed(2)}` +
        `  longest is correct: ${lens.indexOf(Math.max(...lens)) === q.correctIdx[0] ? "yes" : "no"}`);
    }
  }

  return out;
}

/* ==========================================================================
   Run
   ========================================================================== */
const loaded = CONFIG.stack === "vanilla" ? loadVanilla() : loadJson();
const items = normalise(loaded.items, loaded);
const ctx = {
  domains: loaded.domains,
  caseStudies: loaded.caseStudies,
  objectives: loaded.objectives ?? [],
  exam: loaded.exam, // undefined on the vanilla stack, which has no bankStatus to check
  domainIds: new Set(loaded.domains.map((d) => d.id)),
  subIds: new Set(loaded.domains.flatMap((d) => d.subs)),
};

console.log(`\nBank check — ${CONFIG.stack} stack` +
  (CONFIG.stack === "json" ? ` · ${CONFIG.certId}` : "") +
  ` — ${items.length} items${CONFIG.legacy ? " · LEGACY amnesty active" : ""}`);
console.log("=".repeat(70));

const seen = new Set();
for (const q of items) checkItem(q, seen, ctx);
checkTyped(items, ctx);
console.log(aggregate(items, ctx).join("\n"));

console.log(`\n${"=".repeat(70)}`);
if (warns.length) { console.log(`\n${warns.length} warning(s):`); warns.forEach((w) => console.log(`  ! ${w}`)); }
if (errors.length) { console.log(`\n${errors.length} error(s):`); errors.forEach((e) => console.log(`  x ${e}`)); }
if (!warns.length && !errors.length) console.log("\nClean.");
if (CONFIG.legacy) console.log("\nLEGACY amnesty was active: provenance and length rules were downgraded to warnings.");
console.log("");
process.exit(errors.length ? 1 : 0);
