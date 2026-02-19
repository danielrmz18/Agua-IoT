export function currentView() {
  const h = (location.hash || "#tinaco").replace("#", "").trim();
  return ["tinaco", "tanque"].includes(h) ? h : "tinaco";
}

export function showView(name) {
  document.getElementById("view-tinaco").classList.toggle("d-none", name !== "tinaco");
  document.getElementById("view-tanque").classList.toggle("d-none", name !== "tanque");

  document.querySelectorAll("[data-nav]").forEach(btn => {
    const active = btn.dataset.nav === name;
    btn.classList.toggle("btn-light", active);
    btn.classList.toggle("btn-outline-light", !active);
  });
}