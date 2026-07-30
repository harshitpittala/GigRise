"""Application settings — Pydantic Settings loader.

Reads environment variables per PROJECT_SETUP.md §5's documented, grouped
list. This module only *declares* the settings surface — it does not
instantiate a Supabase client, a database connection, or any auth
mechanism (Phase 0.2 explicitly excludes Supabase/authentication). Every
field has a safe default so the application can start in a local
development environment with no real secrets configured yet.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Backend (PROJECT_SETUP.md §5 "Backend") ---
    api_env: Literal["development", "staging", "production"] = "development"
    api_port: int = 8000
    api_host: str = "0.0.0.0"
    log_level: str = "info"

    # --- Database (§5 "Database") ---
    database_url: str | None = None
    database_pool_size: int = 10

    # --- Supabase (§5 "Supabase") — declared only, never connected to yet.
    # No client is instantiated anywhere in this codebase at Phase 0.2;
    # these fields exist so later phases don't have to touch this module's
    # shape, only its usage.
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_jwks_url: str | None = None

    # --- Auth / Security (§5) ---
    session_idle_timeout_minutes: int = 30
    rate_limit_redis_url: str | None = None

    # --- Email (§5) ---
    resend_api_key: str | None = None
    email_from_address: str | None = None

    # --- Payments (§5) ---
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None

    # --- Cloudinary (§5) ---
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None

    # --- Analytics / Observability (§5) ---
    analytics_write_key: str | None = None
    sentry_dsn_api: str | None = None

    @property
    def is_production(self) -> bool:
        return self.api_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton — reads the environment exactly once."""
    return Settings()
