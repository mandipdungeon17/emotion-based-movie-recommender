import os
import cloudscraper
import time

# --- CONFIGURATION ---
# Go to movieposterdb.com > Login > Open DevTools (F12) > Network tab >
# Click any request > Copy the full "Cookie" header value and paste below
COOKIE_STRING = "PASTE_YOUR_COOKIE_HERE"
BEARER_TOKEN = "2|orm8s8TMSQSZcziQOXZwOgmRsrsW233VqoAP5oeU"  # Replace if expired

BASE_URL = 'https://api.movieposterdb.com/v1'
SAVE_FOLDER = "movie_posters"

movie_titles = ["Inception", "Toy Story 3", "The Social Network"]

os.makedirs(SAVE_FOLDER, exist_ok=True)

# Let cloudscraper manage browser spoofing — don't override User-Agent
scraper = cloudscraper.create_scraper(browser={'browser': 'chrome', 'platform': 'windows', 'mobile': False})

# Only pass what the API needs; let cloudscraper handle User-Agent
HEADERS = {
    'Authorization': f'Bearer {BEARER_TOKEN}',
    'Accept': 'application/json',
    'Cookie': COOKIE_STRING,
}

def fetch_poster(movie_title):
    print(f"🎬 Processing: {movie_title}...")
    search_url = f"{BASE_URL}/movies?query={movie_title}"

    try:
        search_res = scraper.get(search_url, headers=HEADERS, timeout=15)
        print(f"   Search status: {search_res.status_code}")

        if search_res.status_code == 401:
            print("   🔑 Unauthorized — your Bearer token or Cookie is invalid/expired.")
            return
        if search_res.status_code == 403:
            print("   🚫 Forbidden — Cookie is likely missing or expired. Refresh it from your browser.")
            return
        if search_res.status_code != 200:
            print(f"   ❌ Unexpected status: {search_res.status_code} | {search_res.text[:200]}")
            return

        data = search_res.json().get('data', [])
        if not data:
            print(f"   ❌ No results found for '{movie_title}'")
            return

        movie_id = data[0]['id']
        print(f"   Found movie ID: {movie_id}")

        poster_res = scraper.get(f"{BASE_URL}/posters?movie_id={movie_id}", headers=HEADERS, timeout=15)
        if poster_res.status_code != 200:
            print(f"   ❌ Poster fetch failed: {poster_res.status_code}")
            return

        posters = poster_res.json().get('data', [])
        if not posters:
            print(f"   ❌ No posters found for movie ID {movie_id}")
            return

        img_url = posters[0]['url']
        print(f"   Downloading: {img_url}")

        img_res = scraper.get(img_url, timeout=30)  # No auth headers for image CDN
        if img_res.status_code != 200:
            print(f"   ❌ Image download failed: {img_res.status_code}")
            return

        filename = f"{movie_title.replace(' ', '_').lower()}.jpg"
        with open(os.path.join(SAVE_FOLDER, filename), 'wb') as f:
            f.write(img_res.content)
        print(f"   ✅ Saved as {filename}")

    except Exception as e:
        print(f"   🛑 Error: {e}")

for movie in movie_titles:
    fetch_poster(movie)
    time.sleep(3)

print("\n🚀 Done!")