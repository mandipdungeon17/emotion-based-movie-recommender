import os
import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# --- CONFIGURATION ---
BEARER_TOKEN = "2|orm8s8TMSQSZcziQOXZwOgmRsrsW233VqoAP5oeU"
BASE_URL = "https://api.movieposterdb.com/v1"
SAVE_FOLDER = "movie_posters"

# Add your full movie list here
movie_titles = [
    "Inception",
    "Toy Story 3",
    "The Social Network",
]

os.makedirs(SAVE_FOLDER, exist_ok=True)


def create_driver():
    options = Options()
    # NOT headless — real browser window needed to pass Cloudflare
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("--window-size=1280,800")
    driver = webdriver.Chrome(options=options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    return driver


def fetch_via_browser(driver, url):
    """Use the real browser to make an authenticated API request."""
    result = driver.execute_async_script(f"""
    const callback = arguments[arguments.length - 1];
    (async () => {{
        try {{
            const response = await fetch("{url}", {{
                headers: {{
                    "Authorization": "Bearer {BEARER_TOKEN}",
                    "Accept": "application/json"
                }}
            }});
            const status = response.status;
            const text = await response.text();
            callback(JSON.stringify({{ status, text }}));
        }} catch(e) {{
            callback(JSON.stringify({{ status: 0, text: e.toString() }}));
        }}
    }})();
    """)
    return json.loads(result)


def fetch_poster(driver, movie_title):
    print(f"🎬 Processing: {movie_title}...")

    # Step 1: Search for movie
    search_url = f"{BASE_URL}/movies?query={movie_title.replace(' ', '%20')}"
    result = fetch_via_browser(driver, search_url)

    print(f"   Search status: {result['status']}")
    if result['status'] != 200:
        print(f"   ❌ Failed: {result['text'][:300]}")
        return

    data = json.loads(result['text']).get('data', [])
    if not data:
        print(f"   ❌ No results found for '{movie_title}'")
        return

    movie_id = data[0]['id']
    print(f"   Found movie ID: {movie_id}")

    # Step 2: Get posters
    poster_url = f"{BASE_URL}/posters?movie_id={movie_id}"
    result = fetch_via_browser(driver, poster_url)

    if result['status'] != 200:
        print(f"   ❌ Poster fetch failed: {result['status']}")
        return

    posters = json.loads(result['text']).get('data', [])
    if not posters:
        print(f"   ❌ No posters found for '{movie_title}'")
        return

    img_url = posters[0]['url']
    print(f"   Downloading: {img_url}")

    # Step 3: Download image via browser fetch
    img_result = driver.execute_async_script(f"""
    const callback = arguments[arguments.length - 1];
    (async () => {{
        try {{
            const response = await fetch("{img_url}");
            const buffer = await response.arrayBuffer();
            const bytes = Array.from(new Uint8Array(buffer));
            callback({{ ok: true, bytes }});
        }} catch(e) {{
            callback({{ ok: false, error: e.toString() }});
        }}
    }})();
    """)

    if not img_result.get('ok'):
        print(f"   ❌ Image download failed: {img_result.get('error')}")
        return

    ext = img_url.split(".")[-1].split("?")[0] or "jpg"
    filename = f"{movie_title.replace(' ', '_').lower()}.{ext}"
    filepath = os.path.join(SAVE_FOLDER, filename)

    with open(filepath, 'wb') as f:
        f.write(bytes(img_result['bytes']))

    print(f"   ✅ Saved: {filepath}")


def main():
    print("🚀 Starting browser...")
    driver = create_driver()

    try:
        # Visit the site first — Cloudflare will verify in the real browser
        print("🌐 Loading movieposterdb.com — please wait for it to fully load...")
        driver.get("https://www.movieposterdb.com")
        time.sleep(10)  # Wait for Cloudflare challenge to clear

        print("✅ Site loaded! Starting downloads...\n")

        for movie in movie_titles:
            fetch_poster(driver, movie)
            time.sleep(3)

    finally:
        driver.quit()

    print("\n🏁 Done!")


if __name__ == "__main__":
    main()
