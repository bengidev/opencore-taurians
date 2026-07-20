(function () {
  var THEME_STORAGE_KEY = "opencore-theme";
  var DEFAULT_THEME_MODE = "light";
  var stored = localStorage.getItem(THEME_STORAGE_KEY);
  var mode =
    stored === "light" || stored === "dark" ? stored : DEFAULT_THEME_MODE;
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
})();
