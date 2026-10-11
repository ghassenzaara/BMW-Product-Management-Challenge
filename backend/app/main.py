"""FastAPI app. The OpenAPI spec (/openapi.json, /docs) is the contract with the UI.

Run: ``uv run uvicorn app.main:app --reload``. Auth: see app/api/auth.py.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import deps
from app.api.routers import cases, collab, config, requirements, signals, workspace
from app.config import get_settings

app = FastAPI(
    title="Argon API",
    version="0.3.0",
    description="Backend for PMs: signals, cases, scores, requirements, RAG sidebar, audit trail. "
                "Every write needs a user (Supabase Auth token, or X-User-Id in dev mode) and is audited.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"], expose_headers=["x-request-id"],
)
deps.install(app)
for module in (config, signals, workspace, cases, requirements, collab):
    app.include_router(module.router)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok"}
