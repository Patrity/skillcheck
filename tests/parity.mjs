/**
 * Parity harness: does the TypeScript port agree with the Python engine that
 * produced our four upstream PRs?
 *
 * Compared per (file, rule, severity) - NOT message text. Reason: the YAML
 * libraries genuinely differ on error column numbering (js-yaml counts the
 * unquoted-colon position differently from PyYAML), and pretending otherwise
 * would force us to paper over a real difference to make a test go green.
 * Usage: node --experimental-strip-types tests/parity.mjs [corpusDir]
 */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { checkSkillMd, subsetYaml } from "../core.ts";
import { load } from "js-yaml";

const root = process.argv[2] || "/tmp/own/skills";
const PY = "/srv/pi/work/build/skillcheck/skillcheck.py";

function findSkillFiles(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if ([".git", "node_modules", "__pycache__"].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) findSkillFiles(p, acc);
    else if (e.toLowerCase() === "skill.md") acc.push(p);
  }
  return acc.sort();
}
const norm = (f) => `${f.severity}/${f.rule}`;

// ---- Python side, one file at a time (keeps targets aligned with TS) -------
const pyFindings = new Map();
for (const f of findSkillFiles(root)) {
  let out = "";
  try { out = execFileSync("python3", [PY, "--json", f], { encoding: "utf8" }); }
  catch (e) { out = e.stdout?.toString() ?? ""; }
  // CLI --json emits [{path, findings:[...]}] - unwrap it. (My first version read
  // the array itself as the findings, so every row came back undefined/undefined and
  // a PERFECT port looked like an 18-file mismatch. A parity harness that cannot
  // prove itself wrong is not a test.)
  let parsed = [];
  try { parsed = JSON.parse(out); } catch { /* empty */ }
  const rows = Array.isArray(parsed) ? (parsed[0]?.findings ?? []) : (parsed?.findings ?? []);
  pyFindings.set(relative(root, f), (rows ?? []).map(norm).sort());
}

// ---- TypeScript side -------------------------------------------------------
const tsFindings = new Map();
for (const f of findSkillFiles(root)) {
  const txt = readFileSync(f, "utf8");
  const d = dirname(f);
  const res = checkSkillMd(txt, { parseYaml: load, dirname: basename(d), parentDir: basename(dirname(d)) });
  tsFindings.set(relative(root, f), res.map(norm).sort());
}

// ---- diff ------------------------------------------------------------------
let diffs = 0, files = 0, pyTotal = 0, tsTotal = 0;
for (const k of [...new Set([...pyFindings.keys(), ...tsFindings.keys()])].sort()) {
  files++;
  const a = pyFindings.get(k) ?? [], b = tsFindings.get(k) ?? [];
  pyTotal += a.length; tsTotal += b.length;
  const missing = a.filter(x => !b.includes(x)), extra = b.filter(x => !a.includes(x));
  if (missing.length || extra.length) {
    diffs++;
    console.log(`DIFF ${k}\n  python-only: ${missing.join(", ") || "-"}\n  ts-only:     ${extra.join(", ") || "-"}`);
  }
}
console.log(`\nparity: ${files} files, python=${pyTotal} findings, ts=${tsTotal} findings, ${diffs} file(s) differ`);
// Also prove the faithful-port test with the dependency-free loader
const bad = "---\nname: x-skill\ndescription: Handles things: breaks YAML\n---\nbody\n";
for (const [label, loader] of [["js-yaml", load], ["subset-loader", subsetYaml]]) {
  const got = checkSkillMd(bad, { parseYaml: loader }).map(norm);
  const ok = got.includes("FAIL/yaml");
  console.log(`loader ${label}: detects unquoted-colon defect = ${ok}`);
  if (!ok) diffs++;
}
process.exit(diffs ? 1 : 0);
