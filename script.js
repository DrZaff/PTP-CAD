/* =========================
   Build marker (helps confirm updates)
   ========================= */
const APP_BUILD = "CAC-pill-fix-v4";
console.log("[PTP CAD]", APP_BUILD);

/* =========================
   Pure logic (portable)
   ========================= */

function getAgeBand(ageYears) {
  if (!Number.isFinite(ageYears)) return null;
  if (ageYears < 30) return "lt30";
  if (ageYears <= 39) return "30-39";
  if (ageYears <= 49) return "40-49";
  if (ageYears <= 59) return "50-59";
  if (ageYears <= 69) return "60-69";
  return "70+";
}

const PTP_TABLE = {
  chestPain: {
    men:   { "30-39": 4,  "40-49": 22, "50-59": 32, "60-69": 44, "70+": 52 },
    women: { "30-39": 5,  "40-49": 10, "50-59": 13, "60-69": 16, "70+": 27 }
  },
  dyspnea: {
    men:   { "30-39": 0,  "40-49": 12, "50-59": 20, "60-69": 27, "70+": 32 },
    women: { "30-39": 3,  "40-49": 3,  "50-59": 9,  "60-69": 14, "70+": 12 }
  }
};

function calculatePretestProbability({ ageYears, sex, symptom }) {
  const flags = [];
  const ageBand = getAgeBand(ageYears);

  if (!ageBand) flags.push({ level: "bad", msg: "Age is required and must be a number." });
  if (ageBand === "lt30") flags.push({ level: "warn", msg: "Age <30: figure table begins at 30–39; not applicable." });

  if (!sex || !["men", "women"].includes(sex)) flags.push({ level: "bad", msg: "Sex is required." });
  if (!symptom || !["chestPain", "dyspnea"].includes(symptom)) flags.push({ level: "bad", msg: "Symptom selection is required." });

  if (flags.some(f => f.level === "bad")) return { ok: false, flags };

  if (ageBand === "lt30") {
    return { ok: false, flags: [...flags, { level: "bad", msg: "No table value for age <30 from the provided figure." }] };
  }

  const ptp = PTP_TABLE?.[symptom]?.[sex]?.[ageBand];
  if (!Number.isFinite(ptp)) return { ok: false, flags: [...flags, { level: "bad", msg: "No matching table value found." }] };

  return {
    ok: true,
    ptpDisplay: `≤${ptp}%`,
    category: ptp <= 15 ? "low" : "intermediateHigh",
    flags
  };
}

/**
 * CAC categories per figure:
 * 0–99 -> ≤15% (low)
 * 100–999 -> >15–50% (intermediate-high)
 * >=1000 -> >50% (high)
 */
function interpretCAC(cacScore) {
  const n = Number(cacScore);
  if (!Number.isFinite(n) || n < 0) return { ok: false, msg: "CAC must be a number ≥ 0." };

  if (n <= 99)  return { ok: true, range: "≤15%",    category: "low" };
  if (n <= 999) return { ok: true, range: ">15–50%", category: "intermediateHigh" };
  return { ok: true, range: ">50%", category: "high" };
}

/* =========================
   UI helpers
   ========================= */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pillFor(category) {
  if (category === "low") return `<span class="badge low">Low ≤15%</span>`;
  if (category === "high") return `<span class="badge veryhigh">High &gt;50%</span>`;
  return `<span class="badge high">Intermediate–High &gt;15%</span>`;
}

function renderFlags(flags) {
  const el = document.getElementById("flags");
  if (!el) return;

  if (!flags || flags.length === 0) {
    el.innerHTML = `<li class="muted">No flags.</li>`;
    return;
  }

  el.innerHTML = flags.map(f => {
    const cls = f.level === "bad" ? "flag-bad" : f.level === "warn" ? "flag-warn" : "flag-good";
    return `<li class="${cls}">${escapeHtml(f.msg)}</li>`;
  }).join("");
}

/* =========================
   Render
   ========================= */

function renderResults(ptpObj, cacObj) {
  const resultsEl = document.getElementById("results");
  if (!resultsEl) return;

  if (!ptpObj?.ok) {
    resultsEl.innerHTML = `<div class="empty">Fix the flagged inputs to calculate.</div>`;
    return;
  }

  const ptpBlock = `
    <div class="kpi">
      <div>
        <div class="label">Pre-test probability based on age, sex, primary symptom</div>
        <div class="value">${escapeHtml(ptpObj.ptpDisplay)}</div>
      </div>
      <div>${pillFor(ptpObj.category)}</div>
    </div>
  `;

  let cacBlock = "";
  if (cacObj) {
    if (!cacObj.ok) {
      cacBlock = `
        <div class="kpi">
          <div>
            <div class="label">Pretest probability based on CAC score</div>
            <div class="value">—</div>
          </div>
          <div><span class="badge veryhigh">Check CAC</span></div>
        </div>
      `;
    } else {
      // ✅ ONLY ONE category pill here (no “all three categories” text)
      // ✅ NO “CAC bucket …” line rendered anywhere
      cacBlock = `
        <div class="kpi">
          <div>
            <div class="label">Pretest probability based on CAC score</div>
            <div class="value">${escapeHtml(cacObj.range)}</div>
          </div>
          <div>${pillFor(cacObj.category)}</div>
        </div>
      `;
    }
  }

  resultsEl.innerHTML = ptpBlock + cacBlock;
}

/* =========================
   DOM wiring
   ========================= */

const els = {
  age: document.getElementById("age"),
  sex: document.getElementById("sex"),
  symptom: document.getElementById("symptom"),
  cac: document.getElementById("cac"),
  calcBtn: document.getElementById("calcBtn"),
  resetBtn: document.getElementById("resetBtn"),
  openRefBtn: document.getElementById("openRefBtn"),
  refModal: document.getElementById("refModal"),
  closeRefBtn: document.getElementById("closeRefBtn"),
};

function onCalculate() {
  const ageYears = Number(els.age.value);
  const sex = els.sex.value;
  const symptom = els.symptom.value;

  const ptpObj = calculatePretestProbability({ ageYears, sex, symptom });

  const cacVal = els.cac.value;
  const cacObj = (cacVal !== "" && cacVal !== null && cacVal !== undefined)
    ? interpretCAC(cacVal)
    : null;

  renderResults(ptpObj, cacObj);
  renderFlags(ptpObj.flags || []);
}

function onReset() {
  els.age.value = "";
  els.sex.value = "";
  els.symptom.value = "";
  els.cac.value = "";
  document.getElementById("results").innerHTML = `<div class="empty">Enter inputs and tap <b>Calculate</b>.</div>`;
  renderFlags([]);
}

els.calcBtn.addEventListener("click", onCalculate);
els.resetBtn.addEventListener("click", onReset);

/* Reference modal behavior */
function openModal() {
  els.refModal.classList.add("open");
  els.refModal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  els.refModal.classList.remove("open");
  els.refModal.setAttribute("aria-hidden", "true");
}
els.openRefBtn?.addEventListener("click", openModal);
els.closeRefBtn?.addEventListener("click", closeModal);
els.refModal?.addEventListener("click", (e) => { if (e.target === els.refModal) closeModal(); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && els.refModal?.classList.contains("open")) closeModal(); });
