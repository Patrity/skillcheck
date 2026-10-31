/**
 * skillcheck core - TypeScript port of build/checker/core.py
 *
 * Same rules, same rule ids, same severity words, same messages as the Python
 * engine that produced the four upstream PRs, so that the deployed demo and the
 * CLI cannot disagree. Parity is enforced by tests/check-against-python.sh: any
 * divergence in findings between the two engines is a bug in this file, not a
 * feature of the web version.
 *
 * Deliberate design notes:
 *  - YAML parsing is injected (`parseYaml`) instead of hard-imported. Reason: the
 *    demo uses js-yaml, and the Node core (node:yaml) ships no parser; a tool
 *    whose verdict depends on which YAML library happened to be installed is a
 *    tool that tells two users different things about the same file.
 *  - Unicode normalization is the tiny subset the rule actually needs (see
 *    normalizeName) rather than a dependency on Intl for one check.
 */

export type Severity = "FAIL" | "WARN" | "INFO";
export interface Finding { severity: Severity; rule: string; message: string; target?: string }

export const MAX_NAME = 64;
export const MAX_DESC = 1024;
export const MAX_COMPAT = 500;
export const ALLOWED_FIELDS = ["name", "description", "license", "allowed-tools", "metadata", "compatibility"];
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Spec's `name` is meant to be ASCII slug; NFKC-fold the few forms that bite in practice. */
export function normalizeName(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ").trim();
}

/** Split `---` fenced frontmatter. Mirrors the Python regex, incl. CRLF + BOM tolerance. */
export function splitFrontmatter(text: string): { fm: string | null; body: string; error?: string } {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const m = /^-{3,}[ \t]*\r?\n([\s\S]*?)\r?\n-{3,}[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { fm: null, body: text, error: "no YAML frontmatter block (`---` ... `---`) at top of file" };
  return { fm: m[1], body: text.slice(m[0].length) };
}

export type YamlLoader = (src: string) => unknown;

/**
 * Minimal YAML subset loader used ONLY to prove the port is faithful in tests:
 * it parses the same flat `key: value` / block-scalar subset that the Python
 * engine's salvage path understands, and it throws on an unquoted colon in a
 * value the same way a strict loader does. Not a general YAML implementation and
 * not used by the demo (the demo injects js-yaml, the same strictness family the
 * upstream PRs were validated against).
 */
export function subsetYaml(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(line);
    if (!m) throw Object.assign(new Error(`cannot parse: ${line}`), { mark: { line: i, column: 0 } });
    let v = m[2];
    if (v === "" ) { continue; }
    if (/^[->|]/.test(v)) {                       // block scalar: gather indented children
      const buf: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) { buf.push(lines[++i].trim()); }
      out[m[1]] = buf.join(" ");
      continue;
    }
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      out[m[1]] = v.slice(1, -1); continue;
    }
    // A plain scalar may not contain ": " - this is the exact rule that broke the
    // upstream skill files, so the subset loader reproduces it rather than hiding it.
    if (/:[ \t]/.test(v)) throw Object.assign(new Error(`mapping values are not allowed here: ${v}`),
                                             { mark: { line: i, column: m[1].length + 2 } });
    out[m[1]] = v;
  }
  return out;
}

/**
 * Check one SKILL.md. `dirname` is the directory name the skill lives in (may be ""
 * when unknown, e.g. a single uploaded file); `parentDir` is the parent's basename,
 * used only to avoid blaming a clone/zip directory for a name mismatch.
 */
export function checkSkillMd(raw: string, opts: {
  parseYaml: YamlLoader; dirname?: string; parentDir?: string;
}): Finding[] {
  const out: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string) => out.push({ severity, rule, message });
  const dirname = opts.dirname ?? "";

  const { fm, body, error } = splitFrontmatter(raw);
  if (error) return [{ severity: "FAIL", rule: "frontmatter", message: error }];

  let data: Record<string, unknown> | null = null;
  try {
    data = opts.parseYaml(fm!) as Record<string, unknown>;
  } catch (e: any) {
    const mark = e?.mark;
    const pos = mark ? ` (line ${mark.line + 1}, column ${mark.column + 1})` : "";
    add("FAIL", "yaml", `frontmatter is not valid YAML${pos}: ${e?.problem ?? e?.message ?? e}`);
    data = {};                                   // salvage: still report field-level problems
    for (const line of fm!.split(/\r?\n/)) {
      const m2 = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (m2) data[m2[1]] = m2[2].trim();
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    add("FAIL", "yaml", `frontmatter must be a mapping, got ${Array.isArray(data) ? "array" : typeof data}`);
    return out;
  }

  for (const k of Object.keys(data).filter(k => !ALLOWED_FIELDS.includes(k)).sort())
    add("FAIL", "unknown-field", `frontmatter key '${k}' is not in the spec's allowed set`);

  const name = data["name"], desc = data["description"];

  if (typeof name !== "string" || !name.trim()) {
    add("FAIL", "name", "`name` is required and must be a non-empty string");
  } else {
    const n = normalizeName(name.trim());
    if (n.length > MAX_NAME) add("FAIL", "name", `\`name\` is ${n.length} chars, limit ${MAX_NAME}`);
    if (!NAME_RE.test(n)) add("FAIL", "name",
      `\`name\` '${n.slice(0, 70)}' is not lowercase alphanumeric/hyphen, no leading/trailing/double hyphen`);
    if (dirname && dirname !== "." && n !== dirname) {
      const base = (opts.parentDir ?? "").toLowerCase();
      if (["skills", "plugins", "skills-main", "out"].includes(base))
        add("WARN", "dir-name-match",
          `\`name\` '${n}' != directory '${dirname}' (spec implies they match; official validators disagree)`);
      else
        add("INFO", "dir-name-context",
          `\`name\` '${n}' != directory '${dirname}' - the parent looks like a download/clone dir, so this is not counted as a mismatch`);
    }
  }

  if (typeof desc !== "string" || !desc.trim()) {
    add("FAIL", "description", "`description` is required and must be a non-empty string");
  } else {
    const d = desc.trim();
    if (d.length > MAX_DESC) add("FAIL", "description", `\`description\` is ${d.length} chars, limit ${MAX_DESC}`);
    if (d.includes("<") || d.includes(">")) add("WARN", "description-angle-brackets",
      "`description` contains '<' or '>' - the spec reserves angle brackets for optional/conditional content");
    if (!/\b(use when|use this skill when|when to use|use for|use it when|use this skill to|use when the user|used when)\b/i.test(d))
      add("WARN", "description-trigger",
        "`description` does not state when to use the skill (triggering relies on this field alone)");
  }

  const compat = data["compatibility"];
  if (typeof compat === "string" && compat.length > MAX_COMPAT)
    add("FAIL", "compatibility", `\`compatibility\` is ${compat.length} chars, limit ${MAX_COMPAT}`);

  if (!body.trim()) add("FAIL", "body", "SKILL.md has frontmatter but no instructions after it");
  return out;
}
