import { ENDPOINTS, updateById } from "../api.js";
import { clamp, fmtDate, nowIso, toBool, escapeHtml } from "../utils.js";
import { store } from "../store.js";

export function renderTinaco() {
  const el = document.getElementById("view-tinaco");
  const items = Array.isArray(store.tinacos) ? store.tinacos : [];

  if (!items.length) {
    el.innerHTML = `
      <div class="card border-0 shadow-sm">
        <div class="card-body p-4 text-secondary">
          No hay registros en <b>Tinaco</b>. Genera datos en MockAPI.
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="h5 fw-semibold mb-1"><i class="bi bi-water"></i> Tinacos</div>
        <div class="text-secondary">Control y simulación de nivel por dispositivo.</div>
      </div>
      <div class="small text-secondary">Total: <b>${items.length}</b></div>
    </div>

    <div class="row g-3">
      ${items.map(cardTinaco).join("")}
    </div>
  `;

  el.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", onClickAction);
  });
}

function cardTinaco(t) {
  const id = t.id;
  const nombre = t.Nombre ?? "Tinaco";
  const nivel = clamp(t.NivelPorcentaje ?? 0, 0, 100);
  const umbral = clamp(t.UmbralBajo ?? 25, 0, 100);
  const llenando = toBool(t.Llenado ?? false);
  const low = nivel <= umbral;

  return `
    <div class="col-12 col-lg-6">
      <div class="card border-0 shadow-sm h-100">
        <div class="card-body p-4">

          <div class="d-flex justify-content-between align-items-start gap-2">
            <div>
              <div class="fw-semibold h5 mb-1">
                <span class="badge text-bg-dark me-2">#${escapeHtml(id)}</span>${escapeHtml(nombre)}
              </div>
              <div class="text-secondary small">Actualizado: ${escapeHtml(fmtDate(t.ActualizadoEn))}</div>
            </div>
            <div class="text-end">
              <span class="badge rounded-pill ${low ? "text-bg-warning" : "text-bg-success"}">
                ${low ? "Nivel bajo" : "OK"}
              </span>
              <div class="mt-2">
                <span class="badge rounded-pill ${llenando ? "text-bg-info" : "text-bg-secondary"}">
                  ${llenando ? "Llenando" : "Detenido"}
                </span>
              </div>
            </div>
          </div>

          <hr class="my-3">

          <div class="mb-2 small text-secondary">
            Nivel: <b>${nivel}%</b> (umbral: ${umbral}%)
          </div>
          <div class="gauge mb-3"><div style="width:${nivel}%"></div></div>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <button class="btn btn-light btn-sm" data-action="fillOn" data-id="${escapeHtml(id)}">
              <i class="bi bi-play-circle"></i> Llenar
            </button>
            <button class="btn btn-outline-light btn-sm" data-action="fillOff" data-id="${escapeHtml(id)}">
              <i class="bi bi-stop-circle"></i> Detener
            </button>
          </div>

          <div class="row g-2 align-items-end">
            <div class="col-6">
              <label class="form-label small text-secondary mb-1">Umbral bajo (%)</label>
              <input class="form-control form-control-sm" type="number" min="0" max="100"
                value="${umbral}" data-field="UmbralBajo" data-id="${escapeHtml(id)}">
            </div>
            <div class="col-6">
              <label class="form-label small text-secondary mb-1">Nivel actual (%)</label>
              <input class="form-control form-control-sm" type="number" min="0" max="100"
                value="${nivel}" data-field="NivelPorcentaje" data-id="${escapeHtml(id)}">
            </div>
            <div class="col-12">
              <button class="btn btn-outline-light btn-sm w-100" data-action="save" data-id="${escapeHtml(id)}">
                <i class="bi bi-save2"></i> Guardar cambios
              </button>
            </div>
          </div>

          <div class="mt-3 small text-secondary">
            *NivelPorcentaje = sensor, Llenado = bomba/válvula.
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

  const current = store.tinacos.find(x => String(x.id) === String(id));
  if (!current) return;

  try {
    if (action === "fillOn") {
      await patchTinaco(id, { Llenado: true });
      window.__toast?.(`Tinaco #${id}: Llenar ✅`);
    }

    if (action === "fillOff") {
      await patchTinaco(id, { Llenado: false });
      window.__toast?.(`Tinaco #${id}: Detener ✅`);
    }

    if (action === "save") {
      const umbralInput = document.querySelector(`input[data-id="${id}"][data-field="UmbralBajo"]`);
      const nivelInput = document.querySelector(`input[data-id="${id}"][data-field="NivelPorcentaje"]`);

      const UmbralBajo = clamp(umbralInput?.value ?? current.UmbralBajo ?? 25, 0, 100);
      const NivelPorcentaje = clamp(nivelInput?.value ?? current.NivelPorcentaje ?? 0, 0, 100);

      await patchTinaco(id, { UmbralBajo, NivelPorcentaje });
      window.__toast?.(`Tinaco #${id}: Guardado ✅`);
    }

    await window.__reload?.();
  } catch (err) {
    console.error(err);
    window.__toast?.("Error al actualizar Tinaco ❌");
  }
}

async function patchTinaco(id, partial) {
  const current = store.tinacos.find(x => String(x.id) === String(id));
  const payload = { ...current, ...partial, ActualizadoEn: nowIso() };
  return await updateById(ENDPOINTS.tinaco, id, payload);
}