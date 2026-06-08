import urllib.parse
from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    GROQ_API_KEY: str | None = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        if not v:
            return v
        if v.startswith("postgresql://") or v.startswith("postgres://"):
            try:
                prefix, rest = v.split("://", 1)
                if "@" in rest:
                    creds, host_part = rest.rsplit("@", 1)
                    if ":" in creds:
                        user, password = creds.split(":", 1)
                        unquoted_password = urllib.parse.unquote(password)
                        quoted_password = urllib.parse.quote(unquoted_password)
                        return f"{prefix}://{user}:{quoted_password}@{host_part}"
            except Exception:
                pass
        return v

    class Config:
        env_file = ".env"

settings = Settings()
