import uuid

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command

from state.ReplyState import ReplyState
from tools.nodes import drafter_node, human_review_node, should_stop_looping, MAX_ATTEMPTS

graph = StateGraph(ReplyState)

graph.add_node("drafter", drafter_node)
graph.add_node("human_review", human_review_node)

graph.add_edge(START, "drafter")
graph.add_edge("drafter", "human_review")

graph.add_conditional_edges(
    "human_review",
    should_stop_looping,
    {
        "drafter": "drafter",
        END: END,
    },
)

# interrupt() needs a checkpointer so the paused run can be resumed by thread_id.
# MemorySaver lives inside this one process - see README before running multiple workers.
compiled_graph = graph.compile(checkpointer=MemorySaver())


class SessionNotFound(Exception):
    """Raised when resuming a thread that doesn't exist or has already finished."""


def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _package(thread_id: str, result: dict) -> dict:
    """Turns a graph result into the shape the API returns."""
    if "__interrupt__" in result:
        payload = result["__interrupt__"][0].value
        return {
            "thread_id": thread_id,
            "status": "awaiting_review",
            "draft": payload["draft"],
            "attempt": payload["attempt"],
            "max_attempts": MAX_ATTEMPTS,
        }

    return {
        "thread_id": thread_id,
        "status": "approved" if result["is_approved"] else "max_attempts",
        "draft": result["draft"],
        "attempt": result["attempt"],
        "max_attempts": MAX_ATTEMPTS,
    }


def start_session(customer_message: str, tone: str) -> dict:
    """Starts a new run; it stops at the human review interrupt."""
    thread_id = uuid.uuid4().hex
    result = compiled_graph.invoke(
        {
            "customer_message": customer_message,
            "tone": tone,
            "draft": "",
            "review_feedback": "",
            "is_approved": False,
            "attempt": 0,
        },
        config=_config(thread_id),
    )
    return _package(thread_id, result)


def resume_session(thread_id: str, response: str) -> dict:
    """Feeds the human's answer back into the paused run."""
    config = _config(thread_id)

    snapshot = compiled_graph.get_state(config)
    if not snapshot.next:  # nothing pending: unknown thread or already finished
        raise SessionNotFound(thread_id)

    result = compiled_graph.invoke(Command(resume=response), config=config)
    return _package(thread_id, result)
