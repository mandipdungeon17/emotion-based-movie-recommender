# CineEmotion — Group Movie Recommender
## Full-Stack Setup Guide

```
project/
├── app.py                     ← Flask backend
├── movies_dataset_500.csv     ← Your movie dataset (place here)
├── movie-recommender.jsx      ← React frontend
└── README.md
```

---

## 1. Backend Setup (Flask)

### Install dependencies
```bash
pip install flask flask-cors pandas numpy
```

### Run the server
```bash
python app.py
```
API starts at **http://localhost:5000**

---

## 2. Frontend Setup (React)

### If using Claude.ai Artifacts
Paste the contents of `movie-recommender.jsx` directly into a Claude artifact.

### If using Create React App / Vite
```bash
npm create vite@latest cineemotion -- --template react
cd cineemotion
npm install
# Replace src/App.jsx with movie-recommender.jsx contents
npm run dev
```

---

## 3. API Endpoints

### `GET /health`
Check if the server is running and see how many movies are loaded.
```json
{
  "status": "ok",
  "movies_loaded": 500,
  "emotions_supported": ["joy", "sadness", ...]
}
```

---

### `POST /recommend`
Get group recommendations.

**Request:**
```json
{
  "members": [
    {
      "name": "Alice",
      "emotions": {
        "joy": 8, "sadness": 2, "fear": 3, "anger": 1,
        "disgust": 1, "surprise": 6, "trust": 7,
        "anticipation": 8, "curiosity": 7, "excitement": 9,
        "hope": 8, "love": 6, "guilt": 1, "shame": 1,
        "gratitude": 7, "loneliness": 2, "confidence": 8,
        "determination": 7, "regret": 1, "relief": 5,
        "nostalgia": 4, "compassion": 6, "anxiety": 2,
        "inspiration": 9
      }
    },
    {
      "name": "Bob",
      "emotions": { "joy": 3, "sadness": 7, ... }
    }
  ],
  "top_n": 5,
  "filters": {
    "eras": ["new"],
    "min_imdb": 7.5,
    "genres": ["Action", "Drama"]
  }
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "rank": 1,
      "title": "Inception",
      "year": 2010,
      "genres": "Sci-Fi|Thriller",
      "imdb": 8.8,
      "similarity": 0.9821,
      "match_percent": 98.2,
      "dominant_emotions": [
        {"emotion": "curiosity", "score": 0.09},
        {"emotion": "anticipation", "score": 0.09},
        {"emotion": "fear", "score": 0.11}
      ]
    }
  ],
  "group_size": 2,
  "top_n": 5,
  "group_avg_emotions": {"joy": 5.5, "sadness": 4.5, ...},
  "filters_applied": {"eras": ["new"], "min_imdb": 7.5, "genres": ["Action"]}
}
```

---

### `GET /movies`
Browse/search the movie catalog.

| Param      | Type   | Description                  |
|------------|--------|------------------------------|
| `limit`    | int    | Results per page (max 100)   |
| `offset`   | int    | Pagination offset            |
| `genre`    | string | Filter by genre              |
| `min_imdb` | float  | Minimum IMDB rating          |
| `era`      | string | `old` / `mid` / `new`        |
| `search`   | string | Search by title              |

```bash
GET /movies?genre=Action&min_imdb=8.0&limit=10
```

---

## 4. Adding More Movies (Scale Up)

The system is designed to scale. To use a larger dataset:

1. Ensure your CSV has these columns:
   - `title`, `year`, `genres`, `imdb`
   - All 24 emotion columns:
     `joy, sadness, fear, anger, disgust, surprise, trust, anticipation,
      curiosity, excitement, hope, love, guilt, shame, gratitude, loneliness,
      confidence, determination, regret, relief, nostalgia, compassion, anxiety, inspiration`

2. Replace `movies_dataset_500.csv` with your larger file.

3. Restart `python app.py` — it will auto-load the new data.

> The cosine similarity is computed using NumPy matrix operations,
> so it handles 10,000+ movies in milliseconds.

---

## 5. Room System

- Each room has a **6-character code** (e.g. `A3K9PX`)
- Max **10 members** per room
- Members set their own emotion sliders (0–10)
- Recommendations are computed from the **average emotion vector** across all members
- Filters: Era (Old/Mid/New), Min IMDB, Genres (multi-select)
- Configurable output: 3 / 5 / 7 / 10 or custom (up to 50)
