// CIRCUITS site: point the download keys at the latest release's files, and mark the visitor's platform.
(() => {
  const REPO = "blackmetaltech/circuits";
  const ua = navigator.userAgent;
  const os = /Windows/i.test(ua) ? "windows" : /Linux|X11/i.test(ua) && !/Android/i.test(ua) ? "linux" : "";
  const $ = (id) => document.getElementById(id);
  if (os) $("dl-" + os)?.classList.add("mine");
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((rel) => {
      const find = (re) => (rel.assets || []).find((a) => re.test(a.name));
      const mb = (a) => `${Math.max(1, Math.round(a.size / 1e6))} MB`;
      const linux = find(/linux.*\.zip$/i), win = find(/windows.*\.zip$/i);
      if (linux) { $("dl-linux").href = linux.browser_download_url; $("dl-linux").querySelector("span").textContent = `x86_64 · zip · ${mb(linux)}`; }
      if (win) { $("dl-windows").href = win.browser_download_url; $("dl-windows").querySelector("span").textContent = `x64 · zip · ${mb(win)}`; }
      $("dl-ver").textContent = `Latest: ${rel.tag_name}.`;
      $("dl-main-label").textContent = `Download ${rel.tag_name}`;
      const mine = os === "windows" ? win : os === "linux" ? linux : null;
      if (mine) { $("dl-main").href = mine.browser_download_url; $("dl-main-sub").textContent = `${os === "windows" ? "Windows" : "Linux"} · free`; }
    })
    .catch(() => {});
})();
