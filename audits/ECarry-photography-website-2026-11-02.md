# Agent-readiness audit — `ECarry/photography-website`

*One instruction file: `AGENTS.md`, 103 words / 9 lines, last edited 2026-11-02. Stack detected from
manifest files: Node + `package.json`. Everything in "what the probe found" is reproducible from the repo
by running the same commands; the interpretation is mine.*

## The short version

This file is **better than most**. Nine lines, five runnable commands, two explicit warnings about what
not to run. I have audited 31-file repos that do less work per line. So the headline is not "problems" —
it is one specific hole, plus two judgement calls about a file that is doing well.

## 1. What is genuinely good, and why it matters

`bun run test:unit` / `bun run build` / `bunx tsc --noEmit` are named exactly, not described. That is the
single most useful thing an `AGENTS.md` can do, and most files fail at it: an agent that is *told* to
"run the tests" without a command will invent one, then report success from the invention.

The strongest line in the file is the database warning:

> Do not run `bun run test:integration` against an unverified database. The server tests delete rows in
> their setup; confirm an isolated disposable database and obtain approval first.

That is worth more than ten lines of general guidance. It names the action, the consequence, and the
condition for safety. An agent without it can wipe a database on a routine task; with it, the same agent
asks instead. Files rarely get this right, so keep the shape.

## 2. The mechanical finding — and the correction I owe you

The probe compares what the file documents against what the repo can actually run. Two scripts exist and
appear nowhere in the instructions: `bun run test` and `bun run test:run`.

I first read that as "`bun run test` is vitest watch mode, it will never exit." **I then ran it, and I was
wrong.** With vitest 4.0.18 on this tree, `bun run test` finished in 3.03s, 38 tests passed, exit 0 — vitest
now auto-exits when no TTY is attached, so the classic "watch mode hangs your agent" failure does not fire
here.

What survives is the narrower, still-useful version: the undocumented `test` script and the documented
`test:unit` both run **the same 38 tests in the same 3 seconds**, so an agent has two equally plausible
routes to the same result and no guidance about which is canonical — one of them relying on an interactive
mode behaving differently in a terminal than in a script. That is a one-line disambiguation, not an emergency:

```md
- Tests: `bun run test:unit`. Do not use `bun run test` — it is interactive watch mode.
```

**Why I am telling you I was wrong:** if I had quietly shipped the confident version, the report would have
been sold on a claim about your repo that your repo doesn't honour. Every "watch mode hangs forever" warning
I have ever repeated came from the vitest 1–3 era. This one measured 3.03s and passed.

## 3. Verification: the file says *how to run*, not *how to know*

No line in the file says what success looks like — no exit code, no "must be green", no expected output.
In a nine-line file that mostly works, because the commands are named so precisely that an agent infers
them. So this is a judgement call, not a defect: **the one sentence I'd add is a completion rule.**

```md
Before reporting done: `bunx tsc --noEmit` clean, `bun run lint` clean, `bun run test:unit` green.
```

That converts "I ran the commands" into "the repo passes," which is the difference between an agent you
trust at a distance and one you re-check by hand.

## 4. Two things I would NOT change

**Length.** Nine lines is correct. The reflex to expand an `AGENTS.md` is a mistake — instructions compete
for the same context window as the task, and a longer file is obeyed less reliably, not more.

**The `.test.ts` and `src/test/setup.ts` references.** They resolve to real patterns, and I checked: both
exist. Not a problem, and I'd rather say so than pad the list.

## 5. What an agent will do differently after the two edits

Nothing about the code changes. The change is one of *authority*: the agent stops guessing which of two
identical-looking test commands is the sanctioned one, and stops declaring work complete on a build it never
type-checked. The second is the silent failure mode, and it is the one worth attention in a file this short.

## 6. What I ran on your repo (so you can check me)

`bun install --frozen-lockfile` (938 packages), then `bun run test` and `bun run test:unit` side by side —
both exit 0, 38 passed, ~3s each; `bunx tsc --noEmit` before install failed on `drizzle.config.ts`
(missing `drizzle-kit`) and cleared conceptually once deps were present. Nothing was pushed, committed, or
migrated; no `bun run test:integration`, because your own file says it deletes rows and needs a disposable
database. That last one is the shape I try to audit *for*: your file already protects an agent from your
scariest command, which is rare and worth keeping.

**Worth ~2 minutes of editing.** If every repo I audit were this clean, this product would be a
five-dollar service — which is why I'd rather you read this than take my word for what an audit finds.
