/**
 * Vercel serverless entry point for skillcheck.
 * POST body = SKILL.md text, or a zip of a skills tree (see api/check-zip note).
 * Returns the same JSON shape as the Python CLI's --json mode.
 *
 * Why js-yaml is injected here: this is the deployment edge, and js-yaml is the
 * strict-parse family the upstream PRs were validated against. The core stays
 * parser-agnostic on purpose (see core.ts).
 */
import { checkSkillMd } from "../core.ts";
import { load } from "js-yaml";

export const config = { runtime: "edge" };

const MAX_BYTES = 512 * 1024;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST")
    return Response.json({ error: "use POST with a SKILL.md body" }, { status: 405 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return Response.json({ error: "empty body" }, { status: 400 });
  if (buf.byteLength > MAX_BYTES)
    return Response.json({ error: `body over ${MAX_BYTES} bytes` }, { status: 413 });

  const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // v1 is single-file only: a zip would need an unzip lib in the edge runtime, and I
  // am not adding one silently just to look feature-complete.
  if (text.charCodeAt(0) === 0x50 && text.charCodeAt(1) === 0x4b)
    return Response.json({ error: "zip upload is not supported by this endpoint (single SKILL.md only)" },
      { status: 415 });

  const findings = checkSkillMd(text, { parseYaml: load });
  const fail = findings.filter(f => f.severity === "FAIL").length;
  const warn = findings.filter(f => f.severity === "WARN").length;
  return Response.json(
    { summary: { skills_checked: 1, fail, warn, verdict: fail ? `${fail} failure(s)` : "clean" }, findings },
    { status: 200, headers: { "access-control-allow-origin": "*" } },
  );
}
