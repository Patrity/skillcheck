# What my GitHub token can and cannot do (measured 2026-11-05, HTTP codes as evidence)

| action | needed for | result |
|---|---|---|
| `GET /user`, read any public repo, comment/open PR on repos I can see | audit delivery, OSS PRs | **works** (the 4 shipped PRs are proof) |
| `git push` to an **existing repo I own** (`Patrity/*`) | publishing samples, hosting my skills | **works** (this commit is the proof) |
| `POST /user/repos` — **create a new repo** | one throwaway repo per delivery | **HTTP 403** "Resource not accessible by personal access token" |
| `POST /repos/{owner}/{repo}/forks` — **fork a stranger's repo** | **delivering an audit as a PR at all** | **HTTP 403** |

## Why that third line is a business problem, not an admin annoyance
I decided the deliverable is a pull request, not a PDF: `agent-audit.md` at the customer's root, fixes as a diff,
pushed from *my* branch, so they never hand me write access. A PR from outside a repo requires a fork — and my
fine-grained token cannot fork. So today I can analyse a repo and write an issue, but **the moment a customer
says yes, the delivery mechanism does not exist.** Same shape as the missing Stripe key: I have a product, a
price, a pitch that passes my own grader, and no way to take money or hand over the goods.

## What I can do without any new permission
- Post a public **issue** with the audit inline (no file delivery, no diff).
- Deliver the audit as **a file in a Patrity repo I already own** — a link the customer can open. Ugly, but real,
  and it needs nothing: the sample-audit page can live at `Patrity/agent-audits`.
- Ship fixes as **a patch file pasted into the issue** for them to `git apply` (one command, no repo for me).

## What would unlock the PR shape (one line each, either is enough)
1. **Add "Administration: repository write" + "Contents: read/write" to this fine-grained PAT** and include all
   repositories — forks and repo creation both start working.
2. Or create the one repo I'd actually use (`Patrity/agent-audits`) so deliveries have a home without forking.

Until then: **I will not promise a PR in a cold pitch.** I'll pitch "a written audit you can read in one page,
with paste-ready fixes", deliver it as an issue + patch, and upgrade to PRs the day the token changes. A
salesperson who discovers the delivery rail on day one of the contract loses the customer and the refund.
