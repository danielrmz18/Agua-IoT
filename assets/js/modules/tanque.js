import { ENDPOINTS, updateById } from "../api.js";
import { clamp, fmtDate, nowIso, toBool, escapeHtml } from "../utils.js";
import { store } from "../store.js";

export function renderTanque() {
  const el = document.getElementById("view-tanque");
  const items = Array.isArray(store.tanques) ? store.tanques : [];

  if (!items.length) {
    el.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body p-4 text-secondary">
          No hay registros en <b>Tanque</b>. Genera datos en MockAPI.
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="h5 fw-semibold mb-1"><i class="bi bi-toilet"></i> Tanques WC</div>
        <div class="text-secondary">Bloqueo de descarga y detección de fuga.</div>
      </div>
      <div class="small text-secondary">Total: <b>${items.length}</b></div>
    </div>

    <div class="row g-3">
      ${items.map(cardTanque).join("")}
    </div>
  `;

  el.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", onClickAction);
  });
}

function cardTanque(b) {
  const id = b.id;
  const nombre = b.name ?? "Tanque WC";

  // tu campo puede venir como "nivelTanquePorcentaj" (sin e)
  const nivel = clamp(b.nivelTanquePorcentaj ?? b.nivelTanquePorcentaje ?? 0, 0, 100);

  const bloqueada = toBool(b.descargaBloqueada ?? false);
  const fuga = toBool(b.fugaDetectada ?? false);

  return `
    <div class="col-12 col-lg-6">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body p-4">

          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold h5 mb-1">
                <span class="badge text-bg-dark me-2">#${escapeHtml(id)}</span>${escapeHtml(nombre)}
              </div>
              <div class="text-secondary small">Actualizado: ${escapeHtml(fmtDate(b.actualizadoEn))}</div>
            </div>
            <div class="text-end">
              <span class="badge rounded-pill ${fuga ? "text-bg-danger" : "text-bg-success"}">
                ${fuga ? "Fuga" : "OK"}
              </span>
              <div class="mt-2">
                <span class="badge rounded-pill ${bloqueada ? "text-bg-warning" : "text-bg-secondary"}">
                  ${bloqueada ? "Bloqueada" : "Habilitada"}
                </span>
              </div>
            </div>
          </div>

          <hr class="my-3">

          <div class="mb-2 small text-secondary">Nivel tanque: <b>${nivel}%</b></div>
          <div class="gauge mb-3"><div style="width:${nivel}%"></div></div>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-outline-light btn-sm" data-action="lock" data-id="${escapeHtml(id)}">
              <i class="bi bi-lock"></i> Bloquear
            </button>
            <button class="btn btn-light btn-sm" data-action="unlock" data-id="${escapeHtml(id)}">
              <i class="bi bi-unlock"></i> Desbloquear
            </button>
            <button class="btn btn-outline-danger btn-sm" data-action="leakOn" data-id="${escapeHtml(id)}">
              <i class="bi bi-exclamation-triangle"></i> Simular fuga
            </button>
            <button class="btn btn-outline-secondary btn-sm" data-action="leakOff" data-id="${escapeHtml(id)}">
              <i class="bi bi-check2-circle"></i> Quitar alerta
            </button>
          </div>

          <div class="row g-2 align-items-end">
            <div class="col-12">
              <label class="form-label small text-secondary mb-1">Nivel tanque (%)</label>
              <input class="form-control form-control-sm" type="number" min="0" max="100"
                value="${nivel}" data-field="nivelTanquePorcentaj" data-id="${escapeHtml(id)}">
            </div>
            <div class="col-12">
              <button class="btn btn-outline-light btn-sm w-100" data-action="save" data-id="${escapeHtml(id)}">
                <i class="bi bi-save2"></i> Guardar nivel
              </button>
            </div>
          </div>

          <div class="mt-3 small text-secondary">
            *descargaBloqueada = actuador, fugaDetectada = alerta.
          </div>
        </div>
      </div>
    </div>
  `;
}

async function onClickAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  const current = store.tanques.find(x => String(x.id) === String(id));
  if (!current) return;

  try {
    if (action === "lock") await patchTanque(id, { descargaBloqueada: true });
    if (action === "unlock") await patchTanque(id, { descargaBloqueada: false });
    if (action === "leakOn") await patchTanque(id, { fugaDetectada: true });
    if (action === "leakOff") await patchTanque(id, { fugaDetectada: false });

    if (action === "save") {
      const inp = document.querySelector(`input[data-id="${id}"][data-field="nivelTanquePorcentaj"]`);
      const nivel = clamp(inp?.value ?? 0, 0, 100);
      await patchTanque(id, { nivelTanquePorcentaj: nivel });
    }

    window.__toast?.("Tanque actualizado ✅");
    await window.__reload?.();
  } catch (err) {
    console.error(err);
    window.__toast?.("Error al actualizar Tanque ❌");
  }
}

async function patchTanque(id, partial) {
  const current = store.tanques.find(x => String(x.id) === String(id));
  const payload = { ...current, ...partial, actualizadoEn: nowIso() };
  return await updateById(ENDPOINTS.tanque, id, payload);
}