"""Settings from environment variables and backend/.env (never committed)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
RAW_DATA_DIR = REPO_DIR / "docs" / "02-bmw-data" / "raw"
SOURCES_FILE = REPO_DIR / "docs" / "05-web-sources" / "fetching-sources.md"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # Supabase. SUPABASE_DB_URL is the Postgres connection string (session pooler).
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # New-style API keys (sb_secret_..., sb_publishable_...); the secret key replaces the
    # service-role key for storage when that one is empty.
    supabase_secret_key: str = ""
    supabase_publishable_key: str = ""
    supabase_jwks_url: str = ""
    supabase_db_url: str = ""
    # Per-session statement timeout (e.g. "0" for long batch scripts on Supabase, whose
    # default for the postgres role is 2 min). Empty = the server default.
    db_statement_timeout: str = ""
    # API auth: "supabase" (Bearer token), "dev" (X-User-Id header), "auto" = supabase
    # when SUPABASE_URL is set, else dev. See app/api/auth.py.
    auth_mode: str = "auto"
    supabase_jwt_secret: str = ""
    # Comma-separated origins of the UI allowed by CORS.
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    # Fallback for development and tests: embedded local Postgres (pgserver).
    local_db_dir: Path = BACKEND_DIR / ".data" / "pg"

    # OpenAI.
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-6-luna"
    openai_strong_model: str = "gpt-6.1-sol"
    # Price per 1M tokens (input, output) in USD, for cost logging only (changes.md 8.12).
    openai_prices: dict[str, tuple[float, float]] = {
        "gpt-6-luna": (0.10, 0.50), "gpt-6.1-sol": (2.0, 10.0), "gpt-6-sol": (2.0, 10.0), "gpt-5-mini": (0.25, 2.0), "gpt-5": (1.25, 10.0),
    }

    def llm_price(self, model: str) -> tuple[float, float]:
        """Prices of the model; dated snapshots (gpt-6-luna-2026-...) use their base name."""
        for name in sorted(self.openai_prices, key=len, reverse=True):
            if model.startswith(name):
                return self.openai_prices[name]
        return self.openai_prices[self.openai_chat_model] if self.openai_chat_model in self.openai_prices else (0.0, 0.0)

    # Embeddings: "openai" or "local" (offline fallback, see changes.md 1.2).
    embedding_provider: str = "openai"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 768   # stored vector size (migration 0016); the API shortens the model's 1536

    # Raw record storage: "supabase" or "local" (see changes.md 1.3).
    storage_backend: str = "local"
    raw_local_dir: Path = BACKEND_DIR / ".data" / "raw-records"
    raw_bucket: str = "raw-records"

    # Web fetching.
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    youtube_api_key: str = ""
    fetch_user_agent: str = ("BMW-PM-Research-Prototype/0.1"
                             " (+https://github.com/ghassenzaara/BMW-Product-Management-Challenge)")
    fetch_daily_request_budget: int = 500
    # YouTube: comments and transcripts of videos published in the last N days.
    youtube_window_days: int = 60
    # The most relevant comments per video (YouTube's own ranking: likes and replies).
    youtube_comments_per_video: int = 10

    def model_post_init(self, __context) -> None:
        # Values still holding the .env.example placeholders count as not set.
        for name in ("supabase_url", "supabase_db_url", "supabase_service_role_key", "supabase_secret_key",
                     "supabase_jwks_url", "openai_api_key"):
            if "<" in getattr(self, name):
                setattr(self, name, "")
        if not self.supabase_service_role_key:
            self.supabase_service_role_key = self.supabase_secret_key
        if self.auth_mode in ("auto", ""):
            self.auth_mode = "supabase" if self.supabase_url else "dev"

    # Model per prompt (changes.md 8.11): high-volume, closed-list work on the chat model,
    # few high-stakes texts on the strong model. Override with OPENAI_STRONG_TASKS.
    openai_strong_tasks: str = "requirement_writer"

    # Thinking effort per prompt. Reading, classifying and summarizing given text needs no
    # long reasoning: those prompts run with minimal effort (faster, cheaper). Every other
    # prompt (the RAG agent, the requirement writer) keeps the model's normal effort.
    openai_minimal_reasoning_tasks: str = "feedback_classify,signal_extract,case_writer,case_tags"
    # The effort value sent for those prompts. gpt-6-luna accepts none, low, medium, high, xhigh
    # (it has no "minimal"): "low" is the least thinking that still thinks, "none" switches it off.
    openai_minimal_reasoning_effort: str = "low"

    def llm_reasoning_for(self, task: str) -> str | None:
        """The reduced effort for the high-volume reading tasks, None (the model's default) otherwise."""
        minimal = {t.strip() for t in self.openai_minimal_reasoning_tasks.split(",") if t.strip()}
        return (self.openai_minimal_reasoning_effort or None) if task in minimal else None

    def llm_model_for(self, task: str) -> str:
        strong = {t.strip() for t in self.openai_strong_tasks.split(",") if t.strip()}
        return self.openai_strong_model if task in strong else self.openai_chat_model

    @property
    def db_url(self) -> str:
        return self.supabase_db_url

    @property
    def has_openai(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
