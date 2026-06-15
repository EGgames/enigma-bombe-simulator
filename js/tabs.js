/*
 * Navegación entre capas (Enigma / Bombe).
 */

(function () {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const views = Array.from(document.querySelectorAll(".view"));

  function showView(viewId) {
    for (const view of views) {
      view.classList.toggle("active", view.id === viewId);
    }
    for (const btn of buttons) {
      btn.classList.toggle("active", btn.dataset.view === viewId);
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  showView("enigma-view");

  window.AppTabs = { showView };
})();
