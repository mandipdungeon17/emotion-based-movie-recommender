"""Movie Emotion-based Recommender GUI

- Reads `movies_emotions_50_souj.csv` from the same directory
- Lets the user pick time ranges (old/mid/new), set a minimum IMDB rating,
  and set sliders for each emotion (0-10)
- Computes cosine similarity between user emotion vector and movies, filters
  by timeframe and rating, and shows top 3 matches in the GUI

Run: python movie_recommender_gui.py
"""

import os
import tkinter as tk
from tkinter import ttk, messagebox
import pandas as pd
import numpy as np

# --- Config: release year bins (adjust if you want different ranges) ---
RELEASE_BINS = {
    "old": lambda year: year <= 1999,
    "mid": lambda year: 2000 <= year <= 2010,
    "new": lambda year: year >= 2011,
}

EMOTIONS = [
    "joy","sadness","fear","anger","disgust","surprise","trust",
    "anticipation","curiosity","excitement","hope","love","guilt",
    "shame","gratitude","loneliness","confidence","determination",
    "regret","relief","nostalgia","compassion","anxiety","inspiration",
]

CSV_FILENAME = os.path.join(os.path.dirname(__file__), "movies_dataset_500.csv")


class MovieRecommenderApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Emotion-Based Movie Recommender")
        self.geometry("900x700")

        # load data
        self.df = pd.read_csv(CSV_FILENAME)
        for col in ["year", "imdb"]:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors="coerce")

        # prepare movie emotion matrix (as np.array)
        self.emotion_cols = [c for c in EMOTIONS if c in self.df.columns]
        if len(self.emotion_cols) != len(EMOTIONS):
            missing = set(EMOTIONS) - set(self.emotion_cols)
            messagebox.showerror("Data error", f"Missing emotions in CSV: {missing}")
            self.destroy(); return
        self.movie_matrix = self.df[self.emotion_cols].fillna(0).to_numpy(dtype=float)

        # UI variables
        self.time_vars = {k: tk.IntVar(value=1) for k in RELEASE_BINS}  # default all selected
        self.min_imdb = tk.DoubleVar(value=0.0)
        self.emotion_vars = {e: tk.DoubleVar(value=5.0) for e in EMOTIONS}

        self._build_ui()

    def _build_ui(self):
        # Top frame: time range checkboxes and imdb rating
        top_frame = ttk.Frame(self)
        top_frame.pack(fill=tk.X, padx=10, pady=10)

        time_frame = ttk.LabelFrame(top_frame, text="Release time")
        time_frame.pack(side=tk.LEFT, padx=10)
        for k in self.time_vars:
            cb = ttk.Checkbutton(time_frame, text=k.title(), variable=self.time_vars[k])
            cb.pack(anchor=tk.W, padx=6, pady=2)

        rating_frame = ttk.Frame(top_frame)
        rating_frame.pack(side=tk.LEFT, padx=10)
        ttk.Label(rating_frame, text="Minimum IMDB rating").pack(anchor=tk.W)
        rating_scale = ttk.Scale(rating_frame, from_=0, to=10, orient=tk.HORIZONTAL, variable=self.min_imdb)
        rating_scale.pack(fill=tk.X, padx=6)
        self.rating_value_label = ttk.Label(rating_frame, textvariable=self.min_imdb)
        self.rating_value_label.pack(anchor=tk.E)

        # Middle frame: emotion sliders inside scrollable canvas
        mid_frame = ttk.LabelFrame(self, text="Emotion sliders (0-10)")
        mid_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        canvas = tk.Canvas(mid_frame)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll = ttk.Scrollbar(mid_frame, orient=tk.VERTICAL, command=canvas.yview)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.configure(yscrollcommand=scroll.set)

        sliders_frame = ttk.Frame(canvas)
        canvas.create_window((0, 0), window=sliders_frame, anchor='nw')

        # Create sliders in two columns for compactness
        col_frames = [ttk.Frame(sliders_frame) for _ in range(2)]
        for cf in col_frames:
            cf.pack(side=tk.LEFT, padx=10, pady=5)

        for i, emotion in enumerate(EMOTIONS):
            f = col_frames[i % 2]
            lbl = ttk.Label(f, text=emotion.title())
            lbl.pack(anchor=tk.W)
            s = ttk.Scale(f, from_=0, to=10, orient=tk.HORIZONTAL, variable=self.emotion_vars[emotion])
            s.pack(fill=tk.X, padx=2, pady=4)

        # update scrollregion
        sliders_frame.update_idletasks()
        canvas.config(scrollregion=canvas.bbox('all'))

        # Bottom frame: recommend button and results
        bottom = ttk.Frame(self)
        bottom.pack(fill=tk.X, padx=10, pady=10)

        rec_btn = ttk.Button(bottom, text="Recommend Top 3", command=self.recommend)
        rec_btn.pack(side=tk.LEFT, padx=10)

        reset_btn = ttk.Button(bottom, text="Reset sliders", command=self.reset_sliders)
        reset_btn.pack(side=tk.LEFT, padx=10)

        self.results_box = tk.Text(self, height=8, wrap='word')
        self.results_box.pack(fill=tk.BOTH, padx=10, pady=(0,10))
        self.results_box.config(state=tk.DISABLED)

    def reset_sliders(self):
        for v in self.emotion_vars.values():
            v.set(5.0)
        self.min_imdb.set(0.0)
        for v in self.time_vars.values():
            v.set(1)

    def recommend(self):
        # build timeframe mask
        selected_bins = [k for k, v in self.time_vars.items() if v.get()]
        if selected_bins:
            mask = np.zeros(len(self.df), dtype=bool)
            for b in selected_bins:
                cond = self.df['year'].apply(lambda y: RELEASE_BINS[b](y) if not pd.isna(y) else False)
                mask |= cond.to_numpy()
        else:
            mask = np.ones(len(self.df), dtype=bool)

        # apply IMDB filter
        try:
            min_r = float(self.min_imdb.get())
        except Exception:
            min_r = 0.0
        mask &= (self.df['imdb'].fillna(0) >= min_r)

        if not mask.any():
            messagebox.showinfo("No matches", "No movies match your timeframe and rating filters.")
            return

        # user emotion vector (scale to 0-1)
        user_vec = np.array([self.emotion_vars[e].get() for e in EMOTIONS], dtype=float) / 10.0
        user_norm = np.linalg.norm(user_vec)
        if user_norm == 0:
            messagebox.showerror("Input error", "Please set at least one emotion slider above 0.")
            return
        user_unit = user_vec / user_norm

        # normalize movie vectors
        movie_vecs = self.movie_matrix.copy()
        norms = np.linalg.norm(movie_vecs, axis=1)
        zero_norms = norms == 0
        norms[zero_norms] = 1.0  # avoid div by zero
        movie_unit = (movie_vecs.T / norms).T

        # compute similarities for filtered movies
        indices = np.where(mask)[0]
        sim = movie_unit[indices].dot(user_unit)

        # rank and pick top 3
        top_k = min(3, len(sim))
        order = np.argsort(-sim)[:top_k]

        results = []
        for idx in order:
            movie_i = indices[idx]
            row = self.df.iloc[movie_i]
            results.append((row['title'], int(row['year']) if not pd.isna(row['year']) else "N/A",
                            row.get('genres', ''), row.get('imdb', ''), sim[idx]))

        # show results
        self.results_box.config(state=tk.NORMAL)
        self.results_box.delete('1.0', tk.END)
        if results:
            for i, (title, year, genres, imdb, score) in enumerate(results, start=1):
                self.results_box.insert(tk.END, f"{i}. {title} ({year})\n")
                self.results_box.insert(tk.END, f"   Genres: {genres}    IMDB: {imdb}    Similarity: {score:.3f}\n\n")
        else:
            self.results_box.insert(tk.END, "No movies found after filtering.")
        self.results_box.config(state=tk.DISABLED)


if __name__ == '__main__':
    if not os.path.exists(CSV_FILENAME):
        print(f"CSV file not found: {CSV_FILENAME}")
    else:
        app = MovieRecommenderApp()
        app.mainloop()
