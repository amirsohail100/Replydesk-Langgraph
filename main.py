import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from schema.payload import StartRequest, ResumeRequest, SessionResponse
from agent import start_session, resume_session, SessionNotFound

logger = logging.getLogger("replydesk")

app = FastAPI(title="ReplyDesk Human-in-the-Loop API")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Dev ke time frontend alag origin se call kar sake, isliye CORS open rakha hai.
# Production me isko apne actual frontend domain tak restrict kar dena.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Human-in-the-loop 2 requests me hota hai:
#   1) /api/start  -> AI draft banata hai, graph human review pe ruk jaata hai
#   2) /api/resume -> human ka jawab (approve / feedback) graph ko aage badhata hai
@app.post("/api/start", response_model=SessionResponse)
@limiter.limit("5/minute")
def start(request: Request, payload: StartRequest):
    message = payload.customer_message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="customer_message khaali hai")

    try:
        return SessionResponse(**start_session(message, payload.tone))
    except Exception as exc:  # Groq API errors, network issues, etc.
        logger.exception("start_session failed")
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/resume", response_model=SessionResponse)
@limiter.limit("15/minute")
def resume(request: Request, payload: ResumeRequest):
    response = payload.response.strip()
    if not response:
        raise HTTPException(status_code=400, detail="response khaali hai")

    try:
        return SessionResponse(**resume_session(payload.thread_id, response))
    except SessionNotFound:
        raise HTTPException(
            status_code=404,
            detail="Session not found or already finished. Please start a new one.",
        )
    except Exception as exc:
        logger.exception("resume_session failed")
        raise HTTPException(status_code=502, detail=str(exc))


# Frontend (index.html/style.css/script.js) ko isi FastAPI server se serve karo.
# Ye line hamesha sabse aakhir me honi chahiye, kyunki ye "/" ko catch-all bana deti hai.
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
