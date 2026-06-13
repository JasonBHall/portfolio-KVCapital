from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models import ValuationRequest, ValuationReport
from app.agent.runner import run_valuation_agent

router = APIRouter()


@router.post("/", response_model=ValuationReport)
async def create_valuation(request: ValuationRequest):
    """
    Run the comp analysis agent against a subject property.
    Returns a full valuation report including comps, adjustments, and narrative.
    """
    try:
        report = await run_valuation_agent(request.subject)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def create_valuation_stream(request: ValuationRequest):
    """
    Streaming version — emits agent trace steps as server-sent events
    so the UI can display tool calls in real time as they happen.

    Event format:
        data: {"type": "trace_step", "step": {...}}
        data: {"type": "report", "report": {...}}
        data: {"type": "done"}
    """
    async def event_stream():
        gen = await run_valuation_agent(request.subject, stream=True)
        async for event in gen:
            yield f"data: {event}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{report_id}", response_model=ValuationReport)
async def get_valuation(report_id: str):
    """Retrieve a previously generated valuation report by ID."""
    from app import db
    row = await db.fetchrow(
        "SELECT * FROM valuation_reports WHERE id = %s", (report_id,)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return row
