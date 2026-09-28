from typing import Literal

from pydantic import BaseModel, Field


class StartRequest(BaseModel):
    customer_message: str = Field(min_length=1, max_length=4000)
    tone: Literal["Friendly", "Formal", "Apologetic", "Concise"] = "Friendly"


class ResumeRequest(BaseModel):
    thread_id: str = Field(min_length=1, max_length=64)
    response: str = Field(min_length=1, max_length=2000)


class SessionResponse(BaseModel):
    thread_id: str
    status: Literal["awaiting_review", "approved", "max_attempts"]
    draft: str
    attempt: int
    max_attempts: int
