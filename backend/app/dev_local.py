"""The API on the LOCAL database: python -m app.dev_local [port] [--openai]

For wiring and testing the UI without touching Supabase or OpenAI, whatever
backend/.env says: embedded Postgres (backend/.data/pg), local raw records, dev
auth (X-User-Id), no LLM (template texts, extractive assistant), local embeddings.

``--openai`` keeps the OpenAI key and embeddings of backend/.env: for a local copy of the
Supabase data (``python -m app.mirror``), whose search index was embedded by OpenAI, so the
assistant answers as on Supabase while every query stays on this machine.
"""

import os
import sys

OPENAI = "--openai" in sys.argv[1:]
for key, value in {"SUPABASE_DB_URL": "", "SUPABASE_URL": "", "STORAGE_BACKEND": "local", "AUTH_MODE": "dev",
                   **({} if OPENAI else {"OPENAI_API_KEY": "", "EMBEDDING_PROVIDER": "local"})}.items():
    os.environ[key] = value

if __name__ == "__main__":
    import uvicorn

    from app.config import get_settings

    s = get_settings()
    assert not s.db_url and (OPENAI or not s.has_openai), "refusing to start: Supabase or OpenAI is still configured"
    port = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8000)
    uvicorn.run("app.main:app", host="127.0.0.1", port=port)
