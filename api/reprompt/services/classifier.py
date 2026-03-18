"""Trained classifier: predicts shopping trigger probability from query embeddings.

Uses OpenAI text-embedding-3-small + logistic regression trained on ground truth data.
"""

import json
import pickle
import sqlite3
from pathlib import Path

import numpy as np
from openai import OpenAI
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from reprompt.config import settings

_MODEL_DIR = Path(__file__).parent.parent / "data"
_MODEL_PATH = _MODEL_DIR / "classifier.pkl"
_DB_PATH = _MODEL_DIR / "ground_truth.db"

# Cached model + scaler
_classifier: LogisticRegression | None = None
_scaler: StandardScaler | None = None
_openai: OpenAI | None = None


def _get_openai() -> OpenAI:
    global _openai
    if _openai is None:
        _openai = OpenAI(api_key=settings.openai_api_key)
    return _openai


def get_embedding(text: str) -> list[float]:
    """Get embedding from OpenAI."""
    client = _get_openai()
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return resp.data[0].embedding


def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Get embeddings for multiple texts in one call."""
    client = _get_openai()
    resp = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [d.embedding for d in resp.data]


def train() -> dict:
    """Train classifier on ground truth data. Returns training stats."""
    db = sqlite3.connect(str(_DB_PATH))
    rows = db.execute(
        "SELECT query, has_product_recs, trigger_score FROM validations"
    ).fetchall()
    db.close()

    if len(rows) < 10:
        raise ValueError(f"Need at least 10 validated queries, have {len(rows)}")

    queries = [r[0] for r in rows]
    labels = np.array([r[1] for r in rows])
    trigger_scores = np.array([r[2] for r in rows])

    # Get embeddings
    print(f"Getting embeddings for {len(queries)} queries...")
    embeddings = get_embeddings_batch(queries)
    X = np.array(embeddings)

    # Train/test split (80/20, stratified)
    from sklearn.model_selection import cross_val_score, StratifiedKFold

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Logistic regression with regularization
    clf = LogisticRegression(
        C=1.0,
        max_iter=1000,
        class_weight="balanced",
        random_state=42,
    )

    # Cross-validate
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(clf, X_scaled, labels, cv=cv, scoring="accuracy")

    # Train on full data
    clf.fit(X_scaled, labels)

    # Also train a regressor for trigger score prediction
    from sklearn.linear_model import Ridge

    reg = Ridge(alpha=1.0)
    reg.fit(X_scaled, trigger_scores)

    # Save model
    model_data = {
        "classifier": clf,
        "regressor": reg,
        "scaler": scaler,
        "n_samples": len(rows),
        "n_positive": int(labels.sum()),
        "cv_accuracy": float(cv_scores.mean()),
        "cv_std": float(cv_scores.std()),
    }
    with open(_MODEL_PATH, "wb") as f:
        pickle.dump(model_data, f)

    # Update globals
    global _classifier, _scaler
    _classifier = clf
    _scaler = scaler

    stats = {
        "samples": len(rows),
        "positive": int(labels.sum()),
        "negative": int(len(rows) - labels.sum()),
        "cv_accuracy": round(cv_scores.mean() * 100, 1),
        "cv_std": round(cv_scores.std() * 100, 1),
        "cv_scores": [round(s * 100, 1) for s in cv_scores.tolist()],
    }
    print(f"Training complete: {stats}")
    return stats


def _load_model():
    """Load trained model from disk."""
    global _classifier, _scaler
    if _classifier is not None:
        return True

    if not _MODEL_PATH.exists():
        return False

    with open(_MODEL_PATH, "rb") as f:
        data = pickle.load(f)

    _classifier = data["classifier"]
    _scaler = data["scaler"]
    return True


def predict(query: str) -> dict:
    """Predict shopping trigger probability for a query."""
    if not _load_model():
        return {"available": False}

    emb = get_embedding(query)
    X = np.array([emb])
    X_scaled = _scaler.transform(X)

    prob = _classifier.predict_proba(X_scaled)[0]
    predicted_class = _classifier.predict(X_scaled)[0]

    # Load regressor for score prediction
    with open(_MODEL_PATH, "rb") as f:
        data = pickle.load(f)
    reg = data["regressor"]
    predicted_score = max(0, min(100, int(reg.predict(X_scaled)[0])))

    return {
        "available": True,
        "will_trigger": bool(predicted_class),
        "trigger_probability": round(float(prob[1]), 3),
        "predicted_score": predicted_score,
    }


def is_trained() -> bool:
    """Check if a trained model exists."""
    return _MODEL_PATH.exists()
