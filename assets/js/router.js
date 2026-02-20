export function currentView() {
  const h = (location.hash || "#tinaco").replace("#", "").trim();
  return ["tinaco", "tanque", "monitor"].includes(h) ? h : "tinaco";
}

export function showView(name) {
  document.getElementById("view-tinaco").classList.toggle("d-none", name !== "tinaco");
  document.getElementById("view-tanque").classList.toggle("d-none", name !== "tanque");
  document.getElementById("view-monitor").classList.toggle("d-none", name !== "monitor");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    const active = btn.dataset.nav === name;
    btn.classList.toggle("btn-light", active);
    btn.classList.toggle("btn-outline-light", !active);
  });
}