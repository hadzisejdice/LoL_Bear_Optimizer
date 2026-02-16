/**
 * FINAL — Option‑A multi‑formation builder
 * - Closed-form optimum (Lagrange math)
 * - Plasma heatmap
 * - Option‑A: after rally, spread ARC evenly, then CAV evenly, then fill INF up to cap
 *
 * Exact fractions:
 *   fin  = α² / (α² + β² + γ²)
 *   fcav = β² / (α² + β² + γ²)
 *   farc = γ² / (α² + β² + γ²)
 *
 * where:
 *   α = Ainf / 3
 *   β = Acav
 *   γ = K_arc * Aarc
 *      K_arc = (4.4/3) for T1–T6; (4.84/3) for T7–TG2 & TG3–TG4
 *
 * A = (1 + atk/100) * (1 + leth/100)
 */

/* ---------- Basic Helpers ---------- */
function num(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : 0;
}
function attackFactor(atk, leth) {
  return (1 + atk/100) * (1 + leth/100);
}
function normalizeTier(value) {
  return (value || "").replace(/–/g, "-"); // normalize en-dash to hyphen
}
function getArcherCoefByTier(tierRaw) {
  const tier = normalizeTier(tierRaw).toUpperCase();
  if (tier === "T1-T6") return 4.4/1.25;
  return 2.78/1.45; // T7–TG2, TG3–TG4 4.84./3
}

/* ---------- Closed-form optimum ---------- */
function computeExactOptimalFractions(stats, tierRaw) {
  const Ainf = attackFactor(stats.inf_atk, stats.inf_let);
  const Acav = attackFactor(stats.cav_atk, stats.cav_let);
  const Aarc = attackFactor(stats.arc_atk, stats.arc_let);
  const KARC = getArcherCoefByTier(tierRaw);

  const alpha = Ainf / 1.12;
  const beta  = Acav;
  const gamma = KARC * Aarc;

  const a2 = alpha*alpha, b2 = beta*beta, g2 = gamma*gamma;
  const sum = a2 + b2 + g2;

  return {
    fin:  a2 / sum,
    fcav: b2 / sum,
    farc: g2 / sum,
    weights: { a2, b2, g2, sum }
  }; 
}

/* ---------- Relative damage for coloring (plot only) ---------- */
function evaluateForPlot(fin, fcav, farc, stats, tierRaw) {
  const Ainf = attackFactor(stats.inf_atk, stats.inf_let);
  const Acav = attackFactor(stats.cav_atk, stats.cav_let);
  const Aarc = attackFactor(stats.arc_atk, stats  .arc_let);
  const KARC = getArcherCoefByTier(tierRaw);

  const termInf = (1/1.45) * Ainf * Math.sqrt(fin);
  const termCav = Acav * Math.sqrt(fcav);
  const termArc = KARC * Aarc * Math.sqrt(farc);

  return termInf + termCav + termArc;
}

/* ================================================================
   NEW: Editable Composition Helpers (Inf/Cav/Arc)
   ================================================================ */
let lastBestTriplet = { fin: 0.04, fcav: 0.10, farc: 0.86 }; // default-ish
let compUserEdited = false; // if user typed into compInput

function getCompEl() { return document.getElementById("compInput"); }
function getCompHintEl() { return document.getElementById("compHint"); }

/** Round two and fix the third so ints sum to 100 */
function roundFractionsTo100(fin, fcav, farc) {
  // Ensure they sum to 1-ish
  const S = fin + fcav + farc;
  if (S <= 0) return { i: 0, c: 0, a: 100 };
  const nf = fin / S, nc = fcav / S, na = farc / S;

  let i = Math.round(nf * 100);
  let c = Math.round(nc * 100);
  let a = 100 - i - c; // exact sum 100
  // minor clamping just in case rounding overshoot
  if (a < 0) { a = 0; if (i + c > 100) { const over = i + c - 100; if (i >= c) i -= over; else c -= over; } }
  return { i, c, a };
}

/** Format fractions (0..1 each) as "X/Y/Z" percentages */
function formatTriplet(fin, fcav, farc) {
  const { i, c, a } = roundFractionsTo100(fin, fcav, farc);
  return `${i}/${c}/${a}`;
}

/** Parse "4/10/85", "4,10,85", "4 10 85". If two numbers, compute third. Normalize to 100%. Returns fractions {fin,fcav,farc} or null if invalid. */
function parseCompToFractions(str) {
  if (typeof str !== "string") return null;
  // accept / , space ; ignore stray % signs
  const parts = str
    .replace(/%/g, "")
    .trim()
    .split(/[/,\s]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => Number(s));

  if (parts.some(v => !Number.isFinite(v) || v < 0)) return null;

  if (parts.length === 0) return null;

  let i = parts[0] ?? 0;
  let c = parts[1] ?? 0;
  let a = (parts.length >= 3) ? parts[2] : Math.max(0, 100 - (i + c));

  // All zero? invalid.
  const sum = i + c + a;
  if (sum <= 0) return null;

  // Normalize to 100%
  const nf = i / sum, nc = c / sum, na = a / sum;
  return { fin: nf, fcav: nc, farc: na };
}

/** Update the UI input with Best triplet unless user has edited */
function setCompInputFromBest() {
  const el = getCompEl();
  if (!el) return;
  el.value = formatTriplet(lastBestTriplet.fin, lastBestTriplet.fcav, lastBestTriplet.farc);
  const hint = getCompHintEl();
  if (hint) hint.textContent = "Auto-filled from Best. Edit to override.";
}

/** Decide which fractions to use: user's editable field (normalized), otherwise Best */
function getFractionsForRally() {
  const el = getCompEl();
  const hint = getCompHintEl();
  if (!el) return lastBestTriplet;

  const parsed = parseCompToFractions(el.value);
  if (parsed) {
    // Show the normalized final integer display if user input wasn't already in exact 100 sum
    const disp = formatTriplet(parsed.fin, parsed.fcav, parsed.farc);
    if (hint) hint.textContent = `Using: ${disp}`;
    return parsed;
  } else {
    if (hint) hint.textContent = "Invalid input → using Best composition.";
    return lastBestTriplet;
  }
}

/* ---------- Plot ---------- */
function computePlots() {
  const stats = {
    inf_atk: num("inf_atk"),
    inf_let: num("inf_let"),
    cav_atk: num("cav_atk"),
    cav_let: num("cav_let"),
    arc_atk: num("arc_atk"),
    arc_let: num("arc_let")
  };
  const tierRaw = document.getElementById("troopTier").value;

  // 1) Exact best composition (closed-form)
  const opt = computeExactOptimalFractions(stats, tierRaw);
  lastBestTriplet = { fin: opt.fin, fcav: opt.fcav, farc: opt.farc };

  // If user didn't edit, auto-fill the editable field from Best
  if (!compUserEdited) {
    setCompInputFromBest();
  }

  // 2) Dense sampling for heat-like background
  const samples = [];
  const vals = [];
  const steps = 55;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps - i; j++) {
      const fin  = i/steps;
      const fcav = j/steps;
      const farc = 1 - fin - fcav;
      const d = evaluateForPlot(fin, fcav, farc, stats, tierRaw);
      samples.push({fin, fcav, farc, d});
      vals.push(d);
    }
  }

  const vmax = Math.max(...vals);
  const norm = vals.map(v => v / (vmax || 1));

  Plotly.newPlot("ternaryPlot", [
    {
      type: "scatterternary",
      mode: "markers",
      a: samples.map(s => s.fin),
      b: samples.map(s => s.fcav),
      c: samples.map(s => s.farc),
      marker: {
        size: 6,
        opacity: 0.95,
        color: norm,
        colorscale: "Plasma",   // Purple -> Yellow like the original
        reversescale: false,
        colorbar: {title:"Fraction of maximal damage", tickformat: ".2f"}
      },
      hovertemplate:
        "Inf: %{a:.2f}<br>Cav: %{b:.2f}<br>Arc: %{c:.2f}<br>Rel: %{marker.color:.3f}<extra></extra>"
    },
    {
      type: "scatterternary",
      mode: "markers+text",
      a: [opt.fin],
      b: [opt.fcav],
      c: [opt.farc],
      marker:{size:14, color:"#10b981"},
      text:["Best"],
      textposition:"top center",
      hovertemplate:
        "Best (closed-form)<br>Inf: %{a:.2f}<br>Cav: %{b:.2f}<br>Arc: %{c:.2f}<extra></extra>"
    }
  ], {
    ternary:{
      aaxis:{title:"Infantry", min:0},
      baxis:{title:"Cavalry",  min:0},
      caxis:{title:"Archery",  min:0},
      sum:1,
      bgcolor:"#0f0f0f"
    },
    paper_bgcolor:"#111",
    plot_bgcolor:"#111",
    font:{color:"#fff"},
    margin:{l:10,r:10,b:10,t:10},
    showlegend:false
  });

  document.getElementById("bestReadout").innerText =
    `Best composition ≈ ${formatTriplet(opt.fin, opt.fcav, opt.farc)} (Inf/Cav/Arc).`;
}

/* ---------- Sum-preserving apportionment with caps (used for rally) ---------- */
function apportionWithCaps(total, weights, caps) {
  const keys = Object.keys(weights);
  const out = Object.fromEntries(keys.map(k=>[k,0]));
  let active = keys.filter(k => caps[k] > 0 && weights[k] > 0);
  let remaining = Math.max(0, Math.floor(total));

  while (remaining > 0 && active.length > 0) {
    const sumW = active.reduce((s,k)=>s+weights[k],0);
    if (sumW <= 0) break;

    const raw  = Object.fromEntries(active.map(k => [k, remaining * (weights[k]/sumW)]));
    const base = Object.fromEntries(active.map(k => [k, Math.floor(raw[k])]));
    let assigned = 0; active.forEach(k=>assigned += base[k]);
    let rem = remaining - assigned;

    const fracs = active.map(k => ({k, f: raw[k]-base[k]})).sort((a,b)=>b.f-a.f);
    for (let i=0; i<rem; i++) base[fracs[i % fracs.length].k] += 1;

    const stillActive = [];
    for (const k of active) {
      const give = Math.min(base[k], caps[k]);
      out[k] += give;
      caps[k] -= give;
      remaining -= give;
      if (caps[k] > 0 && weights[k] > 0) stillActive.push(k);
    }
    active = stillActive;
  }
  return out;
}

/* ---------- Rally build: subtracts stock first ---------- */
function buildRally(fractions, rallySize, stock) {
  if (rallySize <= 0) return {inf:0, cav:0, arc:0};
  const weights = { inf: fractions.fin, cav: fractions.fcav, arc: fractions.farc };
  const caps    = { inf: stock.inf,     cav: stock.cav,      arc: stock.arc };
  const rally   = apportionWithCaps(rallySize, weights, {...caps});
  stock.inf -= rally.inf; stock.cav -= rally.cav; stock.arc -= rally.arc;
  return rally;
}

/* ---------- Even distributions & infantry fill ---------- */
function distributeEven(total, n, capPerSlot) {
  total = Math.max(0, Math.floor(total));
  const per = Math.min(Math.floor(total / n), capPerSlot);
  return Array(n).fill(per);
}
function distributeInf(leftInf, arcAlloc, cavAlloc, cap) {
  const n = arcAlloc.length;
  const infAlloc = Array(n).fill(0);
  let remaining = Math.max(0, Math.floor(leftInf));
  for (let i=0;i<n;i++){
    const free = Math.max(0, cap - arcAlloc[i] - cavAlloc[i]);
    if (free <= 0) { infAlloc[i] = 0; continue; }
    const ideal = Math.floor(remaining / (n - i));
    const give  = Math.min(ideal, free);
    infAlloc[i] = give;
    remaining  -= give;
  }
  return infAlloc;
}

/* ---------- Option‑A formations ---------- */
function buildOptionAFormations(stock, formations, cap) {
  const n = Math.max(1, formations);

  // A) Archers evenly (capped)
  const arcAlloc = distributeEven(stock.arc, n, cap);
  const usedArc  = arcAlloc.reduce((s,x)=>s+x,0);
  const leftArc  = stock.arc - usedArc;

  // B) Cavalry evenly (respect remaining capacity after archers)
  const spaceAfterArc = Math.max(0, cap - arcAlloc[0]); // equal per march
  const cavAlloc = distributeEven(stock.cav, n, spaceAfterArc);
  const usedCav  = cavAlloc.reduce((s,x)=>s+x,0);
  const leftCav  = stock.cav - usedCav;

  // C) Infantry fill to cap
  const infAlloc = distributeInf(stock.inf, arcAlloc, cavAlloc, cap);
  const usedInf  = infAlloc.reduce((s,x)=>s+x,0);
  const leftInf  = stock.inf - usedInf;

  const leftover = { inf: leftInf, cav: leftCav, arc: leftArc };

  const packs = [];
  for (let i=0;i<n;i++){
    packs.push({ inf: infAlloc[i], cav: cavAlloc[i], arc: arcAlloc[i] });
  }
  return { packs, leftover };
}

/* ---------- UI: Optimizer handler (Option‑A) ---------- */
function onOptimize() {
  // 1) Stats + exact fractions (Best)
  const stats = {
    inf_atk: num("inf_atk"),
    inf_let: num("inf_let"),
    cav_atk: num("cav_atk"),
    cav_let: num("cav_let"),
    arc_atk: num("arc_atk"),
    arc_let: num("arc_let")
  };
  const tierRaw = document.getElementById("troopTier").value;
  const opt = computeExactOptimalFractions(stats, tierRaw);
  lastBestTriplet = { fin: opt.fin, fcav: opt.fcav, farc: opt.farc };

  // 2) Use editable composition (or Best if invalid)
  const usedFractions = getFractionsForRally();

  // Update readout
  const usedDisp = formatTriplet(usedFractions.fin, usedFractions.fcav, usedFractions.farc);
  const bestDisp = formatTriplet(opt.fin, opt.fcav, opt.farc);
  const fracEl = document.getElementById("fractionReadout");
  if (fracEl) fracEl.innerText =
    `Target fractions (Inf/Cav/Arc): ${usedDisp}   ·   Best: ${bestDisp}`;

  // 3) Inventory + settings
  const stock = {
    inf: Math.max(0, Math.floor(num("stockInf"))),
    cav: Math.max(0, Math.floor(num("stockCav"))),
    arc: Math.max(0, Math.floor(num("stockArc")))
  };
  const cap        = Math.max(1, Math.floor(num("marchSize")));   // per formation cap
  const formations = Math.max(1, Math.floor(num("numFormations")));
  const rallySize  = Math.max(0, Math.floor(num("rallySize")));    // real field

  const totalAvailBefore = stock.inf + stock.cav + stock.arc;

  // 4) Build rally first (consumes stock) — uses the EDITABLE composition
  const rally = buildRally(usedFractions, rallySize, stock);
  const rallyTotal = rally.inf + rally.cav + rally.arc;

  // 5) Build formations with Option‑A
  const { packs, leftover } = buildOptionAFormations({...stock}, formations, cap);

  // 6) Render table (with CALL RALLY row if >0)
  let html = `<table><thead>
  <tr>
      <th>Type</th>
      <th>Infantry</th>
      <th>Cavalry</th>
      <th>Archers</th>
      <th>Total</th>
  </tr>
  </thead><tbody>`;

  if (rallySize > 0) {
    html += `<tr style="background:#162031;">
        <td><strong>CALL RALLY</strong></td>
        <td>${rally.inf.toLocaleString()}</td>
        <td>${rally.cav.toLocaleString()}</td>
        <td>${rally.arc.toLocaleString()}</td>
        <td>${rallyTotal.toLocaleString()}</td>
    </tr>`;
  }

  packs.forEach((p, idx) => {
    const tot = p.inf + p.cav + p.arc;
    html += `<tr><td>#${idx+1}</td>
      <td>${p.inf.toLocaleString()}</td>
      <td>${p.cav.toLocaleString()}</td>
      <td>${p.arc.toLocaleString()}</td>
      <td>${tot.toLocaleString()}</td></tr>`;
  });
  html += `</tbody></table>`;
  const tableEl = document.getElementById("optTableWrap");
  if (tableEl) tableEl.innerHTML = html;

  // 7) Summary (aligned, multiline)
  const formedTroops = packs.reduce((s,p)=>s + p.inf + p.cav + p.arc, 0);
  const totalUsed = (totalAvailBefore - (leftover.inf+leftover.cav+leftover.arc));

  const msgParts = [];
  if (rallySize > 0) {
    msgParts.push(`Rally used → INF ${rally.inf.toLocaleString()}, CAV ${rally.cav.toLocaleString()}, ARC ${rally.arc.toLocaleString()} (total ${rallyTotal.toLocaleString()}).`);
  } else {
    msgParts.push(`Rally not built (set "Call rally size" if you want to consume stock first).`);
  }
  msgParts.push(`Formations built: ${packs.length} × cap ${cap.toLocaleString()} (troops placed: ${formedTroops.toLocaleString()}).`);
  msgParts.push(`Leftover → INF ${leftover.inf.toLocaleString()}, CAV ${leftover.cav.toLocaleString()}, ARC ${leftover.arc.toLocaleString()}.`);
  msgParts.push(`Stock used: ${totalUsed.toLocaleString()} of ${totalAvailBefore.toLocaleString()}.`);

  const invEl = document.getElementById("inventoryReadout");
  if (invEl) {
    invEl.style.whiteSpace = "pre-line"; // alignment/readability
    invEl.innerText = msgParts.join("\n\n");
  }
}

/* ---------- Init ---------- */
function wireUp() {
  const btnPlot = document.getElementById("btnPlot");
  if (btnPlot) btnPlot.addEventListener("click", () => { computePlots(); onOptimize(); });

  const btnOpt = document.getElementById("btnOptimize");
  if (btnOpt) btnOpt.addEventListener("click", onOptimize);

  const compEl = getCompEl();
  if (compEl) {
    compEl.addEventListener("input", () => {
      compUserEdited = true;
      onOptimize(); // live update table as you type
    });
  }
  const btnBest = document.getElementById("btnUseBest");
  if (btnBest) {
    btnBest.addEventListener("click", () => {
      compUserEdited = false;
      setCompInputFromBest();
      onOptimize();
    });
  }

  // Initial render
  computePlots();
  onOptimize();
}
window.addEventListener("DOMContentLoaded", wireUp);
