import os
import cloudscraper
import time

# --- CONFIGURATION ---
BEARER_TOKEN = "2|orm8s8TMSQSZcziQOXZwOgmRsrsW233VqoAP5oeU"

# Paste the full Cookie header from DevTools Network tab here (includes cf_clearance)
# For now using what we have — replace CF_CLEARANCE_VALUE with the real one from Network tab
COOKIE_STRING = "jsredirect=false; mode=dark; _gid=GA1.2.436541560.1771695107; cf_clearance=s.hDSTlSZuTHEifgFEDqbFIgpIau_YK7joHm8EaAitg-1771697995-1.2.1.1-qsRehYatENPSw85vCIg8JBZSbjxBwXR1eNTVnYh1lxE33uyhUgKT3MDyGMlLEBb2HUNy0PLO9HCPgAVmrAmTaaHhHBMoldXSEwDGPCxSXlUaKS5POCsMIs7xAzGLNWlr3xO6WdJkCs4NMeW.tftt.BtPEf2NKigDN1uWtOcNEGA97XgLQb_P6vC7lkeeDOa.8rgGoPwov0B3w7c0aB0US4SZOSo6yNXWytwMSCZqxSyJowYi8WfdurRyBTUBv4Po; _gat_UA-170490800-1=1; _ga_50WJT4VBC9=GS2.1.s1771695107$o1$g1$t1771698251$j49$l0$h0; _ga=GA1.1.1262509630.1771695107; XSRF-TOKEN=eyJpdiI6Im1kc0JQSlUyTDRRSmFGNDlWNW84Zmc9PSIsInZhbHVlIjoiZTB3YTg2aUJSazlkMnZjTEpBR3lyaUFjSzdWQVFhSVBsNHNLMitYd2FPdE9PQ2dLQk4xNUNNV1NrYXpUZExpemljeTFSYUhramVYR056VVVDa29oNHV5M013MVF3YlJiRUhtcS9LR0ZCOW1RNyt4N3RHd0VoT3J0ZG1BZ0FxOHEiLCJtYWMiOiJmYTdmODBiZWE5M2VjYmY5NTJjZDRiZjQ3ZTcwOTY2ZjFhMmQ4NzQ2YmY5YjVjNzY4M2UxZDE4OWQ4OTEzNGEwIn0%3D; movieposterdb_session=eyJpdiI6Im85VUM4Y0dMTm41UmxsNkJiZUp4Z0E9PSIsInZhbHVlIjoiNnVTbThiOVBNSUpoZkM0ZWQwUEFySThoTENYU0JXbGRQclVJZnJwWW94ald0eWhzZGdpUTh4YmsxSkxaUVAxZS9nTGJmSkE5NzhvT0ROLzlnbEJ1bml3Z3pxdEo5ZXl5RzdvZG12cGFYTHNIOGlEeHpYZWt5dUlUdXBpSUN6ZmciLCJtYWMiOiI0YzkzZDcxNjNlMmIyZDY1ZGMyNWY1MjlmNzdhMWY1N2Q5YmI3YjA1ZWI1M2JmNTM5M2FjMzE1OWEyYTlmMDJhIn0%3D"

BASE_URL = "https://api.movieposterdb.com/v1"
SAVE_FOLDER = "movie_posters"

# Add your full movie list here
movie_titles = [
    "Inception",
    "Toy Story 3",
    "The Social Network",
]

os.makedirs(SAVE_FOLDER, exist_ok=True)

# cloudscraper handles Cloudflare JS challenges
scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "mobile": False}
)

HEADERS = {
    "Authorization": f"Bearer {BEARER_TOKEN}",
    "Accept": "application/json",
    "Cookie": COOKIE_STRING,
    "Referer": "https://www.movieposterdb.com/",
    "Origin": "https://www.movieposterdb.com",
}


def fetch_poster(movie_title):
    print(f"🎬 Processing: {movie_title}...")

    try:
        # Step 1: Search for the movie
        search_res = scraper.get(
            f"{BASE_URL}/movies",
            headers=HEADERS,
            params={"query": movie_title},
            timeout=15,
        )
        print(f"   Search status: {search_res.status_code}")

        if search_res.status_code == 403:
            print("   🚫 Still blocked by Cloudflare. cf_clearance cookie may be missing or expired.")
            print(f"   Response: {search_res.text[:300]}")
            return
        if search_res.status_code == 401:
            print("   🔑 Unauthorized — Bearer token may be expired.")
            return
        if search_res.status_code != 200:
            print(f"   ❌ Unexpected status {search_res.status_code}: {search_res.text[:300]}")
            return

        data = search_res.json().get("data", [])
        if not data:
            print(f"   ❌ No results found for '{movie_title}'")
            return

        movie_id = data[0]["id"]
        print(f"   Found movie ID: {movie_id}")

        # Step 2: Get posters for that movie
        poster_res = scraper.get(
            f"{BASE_URL}/posters",
            headers=HEADERS,
            params={"movie_id": movie_id},
            timeout=15,
        )

        if poster_res.status_code != 200:
            print(f"   ❌ Poster fetch failed: {poster_res.status_code}")
            return

        posters = poster_res.json().get("data", [])
        if not posters:
            print(f"   ❌ No posters found for '{movie_title}'")
            return

        # Step 3: Download the first poster image
        img_url = posters[0]["url"]
        print(f"   Downloading: {img_url}")

        img_res = scraper.get(img_url, timeout=30)
        if img_res.status_code != 200:
            print(f"   ❌ Image download failed: {img_res.status_code}")
            return

        ext = img_url.split(".")[-1].split("?")[0] or "jpg"
        filename = f"{movie_title.replace(' ', '_').lower()}.{ext}"
        filepath = os.path.join(SAVE_FOLDER, filename)

        with open(filepath, "wb") as f:
            f.write(img_res.content)
        print(f"   ✅ Saved: {filepath}")

    except Exception as e:
        print(f"   🛑 Error: {e}")


for movie in movie_titles:
    fetch_poster(movie)
    time.sleep(3)

print("\n🚀 Done!")
