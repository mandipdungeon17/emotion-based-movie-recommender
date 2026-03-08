# CinEmotion — Emotion-Based Group Movie Recommender

## What is this?

CinEmotion recommends movies based on how you **feel**, not just what genre you like. Instead of searching by title or category, you set 24 emotion sliders (joy, sadness, fear, excitement, nostalgia, etc.) to reflect your current mood, and the system finds movies that match your emotional state.

It also works as a **group recommender**. Multiple people can join a room over LAN, each set their own emotions and filters independently, and the system aggregates everyone's input to find movies that best satisfy the group's combined mood.

### How it works

1. Create or join a room (up to 10 people on the same network)
2. Each person adjusts 24 emotion sliders (0–10 scale) across 4 categories: Positive, Social, Dark, and Reflective
3. Each person sets their own filters (release era, IMDb rating, genres) — filters are per-member, not shared
4. The admin chooses a group mood strategy:
   - **Balanced** — averages emotions but vetoes anything someone strongly dislikes
   - **Simple Average** — straight mean of all members' emotions
   - **Least Misery** — uses the minimum value per emotion so nobody gets a clashing mood
   - **Most Pleasure** — uses the maximum per emotion to honour the strongest desires
   - **By Intensity** — members who feel more strongly pull the group more
5. Members click **I'm Done** when finished — the admin can see who's ready
6. The backend aggregates per-member filters (union of eras/genres, most inclusive IMDb threshold) and computes **cosine similarity** between the group's emotion vector and all 500 movies' pre-scored emotion vectors
7. Top-N results are returned, ranked by match percentage with dominant emotions highlighted

### Features

- **Per-member input**: Each member provides their own emotions and filters independently
- **Real-time sync**: Room state is polled every 2.5 seconds across all members
- **Ready status**: Orange dot (editing) / Green dot (ready) next to each member's name
- **Aggregated view**: Members tab shows group emotion average + combined filters + per-member filter breakdown
- **Responsive design**: Desktop sidebar + mobile hamburger menu with slide-in drawer
- **Room sharing**: Copy room link, share code, or use native share (WhatsApp) on mobile
- **Session persistence**: Browser refresh doesn't lose your room — session is saved to localStorage
- **Movie posters**: 491 poster images fetched from TMDB

### Tech stack

- **Backend**: Python (Flask) with pandas and NumPy for similarity computation
- **Frontend**: React (Vite) with inline styled components
- **Dataset**: 500 movies, each scored across 24 emotions
- **Networking**: LAN-accessible via `0.0.0.0` binding (Flask + Vite)

---

## Project Structure

```
emotion-based-movie-recommender/
├── app.py                        # Flask backend API
├── download_posters.py           # TMDB poster download script
├── datasets/
│   └── movies_dataset_500.csv    # Movie dataset with emotion scores
├── movie_posters/                # Poster images (Title_Year.jpg)
│   └── *.jpg
├── cineemotion/                  # React frontend (Vite)
│   ├── src/
│   │   └── App.jsx               # Main React application
│   ├── vite.config.js            # Vite config with API proxy + LAN host
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
cd emotion-based-movie-recommender
pip install flask flask-cors pandas numpy
python app.py
```

The API starts at **http://localhost:5000**. Verify with: `http://localhost:5000/health`

### 2. Start the frontend

```bash
cd emotion-based-movie-recommender/cineemotion
npm install
npm run dev
```

The frontend starts at **http://localhost:5173**. Open this URL in your browser.

> The Vite dev server proxies all API requests (`/health`, `/recommend`, `/rooms/*`, `/posters/*`, etc.) to the Flask backend automatically, so no CORS configuration is needed on your end.

### 3. Access over LAN (for group use)

Both servers bind to `0.0.0.0`, making them accessible from other devices on the same network:

1. Find your IP: run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Share `http://<your-ip>:5173` with others on the same network
3. Others open the link, enter their name, and join using the room code

> Browsers may show a security warning on `http://` LAN IPs — this is expected and safe to proceed.

### 4. Use the app

1. Open **http://localhost:5173** in your browser
2. Enter your name and click **Create Room**
3. Share the room code or link with others
4. Each member: adjust emotion sliders + set filters + click **I'm Done**
5. Admin clicks **Get Recommendations**

---

## Sharing Guide

Copy and share this with your group:

> I've built a small project called **CinEmotion** — a group movie recommender that picks movies based on everyone's mood. Each person sets their emotions and preferences, and the app finds the best match for the whole group. Please join the room from the link below and share your feedback. Currently only 500 movies are available for testing purposes.
>
> **Link:** `[your room link]`
>
> **How to use:**
>
> 1. Copy-paste the link in your browser — enter your name and join the room.
> 2. Set your mood sliders (0–10) based on how you're feeling — the app picks movies that match everyone's mood. Crank up joy & excitement for something fun, or nostalgia & sadness for a deep watch.
> 3. Pick your filters (era, rating, genres) if you have a preference, then hit **I'm Done**.

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

### Room Endpoints

| Endpoint                | Method | Description                                                         |
| ----------------------- | ------ | ------------------------------------------------------------------- |
| `/rooms/create`         | POST   | Create a new room (body: `{name}`)                                  |
| `/rooms/<id>/join`      | POST   | Join a room (body: `{name}`)                                        |
| `/rooms/<id>/leave`     | POST   | Leave a room (body: `{member_id}`)                                  |
| `/rooms/<id>`           | GET    | Get room state (query: `?member_id=`)                               |
| `/rooms/<id>/emotions`  | PUT    | Update your emotions (body: `{member_id, emotions}`)                |
| `/rooms/<id>/filters`   | PUT    | Update your filters (body: `{member_id, filters}`)                  |
| `/rooms/<id>/settings`  | PUT    | Admin: change strategy/top_n (body: `{member_id, strategy, top_n}`) |
| `/rooms/<id>/ready`     | PUT    | Toggle ready status (body: `{member_id, ready}`)                    |
| `/rooms/<id>/recommend` | POST   | Admin: run recommendation (body: `{member_id}`)                     |

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

## Room System

- Each room has a **6-character code** (e.g. `A3K9PX`)
- Max **10 members** per room
- The room creator is the **admin** (auto-promoted if admin leaves)
- Each member sets their **own emotions** (24 sliders, 0–10) and **own filters** (era, IMDb, genres) independently
- Admin controls: aggregation strategy, number of results, triggering recommendations
- Per-member filters are **aggregated at recommendation time** (union of eras/genres, minimum IMDb threshold)
- Members tab shows: group emotion averages, aggregated filters, and per-member filter breakdown
- Ready status with colored indicators: green (ready) / orange (editing)
- Room link sharing via clipboard, code copy, or native share API (WhatsApp)
- Session persists across browser refresh via localStorage

---

## Download Posters

To download movie posters from TMDB:

```bash
set TMDB_API_KEY=your_api_key_here
python download_posters.py
```

- Requires a free [TMDB API key](https://www.themoviedb.org/settings/api)
- Downloads posters for all 500 movies in the dataset
- Skips already-downloaded posters
- Uses a two-pass search (with year, then title-only fallback) to maximize matches

---

## Adding More Movies

1. Ensure your CSV has these columns:
   - `title`, `year`, `genres`, `imdb`
   - All 24 emotion columns: `joy, sadness, fear, anger, disgust, surprise, trust, anticipation, curiosity, excitement, hope, love, guilt, shame, gratitude, loneliness, confidence, determination, regret, relief, nostalgia, compassion, anxiety, inspiration`
2. Replace `datasets/movies_dataset_500.csv` with your file
3. Add poster images to `movie_posters/` named as `Title_Year.jpg` (spaces replaced with underscores)
4. Restart `python app.py`

> Cosine similarity is computed using NumPy matrix operations, so it handles 10,000+ movies in milliseconds.
