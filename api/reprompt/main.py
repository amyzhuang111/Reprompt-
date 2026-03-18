"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from reprompt.config import settings
from reprompt.routes import baskets, rewrite, strategies, validate

app = FastAPI(
    title="Reprompt",
    description="Query rewriter for ChatGPT shopping triggers",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rewrite.router, tags=["rewrite"])
app.include_router(strategies.router, tags=["strategies"])
app.include_router(baskets.router, tags=["baskets"])
app.include_router(validate.router, tags=["validate"])


@app.get("/health")
async def health():
    return {"status": "ok"}
