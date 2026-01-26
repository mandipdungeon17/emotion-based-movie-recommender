# 🎬 Emotion-Based Movie Recommender

A **human-centric movie recommendation system** that suggests movies based on **how you feel** and **what emotional experience you want**, rather than just genre or ratings.

Instead of asking *"Action or Comedy?"*, this system asks:
> **"Do you want comfort, adrenaline, emotional depth, or inspiration today?"**

---

## ✨ Key Features

- 🎯 **Intent-based recommendations**
  - Why are you watching? (adrenaline, comfort, fun, catharsis, inspiration…)

- 🌗 **Emotion cluster selection**
  - Broad mood buckets like:
    - `dark_intensity`
    - `emotional_pain`
    - `positive_energy`
    - `engagement`
    - `meaning_growth`

- 🎚️ **Fine-grained emotion tuning**
  - Adjust specific emotions like `fear`, `joy`, `regret`, `hope`, `compassion`
  - Friendly aliases supported: `suspense`, `pride`, `acceptance`, `despair`, `shock`

- 🧠 **Explainable emotion vectors**
  - Every movie and user mood is represented as a **24-dimensional normalized emotion vector**
  - No black-box ML

- ⚡ **Fast & scalable**
  - Uses NumPy vector math
  - Scales from **50 → 20,000+ movies**
  - No backend required

- 🧩 **UI-ready**
  - Designed to map cleanly to sliders, toggles, and buttons (React-friendly)

---

## 🧠 How It Works (Concept)

Each movie is represented as a vector of **24 emotions**:

```
joy, sadness, fear, anger, disgust, surprise,
trust, anticipation, curiosity, excitement,
hope, love, guilt, shame, gratitude, loneliness,
confidence, determination, regret, relief,
nostalgia, compassion, anxiety, inspiration
```

User input is collected at **three levels**:

1. **Intents** → why the user is watching  
2. **Emotion clusters** → overall mood  
3. **Individual emotions** → fine tuning  

All inputs are merged → normalized → compared using a **dot product** against movie emotion vectors.

> 🎯 Higher dot product = better emotional match

---

## 📁 Project Structure

```
emotion-based-movie-recommender/
│
├── movies_emotions_50.csv      # Movie dataset with emotion vectors
├── movie_emotion_engine.py     # Single-file recommendation engine
└── README.md                   # Project documentation
```

---

## ▶️ How to Run

### 1️⃣ Install dependencies
```bash
pip install pandas numpy
```

### 2️⃣ Run the recommender
```bash
python movie_emotion_engine.py
```

---

## 🧪 Example Interaction

```
🎯 STEP 1: WHY are you watching?
> adrenaline, fun

🌗 STEP 2: WHAT kind of mood?
> emotional_pain, engagement

🎚️ STEP 3: Fine-tune emotions
> compassion=0.3, suspense=0.6, regret=1.0

🧠 Your emotional state:
regret        : 0.28
anticipation : 0.17
surprise     : 0.14
joy          : 0.14
confidence   : 0.11
fear         : 0.08
compassion  : 0.08

🎯 Recommended Movies:
La La Land            -> match score: 0.236
Inception             -> match score: 0.225
Titanic               -> match score: 0.194
Avengers: Endgame     -> match score: 0.172
John Wick             -> match score: 0.147
```

---

## 📊 Dataset

* 50 real, well-known movies (Hollywood-focused for now)
* Each movie contains:
  * IMDb rating
  * Genres
  * Intent labels
  * Emotion clusters
  * **24-dimensional normalized emotion vector**

> The system is designed to scale easily to **500–20,000 movies** using the same structure.

---

## 🚀 Future Enhancements

* 🎨 React UI (sliders + toggles)
* ⭐ IMDb / Rotten Tomatoes weighted scoring
* 🧠 "Why this movie matched you" explanation
* 📈 Learning weights from user clicks
* 🌍 Multi-language / regional datasets

---

## 🧩 Philosophy

This project prioritizes:

* **Human emotion over rigid categories**
* **Explainability over black-box ML**
* **User mood over historical behavior**

Think of it as:

> *"Netflix recommendations if emotions were first-class citizens."*

---

## 🙌 Contributing

Ideas, improvements, and extensions are welcome.
This project is intentionally designed to be simple, transparent, and hackable.
```

***

This is now properly formatted GitHub-flavored Markdown ready to save as `README.md`. All code blocks, lists, emojis, and spacing are optimized for GitHub rendering.

Would you like me to add badges, a demo GIF section, or any other common README elements?
