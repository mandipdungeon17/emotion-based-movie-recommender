import math
from collections import defaultdict

# ============================================================
# 1. BASE EMOTIONS (GROUND TRUTH)
# ============================================================

BASE_EMOTIONS = [
    "joy", "love", "relief", "pride", "gratitude",
    "hope", "compassion", "acceptance", "trust",
    "sadness", "despair", "loneliness", "guilt", "shame",
    "fear", "anger", "hatred", "shock",
    "surprise", "curiosity", "suspense",
    "determination", "confidence", "regret"
]

# ============================================================
# 2. EMOTION CLUSTERS (BULK SELECTORS)
# ============================================================

EMOTION_CLUSTERS = {
    "dark_intensity": ["fear", "anger", "hatred", "shock"],
    "emotional_pain": ["sadness", "despair", "loneliness", "guilt", "shame"],
    "positive_energy": ["joy", "love", "relief", "pride", "gratitude"],
    "meaning_growth": ["hope", "redemption", "compassion", "acceptance", "trust"],
    "engagement": ["surprise", "curiosity", "suspense", "determination", "confidence"]
}

# ============================================================
# 3. VIEWER INTENTS (WHY USER IS WATCHING)
# ============================================================

INTENTS = {
    "adrenaline": {
        "fear": 0.3,
        "suspense": 0.3,
        "surprise": 0.2,
        "confidence": 0.2
    },
    "comfort": {
        "joy": 0.4,
        "love": 0.3,
        "relief": 0.3
    },
    "catharsis": {
        "sadness": 0.4,
        "despair": 0.3,
        "regret": 0.3
    },
    "fun": {
        "joy": 0.5,
        "surprise": 0.3,
        "confidence": 0.2
    },
    "contemplation": {
        "curiosity": 0.4,
        "sadness": 0.3,
        "hope": 0.3
    },
    "inspiration": {
        "hope": 0.4,
        "confidence": 0.3,
        "acceptance": 0.3
    }
}

# ============================================================
# 4. MOVIE DATASET (20 MOVIES, EMOTION VECTORS)
# ============================================================

MOVIES = [
    {
        "title": "The Dark Knight",
        "emotions": {
            "fear": 0.8, "anger": 0.7, "sadness": 0.4,
            "confidence": 0.6, "hope": 0.3
        }
    },
    {
        "title": "Joker",
        "emotions": {
            "fear": 0.9, "sadness": 0.85, "loneliness": 0.7,
            "anger": 0.8, "shock": 0.75
        }
    },
    {
        "title": "Inception",
        "emotions": {
            "curiosity": 0.8, "suspense": 0.7,
            "fear": 0.5, "confidence": 0.6
        }
    },
    {
        "title": "Interstellar",
        "emotions": {
            "hope": 0.8, "sadness": 0.6,
            "curiosity": 0.7, "love": 0.5
        }
    },
    {
        "title": "Titanic",
        "emotions": {
            "love": 0.9, "sadness": 0.85,
            "hope": 0.6, "regret": 0.7
        }
    },
    {
        "title": "Forrest Gump",
        "emotions": {
            "joy": 0.8, "hope": 0.75,
            "sadness": 0.5, "love": 0.7
        }
    },
    {
        "title": "John Wick",
        "emotions": {
            "anger": 0.9, "fear": 0.7,
            "confidence": 0.8, "hatred": 0.6
        }
    },
    {
        "title": "Gladiator",
        "emotions": {
            "anger": 0.8, "pride": 0.7,
            "sadness": 0.6, "hope": 0.5
        }
    },
    {
        "title": "La La Land",
        "emotions": {
            "joy": 0.7, "love": 0.8,
            "sadness": 0.6, "regret": 0.5
        }
    },
    {
        "title": "Avengers: Endgame",
        "emotions": {
            "confidence": 0.8, "hope": 0.7,
            "sadness": 0.6, "joy": 0.6
        }
    },
    # ---- Add 10 more lightweight entries ----
    {"title": "Avatar", "emotions": {"curiosity": 0.8, "hope": 0.6}},
    {"title": "The Matrix", "emotions": {"curiosity": 0.9, "fear": 0.5}},
    {"title": "Parasite", "emotions": {"shock": 0.8, "sadness": 0.6}},
    {"title": "Whiplash", "emotions": {"anger": 0.7, "confidence": 0.8}},
    {"title": "Her", "emotions": {"love": 0.8, "loneliness": 0.7}},
    {"title": "Fight Club", "emotions": {"anger": 0.8, "hatred": 0.6}},
    {"title": "The Shawshank Redemption", "emotions": {"hope": 0.9, "sadness": 0.6}},
    {"title": "Se7en", "emotions": {"fear": 0.85, "shock": 0.8}},
    {"title": "The Pursuit of Happyness", "emotions": {"hope": 0.85, "sadness": 0.7}},
    {"title": "Mad Max: Fury Road", "emotions": {"adrenaline": 0.9}}
]

# ============================================================
# 5. VECTOR UTILITIES
# ============================================================

def normalize(vec):
    total = sum(vec.values())
    if total == 0:
        return vec
    return {k: v / total for k, v in vec.items()}

def dot_product(v1, v2):
    return sum(v1[e] * v2.get(e, 0) for e in v1)

def cosine_similarity(v1, v2):
    num = dot_product(v1, v2)
    den = math.sqrt(dot_product(v1, v1)) * math.sqrt(dot_product(v2, v2))
    return num / den if den else 0.0

# ============================================================
# 6. USER INPUT → EMOTION VECTOR
# ============================================================

def build_user_vector():
    user_vec = defaultdict(float)

    print("\n--- Select Intents (comma separated) ---")
    print(", ".join(INTENTS.keys()))
    intents = input("> ").lower().split(",")

    for intent in intents:
        intent = intent.strip()
        if intent in INTENTS:
            for emo, w in INTENTS[intent].items():
                user_vec[emo] += w

    print("\n--- Select Emotion Clusters (cluster=weight) ---")
    print(", ".join(EMOTION_CLUSTERS.keys()))
    cluster_input = input("> ").split(",")

    for item in cluster_input:
        if "=" in item:
            cluster, weight = item.split("=")
            cluster = cluster.strip()
            weight = float(weight.strip())
            emotions = EMOTION_CLUSTERS.get(cluster, [])
            if emotions:
                per = weight / len(emotions)
                for e in emotions:
                    user_vec[e] += per

    print("\n--- Fine tune individual emotions (emotion=weight) ---")
    print(", ".join(BASE_EMOTIONS))
    emo_input = input("> ").split(",")

    for item in emo_input:
        if "=" in item:
            e, w = item.split("=")
            user_vec[e.strip()] = float(w.strip())

    return normalize(user_vec)

# ============================================================
# 7. RECOMMENDATION ENGINE
# ============================================================

def recommend(user_vec, top_n=5):
    scored = []
    for movie in MOVIES:
        score = dot_product(user_vec, movie["emotions"])
        scored.append((movie["title"], score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_n]

# ============================================================
# 8. MAIN
# ============================================================

if __name__ == "__main__":
    print("\n🎬 Emotion-Based Movie Recommender")
    user_vector = build_user_vector()

    print("\nYour emotion vector:")
    for k, v in sorted(user_vector.items(), key=lambda x: -x[1]):
        print(f"{k:15s} : {v:.2f}")

    print("\n🎯 Recommended Movies:")
    results = recommend(user_vector)
    for title, score in results:
        print(f"{title:30s} -> match score: {score:.3f}")
