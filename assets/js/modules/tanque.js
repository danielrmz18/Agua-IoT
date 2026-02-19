import { ENDPOINTS, updateById, deleteById } from "../api.js";
import { clamp, fmtDate, nowIso, toBool, escapeHtml } from "../utils.js";
import { store } from "../store.js";

export function renderTanque() {
  const el = document.getElementById("view-tanque");
  const items = Array.isArray(store.tanques) ? store.tanques : [];

  el.innerHTML = `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="h5 fw-semibold mb-1"><i class="bi bi-toilet"></i> Tanques WC</div>
        <div class="text-secondary">Bloqueo de descarga y detección de fuga.</div>
      </div>
      <button class="btn btn-light btn-sm" id="btnAddTanque">
        <i class="bi bi-plus-circle"></i> Agregar Tanque
      </button>
    </div>

    <div class="row g-3">
      ${
        items.length
          ? items.map(cardTanque).join("")
          : `<div class="col-12">
               <div class="card border-0 shadow-sm">
                 <div class="card-body p-4 text-secondary">
                   No hay registros en <b>Tanque</b>. Agrega uno con el botón.
                 </div>
               </div>
             </div>`
      }
    </div>
  `;

  document.getElementById("btnAddTanque").addEventListener("click", () => {
    window.__openCrud?.("tanque", "create");
  });

  el.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", onClickAction);
  });
}

function cardTanque(b) {
  const id = b.id;
  const nombre = b.name ?? "Tanque WC";
  const field = ("nivelTanquePorcentaj" in b) ? "nivelTanquePorcentaj" : "nivelTanquePorcentaje";
  const nivel = clamp(b[field] ?? 0, 0, 100);

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
            <button class="btn btn-outline-light btn-sm" data-action="unlock" data-id="${escapeHtml(id)}">
              <i class="bi bi-unlock"></i> Desbloquear
            </button>
            <button class="btn btn-outline-danger btn-sm" data-action="leakOn" data-id="${escapeHtml(id)}">
              <i class="bi bi-exclamation-triangle"></i> Fuga
            </button>
            <button class="btn btn-outline-secondary btn-sm" data-action="leakOff" data-id="${escapeHtml(id)}">
              <i class="bi bi-check2-circle"></i> OK
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

  const current = store.tanques.find(x => String(x.id) === String(id));
  if (!current) return;

  try {
    if (action === "edit") {
      window.__openCrud?.("tanque", "edit", current);
      return;
    }

    if (action === "delete") {
      const ok = confirm(`¿Eliminar Tanque #${id}?`);
      if (!ok) return;
      await deleteById(ENDPOINTS.tanque, id);
      window.__toast?.("Eliminado ✅");
      await window.__reload?.();
      return;
    }

    if (action === "lock") {
      await patchTanque(id, { descargaBloqueada: true });
      window.__sim?.startTanqueFill(id);
      window.__toast?.("Bloqueada: llenando tanque ✅");
      await window.__reload?.();
      return;
    }

    if (action === "unlock") {
      const field = ("nivelTanquePorcentaj" in current) ? "nivelTanquePorcentaj" : "nivelTanquePorcentaje";
      await patchTanque(id, { descargaBloqueada: false, [field]: 0 });
      window.__sim?.stopTanqueFill(id);
      window.__toast?.("Desbloqueada: tanque vacío ✅");
      await window.__reload?.();
      return;
    }

    if (action === "leakOn") {
      await patchTanque(id, { fugaDetectada: true });
      window.__toast?.("Fuga activada ⚠️");
      await window.__reload?.();
      return;
    }

    if (action === "leakOff") {
      await patchTanque(id, { fugaDetectada: false });
      window.__toast?.("Fuga desactivada ✅");
      await window.__reload?.();
      return;
    }

  } catch (err) {
    console.error(err);
    window.__toast?.("Error en Tanque ❌");
  }
}

async function patchTanque(id, partial) {
  const current = store.tanques.find(x => String(x.id) === String(id));
  const payload = { ...current, ...partial, actualizadoEn: nowIso() };
  return await updateById(ENDPOINTS.tanque, id, payload);
}