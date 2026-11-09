# StudioHQ portfolio documentation

Public case study: `public/showcases/studiohq/index.html`.
Main portfolio project: `#project-studiohq`, category **Custom AI Workflows**.
Developer portfolio: `dev/#studiohq`.

## Evidence and scope

Reviewed hq-app source snapshot `5f137beb738495dda6f8a0785a9b07a435cfeb65` on 9 November 2026. The owner reports prior server deployment with agents running continuously, later stopped to reduce costs. No uptime, user-count, cost-saving or evaluation metrics have been verified.

This is an implementation review plus a browser capture of the actual frontend with synthetic API responses. It is not an end-to-end execution test. The source repository, studio vault, credentials and client data are not included in this public portfolio.

## Feature evidence

| Feature | Implementation | Validation boundary |
| --- | --- | --- |
| Windowed console, layout persistence, reduced motion | public/app.js, public/style.css | UI inspected locally; no complete accessibility audit |
| Canvas nodes, edges, pan/zoom, inspector | public/canvas.js | Actual UI rendered using fixture flow data |
| Flow persistence and camera state | lib/canvas.js | Code inspected; vault writes not exercised |
| FFmpeg drivers and progress | lib/canvas.js | Argument-array spawn present; no media job executed for capture |
| Build request dispatch | lib/canvas.js | Writes queue request; external orchestrator executes it |
| Review actions and event history | lib/review.js | Code inspected; synthetic review UI captured; no real verdict sent |
| Handoff readiness | hydrateNode / getDeliverHtml in lib/canvas.js | Checks immediate predecessor completion; not a global approval policy |
| Agent chat | server.js | External Hermes CLI session; not reactivated |
| Sessions | lib/auth.js | Signed cookies and deployment-specific auth-check; not security-audited |
| Library and scheduled research | lib/library.js, bin/librarian-session.js | Source present; scheduled execution not restarted |

## Architecture talking points

Browser UI -> Node HTTP routes -> state aggregation / action handlers -> Markdown and JSON vault + Git + external CLI tools. The canvas is an interaction layer, not a durable general-purpose agent runtime. Build requests, media execution and human review have separate paths.

The backend has no npm runtime dependencies in its package manifest. This does not mean the system has no dependencies: FFmpeg, agent CLIs, Git, Linux services and browser vendor libraries still matter. App and README version strings differ; the source commit is the review identifier.

## Interview walkthrough

### A 60-second introduction

“StudioHQ is a studio operations console I developed with AI coding assistance. I wanted one place to see agent work, manage media pipelines and review the result before handoff. The frontend is vanilla JavaScript and the backend is a small Node server over a Git-backed workspace. I previously hosted it with agents running continuously and stopped the server to reduce costs. A useful example is the media canvas: processing, build requests and review are distinct stages. I can explain what is implemented and where the system still needs stronger testing.”

### Be ready to explain

1. Why files and Git? Easy inspection and history, but concurrent writes and large artifacts need care.
2. Why separate dispatch from execution? A queue record is visible and inspectable; it is not proof that a worker ran successfully.
3. What does review enforce? In the demonstrated flow, the immediate upstream review gate controls delivery readiness. Arbitrary graph structures need stronger invariants.
4. How do you know it works? Show source paths, a repeatable test and its output. UI screenshots alone do not prove execution.
5. What happens on failure? Explain the specific handler and remaining gap; do not imply automatic recovery across all jobs.
6. What did AI contribute? Explain AI-assisted implementation honestly, then demonstrate your ability to change and debug the code.
7. What would you improve? Authentication configuration, workflow invariant tests, durable recovery, model task evaluation, and measured latency/cost.

### Claims to avoid

Do not claim Temporal usage, exactly-once processing, autonomous production deployment, model training, proven model-quality improvements, enterprise access control, or production scale on the strength of this repository alone. Prior self-hosting is valid deployment experience; it does not establish these additional properties.

## Screenshot provenance

`canvas.png` and `review.png` are crops of the actual frontend rendered locally at desktop size with reduced motion enabled. Synthetic API fixtures supply example jobs, flow nodes and review data. The review thumbnail is the canvas capture. No model provider, live client data, Telegram action or production service was used. Fixture statuses are illustrative, not measured execution results. Public source distribution is intentionally excluded.


## Expanded console tour

Full-frame UI captures now cover OPS, agenda/orchestration, agent roster, daily tasks, data-flow graph, GitHub/staging links, Hermes concierge, library and human review. All values and conversation content in these images are synthetic and visibly labelled. The concierge was exercised against a mocked API response, not a live model. No Telegram message was sent.

Additional source inspected: `lib/tasks.js` (Markdown checklist writes), `lib/links.js` (Git remotes and staging URL map), `bin/librarian-session.js` (reference digestion, lesson cards and skill-amendment review proposals). The learning loop updates knowledge artifacts and proposed instructions; it does not train model weights or establish measured improvement. Failed library steps are logged with best-effort continuation, so exit success alone is not evidence every material item was processed.

Owner-supplied deployment history: Obsidian digital brain, role-specific agents, daily routines, Telegram standup/end-of-day messages, and DuckDNS/Caddy access that reduced manual coordination between requirements and delivered work. Preserve these as qualitative experience, not quantified efficiency claims. The links pane is not a GitHub Actions deployment monitor.
