import { ENDPOINTS } from "./config.js";

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} - ${text || res.statusText}`);
  }

  return await res.json().catch(() => null);
}

export async function getAll(resourceUrl) {
  const data = await apiRequest(resourceUrl, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

export async function updateById(resourceUrl, id, payload) {
  return await apiRequest(`${resourceUrl}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export { ENDPOINTS };