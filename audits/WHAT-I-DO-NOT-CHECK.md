# What the audit does NOT check — the boundary of my product

Written because a report that hides its blind spots is a sales pitch, and because the fastest way to lose a
customer is to be confidently wrong about something I never looked at. The mechanical sections above are
reproducible; **this list is the honest size of the thing.**

## 1. Whether an agent actually OBEYS the file
Nothing here reads a model's behaviour. I can prove a command exists and that the file doesn't mention it; I
cannot prove that adding the line changes what the agent does. Some repos carry 2,000 words of instructions
that are ignored within a single session. That gap is real, it is worth money, and **no audit priced at $69
can close it** — it needs a before/after run on real tasks, which nobody is buying from me yet.

## 2. Whether the file is the RIGHT length
Short files are not automatically good and long files not automatically bad; a long file full of gotchas earns
its length. What I can say mechanically: this file competes with the task for one context window, and here are
the sections that repeat each other. Whether a section pulls its weight is a judgement I make and label.

## 3. Cross-tool consistency between agents and humans
If `README.md` and `AGENTS.md` disagree, I notice when commands differ. I do not verify the whole README, nor
CI configuration, nor whether the pipeline the file implies actually exists in `.github/workflows/`.

## 4. Security depth
I flag secret-*shaped* strings (values redacted) — a pattern check, not a secret scanner. A leaked token in a
`.env` committed in 2023 is a worse incident than anything I find, and I am not the tool for it.

## 5. Anything requiring a mutation
I do not install dependencies, run migrations, push branches, or execute the repo's own test suite unless the
command is on my read-only whitelist and the repo is a local clone. **On the sample audit I ran
`bun install` in a throwaway clone** to measure a claim; that is the most invasive thing I do, and I now say so
in the report. If a claim can be tested read-only, it gets tested before it gets written.

## 6. Repo size and shape I cannot see
Submodules, Git LFS blobs, private sibling repos, and generated directories excluded by `.gitignore` are
invisible to me without credentials. A build-output path that "doesn't exist" may exist after a build (my path
probe says *unresolved*, never *dead*, for exactly this reason).

## 7. The thing that decides whether you buy
Maintenance pressure: is this repo about to be refactored, is the team already happy with their agent, does
the owner have a budget? I cannot see any of that from a repo, and it is why the offer is "reply with one file
and I'll audit it free" instead of "trust me at $69."

---

**What this list costs me:** several of these would justify a $295 audit, and I could quietly imply I covered
them. **What it buys:** when I say "your file never says how to know the work worked," you can grep for it in
ten seconds — and after ten such checks, the judgement sections are worth believing too.
