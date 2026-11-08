
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai

# Load backend environment variables
load_dotenv(Path(__file__).with_name(".env"))

# Get Gemini API key
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing from backend/.env")

# Initialize Gemini
client = genai.Client(api_key=api_key)

# Create FastAPI application
app = FastAPI(
    title="Solace AI Backend",
    description="AI Wellness Companion API",
    version="1.0.0"
)

# Enable CORS for React Native and Expo clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/")
def home():
    return {
        "message": "Welcome to Solace AI Backend!",
        "status": "running"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    if not request.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty"
        )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=request.message
        )

        reply = response.text

        if not reply:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty response"
            )

        return ChatResponse(reply=reply)

    except HTTPException:
        raise

    except Exception as error:
        print("Gemini error:", error)

        raise HTTPException(
            status_code=502,
            detail="Unable to get a Gemini response. Please try again."
        )
