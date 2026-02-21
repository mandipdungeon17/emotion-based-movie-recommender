"""Minimal HTTP server to run the web app and load the dataset CSV.
Run from project root: python server.py
Then open http://localhost:8000
"""
import http.server
import os
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
handler = http.server.SimpleHTTPRequestHandler
server = http.server.HTTPServer(("", 8000), handler)
print("Serving at http://localhost:8000")
print("Open http://localhost:8000 in your browser. Press Ctrl+C to stop.")
try:
    webbrowser.open("http://localhost:8000")
except Exception:
    pass
server.serve_forever()
