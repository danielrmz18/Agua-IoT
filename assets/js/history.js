import { clamp, toBool } from "./utils.js";

const KEY = "agua_iot_history_v1";
const MAX = 10;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { tinaco: {}, tanque: {} };
  } catch {
    return { tinaco: {}, tanque: {} };
  }
}

function save(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

function pushArr(mapObj, id, entry) {
  const k = String(id);
  if (!mapObj[k]) mapObj[k] = [];
  mapObj[k].unshift(entry);
  mapObj[k] = mapObj[k].slice(0, MAX);
}

export function addSnapshot(tinacos, tanques) {
  const h = load();
  const ts = new Date().toISOString();

  // Tinaco snapshot
  for (const t of tinacos) {
    pushArr(h.tinaco, t.id, {
      ts,
      nivel: clamp(t.NivelPorcentaje ?? 0, 0, 100),
      llenado: toBool(t.Llenado ?? false) ? 1 : 0,
      umbral: clamp(t.UmbralBajo ?? 25, 0, 100),
    });
  }

  // Tanque snapshot
  for (const b of tanques) {
    const field = ("nivelTanquePorcentaj" in b) ? "nivelTanquePorcentaj" : "nivelTanquePorcentaje";
    pushArr(h.tanque, b.id, {
      ts,
      nivel: clamp(b[field] ?? 0, 0, 100),
      bloqueada: toBool(b.descargaBloqueada ?? false) ? 1 : 0,
      fuga: toBool(b.fugaDetectada ?? false) ? 1 : 0,
    });
  }

  save(h);
}

export function getHistory() {
  return load();
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}