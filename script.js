/* =========================
   Pure logic (portable)
   ========================= */

/**
 * Map age -> age band key used by the figure.
 * Returns one of: "30-39","40-49","50-59","60-69","70+"
 */
function getAgeBand(ageYears) {
  if (!Number.isFinite(ageYears)) return null;
  if (ageYears < 30) return "lt30";
  if (ageYears <= 39) return "30-39";
  if (ageYears <= 49) return "40-49";
  if (ageYears <= 59) return "50-59";
  if (ageYears <= 69) return "60-69";
  return "70+";
}

/**
 * Table values transcribed from the provided ACC/AHA 2021 guideline figure snapshot.
 * Units: percent (%). Some are shown with "≤" in the figure; we store the numeric value.
 *
 * Structure: table[symptom][sex][ageBand] = ptpPercent
 */
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

/**
 * Calculate pretest probability (PTP) based on age, sex, symptom.
 * Returns a structured object; no DOM access.
 */
function calculatePretestProbability({ ageYears, sex, symptom }) {
  const flags = [];

  const ageBand = getAgeBand(ageYears);
  if (!ageBand) flags.push({ level: "bad", msg: "Age is required and must be a number." });

  if (ageBand === "lt30") {
    flags.push({ level: "warn", msg: "Age <30: the provided figure table begins at 30–39. Result may not be applicable." });
  }

  if (!sex || !["men", "women"].includes(sex)) {
    flags.push({ level: "bad", msg: "Sex is required." });
  }
  if (!symptom || !["chestPain", "dyspnea"].includes(symptom)) {
    flags.push({ level: "bad", msg: "Symptom selection is required." });
  }

  if (flags.some(f => f.level === "bad")) {
    return { ok: false, flags, ageBand };
  }

  if (ageBand === "lt30") {
    flags.push({ level: "bad", msg: "No table value available for age <30 from the provided figure. Cannot compute." });
    return { ok: false, flags, ageBand };
  }

  const ptp = PTP_TABLE?.[symptom]?.[sex]?.[ageBand];
  if (!Number.isFinite(ptp)) {
    flags.push({ level: "bad", msg: "No matching table value found (check inputs)." });
    return { ok: false, flags, ageBand };
  }

  const category = ptp <= 15 ? "low" : "intermediateHigh";

  return {
    ok: true,
    ptpPercent: ptp,
    ptpDisplay: `≤${ptp}%`,
    category,
    ageBand,
    flags
  };
}

/**
 * CAC interpretation per the figure snapshot.
 */
function interpretCAC(cacScore) {
  if (cacScore === null || cacScore === undefined || cacScore === "") return null;
  const n = Number(cacScore);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, level: "bad", label: "Invalid CAC", detail: "CAC must be a number ≥ 0." };
  }

  // Per the provided figure’s CAC categories. CAC=0 is not explicitly shown in the bar;
  // we treat CAC=0 as the lowest-probability bucket for display purposes.
  if (n === 0) {
    return { ok: true, bucket: "0", ptpRange: "≤15%", level: "low", label: "CAC 0", detail: "Figure-style interpretation: CAC 0 → ≤15%." };
  }
  if (n >= 1 && n <= 99) {
    return { ok: true, bucket: "1-99", ptpRange: "≤15%", level: "low", label: "CAC 1–99", detail: "CAC 1–99 → ≤15% (low)." };
  }
  if (n >= 100 && n <= 999) {
    return { ok: true, bucket: "100-999", ptpRange: ">15–50%", level: "high", label: "CAC 100–999", detail: "CAC 100–999 → >15–50%." };
  }
  return { ok: true, bucket: ">=1000", ptpRange: ">50%", level: "veryhigh", label: "CAC ≥1000", detail: "CAC ≥1000 → >50%." };
}

/* =========================
   UI wiring (DOM only here)
   ========================= */

const els = {
  age: document.getElementById("age"),
  sex: document.getElementById("sex"),
  symptom: document.getElementById("symptom"),
  cac: document.getElementById("cac"),
  calcBtn: document.getElementById("calcBtn"),
  resetBtn: document.getElementById("resetBtn"),
  results: document.getElementById("results"),
  flags: document.getElementById("flags"),

  openRefBtn: document.getElementById("openRefBtn"),
  refModal: document.getElementById("refModal"),
  closeRefBtn: document.getElementById("closeRefBtn"),
};

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badgeForCategory(category) {
  if (category === "low") return `<span class="badge low">Low ≤15%</span>`;
  return `<span class="badge high">Intermediate–High &gt;15%</span>`;
}

function badgeForCACLevel(level) {
  // User-facing legend for CAC-based probability buckets
  return `<span class="badge high">Low ≤15%, Intermediate–High &gt;15%, and High &gt;50%</span>`;
}

function renderFlags(flags) {
  if (!flags || flags.length === 0) {
    els.flags.innerHTML = `<li class="muted">No flags.</li>`;
    return;
  }
  els.flags.innerHTML = flags.map(f => {
    const cls = f.level === "bad" ? "flag-bad" : f.level === "warn" ? "flag-warn" : "flag-good";
    return `<li class="${cls}">${escapeHtml(f.msg)}</li>`;
  }).join("");
}

function renderResults(ptpObj, cacObj) {
  if (!ptpObj?.ok) {
    els.results.innerHTML = `<div class="empty">Fix the flagged inputs to calculate.</div>`;
    return;
  }

  const kpi1 = `
    <div class="kpi">
      <div>
        <div class="label">Pre-test probability based on age, sex, primary symptom</div>
        <div class="value">${escapeHtml(ptpObj.ptpDisplay)}</div>
      </div>
      <div>${badgeForCategory(ptpObj.category)}</div>
    </div>
  `;

  let cacBlock = "";
  if (cacObj) {
    if (!cacObj.ok) {
      cacBlock = `
        <div class="kpi">
          <div>
            <div class="label">Pretest probability based on CAC score</div>
            <div class="value">${escapeHtml(cacObj.label)}</div>
          </div>
          <div><span class="badge veryhigh">Check CAC</span></div>
        </div>
        <div class="muted small">${escapeHtml(cacObj.detail)}</div>
      `;
    } else {
      cacBlock = `
        <div class="kpi">
          <div>
            <div class="label">Pretest probability based on CAC score</div>
            <div class="value">${escapeHtml(cacObj.ptpRange)}</div>
          </div>
          <div>${badgeForCACLevel(cacObj.level)}</div>
        </div>
        <div class="muted small">CAC bucket: ${escapeHtml(cacObj.label)} • ${escapeHtml(cacObj.detail)}</div>
      `;
    }
  }

  els.results.innerHTML = kpi1 + cacBlock;
}

function onCalculate() {
  const ageYears = Number(els.age.value);
  const sex = els.sex.value;
  const symptom = els.symptom.value;
  const cacVal = els.cac.value;

  const ptpObj = calculatePretestProbability({ ageYears, sex, symptom });
  const cacObj = (cacVal !== "" && cacVal !== null && cacVal !== undefined) ? interpretCAC(cacVal) : null;

  const mergedFlags = [...(ptpObj.flags || [])];

  if (ptpObj.ok) {
    if (ageYears > 100) mergedFlags.push({ level: "warn", msg: "Age >100: verify input." });
    if (ageYears < 30) mergedFlags.push({ level: "warn", msg: "Age <30: outside figure range; computation not provided." });
  }

  if (cacObj && !cacObj.ok) {
    mergedFlags.push({ level: "bad", msg: "CAC input invalid (must be ≥0)." });
  }

  renderResults(ptpObj, cacObj);
  renderFlags(mergedFlags);
}

function onReset() {
  els.age.value = "";
  els.sex.value = "";
  els.symptom.value = "";
  els.cac.value = "";
  els.results.innerHTML = `<div class="empty">Enter inputs and tap <b>Calculate</b>.</div>`;
  els.flags.innerHTML = `<li class="muted">No flags yet.</li>`;
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
els.refModal?.addEventListener("click", (e) => {
  if (e.target === els.refModal) closeModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.refModal?.classList.contains("open")) closeModal();
});
