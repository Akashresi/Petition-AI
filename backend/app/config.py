import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "PetitionAI API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    ENV: str = os.getenv("ENV", "development").lower()

    # MongoDB
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI", "mongodb://localhost:27017/petition_ai"
    )
    USE_MONGODB: bool = os.getenv("USE_MONGODB", "true").lower() == "true"

    # JWT Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # CORS
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8080,http://localhost:5173,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ]

    # Email (SMTP)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", SMTP_USER)

    # SMS & WhatsApp providers (console, twilio, fast2sms, gupshup)
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "fast2sms")
    FAST2SMS_API_KEY: str = os.getenv("FAST2SMS_API_KEY", "")
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")

    # WhatsApp provider (console, gupshup, twilio)
    WHATSAPP_PROVIDER: str = os.getenv("WHATSAPP_PROVIDER", "gupshup")
    GUPSHUP_API_KEY: str = os.getenv("GUPSHUP_API_KEY", "")
    GUPSHUP_APP_NAME: str = os.getenv("GUPSHUP_APP_NAME", "PetitionAI")
    GUPSHUP_SOURCE_NUMBER: str = os.getenv("GUPSHUP_SOURCE_NUMBER", "917834811114")

    # Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
