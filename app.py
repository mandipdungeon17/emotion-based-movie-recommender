"""
CinEmotion - Flask Backend API
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
import uuid
import threading
import time
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_file, abort
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow React frontend (any origin) to call this API

# ─────────────────────────────────────────────
# SERVER-SIDE ROOM MANAGEMENT
# ─────────────────────────────────────────────
ROOMS = {}                     # room_id -> room dict
rooms_lock = threading.Lock()  # thread safety for concurrent polling
MAX_MEMBERS_PER_ROOM = 10

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "datasets", "movies_dataset_500.csv")

# Folder containing movie poster images (e.g. "Inception.jpg")
POSTER_PATH = os.path.join(BASE_DIR, "movie_posters")

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
# EMOTION-AWARE GROUP AGGREGATION
# ─────────────────────────────────────────────
#
# We implement four strategies from social choice theory
# (Felfernig et al., Group Recommender Systems, 2018)
# adapted to emotion vectors instead of item ratings.
#
#  avg          – simple average (baseline)
#  least_misery – for each emotion, take the MINIMUM across members
#                 → no one gets a movie that clashes with their mood
#  most_pleasure– for each emotion, take the MAXIMUM across members
#                 → at least one person will love the result
#  avg_no_misery– average only if NO member scores the emotion below
#                 a misery threshold; otherwise zero that dimension out
#                 → consensus with a veto
#  weighted_avg – members weighted by their emotional intensity
#                 (people who feel stronger emotions pull the group more)

MISERY_THRESHOLD = 2.0   # out of 10 — below this = "this emotion upsets me"


def _member_vectors(members):
    """Return list of raw (0-10) emotion numpy arrays, one per member."""
    vecs = []
    for m in members:
        emo = m.get("emotions", {})
        vecs.append(np.array([float(emo.get(e, 0)) for e in EMOTIONS]))
    return vecs


def _normalise(vec):
    n = np.linalg.norm(vec)
    return vec / n if n > 0 else vec


def aggregate_avg(vecs):
    """Simple average — baseline."""
    return _normalise(np.mean(vecs, axis=0))


def aggregate_least_misery(vecs):
    """
    Per emotion, take the minimum score across all members.
    Ensures no member is matched to a film that triggers a mood they
    explicitly don't want (e.g. one person low on fear ⇒ no horror).
    Best for groups where one member has strong aversions.
    """
    return _normalise(np.min(vecs, axis=0))


def aggregate_most_pleasure(vecs):
    """
    Per emotion, take the maximum score across all members.
    Optimises for at least one person being very satisfied.
    Best for groups where you want to honour someone's strong desire.
    """
    return _normalise(np.max(vecs, axis=0))


def aggregate_avg_no_misery(vecs):
    """
    Average without misery: compute average, but for any emotion where
    ANY member scores below MISERY_THRESHOLD, zero that dimension out.
    This is a veto: a member in a strongly anti-X mood prevents X-heavy
    films from being recommended, even if others want them.
    Best for balanced groups where nobody should feel excluded.
    """
    matrix = np.stack(vecs, axis=0)           # shape (n_members, n_emotions)
    avg = np.mean(matrix, axis=0)
    mins = np.min(matrix, axis=0)
    # Zero out any emotion dimension where someone is below threshold
    avg[mins < MISERY_THRESHOLD] = 0.0
    return _normalise(avg)


def aggregate_weighted_avg(vecs):
    """
    Weighted average by emotional intensity.
    Members with stronger overall emotions (higher L2 norm) pull the
    group vector more — they 'feel more' so their mood matters more.
    Useful when group members have very different intensity levels.
    """
    weights = np.array([np.linalg.norm(v) for v in vecs])
    if weights.sum() == 0:
        return aggregate_avg(vecs)
    weights = weights / weights.sum()
    weighted = sum(w * v for w, v in zip(weights, vecs))
    return _normalise(weighted)


AGGREGATION_STRATEGIES = {
    "avg":           aggregate_avg,
    "least_misery":  aggregate_least_misery,
    "most_pleasure": aggregate_most_pleasure,
    "avg_no_misery": aggregate_avg_no_misery,
    "weighted_avg":  aggregate_weighted_avg,
}

STRATEGY_LABELS = {
    "avg":           "Simple Average",
    "least_misery":  "Least Misery — no one gets a clashing mood",
    "most_pleasure": "Most Pleasure — honours strongest desires",
    "avg_no_misery": "Average without Misery — consensus with veto",
    "weighted_avg":  "Intensity-Weighted Average",
}


def build_group_vector(members, strategy="avg_no_misery"):
    """
    Build a normalised group emotion vector using the chosen strategy.
    Falls back to 'avg' if strategy is unknown.
    Single-member groups always use plain average (strategies are identical).
    """
    vecs = _member_vectors(members)
    if len(vecs) == 1:
        return _normalise(vecs[0])
    fn = AGGREGATION_STRATEGIES.get(strategy, aggregate_avg)
    return fn(vecs)


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


def get_recommendations(members: list[dict], top_n: int = 5,
                        filters: dict = None, strategy: str = "avg_no_misery") -> list[dict]:
    """
    Core recommendation function.
    strategy: one of avg | least_misery | most_pleasure | avg_no_misery | weighted_avg
    Returns list of top_n movies sorted by cosine similarity to the group vector.
    """
    if len(DF) == 0:
        return []

    filters = filters or {}
    group_vec = build_group_vector(members, strategy=strategy)
    if np.linalg.norm(group_vec) == 0:
        return []

    # Apply filters
    mask = apply_filters(DF, filters)
    if not mask.any():
        return []

    indices = np.where(mask)[0]
    similarities = NORM_MATRIX[indices].dot(group_vec)

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

        strategy = data.get("strategy", "avg_no_misery")
        if strategy not in AGGREGATION_STRATEGIES:
            strategy = "avg_no_misery"

        recommendations = get_recommendations(
            members, top_n=top_n, filters=filters, strategy=strategy
        )

        # Per-emotion display: show true avg and also per-member spread
        avg_emotions = {}
        spread_emotions = {}   # std dev per emotion — useful to show disagreement
        for e in EMOTIONS:
            vals = [float(m["emotions"].get(e, 0)) for m in members]
            avg_emotions[e] = round(sum(vals) / len(vals), 2)
            if len(vals) > 1:
                mean = avg_emotions[e]
                std = (sum((v - mean)**2 for v in vals) / len(vals)) ** 0.5
                spread_emotions[e] = round(std, 2)

        return jsonify({
            "recommendations": recommendations,
            "group_size": len(members),
            "top_n": top_n,
            "strategy": strategy,
            "strategy_label": STRATEGY_LABELS.get(strategy, strategy),
            "group_avg_emotions": avg_emotions,
            "group_emotion_spread": spread_emotions,
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
# POSTER ROUTES
# ─────────────────────────────────────────────

@app.route("/posters-debug", methods=["GET"])
def posters_debug():
    """Lists all files found in POSTER_PATH so you can verify filenames."""
    if not os.path.isdir(POSTER_PATH):
        return jsonify({"error": "POSTER_PATH does not exist", "path": POSTER_PATH}), 500
    files = sorted(os.listdir(POSTER_PATH))
    return jsonify({"path": POSTER_PATH, "count": len(files), "files": files})


@app.route("/posters/<path:title>", methods=["GET"])
def poster(title):
    """
    Serve a movie poster by movie title.

    Filenames in the folder follow the pattern: Title_Year.jpg
    e.g. "The Social Network" → "The_Social_Network_2010.jpg"

    Strategy:
      1. Decode the title from the URL
      2. Convert spaces → underscores
      3. Scan the folder for any file that STARTS WITH that slug
         (this handles the _YEAR suffix without needing the year)
      4. Return the first match, or 404
    """
    from urllib.parse import unquote

    if not os.path.isdir(POSTER_PATH):
        abort(404)

    # Normalise: URL-decode, strip whitespace, replace spaces with underscores
    decoded = unquote(title).strip()
    slug = decoded.replace(" ", "_")

    # Scan directory for a filename starting with this slug
    for fname in os.listdir(POSTER_PATH):
        name, ext = os.path.splitext(fname)
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        # Match: filename starts with slug (case-insensitive)
        if name.lower().startswith(slug.lower()):
            return send_file(os.path.join(POSTER_PATH, fname))

    abort(404)


# ─────────────────────────────────────────────
# ROOM HELPERS
# ─────────────────────────────────────────────

def _gen_room_id():
    """Generate a unique 6-char uppercase room code."""
    while True:
        rid = uuid.uuid4().hex[:6].upper()
        if rid not in ROOMS:
            return rid


def _default_emotions():
    """Return a dict of all 24 emotions set to 5."""
    return {e: 5 for e in EMOTIONS}


def _default_filters():
    """Return a default (empty) filters dict for a new member."""
    return {"eras": [], "min_imdb": 0, "genres": []}


def _aggregate_member_filters(members):
    """
    Aggregate per-member filters for recommendation.
    - eras: union of all members' selected eras
    - genres: union of all members' selected genres
    - min_imdb: minimum of all members' min_imdb values (most inclusive)
    """
    all_eras = set()
    all_genres = set()
    min_imdbs = []
    for m in members:
        f = m.get("filters", _default_filters())
        for era in f.get("eras", []):
            all_eras.add(era)
        for genre in f.get("genres", []):
            all_genres.add(genre)
        val = float(f.get("min_imdb", 0))
        if val > 0:
            min_imdbs.append(val)
    return {
        "eras": sorted(all_eras),
        "genres": sorted(all_genres),
        "min_imdb": min(min_imdbs) if min_imdbs else 0,
    }


def _find_member(room, member_id):
    """Find a member in a room by their ID. Returns (index, member) or (-1, None)."""
    for i, m in enumerate(room["members"]):
        if m["id"] == member_id:
            return i, m
    return -1, None


def _room_response(room, member_id=None):
    """Build the JSON-safe room state for a client."""
    ready_count = sum(1 for m in room["members"] if m.get("ready"))
    return {
        "id": room["id"],
        "admin_id": room["admin_id"],
        "strategy": room["strategy"],
        "top_n": room["top_n"],
        "members": room["members"],
        "results": room["results"],
        "member_count": len(room["members"]),
        "ready_count": ready_count,
        "is_admin": member_id == room["admin_id"] if member_id else False,
    }


# ─────────────────────────────────────────────
# ROOM ROUTES
# ─────────────────────────────────────────────

@app.route("/rooms/create", methods=["POST"])
def create_room():
    """Create a new room. Caller becomes admin."""
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    with rooms_lock:
        room_id = _gen_room_id()
        member_id = str(uuid.uuid4())
        room = {
            "id": room_id,
            "admin_id": member_id,
            "strategy": "avg_no_misery",
            "top_n": 5,
            "members": [{
                "id": member_id,
                "name": name,
                "emotions": _default_emotions(),
                "filters": _default_filters(),
                "ready": False,
            }],
            "results": None,
            "created_at": time.time(),
        }
        ROOMS[room_id] = room

    return jsonify({
        "room_id": room_id,
        "member_id": member_id,
        "is_admin": True,
    })


@app.route("/rooms/<room_id>/join", methods=["POST"])
def join_room(room_id):
    """Join an existing room."""
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404
        if len(room["members"]) >= MAX_MEMBERS_PER_ROOM:
            return jsonify({"error": "Room is full"}), 400
        for m in room["members"]:
            if m["name"].lower() == name.lower():
                return jsonify({"error": "Name already taken in this room"}), 400

        member_id = str(uuid.uuid4())
        room["members"].append({
            "id": member_id,
            "name": name,
            "emotions": _default_emotions(),
            "filters": _default_filters(),
            "ready": False,
        })

    return jsonify({
        "room_id": room_id,
        "member_id": member_id,
        "is_admin": False,
    })


@app.route("/rooms/<room_id>/leave", methods=["POST"])
def leave_room(room_id):
    """Leave a room. If admin leaves, promote next member. If empty, delete room."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"ok": True})

        idx, _ = _find_member(room, member_id)
        if idx == -1:
            return jsonify({"ok": True})

        room["members"].pop(idx)

        if len(room["members"]) == 0:
            del ROOMS[room_id]
        elif room["admin_id"] == member_id:
            room["admin_id"] = room["members"][0]["id"]

    return jsonify({"ok": True})


@app.route("/rooms/<room_id>", methods=["GET"])
def get_room(room_id):
    """Poll room state. Called every 2.5s by all clients."""
    member_id = request.args.get("member_id")

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404

        _, member = _find_member(room, member_id)
        if not member:
            return jsonify({"error": "You are not in this room"}), 403

        return jsonify(_room_response(room, member_id))


@app.route("/rooms/<room_id>/emotions", methods=["PUT"])
def update_emotions(room_id):
    """Update the calling member's emotions."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")
    emotions = data.get("emotions", {})

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404

        idx, _ = _find_member(room, member_id)
        if idx == -1:
            return jsonify({"error": "Not in room"}), 403

        clean = {}
        for e in EMOTIONS:
            val = float(emotions.get(e, 5))
            clean[e] = max(0, min(10, val))
        room["members"][idx]["emotions"] = clean

    return jsonify({"ok": True})


@app.route("/rooms/<room_id>/settings", methods=["PUT"])
def update_settings(room_id):
    """Update room settings. Only admin can change strategy and top_n."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404

        idx, _ = _find_member(room, member_id)
        if idx == -1:
            return jsonify({"error": "Not in room"}), 403

        is_admin = room["admin_id"] == member_id

        # Strategy and top_n: admin only
        if "strategy" in data:
            if not is_admin:
                return jsonify({"error": "Only the admin can change strategy"}), 403
            s = data["strategy"]
            if s in AGGREGATION_STRATEGIES:
                room["strategy"] = s
        if "top_n" in data:
            if not is_admin:
                return jsonify({"error": "Only the admin can change top_n"}), 403
            room["top_n"] = max(1, min(50, int(data["top_n"])))

    return jsonify({"ok": True})


@app.route("/rooms/<room_id>/filters", methods=["PUT"])
def update_member_filters(room_id):
    """Update the calling member's own filters."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")
    filters = data.get("filters", {})

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404

        idx, _ = _find_member(room, member_id)
        if idx == -1:
            return jsonify({"error": "Not in room"}), 403

        room["members"][idx]["filters"] = {
            "eras": filters.get("eras", []),
            "min_imdb": float(filters.get("min_imdb", 0)),
            "genres": filters.get("genres", []),
        }

    return jsonify({"ok": True})


@app.route("/rooms/<room_id>/ready", methods=["PUT"])
def toggle_ready(room_id):
    """Toggle the calling member's ready status."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")
    ready = data.get("ready", True)

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404

        idx, _ = _find_member(room, member_id)
        if idx == -1:
            return jsonify({"error": "Not in room"}), 403

        room["members"][idx]["ready"] = bool(ready)

    return jsonify({"ok": True})


@app.route("/rooms/<room_id>/recommend", methods=["POST"])
def room_recommend(room_id):
    """Admin triggers recommendation. Results stored on room for all members."""
    data = request.get_json(force=True)
    member_id = data.get("member_id")

    with rooms_lock:
        room = ROOMS.get(room_id)
        if not room:
            return jsonify({"error": "Room not found"}), 404
        if room["admin_id"] != member_id:
            return jsonify({"error": "Only the admin can get recommendations"}), 403

        members = list(room["members"])
        strategy = room["strategy"]
        top_n = room["top_n"]

    # Aggregate per-member filters (union of eras/genres, min of min_imdb)
    filters = _aggregate_member_filters(members)

    # Run recommendation OUTSIDE the lock (CPU-intensive, no mutation)
    recommendations = get_recommendations(
        members, top_n=top_n, filters=filters, strategy=strategy
    )

    avg_emotions = {}
    spread_emotions = {}
    for e in EMOTIONS:
        vals = [float(m["emotions"].get(e, 0)) for m in members]
        avg_emotions[e] = round(sum(vals) / len(vals), 2)
        if len(vals) > 1:
            mean = avg_emotions[e]
            std = (sum((v - mean)**2 for v in vals) / len(vals)) ** 0.5
            spread_emotions[e] = round(std, 2)

    result_data = {
        "recommendations": recommendations,
        "group_size": len(members),
        "top_n": top_n,
        "strategy": strategy,
        "strategy_label": STRATEGY_LABELS.get(strategy, strategy),
        "group_avg_emotions": avg_emotions,
        "group_emotion_spread": spread_emotions,
        "filters_applied": filters,
    }

    with rooms_lock:
        room = ROOMS.get(room_id)
        if room:
            room["results"] = result_data

    return jsonify({"ok": True, "results": result_data})


# ─────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)