# skillcheck (TypeScript)

Checks whether an `SKILL.md` actually conforms to the [Agent Skills spec](https://agentskills.io/specification)
as a *strict loader* would read it - not as a lenient hand-rolled frontmatter splitter would.

Three parts, one engine:

| piece | what it is |
|---|---|
| `core.ts` | the rules. Zero runtime dependencies, pure `string -> findings`. YAML parser is **injected** so a verdict can't depend on which YAML library happens to be installed. |
| `api/check.ts` | Vercel edge function (the web demo). Injects `js-yaml`. |
| `../checker/` | the same rules in Python, as a CLI that scans a whole repo from disk with **no network and no deps** (CI / private repos). |

## Parity is tested, not promised

    node --experimental-strip-types tests/parity.mjs /path/to/skills/corpus

Runs every `SKILL.md` in a corpus through **both** engines and fails if the findings differ.
It compares `severity/rule` per file, not message text: PyYAML and js-yaml genuinely report
different column numbers for the same invalid YAML, and forcing the strings to match would
hide a real difference instead of recording it.

Current status on an 18-file corpus (the operator's `Patrity/skills` tree):
`python=13 findings, ts=13 findings, 0 files differ`.

## Rules currently enforced

FAIL: frontmatter missing / not valid YAML / not a mapping; `name` missing, over 64 chars, or not
lowercase-hyphen slug; `description` missing or over 1024; `compatibility` over 500; any key outside
`name, description, license, allowed-tools, metadata, compatibility`; empty body.
WARN: `description` states no trigger condition; `description` contains `<`/`>`; `name` != directory
(only when the parent plausibly *is* the skill's directory - a clone/zip dir is reported as INFO instead).

## Not in v1, on purpose

No whole-repo web upload (needs an unzip lib in the edge runtime), no "paste a GitHub URL" (makes the
server fetch arbitrary user input: different abuse story), and nothing is stored - the upload is
discarded with the request temp dir.
