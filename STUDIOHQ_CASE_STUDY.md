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

## Interactive historical archive (9 November 2026)

`public/showcases/studiohq/archive/` is a static, read-only archive UI, not a restarted hq-app backend. Source snapshot: studio-brain `0d8966ef1b40feac67d993e7b27982d4de05ff82`. It includes seven selected review records, five selected task entries, the five-node studio-reel-test graph, three selected ensemble remarks and two lesson summaries. Reviews preserve status, capture time and event dates; summaries and one lengthy revision event are edited. The two WebP images are original historical screenshots, unlike the synthetic console-tour captures.

The source graph has idle node status despite finished/progress fields and an approved review. These differences remain visible. The flow is a real saved FFmpeg test-pattern pipeline, not client footage or a running job. The task checkbox for ALIFA concerns its brief/checklist, not proof of whole-project delivery. Agent dialogue is labelled generated discussion, not verified operational evidence. No Hermes chat history was exported.

Public data is an explicit allowlist assembled from individually inspected files. Raw vault files, staging addresses, infrastructure/account details, credentials and unrelated personal material are excluded. Full private source is retained only outside the site repository under the workspace tmp directory. No backend calls, message sends or write actions are part of the archive.

## Actual console frontend demo

`public/showcases/studiohq/console/` vendors the original hq-app frontend (`app.js`, `canvas.js`, `style.css`, `index.html`) from source commit `5f137beb738495dda6f8a0785a9b07a435cfeb65`. This is the actual window manager and canvas, not an imitation archive interface. `demo.js` adapts the allowlisted historical data to its API response shapes. `history.js` contains the same reviewed public selection as archive/history.json.

Portfolio-specific changes: isolated local-storage keys; historical dates and labels; original review images inside history rows; historical event list in the agenda; loadouts focus on populated panes; unavailable operational panes hidden; agent, publication and record-write controls disabled. The transport allows only in-memory canvas geometry edits, never a network request. Read-only data remains unchanged. The optional bridge, study animation, Telegram SDK and sound integration are not loaded. No server code, auth data or vault raw records are distributed.

Validation: syntax checks, production build, desktop/mobile browser checks; screenshot lightbox, library expansion, five-node inspector, layout navigation and transport rejection tested. Static preview used deliberately: booting the production server is unnecessary and would contradict the read-only demo scope. Original source repo was not modified or pushed.
