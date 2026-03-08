"""
Enrich movie data from TMDB: overview, rating, and watch providers (India).

Usage:
    set TMDB_API_KEY=your_api_key_here
    python enrich_movies.py

Output: datasets/movie_enrichment.json
Already-enriched movies are skipped (delete the file to re-fetch all).
"""

import os
import json
import time
import re
import urllib3
import requests
import pandas as pd
from datetime import datetime

# Suppress SSL warnings (corporate proxy intercepts HTTPS)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "datasets", "movies_dataset_500.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "datasets", "movie_enrichment.json")

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie"
TMDB_MOVIE_URL = "https://api.themoviedb.org/3/movie"

DELAY = 0.3  # seconds between API calls
WATCH_COUNTRY = "IN"  # India


def _make_key(title, year):
    """Build the lookup key matching '{title}_{year}'."""
    return f"{title}_{year}"


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
    return None


def _tmdb_api(session, url, params=None):
    """Generic TMDB GET with retry on rate-limit."""
    if params is None:
        params = {}
    params["api_key"] = TMDB_API_KEY
    for attempt in range(3):
        resp = session.get(url, params=params, timeout=10)
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("Retry-After", 2))
            print(f"  Rate limited, waiting {retry_after}s...")
            time.sleep(retry_after)
            continue
        resp.raise_for_status()
        return resp.json()
    return None


def find_tmdb_id(session, title, year):
    """Search TMDB for the movie. Returns tmdb_id or None."""
    # Try with year first
    results = _tmdb_search(session, {"api_key": TMDB_API_KEY, "query": title, "year": year})
    if results is None:
        return None
    if not results:
        # Year mismatch — retry without year
        results = _tmdb_search(session, {"api_key": TMDB_API_KEY, "query": title})
        if results is None or not results:
            return None
        print(f"(year mismatch, matched by title) ", end="")
    return results[0]["id"]


def fetch_details(session, tmdb_id):
    """Fetch movie details: overview, vote_average, vote_count."""
    url = f"{TMDB_MOVIE_URL}/{tmdb_id}"
    data = _tmdb_api(session, url)
    if not data:
        return {"overview": "", "tmdb_rating": None, "tmdb_vote_count": None}
    return {
        "overview": data.get("overview", ""),
        "tmdb_rating": data.get("vote_average"),
        "tmdb_vote_count": data.get("vote_count"),
    }


def fetch_watch_providers(session, tmdb_id):
    """Fetch watch providers for India (IN): flatrate, rent, buy."""
    url = f"{TMDB_MOVIE_URL}/{tmdb_id}/watch/providers"
    data = _tmdb_api(session, url)
    if not data:
        return {"flatrate": [], "rent": [], "buy": []}

    country_data = data.get("results", {}).get(WATCH_COUNTRY, {})
    providers = {}
    for category in ["flatrate", "rent", "buy"]:
        items = country_data.get(category, [])
        providers[category] = [
            {"name": p["provider_name"], "logo_path": p["logo_path"]}
            for p in items
        ]
    return providers


def main():
    if not TMDB_API_KEY:
        print("ERROR: Set the TMDB_API_KEY environment variable first.")
        print("  Windows:  set TMDB_API_KEY=your_key_here")
        print("  Linux:    export TMDB_API_KEY=your_key_here")
        return

    # Load existing data if present (incremental mode)
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            enrichment = json.load(f)
        print(f"Loaded existing enrichment file with {len(enrichment.get('movies', {}))} movies.")
    else:
        enrichment = {"_meta": {}, "movies": {}}
        print("Starting fresh enrichment.")

    existing = enrichment.get("movies", {})

    df = pd.read_csv(CSV_PATH)
    total = len(df)
    print(f"Found {total} movies in dataset.\n")

    stats = {"enriched": 0, "skipped": 0, "not_found": 0, "failed": 0}
    session = requests.Session()
    session.verify = False  # skip SSL verification (corporate proxy)

    for idx, row in df.iterrows():
        title = str(row["title"]).strip()
        year = str(row["year"]).strip()
        key = _make_key(title, year)

        if key in existing:
            print(f"[{idx + 1}/{total}] {title} ({year})... cached")
            stats["skipped"] += 1
            continue

        print(f"[{idx + 1}/{total}] {title} ({year})... ", end="")

        try:
            # 1. Find TMDB ID
            tmdb_id = find_tmdb_id(session, title, year)
            if not tmdb_id:
                print("NOT FOUND on TMDB")
                existing[key] = {
                    "tmdb_id": None,
                    "overview": "",
                    "tmdb_rating": None,
                    "tmdb_vote_count": None,
                    "watch_providers": {"flatrate": [], "rent": [], "buy": []},
                }
                stats["not_found"] += 1
                time.sleep(DELAY)
                continue

            time.sleep(DELAY)

            # 2. Fetch details (overview + rating)
            details = fetch_details(session, tmdb_id)
            time.sleep(DELAY)

            # 3. Fetch watch providers for India
            providers = fetch_watch_providers(session, tmdb_id)
            time.sleep(DELAY)

            existing[key] = {
                "tmdb_id": tmdb_id,
                **details,
                "watch_providers": providers,
            }

            provider_count = sum(len(v) for v in providers.values())
            print(f"OK (TMDB {details.get('tmdb_rating', '?')}, {provider_count} providers)")
            stats["enriched"] += 1

        except Exception as e:
            print(f"ERROR: {e}")
            stats["failed"] += 1

        # Save after each movie (crash-resilient)
        enrichment["movies"] = existing
        enrichment["_meta"] = {
            "generated_at": datetime.now().isoformat(),
            "movie_count": len(existing),
            "watch_country": WATCH_COUNTRY,
            "tmdb_attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        }
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(enrichment, f, indent=2, ensure_ascii=False)

    print(f"\n--- Done ---")
    print(f"Enriched   : {stats['enriched']}")
    print(f"Skipped    : {stats['skipped']}")
    print(f"Not found  : {stats['not_found']}")
    print(f"Failed     : {stats['failed']}")
    print(f"\nOutput: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
