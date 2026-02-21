# Coastal Movies — Group Emotion Recommender (Web)

Web app for the multi-user emotion-based movie recommender. Same logic as `multi_user_recommender.py`, using the dataset `datasets/movies_dataset_500_souj.csv`.

## Dependencies (virtual env)

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

## Run the app

From the project root (with venv activated if you use one):

```bash
python server.py
```

Then open **http://localhost:8000** in your browser. The CSV is loaded from `datasets/movies_dataset_500_souj.csv`; the app must be served over HTTP (not opened as a file) so that the dataset can be fetched.

## Features

- **Coastal Retreat** color palette for UI.
- **Dynamic users**: click **Add user** to add another column of emotion sliders; **Remove** to remove a user (at least one required).
- **Emotion sliders** (0–10) for each user — same 24 emotions as the Python app.
- **Reset sliders** (per user or **Reset all sliders**).
- **Preview my top 3** on each user card to see that user’s top 3 before computing the group.
- **Get group recommendations**:
  - Per-user **Top 3** with similarity (correlation) score.
  - **Group Top 3** from the averaged emotion vector, with similarity.
  - **Pairwise cosine similarity** matrix between users.
  - **Consensus coefficient** (average pairwise similarity).
  - **User → group** similarity and overlap of each user’s top 3 with the group top 3.

## Methodology (matches Python)

- Movie vectors: emotion columns from the CSV, row-normalized to unit vectors.
- User vectors: sliders 0–10 → divide by 10, then unit-normalized.
- Similarity: cosine (dot product of unit vectors).
- Group vector: mean of each user’s *non*-unit scaled vector (0–1), then normalized; used for group top 3.
- Consensus: mean of the upper triangle of the user–user cosine matrix (excluding diagonal).
