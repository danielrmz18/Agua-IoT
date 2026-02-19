import { getAll, ENDPOINTS, createItem, updateById } from "./api.js";
import { store } from "./store.js";
import { currentView, showView } from "./router.js";
import { renderTinaco } from "./modules/tinaco.js";
import { renderTanque } from "./modules/tanque.js";
import { clamp, toBool, nowIso } from "./utils.js";

// ===== DOM Stats =====
const statApi = document.getElementById("statApi");
const statLast = document.getElementById("statLast");
const statAlerts = document.getElementById("statAlerts");
const btnReload = document.getElementById("btnReload");

document.getElementById("year").textContent = String(new Date().getFullYear());

// ===== Toast =====
const toastEl = document.getElementById("appToast");
const toastMsg = document.getElementById("toastMsg");
const toast = new bootstrap.Toast(toastEl, { delay: 2400 });
window.__toast = (msg) => { toastMsg.textContent = msg; toast.show(); };

// ===== Modal CRUD =====
const crudModalEl = document.getElementById("crudModal");
const crudModal = new bootstrap.Modal(crudModalEl);
const crudForm = document.getElementById("crudForm");
const crudFields = document.getElementById("crudFields");
const crudTitle = document.getElementById("crudModalTitle");
const crudResource = document.getElementById("crudResource");
const crudId = document.getElementById("crudId");

// Exponer helpers globales para módulos
window.__openCrud = openCrudModal;
window.__closeCrud = () => crudModal.hide();

function setApiBadge(text, type="secondary") {
  statApi.innerHTML = `<span class="badge rounded-pill text-bg-${type}">${text}</span>`;
}

function countAlerts() {
  let c = 0;

  for (const t of store.tinacos) {
    const nivel = clamp(t.NivelPorcentaje ?? 0, 0, 100);
    const umbral = clamp(t.UmbralBajo ?? 25, 0, 100);
    if (nivel <= umbral) c++;
  }

  for (const b of store.tanques) {
    if (toBool(b.fugaDetectada ?? false)) c++;
  }

  statAlerts.textContent = String(c);
}

function renderCurrent() {
  const view = currentView();
  showView(view);
  if (view === "tinaco") renderTinaco();
  if (view === "tanque") renderTanque();
}

// ===== Reload =====
window.__reload = async function reload() {
  setApiBadge("Cargando...", "info");

  try {
    const [tinacos, tanques] = await Promise.all([
      getAll(ENDPOINTS.tinaco),
      getAll(ENDPOINTS.tanque),
    ]);

    store.tinacos = tinacos;
    store.tanques = tanques;
    store.lastLoad = new Date();

    statLast.textContent = store.lastLoad.toLocaleTimeString();
    setApiBadge("OK", "success");

    countAlerts();
    renderCurrent();
  } catch (e) {
    console.error(e);
    setApiBadge("Error", "danger");
    window.__toast("Error al leer la API ❌");
  }
};

btnReload.addEventListener("click", window.__reload);
window.addEventListener("hashchange", renderCurrent);

if (!location.hash) location.hash = "#tinaco";
window.__reload();

// ===== Modal builder =====
function openCrudModal(resourceKey, mode, item = null) {
  // resourceKey: "tinaco" | "tanque"
  crudResource.value = resourceKey;
  crudId.value = item?.id ?? "";

  const isCreate = mode === "create";
  crudTitle.textContent = isCreate
    ? (resourceKey === "tinaco" ? "Agregar Tinaco" : "Agregar Tanque WC")
    : `Modificar #${item?.id}`;

  // Construir campos según recurso
  crudFields.innerHTML = "";
  const fields = resourceKey === "tinaco"
    ? getTinacoFields(item)
    : getTanqueFields(item);

  for (const f of fields) {
    crudFields.appendChild(f);
  }

  crudModal.show();
}

// ===== Submit modal =====
crudForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const resourceKey = crudResource.value; // tinaco | tanque
  const id = crudId.value;
  const isCreate = !id;

  try {
    const payload = resourceKey === "tinaco"
      ? payloadTinacoFromForm()
      : payloadTanqueFromForm();

    // timestamps
    if (resourceKey === "tinaco") payload.ActualizadoEn = nowIso();
    if (resourceKey === "tanque") payload.actualizadoEn = nowIso();

    const url = resourceKey === "tinaco" ? ENDPOINTS.tinaco : ENDPOINTS.tanque;

    if (isCreate) {
      await createItem(url, payload);
      window.__toast("Creado ✅");
    } else {
      // Mantener otros campos del registro actual
      const current = (resourceKey === "tinaco" ? store.tinacos : store.tanques)
        .find(x => String(x.id) === String(id));

      await updateById(url, id, { ...current, ...payload });
      window.__toast("Actualizado ✅");
    }

    crudModal.hide();
    await window.__reload();
  } catch (err) {
    console.error(err);
    window.__toast(err.message || "Error al guardar ❌");
  }
});

// ===== Field templates =====
function makeCol(html) {
  const col = document.createElement("div");
  col.className = "col-12 col-md-6";
  col.innerHTML = html;
  return col;
}

function getTinacoFields(item) {
  const Nombre = item?.Nombre ?? "";
  const NivelPorcentaje = item?.NivelPorcentaje ?? 50;
  const UmbralBajo = item?.UmbralBajo ?? 25;
  const Llenado = Boolean(item?.Llenado ?? false);

  return [
    makeCol(`
      <label class="form-label">Nombre</label>
      <input class="form-control" id="fNombre" value="${escapeHtml(Nombre)}" required>
    `),
    makeCol(`
      <label class="form-label">NivelPorcentaje (0-100)</label>
      <input class="form-control" id="fNivel" type="number" min="0" max="100" value="${Number(NivelPorcentaje)}" required>
    `),
    makeCol(`
      <label class="form-label">UmbralBajo (0-100)</label>
      <input class="form-control" id="fUmbral" type="number" min="0" max="100" value="${Number(UmbralBajo)}" required>
    `),
    makeCol(`
      <label class="form-label">Llenado</label>
      <div class="form-check form-switch mt-2">
        <input class="form-check-input" id="fLlenado" type="checkbox" ${Llenado ? "checked" : ""}>
        <label class="form-check-label" for="fLlenado">Encendido</label>
      </div>
    `),
  ];
}

function getTanqueFields(item) {
  const name = item?.name ?? "";
  const nivel = item?.nivelTanquePorcentaj ?? item?.nivelTanquePorcentaje ?? 50;
  const descargaBloqueada = Boolean(item?.descargaBloqueada ?? false);
  const fugaDetectada = Boolean(item?.fugaDetectada ?? false);

  return [
    makeCol(`
      <label class="form-label">Nombre</label>
      <input class="form-control" id="fName" value="${escapeHtml(name)}" required>
    `),
    makeCol(`
      <label class="form-label">nivelTanquePorcentaj (0-100)</label>
      <input class="form-control" id="fNivelTanque" type="number" min="0" max="100" value="${Number(nivel)}" required>
    `),
    makeCol(`
      <label class="form-label">Descarga bloqueada</label>
      <div class="form-check form-switch mt-2">
        <input class="form-check-input" id="fBloqueada" type="checkbox" ${descargaBloqueada ? "checked" : ""}>
        <label class="form-check-label" for="fBloqueada">Bloquear</label>
      </div>
    `),
    makeCol(`
      <label class="form-label">Fuga detectada</label>
      <div class="form-check form-switch mt-2">
        <input class="form-check-input" id="fFuga" type="checkbox" ${fugaDetectada ? "checked" : ""}>
        <label class="form-check-label" for="fFuga">Marcar fuga</label>
      </div>
    `),
  ];
}

// ===== Payload from form =====
function payloadTinacoFromForm() {
  const Nombre = document.getElementById("fNombre").value.trim();
  const NivelPorcentaje = clamp(document.getElementById("fNivel").value, 0, 100);
  const UmbralBajo = clamp(document.getElementById("fUmbral").value, 0, 100);
  const Llenado = document.getElementById("fLlenado").checked;

  return { Nombre, NivelPorcentaje, UmbralBajo, Llenado };
}

function payloadTanqueFromForm() {
  const name = document.getElementById("fName").value.trim();
  const nivelTanquePorcentaj = clamp(document.getElementById("fNivelTanque").value, 0, 100);
  const descargaBloqueada = document.getElementById("fBloqueada").checked;
  const fugaDetectada = document.getElementById("fFuga").checked;

  return { name, nivelTanquePorcentaj, descargaBloqueada, fugaDetectada };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}