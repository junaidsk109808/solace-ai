
import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("solace-backend")


# Load local environment variables
load_dotenv(Path(__file__).with_name(".env"))


# FastAPI application
app = FastAPI(
    title="Solace AI Backend",
    description="AI Wellness Companion API",
    version="1.1.0"
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Gemini configuration
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_TIMEOUT_MS = 60000

client = None


def get_gemini_client():
    global client

    if client is not None:
        return client

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Please try again later."
        )

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=GEMINI_TIMEOUT_MS
            )
        )
        return client

    except Exception:
        logger.exception("Gemini client initialization failed")

        raise HTTPException(
            status_code=503,
            detail="AI service is temporarily unavailable."
        )


# Request and response models
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


# Home endpoint
@app.get("/")
def home():
    return {
        "message": "Welcome to Solace AI Backend!",
        "status": "running"
    }


# Health endpoint
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Solace AI Backend"
    }


# AI chat endpoint
@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    try:
        gemini = get_gemini_client()

        logger.info("Processing chat request")

        response = gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=message
        )

        reply = response.text

        if not reply or not reply.strip():
            logger.warning("Gemini returned an empty response")

            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty response."
            )

        logger.info("Chat response generated successfully")

        return ChatResponse(reply=reply.strip())

    except HTTPException:
        raise

    except Exception as error:
        logger.error(
            "Gemini request failed: %s",
            type(error).__name__
        )

        raise HTTPException(
            status_code=502,
            detail="Unable to get an AI response. Please try again."
        )
