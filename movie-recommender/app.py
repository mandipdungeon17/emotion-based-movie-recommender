"""
CineEmotion - Flask Backend API
================================
Run:
    pip install flask flask-cors pandas numpy
    python app.py

The API will start at http://localhost:5000

Endpoints:
    POST /recommend     - Get movie recommendations from group emotions
    GET  /movies        - List all movies (with optional filters)
    GET  /health        - Health check
"""

import os
import json
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow React frontend (any origin) to call this API

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(__file__), "movies_dataset_500.csv")

EMOTIONS = [
    "joy", "sadness", "fear", "anger", "disgust", "surprise", "trust",
    "anticipation", "curiosity", "excitement", "hope", "love", "guilt",
    "shame", "gratitude", "loneliness", "confidence", "determination",
    "regret", "relief", "nostalgia", "compassion", "anxiety", "inspiration",
]

RELEASE_BINS = {
    "old": lambda y: y <= 1999,
    "mid": lambda y: 2000 <= y <= 2010,
    "new": lambda y: y >= 2011,
}

# ─────────────────────────────────────────────
# LOAD & PREPARE DATA
# ─────────────────────────────────────────────
def load_movies():
    if not os.path.exists(CSV_PATH):
        print(f"[WARN] CSV not found at {CSV_PATH}. Using empty dataset.")
        return pd.DataFrame(), np.array([])

    df = pd.read_csv(CSV_PATH)

    # Coerce numeric columns
    for col in ["year", "imdb"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Check all emotion columns exist
    missing = [e for e in EMOTIONS if e not in df.columns]
    if missing:
        print(f"[WARN] Missing emotion columns: {missing}")

    emotion_cols = [e for e in EMOTIONS if e in df.columns]
    matrix = df[emotion_cols].fillna(0).to_numpy(dtype=float)

    # Precompute L2 norms for each movie (for fast cosine similarity)
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0  # Avoid division by zero
    normalized_matrix = (matrix.T / norms).T

    df["_norm_idx"] = range(len(df))
    return df, normalized_matrix


print("[INFO] Loading movie dataset...")
DF, NORM_MATRIX = load_movies()
print(f"[INFO] Loaded {len(DF)} movies.")


# ─────────────────────────────────────────────
# CORE RECOMMENDATION LOGIC
# ─────────────────────────────────────────────
def average_emotion_vectors(members: list[dict]) -> np.ndarray:
    """
    members: list of dicts, each with key 'emotions': {emotion_name: float 0-10}
    Returns averaged, L2-normalized vector of shape (len(EMOTIONS),)
    """
    vectors = []
    for m in members:
        emotions = m.get("emotions", {})
        vec = np.array([float(emotions.get(e, 0)) / 10.0 for e in EMOTIONS])
        vectors.append(vec)

    avg = np.mean(vectors, axis=0)
    norm = np.linalg.norm(avg)
    if norm == 0:
        return avg
    return avg / norm


def apply_filters(df: pd.DataFrame, filters: dict) -> np.ndarray:
    """
    filters: {
        "eras": ["old", "mid", "new"],   # subset, empty = all
        "min_imdb": 0.0,
        "genres": ["Action", "Drama"],   # empty = all (OR logic)
    }
    Returns boolean mask array.
    """
    mask = np.ones(len(df), dtype=bool)

    # Era filter
    eras = filters.get("eras", [])
    if eras:
        era_mask = np.zeros(len(df), dtype=bool)
        for era in eras:
            if era in RELEASE_BINS:
                fn = RELEASE_BINS[era]
                era_mask |= df["year"].apply(
                    lambda y: fn(int(y)) if not pd.isna(y) else False
                ).to_numpy()
        mask &= era_mask

    # IMDB filter
    min_imdb = float(filters.get("min_imdb", 0.0))
    if min_imdb > 0 and "imdb" in df.columns:
        mask &= (df["imdb"].fillna(0) >= min_imdb).to_numpy()

    # Genre filter (OR: movie must contain at least one selected genre)
    genres = filters.get("genres", [])
    if genres and "genres" in df.columns:
        genre_mask = np.zeros(len(df), dtype=bool)
        for genre in genres:
            genre_mask |= df["genres"].str.contains(genre, case=False, na=False).to_numpy()
        mask &= genre_mask

    return mask


def get_recommendations(members: list[dict], top_n: int = 5, filters: dict = None) -> list[dict]:
    """
    Core recommendation function.
    Returns list of top_n movies sorted by cosine similarity to group average.
    """
    if len(DF) == 0:
        return []

    filters = filters or {}
    user_unit = average_emotion_vectors(members)
    norm = np.linalg.norm(user_unit)
    if norm == 0:
        return []

    # Apply filters
    mask = apply_filters(DF, filters)
    if not mask.any():
        return []

    indices = np.where(mask)[0]
    similarities = NORM_MATRIX[indices].dot(user_unit)

    # Sort descending
    top_k = min(top_n, len(similarities))
    order = np.argsort(-similarities)[:top_k]

    results = []
    for rank, idx in enumerate(order):
        movie_i = indices[idx]
        row = DF.iloc[movie_i]
        results.append({
            "rank": rank + 1,
            "title": str(row.get("title", "Unknown")),
            "year": int(row["year"]) if not pd.isna(row.get("year")) else None,
            "genres": str(row.get("genres", "")),
            "imdb": float(row["imdb"]) if not pd.isna(row.get("imdb")) else None,
            "similarity": round(float(similarities[idx]), 4),
            "match_percent": round(float(similarities[idx]) * 100, 1),
            # Include top 3 dominant emotions for this movie
            "dominant_emotions": _get_dominant_emotions(row, n=3),
        })

    return results


def _get_dominant_emotions(row, n=3):
    scores = {e: float(row[e]) for e in EMOTIONS if e in row.index and not pd.isna(row[e])}
    top = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
    return [{"emotion": e, "score": round(s, 3)} for e, s in top]


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "movies_loaded": len(DF),
        "emotions_supported": EMOTIONS,
    })


@app.route("/recommend", methods=["POST"])
def recommend():
    """
    Request body (JSON):
    {
        "members": [
            {
                "name": "Alice",
                "emotions": {
                    "joy": 8, "sadness": 2, "fear": 3, ...
                }
            },
            ...
        ],
        "top_n": 5,
        "filters": {
            "eras": ["new"],
            "min_imdb": 7.0,
            "genres": ["Action", "Drama"]
        }
    }

    Response:
    {
        "recommendations": [...],
        "group_size": 2,
        "group_avg_emotions": {...},
        "filters_applied": {...}
    }
    """
    try:
        data = request.get_json(force=True)

        members = data.get("members", [])
        if not members:
            return jsonify({"error": "No members provided"}), 400
        if len(members) > 10:
            return jsonify({"error": "Maximum 10 members allowed"}), 400

        # Validate members
        for i, m in enumerate(members):
            if "emotions" not in m:
                return jsonify({"error": f"Member {i} missing 'emotions' field"}), 400
            if not isinstance(m["emotions"], dict):
                return jsonify({"error": f"Member {i} emotions must be a dict"}), 400

        top_n = int(data.get("top_n", 5))
        top_n = max(1, min(top_n, 50))  # Clamp between 1 and 50

        filters = data.get("filters", {})

        recommendations = get_recommendations(members, top_n=top_n, filters=filters)

        # Compute group average emotions for display
        avg_emotions = {}
        for e in EMOTIONS:
            vals = [m["emotions"].get(e, 0) for m in members]
            avg_emotions[e] = round(sum(vals) / len(vals), 2)

        return jsonify({
            "recommendations": recommendations,
            "group_size": len(members),
            "top_n": top_n,
            "group_avg_emotions": avg_emotions,
            "filters_applied": filters,
        })

    except Exception as ex:
        return jsonify({"error": str(ex)}), 500


@app.route("/movies", methods=["GET"])
def movies():
    """
    Query params:
        limit   (int, default 20)
        offset  (int, default 0)
        genre   (str, optional)
        min_imdb (float, optional)
        era     (str: old|mid|new, optional)
        search  (str, optional - title search)
    """
    try:
        if len(DF) == 0:
            return jsonify({"movies": [], "total": 0})

        df = DF.copy()

        # Filters
        genre = request.args.get("genre", "")
        if genre:
            df = df[df["genres"].str.contains(genre, case=False, na=False)]

        min_imdb = request.args.get("min_imdb", type=float)
        if min_imdb is not None:
            df = df[df["imdb"].fillna(0) >= min_imdb]

        era = request.args.get("era", "")
        if era and era in RELEASE_BINS:
            fn = RELEASE_BINS[era]
            df = df[df["year"].apply(lambda y: fn(int(y)) if not pd.isna(y) else False)]

        search = request.args.get("search", "")
        if search:
            df = df[df["title"].str.contains(search, case=False, na=False)]

        total = len(df)
        limit = min(int(request.args.get("limit", 20)), 100)
        offset = int(request.args.get("offset", 0))
        df = df.iloc[offset:offset + limit]

        records = []
        for _, row in df.iterrows():
            records.append({
                "title": str(row.get("title", "")),
                "year": int(row["year"]) if not pd.isna(row.get("year")) else None,
                "genres": str(row.get("genres", "")),
                "imdb": float(row["imdb"]) if not pd.isna(row.get("imdb")) else None,
            })

        return jsonify({"movies": records, "total": total, "limit": limit, "offset": offset})

    except Exception as ex:
        return jsonify({"error": str(ex)}), 500


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
