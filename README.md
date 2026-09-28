# ReplyDesk-LangGraph

A human-in-the-loop customer support reply drafter. An LLM (Groq) writes a reply to a customer message in the tone you pick, then the graph **pauses** and waits for a human to approve it or send feedback. On feedback, the drafter rewrites using the previous draft plus your notes, up to 3 attempts total.

## Graph

```
START -> drafter -> human_review -> (router) -> END        if approved, or attempt limit reached
                        ^                |
                        |________________|  otherwise back to drafter
```

- **2 nodes:** `drafter` (writes/rewrites), `human_review` (calls `interrupt()` and waits)
- **1 router:** `should_stop_looping`
- The graph is compiled with a checkpointer (`MemorySaver`), which is what lets a paused run be resumed later by `thread_id`.

## Structure

```
ReplyDesk-LangGraph/
├── main.py             # FastAPI app: /api/start, /api/resume, /api/health, serves the UI
├── agent.py             # Graph wiring + start_session / resume_session helpers
├── schema/
│   └── payload.py        # StartRequest / ResumeRequest / SessionResponse
├── state/
│   └── ReplyState.py      # ReplyState TypedDict
├── tools/
│   └── nodes.py            # drafter_node, human_review_node, should_stop_looping
├── static/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── requirements.txt
└── .env                     # GROQ_API_KEY
```

## How human-in-the-loop works over HTTP

A CLI can block on `input()`; a web server can't. So one graph run is split across two requests:

1. `POST /api/start` runs the graph until `human_review` calls `interrupt()`. The response contains the draft and a `thread_id`.
2. `POST /api/resume` sends the human's answer with that `thread_id`. The graph continues from the pause: either it finishes, or it loops back to `drafter` and pauses again with a new draft.

The UI keeps the `thread_id` in memory and repeats step 2 until `status` is no longer `awaiting_review`.

## Endpoints

- `GET  /api/health` returns `{"status": "ok"}`
- `POST /api/start` with body `{"customer_message": "...", "tone": "Friendly"}`. Tone is one of `Friendly`, `Formal`, `Apologetic`, `Concise`. Rate limit: 5/minute per IP.
- `POST /api/resume` with body `{"thread_id": "...", "response": "approved" | "<feedback>"}`. Rate limit: 15/minute per IP.
- Both return:
  ```json
  {
    "thread_id": "…",
    "status": "awaiting_review",
    "draft": "…",
    "attempt": 1,
    "max_attempts": 3
  }
  ```
  `status` is `awaiting_review` (waiting for the human), `approved`, or `max_attempts` (limit reached, last draft kept, not approved).
- `POST /api/resume` on an unknown or already finished thread returns `404`.
- `GET /` serves the UI.

## Run locally

```bash
pip install -r requirements.txt
# put GROQ_API_KEY in .env
uvicorn main:app --reload --port 8000
```

Open `http://localhost:8000`.

## Behavior worth knowing

- Feedback that is exactly `approved`, `approve`, `yes`, `ok` or `good` counts as approval (same rule as the original CLI version). The UI's Approve button sends `approved`.
- On the last attempt, giving feedback does not trigger another rewrite; the run ends with the last draft, marked not approved. The UI relabels the button "Finish without approval" for that round.
- The customer message is treated as untrusted text: the system prompt tells the model to respond to it, not obey it. The prompt also forbids inventing order details, refund amounts or policies, so the model uses placeholders like `[order number]`. A human should still read every draft.

## Before going to production

- **`MemorySaver` keeps paused sessions in this process's RAM.** That has three consequences: running with `--workers 2` or more will break `/api/resume` (a request can land on a worker that never saw the thread); a server restart loses every paused session; and finished sessions are never cleaned up, so memory grows over time. For real deployments switch to a persistent checkpointer (`langgraph-checkpoint-sqlite` or `langgraph-checkpoint-postgres`) and swap it in where `agent.py` calls `graph.compile(...)`.
- `thread_id` is a random 128-bit id and acts as the only key to a session. Add authentication if drafts could be sensitive.
- CORS is `allow_origins=["*"]`; restrict it to your real frontend domain.
- Tune the rate limits to your traffic.
