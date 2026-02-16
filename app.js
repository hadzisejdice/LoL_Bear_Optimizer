/**
 * FINAL — Frakinator‑accurate composition + Option‑A multi‑formation builder
 * - Closed-form optimum (Lagrange math) with bounds
 * - Plasma heatmap
 * - Rally + formations respect composition constraints:
 *    - INF ∈ [7.5%, 10%]
 *    - CAV ≥ 10%
 *    - ARC fills remainder
 *
 * Exact fractions (unconstrained):
 *   fin  = α² / (α² + β² + γ²)
 *   fcav = β² / (α² + β² + γ²)
 *   farc = γ² / (α² + β² + γ²)
 *
 * where:
 *   α = Ainf / 3    (adjusted below)
 *   β = Acav
 *   γ = K_arc * Aarc
 *      K_arc = (4.4/3) for T1–T6; (4.84/3) for T7–TG2 & TG3–TG4  [effective constant encoded]
 *
 * A = (1 + atk/100) * (1 + leth/100)
 */

/* ---------- Global Composition Bounds ---------- */
const INF_MIN_PCT = 0.075; // 7.5%
const INF_MAX_PCT = 0.10;  // 10%
const CAV_MIN_PCT = 0.10;  // 10%

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
  return 2.78/1.45; // T7–TG2, TG3–TG4 4.84/3
}

/* ---------- Clamp/Project Fractions to Bounds ---------- */
/**
 * Enforce:
 *  - INF ∈ [INF_MIN_PCT, INF_MAX_PCT]
 *  - CAV ≥ CAV_MIN_PCT
 *  - ARC = 1 - INF - CAV  (≥ 0; if negative, reduce CAV down to min so ARC hits 0)
 */
function enforceCompositionBounds(fin, fcav, farc) {
  let i = fin, c = fcav, a = farc;
  // Clamp INF to [min,max]
  if (i < INF_MIN_PCT) i = INF_MIN_PCT;
  if (i > INF_MAX_PCT) i = INF_MAX_PCT;

  // Enforce Cav ≥ min
  if (c < CAV_MIN_PCT) c = CAV_MIN_PCT;

  // Give remainder to Archers
  a = 1 - i - c;

  // If over-constrained (negative ARC), reduce Cav down to make ARC=0, but not below Cav min
  if (a < 0) {
    c = Math.max(CAV_MIN_PCT, 1 - i); // this sets ARC to 0
    a = 1 - i - c;
    if (a < 0) { // should not happen with these bounds, but keep safe
      a = 0;
      c = 1 - i;
    }
  }

  // Final safety clamp
  const S = i + c + a;
  if (S <= 0) return { fin: INF_MIN_PCT, fcav: CAV_MIN_PCT, farc: 1 - INF_MIN_PCT - CAV_MIN_PCT };
  return { fin: i / S, fcav: c / S, farc: a / S };
}

/* ---------- Closed-form optimum ---------- */
function computeExactOptimalFractions(stats, tierRaw) {
  const Ainf = attackFactor(stats.inf_atk, stats.inf_let);
  const Acav = attackFactor(stats.cav_atk, stats.cav_let);
  const Aarc = attackFactor(stats.arc_atk, stats.arc_let);
  const KARC = getArcherCoefByTier(tierRaw);

  const alpha = Ainf / 1.12; // original tuned constant (was /1.12)
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
  const Aarc = attackFactor(stats.arc_atk, stats.arc_let);
  const KARC = getArcherCoefByTier(tierRaw);

  const termInf = (1/1.45) * Ainf * Math.sqrt(fin);
  const termCav = Acav * Math.sqrt(fcav);
  const termArc = KARC * Aarc * Math.sqrt(farc);

  return termInf + termCav + termArc;
}

/* ================================================================
   NEW: Editable Composition Helpers (Inf/Cav/Arc)
   ================================================================ */
let lastBestTriplet = { fin: INF_MIN_PCT, fcav: CAV_MIN_PCT, farc: 1 - INF_MIN_PCT - CAV_MIN_PCT }; // bounded default
let compUserEdited = false; // if user typed into compInput

function getCompEl() { return document.getElementById("compInput"); }
function getCompHintEl() { return document.getElementById("compHint"); }

/** Round two and fix the third so ints sum to 100 */
function roundFractionsTo100(fin, fcav, farc) {
  const S = fin + fcav + farc;
  if (S <= 0) return { i: 0, c: 0, a: 100 };
  const nf = fin / S, nc = fcav / S, na = farc / S;

  let i = Math.round(nf * 100);
  let c = Math.round(nc * 100);
  let a = 100 - i - c;
  if (a < 0) {
    a = 0;
    if (i + c > 100) {
      const over = i + c - 100;
      if (i >= c) i -= over; else c -= over;
    }
  }
  return { i, c, a };
}

/** Format fractions (0..1 each) as "X/Y/Z" percentages */
function formatTriplet(fin, fcav, farc) {
  const { i, c, a } = roundFractionsTo100(fin, fcav, farc);
  return `${i}/${c}/${a}`;
}

/** Parse "4/10/85", "4,10,85", "4 10 85". Normalize to 100%. Returns fractions {fin,fcav,farc} or null if invalid. */
function parseCompToFractions(str) {
  if (typeof str !== "string") return null;
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

  const sum = i + c + a;
  if (sum <= 0) return null;

  const nf = i / sum, nc = c / sum, na = a / sum;
  return { fin: nf, fcav: nc, farc: na };
}

/** Update the UI input with Best triplet unless user has edited */
function setCompInputFromBest() {
  const el = getCompEl();
  if (!el) return;
  el.value = formatTriplet(lastBestTriplet.fin, lastBestTriplet.fcav, lastBestTriplet.farc);
  const hint = getCompHintEl();
  if (hint) hint.textContent = "Auto-filled from Best (bounded). Edit to override.";
}

/** Decide which fractions to use: user's editable field (normalized & clamped), otherwise bounded Best */
function getFractionsForRally() {
  const el = getCompEl();
  const hint = getCompHintEl();
  if (!el) return lastBestTriplet;

  const parsed = parseCompToFractions(el.value);
  if (parsed) {
    const bounded = enforceCompositionBounds(parsed.fin, parsed.fcav, parsed.farc);
    const disp = formatTriplet(bounded.fin, bounded.fcav, bounded.farc);
    if (hint) {
      const orig = formatTriplet(parsed.fin, parsed.fcav, parsed.farc);
      if (orig !== disp) {
        hint.textContent = `Using (clamped): ${disp}  ·  (Inf 7.5–10%, Cav ≥ 10%)`;
      } else {
        hint.textContent = `Using: ${disp}`;
      }
    }
    return bounded;
  } else {
    if (hint) hint.textContent = "Invalid input → using Best (bounded).";
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

  // 1) Exact best composition (closed-form), then enforce bounds
  const opt = computeExactOptimalFractions(stats, tierRaw);
  const bounded = enforceCompositionBounds(opt.fin, opt.fcav, opt.farc);
  lastBestTriplet = { fin: bounded.fin, fcav: bounded.fcav, farc: bounded.farc };

  // If user didn't edit, auto-fill the editable field from bounded Best
  if (!compUserEdited) {
    setCompInputFromBest();
  }

  // 2) Dense sampling for heat-like background (unbounded surface for relative view)
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
        colorscale: "Plasma",
        reversescale: false,
        colorbar: {title:"Fraction of maximal damage", tickformat: ".2f"}
      },
      hovertemplate:
        "Inf: %{a:.2f}<br>Cav: %{b:.2f}<br>Arc: %{c:.2f}<br>Rel: %{marker.color:.3f}<extra></extra>"
    },
    {
      type: "scatterternary",
      mode: "markers+text",
      a: [bounded.fin],
      b: [bounded.fcav],
      c: [bounded.farc],
      marker:{size:14, color:"#10b981"},
      text:["Best*"],
      textposition:"top center",
      hovertemplate:
        "Best (bounded)<br>Inf: %{a:.2f}<br>Cav: %{b:.2f}<br>Arc: %{c:.2f}<extra></extra>"
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
    `Best composition (bounded) ≈ ${formatTriplet(bounded.fin, bounded.fcav, bounded.farc)} (Inf/Cav/Arc) · [Inf 7.5–10%, Cav ≥ 10%].`;
}

/* ---------- Rally build with integer bounds ---------- */
function buildRally(fractions, rallySize, stock) {
  if (rallySize <= 0) return {inf:0, cav:0, arc:0};

  // Integer min/max based on rally size
  const iMin = Math.ceil(INF_MIN_PCT * rallySize);
  const iMax = Math.floor(INF_MAX_PCT * rallySize);
  const cMin = Math.ceil(CAV_MIN_PCT * rallySize);

  // Start from bounded fractions, then clamp to integer bounds
  let iTarget = Math.round(fractions.fin  * rallySize);
  let cTarget = Math.round(fractions.fcav * rallySize);
  iTarget = Math.min(Math.max(iTarget, iMin), iMax);
  if (cTarget < cMin) cTarget = cMin;

  let aTarget = rallySize - iTarget - cTarget;
  if (aTarget < 0) {
    // Too much INF+CAV; reduce CAV down to leave ARC=0, but not below cMin
    cTarget = Math.max(cMin, rallySize - iTarget);
    aTarget = rallySize - iTarget - cTarget;
  }

  // Pull from stock; may cause deficit if stock is insufficient
  let i = Math.min(iTarget, stock.inf);
  let c = Math.min(cTarget, stock.cav);
  let a = Math.min(aTarget, stock.arc);

  let placed = i + c + a;
  let deficit = rallySize - placed;

  // Fill deficit: prefer ARC -> CAV -> INF (INF cannot exceed iMax)
  if (deficit > 0) {
    let give = Math.min(deficit, Math.max(0, stock.arc - a));
    a += give; deficit -= give;
  }
  if (deficit > 0) {
    let give = Math.min(deficit, Math.max(0, stock.cav - c));
    c += give; deficit -= give;
  }
  if (deficit > 0) {
    let canInf = Math.min(iMax, stock.inf) - i;
    let give = Math.min(deficit, Math.max(0, canInf));
    i += give; deficit -= give;
  }

  // If somehow over-allocated (shouldn't), trim ARC -> CAV -> INF but respect mins
  let surplus = (i + c + a) - rallySize;
  if (surplus > 0) {
    let take = Math.min(surplus, a);
    a -= take; surplus -= take;
  }
  if (surplus > 0) {
    let minC = Math.min(cMin, c); // keep at least cMin if possible
    let take = Math.min(surplus, c - minC);
    c -= take; surplus -= take;
  }
  if (surplus > 0) {
    let minI = Math.min(iMin, i); // keep at least iMin if possible
    let take = Math.min(surplus, i - minI);
    i -= take; surplus -= take;
  }

  // Consume stock
  stock.inf -= i; stock.cav -= c; stock.arc -= a;
  return { inf: i, cav: c, arc: a };
}

/* ---------- Round-robin filler for uneven per-slot caps ---------- */
function fillRoundRobin(total, caps) {
  const n = caps.length;
  const out = Array(n).fill(0);
  let t = Math.max(0, Math.floor(total));
  let progress = true;
  while (t > 0 && progress) {
    progress = false;
    for (let i = 0; i < n && t > 0; i++) {
      if (out[i] < caps[i]) {
        out[i] += 1;
        t -= 1;
        progress = true;
      }
    }
  }
  return out;
}

/* ---------- Option‑A formations with constraints per march ---------- */
function buildOptionAFormations(stock, formations, cap) {
  const n = Math.max(1, formations);

  const infMinPer = Math.ceil(INF_MIN_PCT * cap);
  const infMaxPer = Math.floor(INF_MAX_PCT * cap);
  const cavMinPer = Math.ceil(CAV_MIN_PCT * cap);

  const infAlloc = Array(n).fill(0);
  const cavAlloc = Array(n).fill(0);
  const arcAlloc = Array(n).fill(0);

  // Stage 0: Reserve minima per march (as much as stock allows)
  for (let i = 0; i < n; i++) {
    const free = cap;
    // INF min
    if (free > 0) {
      const giveInf = Math.min(infMinPer, stock.inf, free);
      infAlloc[i] += giveInf; stock.inf -= giveInf;
    }
    // CAV min
    const free2 = cap - infAlloc[i];
    if (free2 > 0) {
      const giveCav = Math.min(cavMinPer, stock.cav, free2);
      cavAlloc[i] += giveCav; stock.cav -= giveCav;
    }
  }

  // Stage 1: Fill Archers evenly into remaining capacity
  const arcCaps = Array(n).fill(0).map((_, i) => Math.max(0, cap - infAlloc[i] - cavAlloc[i]));
  const arcGive = fillRoundRobin(stock.arc, arcCaps);
  for (let i = 0; i < n; i++) {
    arcAlloc[i] += arcGive[i];
    stock.arc -= arcGive[i];
  }

  // Stage 2: Fill Cavalry evenly into any remaining capacity
  const cavCaps = Array(n).fill(0).map((_, i) => Math.max(0, cap - infAlloc[i] - cavAlloc[i] - arcAlloc[i]));
  const cavGive = fillRoundRobin(stock.cav, cavCaps);
  for (let i = 0; i < n; i++) {
    cavAlloc[i] += cavGive[i];
    stock.cav -= cavGive[i];
  }

  // Stage 3: Fill Infantry up to per-march max (even), into any remaining capacity
  const infCaps = Array(n).fill(0).map((_, i) => {
    const capLeft = Math.max(0, cap - infAlloc[i] - cavAlloc[i] - arcAlloc[i]);
    const roomToMax = Math.max(0, infMaxPer - infAlloc[i]);
    return Math.min(capLeft, roomToMax);
  });
  const infGive = fillRoundRobin(stock.inf, infCaps);
  for (let i = 0; i < n; i++) {
    infAlloc[i] += infGive[i];
    stock.inf -= infGive[i];
  }

  const packs = [];
  for (let i = 0; i < n; i++) {
    packs.push({ inf: infAlloc[i], cav: cavAlloc[i], arc: arcAlloc[i] });
  }
  const leftover = { inf: stock.inf, cav: stock.cav, arc: stock.arc };
  return { packs, leftover };
}

/* ---------- UI: Optimizer handler (Option‑A) ---------- */
function onOptimize() {
  // 1) Stats + exact fractions (Best → bounded)
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
  const bounded = enforceCompositionBounds(opt.fin, opt.fcav, opt.farc);
  lastBestTriplet = { fin: bounded.fin, fcav: bounded.fcav, farc: bounded.farc };

  // 2) Use editable composition (normalized & clamped) or bounded Best
  const usedFractions = getFractionsForRally();

  // Update readout
  const usedDisp = formatTriplet(usedFractions.fin, usedFractions.fcav, usedFractions.farc);
  const bestDisp = formatTriplet(bounded.fin, bounded.fcav, bounded.farc);
  const fracEl = document.getElementById("fractionReadout");
  if (fracEl) fracEl.innerText =
    `Target fractions (bounded · Inf 7.5–10%, Cav ≥ 10%): ${usedDisp}   ·   Best: ${bestDisp}`;

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

  // 4) Build rally first (consumes stock) — uses the EDITABLE composition (bounded already)
  const rally = buildRally(usedFractions, rallySize, stock);
  const rallyTotal = rally.inf + rally.cav + rally.arc;

  // 5) Build formations with Option‑A (bounded per-march)
  const { packs, leftover } = buildOptionAFormations({ ...stock }, formations, cap);

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
    invEl.style.whiteSpace = "pre-line";
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
