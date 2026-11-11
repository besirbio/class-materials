"use strict";

// The version this script was loaded as, taken from its own address
// (app.js?v=12 gives 12). Must be read here, while the script first runs.
const RUNNING_VERSION =
  +(/[?&]v=(\d+)/.exec(document.currentScript ? document.currentScript.src : "") || [])[1] || 0;

// Class Materials: shows the list in files.json as grades → topics → files.
// No accounts, no tracking, no outside services. The only thing saved on the
// device is the light/dark choice.

const view = document.getElementById("view");
const searchBox = document.getElementById("search");
const clearButton = document.getElementById("clear-search");
const themeButton = document.getElementById("theme-button");
const updatedLine = document.getElementById("updated");

let data = null;

/* ---------- Small helpers ---------- */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "text") node.textContent = value;
    else if (key === "className") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

const TYPE_NAMES = {
  pdf: "PDF", ppt: "PowerPoint", pptx: "PowerPoint", key: "Keynote",
  doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel",
  odp: "Slides", odt: "Document", jpg: "Image", jpeg: "Image", png: "Image",
  mp4: "Video", mp3: "Audio", zip: "ZIP",
};
const typeName = (t) => TYPE_NAMES[t] || (t ? t.toUpperCase() : "File");

function sizeText(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Lowercase and remove accents, so "café" matches "cafe".
const simplify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const gradeLink = (g) => "#/" + encodeURIComponent(g.name);
const topicLink = (g, t) => gradeLink(g) + "/" + encodeURIComponent(t.name);
const countFiles = (g) => g.topics.reduce((n, t) => n + t.files.length, 0);

function backLink(href, label) {
  return el("a", { className: "back", href, text: "← " + label });
}

function show(...nodes) {
  view.replaceChildren(...nodes.filter(Boolean));
  window.scrollTo(0, 0);
}

/* ---------- Rows ---------- */

function folderRow(href, title, meta) {
  return el("li", {}, [
    el("a", { className: "item", href }, [
      el("span", { className: "item-text" }, [
        el("span", { className: "item-title", text: title }),
        el("span", { className: "item-meta", text: meta }),
      ]),
      el("span", { className: "action action-soft", text: "Open →" }),
    ]),
  ]);
}

function fileRow(file, where) {
  const isPdf = file.type === "pdf";
  const props = { className: "item", href: file.url };
  if (isPdf) {
    props.target = "_blank";
    props.rel = "noopener";
  } else {
    props.download = file.name;
  }
  const meta = [where, typeName(file.type), sizeText(file.size)].filter(Boolean).join(" · ");
  return el("li", {}, [
    el("a", props, [
      el("span", { className: "item-text" }, [
        el("span", { className: "item-title", text: file.title }),
        el("span", { className: "item-meta", text: meta }),
      ]),
      el("span", { className: "action", text: isPdf ? "Open PDF" : "Download" }),
    ]),
  ]);
}

/* ---------- Pages ---------- */

function showGrades() {
  document.title = "Class Materials";
  const list = el("ul", { className: "list" });
  for (const g of data.grades) {
    const files = countFiles(g);
    list.append(folderRow(gradeLink(g), g.name,
      files ? `${plural(g.topics.length, "topic")} · ${plural(files, "file")}` : "Nothing here yet"));
  }
  show(el("h1", { text: "Choose your grade" }), list);
}

function showGrade(g) {
  document.title = g.name + " · Class Materials";
  const back = backLink("#/", "Back to all grades");
  if (!g.topics.length) {
    return show(back, el("h1", { text: g.name }), el("p", { className: "note", text: "Nothing here yet." }));
  }
  const list = el("ul", { className: "list" });
  for (const t of g.topics) {
    list.append(folderRow(topicLink(g, t), t.name, t.files.length ? plural(t.files.length, "file") : "No files yet"));
  }
  show(back, el("h1", { text: g.name }), el("p", { className: "note", text: "Choose a topic." }), list);
}

function showTopic(g, t) {
  document.title = t.name + " · " + g.name;
  const back = backLink(gradeLink(g), "Back to " + g.name);
  const heading = el("h1", { text: t.name });
  const sub = el("p", { className: "note", text: g.name });
  if (!t.files.length) {
    return show(back, heading, sub, el("p", { className: "note", text: "No files here yet." }));
  }
  const list = el("ul", { className: "list" });
  for (const f of t.files) list.append(fileRow(f));
  show(back, heading, sub, list);
}

function showNotFound() {
  show(backLink("#/", "Back to all grades"),
    el("h1", { text: "Page not found" }),
    el("p", { className: "note", text: "This grade or topic may have been renamed or removed." }));
}

function showSearch(query) {
  const words = simplify(query).split(/\s+/).filter(Boolean);
  const results = [];
  for (const g of data.grades) {
    for (const t of g.topics) {
      for (const f of t.files) {
        const hay = simplify(f.title + " " + f.name);
        if (words.every((w) => hay.includes(w))) results.push(fileRow(f, g.name + " › " + t.name));
      }
    }
  }
  const heading = el("h1", { text: results.length ? plural(results.length, "file") + " found" : "No files found" });
  if (!results.length) {
    return show(heading, el("p", { className: "note", text: "Check the spelling, or try a shorter word." }));
  }
  show(heading, el("ul", { className: "list" }, results));
}

/* ---------- Choosing what to show ---------- */

function render() {
  if (!data) return;
  const query = searchBox.value.trim();
  clearButton.hidden = !query;
  if (query) return showSearch(query);

  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map((p) => {
    try { return decodeURIComponent(p); } catch (e) { return p; }
  });
  if (!parts.length) return showGrades();
  const grade = data.grades.find((g) => g.name === parts[0]);
  if (!grade) return showNotFound();
  if (parts.length === 1) return showGrade(grade);
  const topic = grade.topics.find((t) => t.name === parts[1]);
  return topic ? showTopic(grade, topic) : showNotFound();
}

/* ---------- Loading the list ---------- */

async function load(quiet) {
  try {
    // Always ask for a fresh copy, never a saved one.
    const response = await fetch("files.json?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    data = await response.json();
    const when = new Date(data.updated);
    updatedLine.textContent = isNaN(when) ? "" :
      "List updated " + when.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    render();
  } catch (err) {
    if (quiet && data) return; // keep showing the list we already have
    const retry = el("button", { type: "button", className: "btn", text: "Try again" });
    retry.addEventListener("click", () => load(false));
    show(el("h1", { text: "Could not load the materials" }),
      el("p", { className: "note", text: "Check your internet connection, then try again." }),
      retry);
  }
}

/* ---------- Updating to a newer version of the site ---------- */

// Phones (especially iPhone home-screen apps) can keep showing an old saved
// copy of the page. Fetch the page fresh, read its version number, and reload
// once if it is newer than the one running.
async function checkForNewVersion() {
  if (!RUNNING_VERSION || !/^https?:/.test(location.protocol)) return;
  try {
    // "reload" goes to the network and also replaces the saved copy of the page.
    const page = await (await fetch(location.pathname, { cache: "reload" })).text();
    const latest = +(/app\.js\?v=(\d+)/.exec(page) || [])[1] || 0;
    let tried = null;
    try { tried = sessionStorage.getItem("site.tried"); } catch (e) {}
    if (latest > RUNNING_VERSION && tried !== String(latest)) {
      // One try per version, so a stubborn saved copy can never cause a loop.
      try { sessionStorage.setItem("site.tried", String(latest)); } catch (e) { return; }
      location.reload();
    }
  } catch (e) {
    // Offline: carry on with what is here.
  }
}

/* ---------- Light / dark ---------- */

function updateThemeButton() {
  const isLight = document.documentElement.dataset.theme === "light";
  themeButton.textContent = isLight ? "Dark mode" : "Light mode";
  document.querySelector('meta[name="theme-color"]').content = isLight ? "#f6f5f1" : "#14181f";
}

themeButton.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch (e) {}
  updateThemeButton();
});

/* ---------- Events ---------- */

searchBox.addEventListener("input", render);
clearButton.addEventListener("click", () => {
  searchBox.value = "";
  render();
  searchBox.focus();
});
window.addEventListener("hashchange", () => {
  searchBox.value = "";
  render();
});
// When a student comes back to the site (for example from the home screen),
// fetch the list again so new files show up.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    load(true);
    checkForNewVersion();
  }
});

updateThemeButton();
load(false);
checkForNewVersion();
