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
    men:   { "30-39": 4, "40-49": 22, "50-59": 32, "60-69": 44, "70+": 52 },
    women: { "30-39": 5, "40-49": 10, "50-59": 13, "60-69": 16, "70+": 27 }
  },
  dyspnea: {
    men:   { "30-39": 0, "40-49": 12, "50-59": 20, "60-69": 27, "70+": 32 },
    women: { "30-39": 3, "40-49": 3, "50-59": 9, "60-69": 14, "70+": 12 }
  }
};

function calculatePretestProbability({ ageYears, sex, symptom }) {
  const ageBand = getAgeBand(ageYears);
  if (!ageBand || !sex || !symptom) return { ok: false, flags: [] };

  const ptp = PTP_TABLE?.[symptom]?.[sex]?.[ageBand];
  if (!Number.isFinite(ptp)) return { ok: false, flags: [] };

  return {
    ok: true,
    ptpDisplay: `≤${ptp}%`,
    category: ptp <= 15 ? "low" : "intermediateHigh",
    flags: []
  };
}

/* =========================
   CAC interpretation
   ========================= */

function interpretCAC(cacScore) {
  const n = Number(cacScore);
  if (!Number.isFinite(n) || n < 0) return null;

  if (n <= 99) {
    return { range: "≤15%", category: "low" };
  }
  if (n <= 999) {
    return { range: ">15–50%", category: "intermediateHigh" };
  }
  return { range: ">50%", category: "high" };
}

/* =========================
   UI helpers
   ========================= */

function pill(category) {
  if (category === "low") {
    return `<span class="badge low">Low ≤15%</span>`;
  }
  if (category === "high") {
    return `<span class="badge veryhigh">High >50%</span>`;
  }
  return `<span class="badge high">Intermediate–High >15%</span>`;
}

/* =========================
   DOM wiring
   ========================= */

const els = {
  age: document.getElementById("age"),
  sex: document.getElementById("sex"),
  symptom: document.getElementById("symptom"),
  cac: document.getElementById("cac"),
  results: document.getElementById("results"),
  calcBtn: document.getElementById("calcBtn"),
  resetBtn: document.getElementById("resetBtn")
};

function renderResults(ptp, cac) {
  let html = "";

  if (ptp?.ok) {
    html += `
      <div class="kpi">
        <div>
          <div class="label">Pre-test probability based on age, sex, primary symptom</div>
          <div class="value">${ptp.ptpDisplay}</div>
        </div>
        <div>${pill(ptp.category)}</div>
      </div>
    `;
  }

  if (cac) {
    html += `
      <div class="kpi">
        <div>
          <div class="label">Pretest probability based on CAC score</div>
          <div class="value">${cac.range}</div>
        </div>
        <div>${pill(cac.category)}</div>
      </div>
    `;
  }

  els.results.innerHTML = html || `<div class="empty">Enter inputs and tap <b>Calculate</b>.</div>`;
}

function onCalculate() {
  const ptp = calculatePretestProbability({
    ageYears: Number(els.age.value),
    sex: els.sex.value,
    symptom: els.symptom.value
  });

  const cac = els.cac.value ? interpretCAC(els.cac.value) : null;
  renderResults(ptp, cac);
}

function onReset() {
  els.age.value = "";
  els.sex.value = "";
  els.symptom.value = "";
  els.cac.value = "";
  els.results.innerHTML = `<div class="empty">Enter inputs and tap <b>Calculate</b>.</div>`;
}

els.calcBtn.addEventListener("click", onCalculate);
els.resetBtn.addEventListener("click", onReset);
