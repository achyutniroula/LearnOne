import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, LearningSession, Quiz, QuizQuestion
from ..auth import get_current_user
from ..schemas import QuizResponse, QuizQuestionResponse
from ..claude import run_claude

router = APIRouter(prefix="/api/sessions", tags=["quiz"])


@router.get("/{session_id}/quiz", response_model=QuizResponse)
def get_or_generate_quiz(session_id: int, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    session = db.query(LearningSession).filter(
        LearningSession.id == session_id, LearningSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    quiz = db.query(Quiz).filter(Quiz.session_id == session_id).first()
    if not quiz:
        quiz = _generate_quiz(session_id, session.learning_goal, db)

    return _to_quiz_response(quiz)


def _generate_quiz(session_id: int, learning_goal: str, db: Session) -> Quiz:
    prompt = (
        f'Based on a learning session with goal: "{learning_goal}"\n\n'
        "Generate 5 quiz questions as JSON (no markdown, no prose):\n"
        '{"questions": [{"question": "...", "type": "MCQ", '
        '"choices": ["Option A", "Option B", "Option C", "Option D"], '
        '"correct_answer": "Option A", "explanation": "..."}]}\n'
        "Use a mix of MCQ and SHORT_ANSWER types. For SHORT_ANSWER omit the choices field."
    )
    raw = run_claude(prompt)
    return _parse_and_save(session_id, raw, db)


def _parse_and_save(session_id: int, raw: str, db: Session) -> Quiz:
    text = raw.strip()
    if text.startswith("```"):
        start = text.find("\n") + 1
        end = text.rfind("```")
        if end > start:
            text = text[start:end].strip()
    quiz = Quiz(session_id=session_id)
    db.add(quiz)
    db.flush()
    try:
        data = json.loads(text)
        for i, q in enumerate(data.get("questions", [])):
            qq = QuizQuestion(
                quiz_id=quiz.id,
                question=q.get("question", ""),
                type=q.get("type", "MCQ"),
                choices=q.get("choices"),
                correct_answer=q.get("correct_answer", ""),
                explanation=q.get("explanation"),
                sort_order=i,
            )
            db.add(qq)
    except Exception:
        pass
    db.commit()
    db.refresh(quiz)
    return quiz


def _to_quiz_response(quiz: Quiz) -> QuizResponse:
    questions = [
        QuizQuestionResponse(
            id=q.id, question=q.question, type=q.type, choices=q.choices,
            correctAnswer=q.correct_answer, explanation=q.explanation, sortOrder=q.sort_order
        ) for q in quiz.questions
    ]
    return QuizResponse(id=quiz.id, sessionId=quiz.session_id, questions=questions)
