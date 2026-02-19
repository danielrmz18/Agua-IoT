import { ENDPOINTS, updateById, deleteById } from "../api.js";
import { clamp, fmtDate, nowIso, toBool, escapeHtml } from "../utils.js";
import { store } from "../store.js";

export function renderTinaco() {
  const el = document.getElementById("view-tinaco");
  const items = Array.isArray(store.tinacos) ? store.tinacos : [];

  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="h5 fw-semibold mb-1"><i class="bi bi-water"></i> Tinacos</div>
        <div class="text-secondary">Control y simulación de nivel por dispositivo.</div>
      </div>
      <button class="btn btn-light btn-sm" id="btnAddTinaco">
        <i class="bi bi-plus-circle"></i> Agregar Tinaco
      </button>
    </div>

    <div class="row g-3">
      ${
        items.length
          ? items.map(cardTinaco).join("")
          : `<div class="col-12">
               <div class="card border-0 shadow-sm">
                 <div class="card-body p-4 text-secondary">
                   No hay registros en <b>Tinaco</b>. Agrega uno con el botón.
                 </div>
               </div>
             </div>`
      }
    </div>
  `;

  document.getElementById("btnAddTinaco").addEventListener("click", () => {
    window.__openCrud?.("tinaco", "create");
  });

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
            <button class="btn btn-outline-light btn-sm" data-action="fillOn" data-id="${escapeHtml(id)}">
              <i class="bi bi-play-circle"></i> Llenar
            </button>
            <button class="btn btn-outline-light btn-sm" data-action="fillOff" data-id="${escapeHtml(id)}">
              <i class="bi bi-stop-circle"></i> Detener
            </button>

            <div class="ms-auto d-flex gap-2">
              <button class="btn btn-light btn-sm" data-action="edit" data-id="${escapeHtml(id)}">
                <i class="bi bi-pencil-square"></i> Modificar
              </button>
              <button class="btn btn-outline-danger btn-sm" data-action="delete" data-id="${escapeHtml(id)}">
                <i class="bi bi-trash3"></i>
              </button>
            </div>
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
    if (action === "edit") {
      window.__openCrud?.("tinaco", "edit", current);
      return;
    }

    if (action === "delete") {
      const ok = confirm(`¿Eliminar Tinaco #${id}?`);
      if (!ok) return;
      await deleteById(ENDPOINTS.tinaco, id);
      window.__toast?.("Eliminado ✅");
      await window.__reload?.();
      return;
    }

    if (action === "fillOn") {
      await patchTinaco(id, { Llenado: true });
      window.__toast?.(`Tinaco #${id}: Llenar ✅`);
      window.__sim?.startTinacoFill(id);
      await window.__reload?.();
      return;
    }

    if (action === "fillOff") {
      await patchTinaco(id, { Llenado: false });
      window.__toast?.(`Tinaco #${id}: Detener ✅`);
      window.__sim?.stopTinacoFill(id);
      await window.__reload?.();
      return;
    }
  } catch (err) {
    console.error(err);
    window.__toast?.("Error en Tinaco ❌");
  }
}

async function patchTinaco(id, partial) {
  const current = store.tinacos.find(x => String(x.id) === String(id));
  const payload = { ...current, ...partial, ActualizadoEn: nowIso() };
  return await updateById(ENDPOINTS.tinaco, id, payload);
}