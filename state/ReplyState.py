from typing import TypedDict


class ReplyState(TypedDict):
    customer_message: str
    tone: str
    draft: str
    review_feedback: str
    is_approved: bool
    attempt: int
