"""Multi-User Emotion-Based Movie Recommender (GUI)

- Based on `movie_recommender_gui_souj.py` UI and logic
- Allows setting number of users, editing each user's emotion sliders (0-10)
- Computes each user's Top-3 recommendations, Group Top-3 (mean vector),
  pairwise cosine similarity matrix, and a consensus coefficient

Run: python multi_user_recommender.py
"""

import os
import tkinter as tk
from tkinter import ttk, messagebox
import pandas as pd
import numpy as np

# --- Config (reused from original GUI) ---
EMOTIONS = [
    "joy","sadness","fear","anger","disgust","surprise","trust",
    "anticipation","curiosity","excitement","hope","love","guilt",
    "shame","gratitude","loneliness","confidence","determination",
    "regret","relief","nostalgia","compassion","anxiety","inspiration",
]

CSV_FILENAME = os.path.join(os.path.dirname(__file__), "movies_emotions_50_souj.csv")


class MultiUserRecommenderApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Multi-User Emotion-Based Recommender")
        self.geometry("1100x700")

        if not os.path.exists(CSV_FILENAME):
            messagebox.showerror("CSV not found", f"CSV file not found: {CSV_FILENAME}")
            self.destroy(); return

        self.df = pd.read_csv(CSV_FILENAME)
        # ensure numeric columns
        for col in ["year", "imdb"]:
            if col in self.df.columns:
                self.df[col] = pd.to_numeric(self.df[col], errors="coerce")

        # movie emotion matrix
        self.movie_matrix = self.df[EMOTIONS].fillna(0).to_numpy(dtype=float)
        # prepare movie unit vectors for cosine similarity
        norms = np.linalg.norm(self.movie_matrix, axis=1)
        norms[norms == 0] = 1.0
        self.movie_unit = (self.movie_matrix.T / norms).T

        # UI state
        self.num_users_var = tk.IntVar(value=2)
        self.user_tabs = None
        self.user_emotion_vars = []  # list of dicts per user

        self._build_ui()

    def _build_ui(self):
        # Top controls: number of users and actions
        top = ttk.Frame(self)
        top.pack(fill=tk.X, padx=10, pady=8)

        ttk.Label(top, text="Number of users:").pack(side=tk.LEFT)
        spin = ttk.Spinbox(top, from_=1, to=12, width=5, textvariable=self.num_users_var)
        spin.pack(side=tk.LEFT, padx=6)

        create_btn = ttk.Button(top, text="Create User Tabs", command=self._create_user_tabs)
        create_btn.pack(side=tk.LEFT, padx=6)

        compute_btn = ttk.Button(top, text="Compute Group Recommendations", command=self.compute_group)
        compute_btn.pack(side=tk.LEFT, padx=6)

        reset_btn = ttk.Button(top, text="Reset All", command=self.reset_all)
        reset_btn.pack(side=tk.LEFT, padx=6)

        # Left: Notebook with one tab per user
        left = ttk.Frame(self)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=8)

        self.user_tabs = ttk.Notebook(left)
        self.user_tabs.pack(fill=tk.BOTH, expand=True)

        # Right: results text
        right = ttk.Frame(self)
        right.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=10, pady=8)

        results_label = ttk.Label(right, text="Results:")
        results_label.pack(anchor=tk.W)

        self.results_box = tk.Text(right, height=40, width=60, wrap='word')
        self.results_box.pack(fill=tk.BOTH, expand=True)
        self.results_box.config(state=tk.DISABLED)

        # initialize tabs
        self._create_user_tabs()

    def _create_user_tabs(self):
        n = int(self.num_users_var.get())
        # clear previous
        for child in self.user_tabs.winfo_children():
            child.destroy()
        self.user_emotion_vars = []

        for i in range(n):
            frame = ttk.Frame(self.user_tabs)
            self.user_tabs.add(frame, text=f"User {i+1}")

            # sliders frame with two columns
            sliders_frame = ttk.Frame(frame)
            sliders_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=6)

            col_frames = [ttk.Frame(sliders_frame) for _ in range(2)]
            for cf in col_frames:
                cf.pack(side=tk.LEFT, padx=10, pady=5, fill=tk.BOTH, expand=True)

            vars_map = {}
            for j, emotion in enumerate(EMOTIONS):
                f = col_frames[j % 2]
                lbl = ttk.Label(f, text=emotion.title())
                lbl.pack(anchor=tk.W)
                var = tk.DoubleVar(value=5.0)
                s = ttk.Scale(f, from_=0, to=10, orient=tk.HORIZONTAL, variable=var)
                s.pack(fill=tk.X, padx=2, pady=4)
                vars_map[emotion] = var

            # quick actions per user
            btn_frame = ttk.Frame(frame)
            btn_frame.pack(fill=tk.X, padx=10, pady=6)

            preview_btn = ttk.Button(btn_frame, text="Preview Top-3", command=lambda idx=i: self.preview_user_topk(idx))
            preview_btn.pack(side=tk.LEFT, padx=4)

            clear_btn = ttk.Button(btn_frame, text="Reset Sliders", command=lambda vm=vars_map: self._reset_vars(vm))
            clear_btn.pack(side=tk.LEFT, padx=4)

            self.user_emotion_vars.append(vars_map)

    def _reset_vars(self, vars_map):
        for v in vars_map.values():
            v.set(5.0)

    def preview_user_topk(self, user_idx):
        vec_unit = self._get_user_unit_vector(user_idx)
        if vec_unit is None:
            messagebox.showerror("Input error", f"User {user_idx+1}: set at least one emotion slider > 0")
            return
        sim = self.movie_unit.dot(vec_unit)
        order = np.argsort(-sim)[:3]
        content = f"User {user_idx+1} Top-3:\n"
        for rank, idx in enumerate(order, start=1):
            row = self.df.iloc[idx]
            content += f"{rank}. {row['title']} ({int(row['year']) if not pd.isna(row['year']) else 'N/A'}) - Similarity: {sim[idx]:.3f}\n"
        self._append_results(content)

    def _get_user_unit_vector(self, user_idx):
        vars_map = self.user_emotion_vars[user_idx]
        vec = np.array([vars_map[e].get() for e in EMOTIONS], dtype=float) / 10.0
        norm = np.linalg.norm(vec)
        if norm == 0:
            return None
        return vec / norm

    def compute_group(self):
        n = len(self.user_emotion_vars)
        # build unit vectors and check validity
        user_units = []
        for i in range(n):
            u = self._get_user_unit_vector(i)
            if u is None:
                messagebox.showerror("Input error", f"User {i+1} must set at least one emotion slider > 0")
                return
            user_units.append(u)
        U = np.vstack(user_units)

        # per-user Top-3
        per_user_top3 = []
        per_user_sims = []
        for i, u in enumerate(user_units):
            sim = self.movie_unit.dot(u)
            order = np.argsort(-sim)[:3]
            per_user_top3.append([self.df.iloc[idx]['title'] for idx in order])
            per_user_sims.append(sim)

        # group vector: mean of original (non-unit) scaled vectors to preserve intensity
        original_vecs = [np.array([self.user_emotion_vars[i][e].get() for e in EMOTIONS], dtype=float) / 10.0 for i in range(n)]
        group_vec = np.mean(np.vstack(original_vecs), axis=0)
        group_norm = np.linalg.norm(group_vec)
        if group_norm == 0:
            messagebox.showerror("Input error", "Group vector is zero. At least one user must set an emotion above 0.")
            return
        group_unit = group_vec / group_norm

        group_sim = self.movie_unit.dot(group_unit)
        group_order = np.argsort(-group_sim)[:3]
        group_top3 = [self.df.iloc[idx]['title'] for idx in group_order]

        # pairwise cosine similarities between users (dot of unit vectors)
        sims = U.dot(U.T)

        # consensus coefficient: mean of upper triangle excluding diagonal, or 1.0 if single user
        if n == 1:
            consensus = 1.0
        else:
            iu = np.triu_indices(n, k=1)
            consensus = float(np.mean(sims[iu]))

        # similarity of each user to group
        user_to_group = [float(np.dot(u, group_unit)) for u in user_units]

        # build results output
        out = []
        out.append("\n=== Individual Top-3 Recommendations ===\n")
        for i, titles in enumerate(per_user_top3, start=1):
            out.append(f"User {i} Top-3:\n")
            for r, t in enumerate(titles, start=1):
                # show score from per_user_sims
                idx = per_user_sims[i-1].argmax() if False else None  # placeholder not used
                out.append(f"  {r}. {t}\n")
            out.append("\n")

        out.append("=== Group Top-3 (Averaged) ===\n")
        for r, idx in enumerate(group_order, start=1):
            row = self.df.iloc[idx]
            out.append(f"  {r}. {row['title']} ({int(row['year']) if not pd.isna(row['year']) else 'N/A'}) - Similarity: {group_sim[idx]:.3f}\n")
        out.append("\n")

        out.append("=== Pairwise Cosine Similarity (users) ===\n")
        # header
        hdr = "     " + " ".join([f"U{j+1:>6}" for j in range(n)])
        out.append(hdr + "\n")
        for i in range(n):
            row = " ".join([f"{sims[i,j]:6.3f}" for j in range(n)])
            out.append(f"U{i+1:<3} {row}\n")
        out.append("\n")

        out.append(f"Consensus coefficient: {consensus:.3f} ({consensus*100:.1f}% average similarity)\n\n")

        out.append("=== User -> Group Similarities & Overlap with Group Top-3 ===\n")
        group_titles_set = set(group_top3)
        for i, sim_val in enumerate(user_to_group, start=1):
            user_top_set = set(per_user_top3[i-1])
            overlap = len(user_top_set & group_titles_set)
            out.append(f"User {i}: similarity to group = {sim_val:.3f}    overlap with group top-3 = {overlap}/3\n")

        # show results
        self._set_results(''.join(out))

    def _append_results(self, content):
        self.results_box.config(state=tk.NORMAL)
        self.results_box.insert(tk.END, content + "\n")
        self.results_box.see(tk.END)
        self.results_box.config(state=tk.DISABLED)

    def _set_results(self, content):
        self.results_box.config(state=tk.NORMAL)
        self.results_box.delete('1.0', tk.END)
        self.results_box.insert(tk.END, content)
        self.results_box.see(tk.END)
        self.results_box.config(state=tk.DISABLED)

    def reset_all(self):
        # reset number of users to 2 and all sliders to default 5
        self.num_users_var.set(2)
        self._create_user_tabs()
        self._set_results("")


if __name__ == '__main__':
    app = MultiUserRecommenderApp()
    app.mainloop()

