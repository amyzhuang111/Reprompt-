from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "https://web-ten-pi-53.vercel.app"]
    rewrite_model: str = "claude-haiku-4-5-20251001"
    max_rewrites: int = 8

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
