"""Rewrite API routes."""

import asyncio
import csv
import io
import json

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse

from reprompt.models import RewriteRequest, RewriteResponse
from reprompt.services.rewriter import rewrite, rewrite_stream

router = APIRouter()


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_query(req: RewriteRequest) -> RewriteResponse:
    return await rewrite(
        query=req.query,
        num_variants=req.num_variants,
        include_proxy=req.include_proxy_scores,
    )


@router.post("/rewrite/stream")
async def rewrite_query_stream(req: RewriteRequest):
    """SSE endpoint: sends original score immediately, then rewrites as they're scored."""

    async def event_generator():
        async for event in rewrite_stream(
            query=req.query,
            num_variants=req.num_variants,
            include_proxy=req.include_proxy_scores,
        ):
            yield f"data: {json.dumps(event)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/rewrite/batch")
async def batch_rewrite(file: UploadFile = File(...)):
    """Accept CSV with 'query' column, return CSV with rewrites and scores."""
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    # Collect all queries and process concurrently
    queries = [row.get("query", "").strip() for row in reader]
    queries = [q for q in queries if q]

    results = await asyncio.gather(*[rewrite(q, num_variants=5, include_proxy=True) for q in queries])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["original_query", "original_score", "best_rewrite", "best_score", "strategy", "lift"])

    for result in results:
        if result.rewrites:
            best = result.rewrites[0]
            writer.writerow([
                result.original_query,
                result.original_score,
                best.query,
                best.score,
                best.strategy,
                best.score - result.original_score,
            ])
        else:
            writer.writerow([result.original_query, result.original_score, "", 0, "", 0])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reprompt_results.csv"},
    )
