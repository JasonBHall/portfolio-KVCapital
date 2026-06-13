from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models import CommercialValuationRequest, CommercialValuationReport
from app.agent.commercial_runner import run_commercial_agent

router = APIRouter()


@router.post("/", response_model=CommercialValuationReport)
async def create_commercial_valuation(request: CommercialValuationRequest):
    try:
        report = await run_commercial_agent(request.subject)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_commercial_valuation(request: CommercialValuationRequest):
    """
    Streaming version — emits agent trace steps as server-sent events.

    Event format:
        data: {"type": "trace_step", "step": {...}}
        data: {"type": "report", "report": {...}}
        data: {"type": "done"}
    """
    async def event_stream():
        gen = await run_commercial_agent(request.subject, stream=True)
        async for event in gen:
            yield f"data: {event}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
