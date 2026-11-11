// Reads the "materials" folder and writes files.json for the website.
// Usage: node build-list.mjs <materials folder> <output file>
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

const root = process.argv[2] || "materials";
const out = process.argv[3] || "files.json";

// Grades always appear in this order. Any other folder is listed after them.
const GRADE_ORDER = [
  "7th grade", "8th grade", "9th grade",
  "1st year", "2nd year", "3rd year", "4th year",
];
const GENERAL_TOPIC = "General";

const byName = (a, b) =>
  a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });

// Hidden files (".keep") and README notes are placeholders, not materials.
const isIgnored = (name) =>
  name.startsWith(".") || name.toLowerCase() === "readme.md";

const toUrl = (parts) =>
  ["materials", ...parts].map(encodeURIComponent).join("/");

function fileEntry(dir, name, parts) {
  const ext = extname(name);
  const title = (ext ? name.slice(0, -ext.length) : name).replace(/_/g, " ").trim() || name;
  return {
    title,
    name,
    type: ext.replace(".", "").toLowerCase(),
    size: statSync(join(dir, name)).size,
    url: toUrl([...parts, name]),
  };
}

// Collect every file under dir. Files in sub-sub-folders are kept in their topic.
function collect(dir, parts, into) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (isIgnored(entry.name)) continue;
    if (entry.isDirectory()) collect(join(dir, entry.name), [...parts, entry.name], into);
    else if (entry.isFile()) into.push(fileEntry(dir, entry.name, parts));
  }
  return into;
}

const grades = [];
for (const g of readdirSync(root, { withFileTypes: true })) {
  if (!g.isDirectory() || isIgnored(g.name)) continue;
  const gradeDir = join(root, g.name);
  const topics = [];
  const loose = [];
  for (const t of readdirSync(gradeDir, { withFileTypes: true })) {
    if (isIgnored(t.name)) continue;
    if (t.isDirectory()) {
      topics.push({
        name: t.name,
        files: collect(join(gradeDir, t.name), [g.name, t.name], []).sort((a, b) =>
          a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" })),
      });
    } else if (t.isFile()) {
      loose.push(fileEntry(gradeDir, t.name, [g.name]));
    }
  }
  topics.sort(byName);
  if (loose.length) topics.push({ name: GENERAL_TOPIC, files: loose });
  grades.push({ name: g.name, topics });
}

grades.sort((a, b) => {
  const ia = GRADE_ORDER.indexOf(a.name), ib = GRADE_ORDER.indexOf(b.name);
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  return byName(a, b);
});

writeFileSync(out, JSON.stringify({ updated: new Date().toISOString(), grades }, null, 1));
const count = grades.reduce((n, g) => n + g.topics.reduce((m, t) => m + t.files.length, 0), 0);
console.log(`Wrote ${out}: ${grades.length} grades, ${count} files`);
