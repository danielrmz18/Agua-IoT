import { store } from "../store.js";
import { escapeHtml, fmtDate } from "../utils.js";
import { getHistory, clearHistory } from "../history.js";

const charts = new Map(); // canvasId -> Chart instance

function resetCharts() {
  for (const ch of charts.values()) {
    try { ch.destroy(); } catch {}
  }
  charts.clear();
}

function fmtTimeShort(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
}

function ensureChart(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el) return null;

  const prev = charts.get(canvasId);
  if (prev) return prev;

  // Chart global (por CDN)
  const chart = new Chart(el, config);
  charts.set(canvasId, chart);
  return chart;
}

function updateChart(chart, labels, datasets) {
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}

export function renderMonitor() {
  resetCharts(); // ✅ IMPORTANTE: evita que se “pierdan” las gráficas
  const el = document.getElementById("view-monitor");
  const h = getHistory();

  const tinacos = Array.isArray(store.tinacos) ? store.tinacos : [];
  const tanques = Array.isArray(store.tanques) ? store.tanques : [];

  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="h5 fw-semibold mb-1"><i class="bi bi-graph-up"></i> Monitoreo</div>
        <div class="text-secondary">Gráficas y últimos 10 estados por dispositivo (refresh cada 2s).</div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-light btn-sm" id="btnClearHistory">
          <i class="bi bi-trash3"></i> Borrar historial
        </button>
      </div>
    </div>

    <div class="row g-3">
      ${tinacos.map(t => monitorTinacoCard(t, h)).join("")}
      ${tanques.map(b => monitorTanqueCard(b, h)).join("")}
    </div>
  `;

  // Clear history
  document.getElementById("btnClearHistory").addEventListener("click", () => {
    const ok = confirm("¿Borrar historial local (últimos 10) de todos los dispositivos?");
    if (!ok) return;
    clearHistory();
    location.reload();
  });

  // Crear/Actualizar charts
  for (const t of tinacos) renderTinacoChart(t, h);
  for (const b of tanques) renderTanqueChart(b, h);
}

// ===== Cards =====
function monitorTinacoCard(t, h) {
  const id = String(t.id);
  const name = escapeHtml(t.Nombre ?? `Tinaco ${id}`);
  const rows = (h.tinaco?.[id] ?? []);
  const canvasId = `chart-tinaco-${id}`;

  return `
    <div class="col-12 col-xl-6">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body p-4">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold h5 mb-1">
                <span class="badge text-bg-dark me-2">Tinaco #${escapeHtml(id)}</span>${name}
              </div>
              <div class="text-secondary small">Nivel + Llenado (0/1)</div>
            </div>
          </div>

          <div class="mt-3">
            <canvas id="${canvasId}" height="110"></canvas>
          </div>

          <hr class="my-3">

          <div class="table-responsive">
            <table class="table table-sm table-dark table-borderless align-middle mb-0">
              <thead>
                <tr class="text-secondary">
                  <th>Hora</th>
                  <th>Nivel %</th>
                  <th>Llenado</th>
                  <th>Umbral</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length ? rows.map(r => `
                    <tr>
                      <td class="text-secondary">${escapeHtml(fmtTimeShort(r.ts))}</td>
                      <td>${escapeHtml(r.nivel)}</td>
                      <td>${escapeHtml(r.llenado)}</td>
                      <td class="text-secondary">${escapeHtml(r.umbral)}</td>
                    </tr>
                  `).join("") : `
                    <tr><td colspan="4" class="text-secondary">Aún no hay historial (espera 2–4s).</td></tr>
                  `
                }
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `;
}

function monitorTanqueCard(b, h) {
  const id = String(b.id);
  const name = escapeHtml(b.name ?? `Tanque ${id}`);
  const rows = (h.tanque?.[id] ?? []);
  const canvasId = `chart-tanque-${id}`;

  return `
    <div class="col-12 col-xl-6">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body p-4">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold h5 mb-1">
                <span class="badge text-bg-dark me-2">Tanque #${escapeHtml(id)}</span>${name}
              </div>
              <div class="text-secondary small">Nivel + Bloqueo (0/1) + Fuga (0/1)</div>
            </div>
          </div>

          <div class="mt-3">
            <canvas id="${canvasId}" height="110"></canvas>
          </div>

          <hr class="my-3">

          <div class="table-responsive">
            <table class="table table-sm table-dark table-borderless align-middle mb-0">
              <thead>
                <tr class="text-secondary">
                  <th>Hora</th>
                  <th>Nivel %</th>
                  <th>Bloq.</th>
                  <th>Fuga</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length ? rows.map(r => `
                    <tr>
                      <td class="text-secondary">${escapeHtml(fmtTimeShort(r.ts))}</td>
                      <td>${escapeHtml(r.nivel)}</td>
                      <td>${escapeHtml(r.bloqueada)}</td>
                      <td>${escapeHtml(r.fuga)}</td>
                    </tr>
                  `).join("") : `
                    <tr><td colspan="4" class="text-secondary">Aún no hay historial (espera 2–4s).</td></tr>
                  `
                }
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  `;
}

// ===== Charts =====
function renderTinacoChart(t, h) {
  const id = String(t.id);
  const rows = (h.tinaco?.[id] ?? []).slice().reverse(); // para que el tiempo vaya L->R
  const labels = rows.map(r => fmtTimeShort(r.ts));

  const dataNivel = rows.map(r => r.nivel);
  const dataLlenado = rows.map(r => r.llenado);

  const canvasId = `chart-tinaco-${id}`;

  const chart = ensureChart(canvasId, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Nivel (%)", data: dataNivel, yAxisID: "y" },
        { label: "Llenado (0/1)", data: dataLlenado, yAxisID: "y1", stepped: true },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { min: 0, max: 100 },
        y1: { min: 0, max: 1, ticks: { stepSize: 1 }, position: "right" },
      },
      plugins: { legend: { labels: { color: "#eaf6ff" } } },
    },
  });

  if (!chart) return;
  updateChart(chart, labels, [
    { label: "Nivel (%)", data: dataNivel, yAxisID: "y" },
    { label: "Llenado (0/1)", data: dataLlenado, yAxisID: "y1", stepped: true },
  ]);
}

function renderTanqueChart(b, h) {
  const id = String(b.id);
  const rows = (h.tanque?.[id] ?? []).slice().reverse();
  const labels = rows.map(r => fmtTimeShort(r.ts));

  const dataNivel = rows.map(r => r.nivel);
  const dataBloq = rows.map(r => r.bloqueada);
  const dataFuga = rows.map(r => r.fuga);

  const canvasId = `chart-tanque-${id}`;

  const chart = ensureChart(canvasId, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Nivel (%)", data: dataNivel, yAxisID: "y" },
        { label: "Bloqueo (0/1)", data: dataBloq, yAxisID: "y1", stepped: true },
        { label: "Fuga (0/1)", data: dataFuga, yAxisID: "y1", stepped: true },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        y: { min: 0, max: 100 },
        y1: { min: 0, max: 1, ticks: { stepSize: 1 }, position: "right" },
      },
      plugins: { legend: { labels: { color: "#eaf6ff" } } },
    },
  });

  if (!chart) return;
  updateChart(chart, labels, [
    { label: "Nivel (%)", data: dataNivel, yAxisID: "y" },
    { label: "Bloqueo (0/1)", data: dataBloq, yAxisID: "y1", stepped: true },
    { label: "Fuga (0/1)", data: dataFuga, yAxisID: "y1", stepped: true },
  ]);
}