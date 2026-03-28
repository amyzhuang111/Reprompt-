"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from reprompt.config import settings
from reprompt.routes import validate

app = FastAPI(
    title="AEO Intelligence",
    description="The optimization layer for AI search — built on AEO research",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validate.router, tags=["validate"])


@app.get("/health")
async def health():
    return {"status": "ok"}
