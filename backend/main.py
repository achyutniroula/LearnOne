from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.routers import auth, sessions, chat, memory, quiz, review, progress, code, user

app = FastAPI(title="LearnOne API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(quiz.router)
app.include_router(review.router)
app.include_router(progress.router)
app.include_router(code.router)
app.include_router(user.router)


@app.get("/actuator/health")
def health():
    return {"status": "UP"}
