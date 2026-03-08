"""
Download movie posters from TMDB for all movies in the dataset.

Usage:
    set TMDB_API_KEY=your_api_key_here
    pip install requests pandas
    python download_posters.py

Posters are saved to movie_posters/ as Title_Year.jpg (spaces replaced with underscores).
Already-downloaded posters are skipped.
"""

import os
import re
import time
import urllib3
import requests
import pandas as pd

# Suppress SSL warnings (corporate proxy intercepts HTTPS)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "datasets", "movies_dataset_500.csv")
POSTER_DIR = os.path.join(BASE_DIR, "movie_posters")

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

DELAY_BETWEEN_REQUESTS = 0.3  # seconds, to respect rate limits


def sanitize_filename(name):
    """Replace spaces and special characters for a safe filename."""
    name = name.replace(" ", "_")
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    return name


def _tmdb_search(session, params):
    """Run a TMDB search with retry on rate-limit. Returns results list."""
    for attempt in range(3):
        resp = session.get(TMDB_SEARCH_URL, params=params, timeout=10)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 2))
            print(f"  Rate limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        resp.raise_for_status()
        return resp.json().get("results", [])
    return None  # rate limited repeatedly


def download_poster(title, year, session):
    """Search TMDB for the movie and download its poster. Returns status string."""
    filename = f"{sanitize_filename(title)}_{year}.jpg"
    filepath = os.path.join(POSTER_DIR, filename)

    if os.path.exists(filepath):
        return "skipped"

    # Try with year first, then fall back to title-only search
    results = _tmdb_search(session, {"api_key": TMDB_API_KEY, "query": title, "year": year})
    if results is None:
        print(f"  FAILED (rate limited repeatedly): {title} ({year})")
        return "failed"

    if not results:
        # Year mismatch — retry without year
        results = _tmdb_search(session, {"api_key": TMDB_API_KEY, "query": title})
        if results is None:
            print(f"  FAILED (rate limited repeatedly): {title} ({year})")
            return "failed"
        if results:
            print(f"(year mismatch, matched by title)...", end=" ")

    if not results:
        print(f"  NOT FOUND on TMDB: {title} ({year})")
        return "not_found"

    poster_path = results[0].get("poster_path")
    if not poster_path:
        print(f"  NO POSTER available: {title} ({year})")
        return "no_poster"

    img_url = f"{TMDB_IMAGE_BASE}{poster_path}"
    for attempt in range(3):
        img_resp = session.get(img_url, timeout=15)
        if img_resp.status_code == 429:
            retry_after = int(img_resp.headers.get("Retry-After", 2))
            time.sleep(retry_after)
            continue
        img_resp.raise_for_status()
        break
    else:
        print(f"  FAILED (image rate limited): {title} ({year})")
        return "failed"

    with open(filepath, "wb") as f:
        f.write(img_resp.content)

    return "downloaded"


def main():
    if not TMDB_API_KEY:
        print("ERROR: Set the TMDB_API_KEY environment variable first.")
        print("  Windows:  set TMDB_API_KEY=your_key_here")
        print("  Linux:    export TMDB_API_KEY=your_key_here")
        return

    os.makedirs(POSTER_DIR, exist_ok=True)

    df = pd.read_csv(CSV_PATH)
    total = len(df)
    print(f"Found {total} movies in dataset.\n")

    stats = {"downloaded": 0, "skipped": 0, "not_found": 0, "no_poster": 0, "failed": 0}
    session = requests.Session()
    session.verify = False  # skip SSL verification (corporate proxy)

    for idx, row in df.iterrows():
        title = str(row["title"]).strip()
        year = str(row["year"]).strip()
        print(f"[{idx + 1}/{total}] {title} ({year})...", end=" ")

        try:
            result = download_poster(title, year, session)
            stats[result] += 1
            if result == "downloaded":
                print("OK")
            elif result == "skipped":
                print("already exists")
        except Exception as e:
            stats["failed"] += 1
            print(f"ERROR: {e}")

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n--- Done ---")
    print(f"Downloaded : {stats['downloaded']}")
    print(f"Skipped    : {stats['skipped']}")
    print(f"Not found  : {stats['not_found']}")
    print(f"No poster  : {stats['no_poster']}")
    print(f"Failed     : {stats['failed']}")


if __name__ == "__main__":
    main()
