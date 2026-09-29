const START_URL = "/api/start";
const RESUME_URL = "/api/resume";

const $ = (id) => document.getElementById(id);

const composeCard = $("composeCard");
const reviewCard = $("reviewCard");
const customerMessage = $("customerMessage");
const startBtn = $("startBtn");
const draftEl = $("draft");
const attemptLabel = $("attemptLabel");
const stepsEl = $("steps");
const actions = $("actions");
const lastNote = $("lastNote");
const feedback = $("feedback");
const approveBtn = $("approveBtn");
const reviseBtn = $("reviseBtn");
const banner = $("banner");
const bannerText = $("bannerText");
const copyBtn = $("copyBtn");
const resetBtn = $("resetBtn");
const errorMsg = $("errorMsg");

let threadId = null;
let isLastRound = false;

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data = {};
  try { data = await res.json(); } catch (_) { /* non-JSON error body */ }

  if (!res.ok) {
    // FastAPI errors use "detail"; the rate limiter replies with "error".
    const message = typeof data.detail === "string" ? data.detail : data.error;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return data;
}

function setBusy(busy, label) {
  [startBtn, approveBtn, reviseBtn].forEach((b) => (b.disabled = busy));
  if (busy && label) startBtn.textContent = label;
  if (!busy) startBtn.textContent = "Draft reply";
}

function renderSteps(attempt, max) {
  stepsEl.innerHTML = "";
  for (let i = 1; i <= max; i++) {
    const dot = document.createElement("i");
    if (i < attempt) dot.className = "done";
    if (i === attempt) dot.className = "current";
    stepsEl.appendChild(dot);
  }
}

function render(data) {
  threadId = data.thread_id;
  composeCard.hidden = true;
  reviewCard.hidden = false;

  draftEl.textContent = data.draft;
  attemptLabel.textContent = `Attempt ${data.attempt} of ${data.max_attempts}`;
  renderSteps(data.attempt, data.max_attempts);

  if (data.status === "awaiting_review") {
    isLastRound = data.attempt >= data.max_attempts;
    actions.hidden = false;
    banner.hidden = true;
    lastNote.hidden = !isLastRound;
    reviseBtn.textContent = isLastRound ? "Finish without approval" : "Request rewrite";
    feedback.value = "";
    feedback.placeholder = isLastRound
      ? "Optional note..."
      : "e.g. Shorter, less formal, mention the refund timeline placeholder...";
    return;
  }

  actions.hidden = true;
  banner.hidden = false;
  if (data.status === "approved") {
    banner.className = "banner ok";
    bannerText.textContent = "Approved. This reply is ready to send.";
  } else {
    banner.className = "banner warn";
    bannerText.textContent = "Attempt limit reached. This is the last draft and it was not approved.";
  }
}

async function start() {
  const message = customerMessage.value.trim();
  if (!message) {
    errorMsg.textContent = "Paste the customer's message first.";
    return;
  }

  errorMsg.textContent = "";
  const tone = document.querySelector('input[name="tone"]:checked').value;
  setBusy(true, "Drafting...");

  try {
    render(await post(START_URL, { customer_message: message, tone }));
  } catch (err) {
    errorMsg.textContent = `Error: ${err.message}`;
  } finally {
    setBusy(false);
  }
}

async function respond(text, busyLabel) {
  errorMsg.textContent = "";
  setBusy(true);
  const original = reviseBtn.textContent;
  if (busyLabel) reviseBtn.textContent = busyLabel;

  try {
    render(await post(RESUME_URL, { thread_id: threadId, response: text }));
  } catch (err) {
    errorMsg.textContent = `Error: ${err.message}`;
    reviseBtn.textContent = original;
  } finally {
    setBusy(false);
  }
}

approveBtn.addEventListener("click", () => respond("approved"));

reviseBtn.addEventListener("click", () => {
  const text = feedback.value.trim();
  if (!text && !isLastRound) {
    errorMsg.textContent = "Add some feedback so the rewrite knows what to fix.";
    return;
  }
  respond(text || "Not approved by human.", isLastRound ? "Finishing..." : "Rewriting...");
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(draftEl.textContent);
    copyBtn.textContent = "Copied";
  } catch (_) {
    copyBtn.textContent = "Copy failed";
  }
  setTimeout(() => (copyBtn.textContent = "Copy reply"), 1500);
});

resetBtn.addEventListener("click", () => {
  threadId = null;
  customerMessage.value = "";
  errorMsg.textContent = "";
  reviewCard.hidden = true;
  composeCard.hidden = false;
  customerMessage.focus();
});

startBtn.addEventListener("click", start);
