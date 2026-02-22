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
├── datasets/
│   └── movies_dataset_500_souj.csv   # Movie dataset with emotion vectors (500 movies)
├── index.html                        # Web app UI
├── app.js                            # Web app logic (group recommender)
├── server.py                         # Local HTTP server for the web app
├── multi_user_recommender.py         # Multi-user GUI (Tkinter)
├── movies_emotions_50.csv            # Movie dataset with emotion vectors (legacy)
├── movie_emotion_engine.py            # Single-file recommendation engine
├── requirements.txt                  # Optional deps (pandas, numpy for GUI)
├── poster_scraper_tmdb.py            # Download movie posters (TMDB API)
├── movie_posters/                    # Downloaded posters (high-res, vertical)
└── README.md                         # Project documentation
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

## 🖼️ Movie poster scraper

Download **high-resolution vertical posters** for all 500 movies in the CSV into `movie_posters/`.

**Source: [The Movie Database (TMDB)](https://www.themoviedb.org/)** — free API, no cookies; posters are native vertical (2:3) and available in original resolution.

### Get a TMDB API key (free)

1. Register: [themoviedb.org/signup](https://www.themoviedb.org/signup)
2. Create an API key: [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (choose “Developer”)
3. Set the key in your environment:

   **Windows (cmd):**
   ```bash
   set TMDB_API_KEY=your_key_here
   ```
   **Windows (PowerShell):**
   ```powershell
   $env:TMDB_API_KEY="your_key_here"
   ```
   **macOS / Linux:**
   ```bash
   export TMDB_API_KEY=your_key_here
   ```

### Run the scraper

Uses only the Python standard library (no `pip` install needed).

```bash
python poster_scraper_tmdb.py
```

- Reads `datasets/movies_dataset_500_souj.csv` (title + year).
- Searches TMDB, downloads the **original** (highest-res) poster per movie.
- Saves to `movie_posters/` as `{title}_{year}.jpg` (or `.png`).
- Skips files that already exist (safe to re-run).
- Rate-limited to respect TMDB’s free tier (~40 requests / 10 sec).

---

## 🌐 Web App: Coastal Movies (Group Recommender)

A **web app** for the **multi-user** emotion-based movie recommender. Same logic as `multi_user_recommender.py`, using the dataset `datasets/movies_dataset_500_souj.csv`.

### Dependencies (virtual env)

The web server uses only the **Python standard library**. After activating your venv you do **not** need to install anything to run the web app:

```bash
.\gropu_rec\Scripts\activate   # or: source gropu_rec/bin/activate on macOS/Linux
python server.py
```

If you also run the Tkinter GUI (`multi_user_recommender.py`), install:

```bash
pip install pandas numpy
```

See `requirements.txt` for version hints.

### Run the web app

From the project root (with venv activated if you use one):

```bash
python server.py
```

Then open **http://localhost:8000** in your browser. The CSV is loaded from `datasets/movies_dataset_500_souj.csv`; the app must be served over HTTP (not opened as a file) so that the dataset can be fetched.

### Web app features

| Feature | Description |
|--------|-------------|
| **Coastal Retreat UI** | Teal/mint color palette for a calm, readable interface. |
| **Dynamic users** | Click **Add user** to add another set of emotion sliders; **Remove** to remove a user (at least one required). |
| **Emotion sliders** | 0–10 for each user — same 24 emotions as the Python app. |
| **Reset sliders** | Per user or **Reset all sliders**. |
| **Preview my top 3** | On each user card, see that user’s top 3 before computing the group. |
| **Group recommendations** | Per-user **Top 3** with similarity score; **Group Top 3** (averaged); **pairwise cosine similarity** matrix; **consensus coefficient**; **user → group** similarity and overlap with group top 3. |

### Methodology (matches Python)

- **Movie vectors:** Emotion columns from the CSV, row-normalized to unit vectors.
- **User vectors:** Sliders 0–10 → divide by 10, then unit-normalized.
- **Similarity:** Cosine (dot product of unit vectors).
- **Group vector:** Mean of each user’s *non*-unit scaled vector (0–1), then normalized; used for group top 3.
- **Consensus:** Mean of the upper triangle of the user–user cosine matrix (excluding diagonal).

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
