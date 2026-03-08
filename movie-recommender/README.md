# CinEmotion — Emotion-Based Group Movie Recommender

## What is this?

CinEmotion recommends movies based on how you **feel**, not just what genre you like. Instead of searching by title or category, you set 24 emotion sliders (joy, sadness, fear, excitement, nostalgia, etc.) to reflect your current mood, and the system finds movies that match your emotional state.

It also works as a **group recommender**. Multiple people can join a room, each set their own emotions, and the system finds movies that best satisfy everyone's combined mood using different aggregation strategies.

### How it works

1. Create or join a room (up to 10 people)
2. Each person adjusts 24 emotion sliders (0-10 scale) across 4 categories: Positive, Social, Dark, and Reflective
3. Choose a group mood strategy:
   - **Balanced** — averages emotions but vetoes anything someone strongly dislikes
   - **Simple Average** — straight mean of all members' emotions
   - **Least Misery** — uses the minimum value per emotion so nobody gets a clashing mood
   - **Most Pleasure** — uses the maximum per emotion to honour the strongest desires
   - **By Intensity** — members who feel more strongly pull the group more
4. Optionally filter by release era, minimum IMDb rating, or genres
5. The backend computes **cosine similarity** between the group's emotion vector and all 500 movies' pre-scored emotion vectors
6. Top-N results are returned, ranked by match percentage with dominant emotions highlighted

### Tech stack

- **Backend**: Python (Flask) with pandas and NumPy for similarity computation
- **Frontend**: React (Vite) with inline styled components
- **Dataset**: 500 movies, each scored across 24 emotions

---

## Project Structure

```
movie-recommender/
├── app.py                        # Flask backend API
├── datasets/
│   └── movies_dataset_500.csv    # Movie dataset with emotion scores
├── movie_posters/                # Poster images (Title_Year.jpg)
│   └── *.jpg
├── cineemotion/                  # React frontend (Vite)
│   ├── src/
│   │   └── App.jsx               # Main React application
│   ├── vite.config.js            # Vite config with API proxy
│   ├── package.json
│   └── index.html
└── README.md
```

---

## How to Run

### Prerequisites

- Python 3.10+
- Node.js 18+
- pip

### 1. Start the backend

```bash
cd movie-recommender
pip install flask flask-cors pandas numpy
python app.py
```

The API starts at **http://localhost:5000**. Verify with: `http://localhost:5000/health`

### 2. Start the frontend

```bash
cd movie-recommender/cineemotion
npm install
npm run dev
```

The frontend starts at **http://localhost:5173**. Open this URL in your browser.

> The Vite dev server proxies all API requests (`/health`, `/recommend`, `/posters/*`, etc.) to the Flask backend automatically, so no CORS configuration is needed on your end.

### 3. Use the app

1. Open **http://localhost:5173** in your browser
2. Confirm the status dot shows **"API connected"** (green)
3. Enter your name and click **Create Room**
4. Adjust the emotion sliders to match your mood
5. Click **Get Recommendations**

---

## API Endpoints

### `GET /health`

Check if the server is running.

```json
{
  "status": "ok",
  "movies_loaded": 500,
  "emotions_supported": ["joy", "sadness", "..."]
}
```

### `POST /recommend`

Get movie recommendations for a group.

**Request:**

```json
{
  "members": [
    {
      "name": "Alice",
      "emotions": {
        "joy": 8,
        "sadness": 2,
        "fear": 3,
        "anger": 1,
        "disgust": 1,
        "surprise": 6,
        "trust": 7,
        "anticipation": 8,
        "curiosity": 7,
        "excitement": 9,
        "hope": 8,
        "love": 6,
        "guilt": 1,
        "shame": 1,
        "gratitude": 7,
        "loneliness": 2,
        "confidence": 8,
        "determination": 7,
        "regret": 1,
        "relief": 5,
        "nostalgia": 4,
        "compassion": 6,
        "anxiety": 2,
        "inspiration": 9
      }
    }
  ],
  "top_n": 5,
  "strategy": "avg_no_misery",
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
        { "emotion": "curiosity", "score": 0.09 },
        { "emotion": "anticipation", "score": 0.09 }
      ]
    }
  ],
  "group_size": 1,
  "top_n": 5,
  "strategy_used": "avg_no_misery",
  "strategy_label": "Balanced",
  "group_avg_emotions": { "joy": 8, "sadness": 2, "...": "..." },
  "filters_applied": {
    "eras": ["new"],
    "min_imdb": 7.5,
    "genres": ["Action", "Drama"]
  }
}
```

### `GET /movies`

Browse the movie catalog.

| Param      | Type   | Description                |
| ---------- | ------ | -------------------------- |
| `limit`    | int    | Results per page (max 100) |
| `offset`   | int    | Pagination offset          |
| `genre`    | string | Filter by genre            |
| `min_imdb` | float  | Minimum IMDb rating        |
| `era`      | string | `old` / `mid` / `new`      |
| `search`   | string | Search by title            |

### `GET /posters/<title>`

Serves a movie poster image by title. Matches filenames in `movie_posters/` using a slug lookup (e.g. "Inception" matches `Inception_2010.jpg`).

---

## Adding More Movies

1. Ensure your CSV has these columns:
   - `title`, `year`, `genres`, `imdb`
   - All 24 emotion columns: `joy, sadness, fear, anger, disgust, surprise, trust, anticipation, curiosity, excitement, hope, love, guilt, shame, gratitude, loneliness, confidence, determination, regret, relief, nostalgia, compassion, anxiety, inspiration`
2. Replace `datasets/movies_dataset_500.csv` with your file
3. Add poster images to `movie_posters/` named as `Title_Year.jpg` (spaces replaced with underscores)
4. Restart `python app.py`

> Cosine similarity is computed using NumPy matrix operations, so it handles 10,000+ movies in milliseconds.

---

## Room System

- Each room has a **6-character code** (e.g. `A3K9PX`)
- Max **10 members** per room
- Members set their own emotion sliders (0-10)
- 5 aggregation strategies for combining group emotions
- Filters: Release era, minimum IMDb rating, genres (multi-select)
- Configurable result count: 3 / 5 / 7 / 10 or custom (up to 50)
