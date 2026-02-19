import { getAll, ENDPOINTS } from "./api.js";
import { store } from "./store.js";
import { currentView, showView } from "./router.js";
import { renderTinaco } from "./modules/tinaco.js";
import { renderTanque } from "./modules/tanque.js";
import { clamp, toBool } from "./utils.js";

const statApi = document.getElementById("statApi");
const statLast = document.getElementById("statLast");
const statAlerts = document.getElementById("statAlerts");
const btnReload = document.getElementById("btnReload");

document.getElementById("year").textContent = String(new Date().getFullYear());

// Toast
const toastEl = document.getElementById("appToast");
const toastMsg = document.getElementById("toastMsg");
const toast = new bootstrap.Toast(toastEl, { delay: 2400 });
window.__toast = (msg) => { toastMsg.textContent = msg; toast.show(); };

function setApiBadge(text, type="secondary") {
  statApi.innerHTML = `<span class="badge rounded-pill text-bg-${type}">${text}</span>`;
}

function countAlerts() {
  let c = 0;

  // Tinacos: nivel <= umbral
  for (const t of store.tinacos) {
    const nivel = clamp(t.NivelPorcentaje ?? 0, 0, 100);
    const umbral = clamp(t.UmbralBajo ?? 25, 0, 100);
    if (nivel <= umbral) c++;
  }

  // Tanques: fugaDetectada
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