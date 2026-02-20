import { getAll, ENDPOINTS, createItem, updateById } from "./api.js";
import { store } from "./store.js";
import { currentView, showView } from "./router.js";
import { renderTinaco } from "./modules/tinaco.js";
import { renderTanque } from "./modules/tanque.js";
import { renderMonitor } from "./modules/monitor.js";
import { clamp, toBool, nowIso, escapeHtml } from "./utils.js";
import { addSnapshot } from "./history.js";

// ===== DOM =====
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
  if (view === "monitor") renderMonitor();
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

    // ✅ Guardar historial local (últimos 10)
    addSnapshot(store.tinacos, store.tanques);

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

// ===== Refresh 2s SOLO en monitor =====
let monitorTimer = null;

function setMonitorTimer() {
  const view = currentView();
  if (view === "monitor") {
    if (!monitorTimer) {
      monitorTimer = setInterval(() => {
        window.__reload();
      }, 2000);
    }
  } else {
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = null;
    }
  }
}

window.addEventListener("hashchange", () => {
  setMonitorTimer();
  renderCurrent();
});

if (!location.hash) location.hash = "#tinaco";
setMonitorTimer();
window.__reload();

// ===== Modal builder =====
function makeCol(html) {
  const col = document.createElement("div");
  col.className = "col-12 col-md-6";
  col.innerHTML = html;
  return col;
}

function openCrudModal(resourceKey, mode, item = null) {
  crudResource.value = resourceKey; // tinaco | tanque
  crudId.value = item?.id ?? "";

  const isCreate = mode === "create";
  crudTitle.textContent = isCreate
    ? (resourceKey === "tinaco" ? "Agregar Tinaco" : "Agregar Tanque WC")
    : `Modificar #${item?.id}`;

  crudFields.innerHTML = "";
  const fields = resourceKey === "tinaco"
    ? getTinacoFields(item)
    : getTanqueFields(item);

  for (const f of fields) crudFields.appendChild(f);

  crudModal.show();
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
      <label class="form-label">Llenado (bomba)</label>
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

// ===== Submit modal =====
crudForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const resourceKey = crudResource.value;
  const id = crudId.value;
  const isCreate = !id;

  try {
    const payload = resourceKey === "tinaco" ? payloadTinacoFromForm() : payloadTanqueFromForm();

    if (resourceKey === "tinaco") payload.ActualizadoEn = nowIso();
    if (resourceKey === "tanque") payload.actualizadoEn = nowIso();

    const url = resourceKey === "tinaco" ? ENDPOINTS.tinaco : ENDPOINTS.tanque;

    if (isCreate) {
      await createItem(url, payload);
      window.__toast("Creado ✅");
    } else {
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

// ===== Simulación (lo que ya tenías) =====
const sim = { tinaco: new Map(), tanque: new Map() };

function stopInterval(map, id) {
  const t = map.get(String(id));
  if (t) clearInterval(t);
  map.delete(String(id));
}
function startInterval(map, id, fn, ms = 900) {
  stopInterval(map, id);
  const t = setInterval(fn, ms);
  map.set(String(id), t);
}

window.__sim = {
  startTinacoFill: (id) => {
    startInterval(sim.tinaco, id, async () => {
      const cur = store.tinacos.find(x => String(x.id) === String(id));
      if (!cur) return stopInterval(sim.tinaco, id);
      if (!cur.Llenado) return stopInterval(sim.tinaco, id);

      let nivel = clamp(cur.NivelPorcentaje ?? 0, 0, 100);
      nivel = clamp(nivel + 2, 0, 100);

      const payload = { ...cur, NivelPorcentaje: nivel, ActualizadoEn: nowIso() };
      if (nivel >= 100) payload.Llenado = false;

      try {
        await updateById(ENDPOINTS.tinaco, id, payload);
        cur.NivelPorcentaje = payload.NivelPorcentaje;
        cur.ActualizadoEn = payload.ActualizadoEn;
        cur.Llenado = payload.Llenado;

        renderCurrent();
        countAlerts();

        if (payload.Llenado === false) stopInterval(sim.tinaco, id);
      } catch (e) {
        console.error(e);
        stopInterval(sim.tinaco, id);
      }
    }, 900);
  },
  stopTinacoFill: (id) => stopInterval(sim.tinaco, id),

  startTanqueFill: (id) => {
    startInterval(sim.tanque, id, async () => {
      const cur = store.tanques.find(x => String(x.id) === String(id));
      if (!cur) return stopInterval(sim.tanque, id);
      if (!cur.descargaBloqueada) return stopInterval(sim.tanque, id);

      const field = ("nivelTanquePorcentaj" in cur) ? "nivelTanquePorcentaj" : "nivelTanquePorcentaje";
      let nivel = clamp(cur[field] ?? 0, 0, 100);
      nivel = clamp(nivel + 3, 0, 100);

      const payload = { ...cur, [field]: nivel, actualizadoEn: nowIso() };

      try {
        await updateById(ENDPOINTS.tanque, id, payload);
        cur[field] = payload[field];
        cur.actualizadoEn = payload.actualizadoEn;

        renderCurrent();
        countAlerts();

        if (nivel >= 100) stopInterval(sim.tanque, id);
      } catch (e) {
        console.error(e);
        stopInterval(sim.tanque, id);
      }
    }, 900);
  },
  stopTanqueFill: (id) => stopInterval(sim.tanque, id),
  // Deteccion de fuga baja el nivel de la barra
  startTanqueLeak: (id) => {
  startInterval(sim.tanque, `leak-${id}`, async () => {
    const cur = store.tanques.find(x => String(x.id) === String(id));
    if (!cur) return stopInterval(sim.tanque, `leak-${id}`);
    if (!cur.fugaDetectada) return stopInterval(sim.tanque, `leak-${id}`);

    const field = ("nivelTanquePorcentaj" in cur) ? "nivelTanquePorcentaj" : "nivelTanquePorcentaje";
    let nivel = clamp(cur[field] ?? 0, 0, 100);

    // baja por fuga (ajusta 1,2,3 a tu gusto)
    nivel = clamp(nivel - 2, 0, 100);

    const payload = { ...cur, [field]: nivel, actualizadoEn: nowIso() };

    try {
      await updateById(ENDPOINTS.tanque, id, payload);
      cur[field] = payload[field];
      cur.actualizadoEn = payload.actualizadoEn;

      renderCurrent();
      countAlerts();

      if (nivel <= 0) stopInterval(sim.tanque, `leak-${id}`);
    } catch (e) {
      console.error(e);
      stopInterval(sim.tanque, `leak-${id}`);
    }
  }, 900);
},

stopTanqueLeak: (id) => stopInterval(sim.tanque, `leak-${id}`),
};