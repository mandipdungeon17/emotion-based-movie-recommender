import pandas as pd
import numpy as np
from collections import defaultdict
import subprocess
import sys
import os

CSV_FILE = "movies_emotions_50.csv"
VALIDATOR_FILE = "validate_csv.py"

# =========================================================
# CANONICAL EMOTION SPACE (24D)
# =========================================================

EMOTIONS = [
    "joy","sadness","fear","anger","disgust","surprise",
    "trust","anticipation","curiosity","excitement",
    "hope","love","guilt","shame","gratitude","loneliness",
    "confidence","determination","regret","relief",
    "nostalgia","compassion","anxiety","inspiration"
]

# =========================================================
# FRIENDLY ALIASES (UX → INTERNAL MAPPING)
# =========================================================

EMOTION_ALIASES = {
    "suspense": {"anticipation": 0.6, "anxiety": 0.4},
    "pride": {"confidence": 1.0},
    "acceptance": {"relief": 0.6, "trust": 0.4},
    "despair": {"sadness": 0.6, "loneliness": 0.4},
    "hatred": {"anger": 1.0},
    "shock": {"surprise": 1.0}
}

# =========================================================
# INTENTS → EMOTIONS
# =========================================================

INTENT_MAP = {
    "adrenaline": {"fear": 0.4, "excitement": 0.4, "anger": 0.2},
    "comfort": {"joy": 0.4, "love": 0.3, "relief": 0.3},
    "catharsis": {"sadness": 0.4, "regret": 0.3, "hope": 0.3},
    "fun": {"joy": 0.5, "surprise": 0.3, "excitement": 0.2},
    "contemplation": {"curiosity": 0.4, "sadness": 0.3, "hope": 0.3},
    "inspiration": {"hope": 0.4, "confidence": 0.3, "determination": 0.3}
}

# =========================================================
# EMOTION CLUSTERS → EMOTIONS
# =========================================================

CLUSTER_MAP = {
    "dark_intensity": {
        "fear": 0.35, "anger": 0.30, "anxiety": 0.20, "disgust": 0.15
    },
    "emotional_pain": {
        "sadness": 0.40, "loneliness": 0.25, "regret": 0.20, "guilt": 0.15
    },
    "positive_energy": {
        "joy": 0.40, "love": 0.30, "gratitude": 0.20, "relief": 0.10
    },
    "engagement": {
        "curiosity": 0.35, "anticipation": 0.30, "surprise": 0.20, "excitement": 0.15
    },
    "meaning_growth": {
        "hope": 0.35, "confidence": 0.25, "determination": 0.25, "inspiration": 0.15
    }
}

# =========================================================
# UTILITIES
# =========================================================

def normalize(vec):
    total = sum(vec.values())
    return {k: v / total for k, v in vec.items()} if total > 0 else vec

def print_top_emotions(vec, top_n=7):
    print("\n🧠 Your emotional state (top influences):")
    print("-" * 45)
    for e, v in sorted(vec.items(), key=lambda x: x[1], reverse=True)[:top_n]:
        print(f"{e:<18}: {v:.2f}")

# =========================================================
# USER INPUT
# =========================================================

def get_user_vector():
    vec = defaultdict(float)

    print("\n🎬 Emotion-Based Movie Recommender")
    print("=" * 70)
    print("You can skip any step by pressing ENTER.")
    print("Start broad → refine → fine-tune.\n")

    # ---------------- STEP 1: INTENTS ----------------
    print("🎯 STEP 1: WHY are you watching?")
    print("Available intents:")
    print(", ".join(INTENT_MAP.keys()))
    print("Example: adrenaline, fun")

    raw = input("> ").strip()
    if raw:
        for intent in raw.split(","):
            intent = intent.strip()
            if intent not in INTENT_MAP:
                sys.exit(f"❌ Unknown intent: {intent}")
            for e, w in INTENT_MAP[intent].items():
                vec[e] += w

    # ---------------- STEP 2: CLUSTERS ----------------
    print("\n🌗 STEP 2: WHAT kind of mood?")
    print("Emotion clusters:")
    print(", ".join(CLUSTER_MAP.keys()))
    print("Example: emotional_pain, engagement")

    raw = input("> ").strip()
    if raw:
        for cluster in raw.split(","):
            cluster = cluster.strip()
            if cluster not in CLUSTER_MAP:
                sys.exit(f"❌ Unknown cluster: {cluster}")
            for e, w in CLUSTER_MAP[cluster].items():
                vec[e] += w

    # ---------------- STEP 3: INDIVIDUAL ----------------
    print("\n🎚️ STEP 3: Fine-tune emotions (optional)")
    print("\nValid emotions:")
    print(", ".join(EMOTIONS))
    print("\nFriendly aliases:")
    print(", ".join(EMOTION_ALIASES.keys()))
    print("\nFormat: emotion=weight")
    print("Example: compassion=0.3, suspense=0.6, regret=1.0")

    raw = input("> ").strip()
    if raw:
        for pair in raw.split(","):
            name, val = pair.strip().split("=")
            name = name.strip().lower()
            val = float(val)

            if name in EMOTION_ALIASES:
                for e, w in EMOTION_ALIASES[name].items():
                    vec[e] += w * val
            elif name in EMOTIONS:
                vec[name] += val
            else:
                sys.exit(f"❌ Unknown emotion: {name}")

    if not vec:
        sys.exit("❌ No input provided. Please select at least one option.")

    vec = normalize(vec)
    print_top_emotions(vec)

    # Optional full vector
    show_all = input("\nShow full emotion vector? (y/n): ").strip().lower()
    if show_all == "y":
        print("\nFull normalized emotion vector:")
        for e in EMOTIONS:
            print(f"{e:<15}: {vec.get(e, 0):.3f}")

    return np.array([vec.get(e, 0) for e in EMOTIONS])

# =========================================================
# RECOMMENDER
# =========================================================

def recommend(df, user_vec, top_k=5):
    movie_matrix = df[EMOTIONS].to_numpy()
    scores = movie_matrix @ user_vec
    df = df.copy()
    df["score"] = scores
    return df.sort_values("score", ascending=False).head(top_k)

# =========================================================
# MAIN
# =========================================================

def main():
    if not os.path.exists(CSV_FILE):
        sys.exit(f"❌ Dataset not found: {CSV_FILE}")

    print(f"\n📁 Dataset detected: {CSV_FILE}")
    print("Do you want to run CSV validation?")
    print("1 → Yes (recommended once)")
    print("2 → Skip")

    choice = input("> ").strip()

    if choice == "1":
        if not os.path.exists(VALIDATOR_FILE):
            sys.exit("❌ validate_csv.py not found")
        subprocess.run([sys.executable, VALIDATOR_FILE], check=True)

    df = pd.read_csv(CSV_FILE)

    user_vec = get_user_vector()
    results = recommend(df, user_vec)

    print("\n🎯 Recommended Movies (best emotional match):")
    print("-" * 70)
    for _, row in results.iterrows():
        print(f"{row['title']:<30} -> match score: {row['score']:.3f}")

    print("\nℹ️ Tips:")
    print("• Increase fear/anxiety → thrillers")
    print("• Increase joy/love → feel-good movies")
    print("• Mix sadness + hope → deep emotional dramas")
    print("=" * 70)

if __name__ == "__main__":
    main()
