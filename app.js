/**
 * Multi-User Emotion-Based Movie Recommender (Web)
 * Same logic as multi_user_recommender.py; dataset: movies_dataset_500_souj.csv
 */

const EMOTIONS = [
  'joy', 'sadness', 'fear', 'anger', 'disgust', 'surprise', 'trust',
  'anticipation', 'curiosity', 'excitement', 'hope', 'love', 'guilt',
  'shame', 'gratitude', 'loneliness', 'confidence', 'determination',
  'regret', 'relief', 'nostalgia', 'compassion', 'anxiety', 'inspiration'
];

const CSV_URL = 'datasets/movies_dataset_500_souj.csv';

let df = [];
let movieMatrix = [];
let movieUnit = [];
let movieNorms = [];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = values[j] !== undefined ? values[j] : '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n' || c === '\r') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1;
}

function loadDataset() {
  const loading = document.getElementById('loading');
  loading.hidden = false;
  return fetch(CSV_URL)
    .then(r => {
      if (!r.ok) throw new Error('Could not load dataset. Run a local server from the project root (e.g. python server.py).');
      return r.text();
    })
    .then(text => {
      df = parseCSV(text);
      if (!df.length) throw new Error('Dataset is empty.');
      for (const row of df) {
        if (row.year != null) row.year = parseInt(row.year, 10) || null;
        if (row.imdb != null) row.imdb = parseFloat(row.imdb) || null;
      }
      const M = df.map(row => EMOTIONS.map(e => parseFloat(row[e]) || 0));
      movieMatrix = M;
      movieNorms = M.map(row => norm(row));
      movieNorms = movieNorms.map(n => n === 0 ? 1 : n);
      movieUnit = movieMatrix.map((row, i) => row.map((v, j) => v / movieNorms[i]));
      loading.hidden = true;
      document.getElementById('computeBtn').disabled = false;
      const status = document.getElementById('dataStatus');
      if (status) status.textContent = `${df.length} movies loaded`;
      ensureOneUser();
    })
    .catch(err => {
      loading.hidden = true;
      showToast(err.message);
    });
}

function showToast(msg, durationMs) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.whiteSpace = 'pre-wrap';
  el.hidden = false;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => { el.hidden = true; }, durationMs || 4000);
}

function ensureOneUser() {
  const section = document.getElementById('usersSection');
  const addCard = document.getElementById('addUserCard');
  const cards = section.querySelectorAll('.user-card');
  if (cards.length === 0) addUser();
}

function addUser() {
  const section = document.getElementById('usersSection');
  const addCard = document.getElementById('addUserCard');
  const users = section.querySelectorAll('.user-card');
  const nextId = users.length + 1;

  const card = document.createElement('div');
  card.className = 'user-card';
  card.dataset.userIndex = String(users.length);

  const header = document.createElement('div');
  header.className = 'user-card-header';
  const title = document.createElement('h3');
  title.textContent = `User ${nextId}`;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn btn-remove';
  removeBtn.textContent = 'Remove';
  removeBtn.addEventListener('click', () => removeUser(card));
  header.appendChild(title);
  header.appendChild(removeBtn);
  card.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'sliders-grid';
  const inputs = {};
  EMOTIONS.forEach(emotion => {
    const wrap = document.createElement('div');
    wrap.className = 'slider-wrap';
    const label = document.createElement('label');
    label.textContent = emotion;
    label.htmlFor = `user-${nextId}-${emotion}`;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.max = 10;
    input.value = 5;
    input.step = 0.5;
    input.id = `user-${nextId}-${emotion}`;
    input.dataset.emotion = emotion;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'slider-value';
    valueSpan.textContent = '5';
    input.addEventListener('input', () => { valueSpan.textContent = input.value; });
    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(valueSpan);
    grid.appendChild(wrap);
    inputs[emotion] = input;
  });
  card.appendChild(grid);

  const btnRow = document.createElement('div');
  btnRow.className = 'toolbar';
  btnRow.style.marginTop = '0.5rem';
  btnRow.style.marginBottom = '0';
  const resetOneBtn = document.createElement('button');
  resetOneBtn.type = 'button';
  resetOneBtn.className = 'btn btn-ghost';
  resetOneBtn.style.fontSize = '0.8rem';
  resetOneBtn.textContent = 'Reset sliders';
  resetOneBtn.addEventListener('click', () => {
    EMOTIONS.forEach(e => {
      inputs[e].value = 5;
      const wrap = inputs[e].closest('.slider-wrap');
      const val = wrap && wrap.querySelector('.slider-value');
      if (val) val.textContent = '5';
    });
  });
  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'btn btn-ghost';
  previewBtn.style.fontSize = '0.8rem';
  previewBtn.textContent = 'Preview my top 3';
  previewBtn.addEventListener('click', () => previewUserTop3(card));
  btnRow.appendChild(resetOneBtn);
  btnRow.appendChild(previewBtn);
  card.appendChild(btnRow);
  card._inputs = inputs;

  // Insert before the wrapper (addCard is inside add-user-wrap; only direct children work for insertBefore)
  const insertBeforeRef = addCard.closest('.add-user-wrap') || addCard.parentElement || addCard;
  section.insertBefore(card, insertBeforeRef);
  renumberUserTitles();
}

function removeUser(card) {
  const section = document.getElementById('usersSection');
  const users = section.querySelectorAll('.user-card');
  if (users.length <= 1) {
    showToast('Keep at least one user.');
    return;
  }
  card.remove();
  renumberUserTitles();
}

function renumberUserTitles() {
  const section = document.getElementById('usersSection');
  const cards = section.querySelectorAll('.user-card');
  cards.forEach((c, i) => {
    const h = c.querySelector('h3');
    if (h) h.textContent = `User ${i + 1}`;
    c.dataset.userIndex = String(i);
  });
}

function getUserVectors() {
  const section = document.getElementById('usersSection');
  const cards = section.querySelectorAll('.user-card');
  const vectors = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const inputs = card._inputs;
    if (!inputs) continue;
    const raw = EMOTIONS.map(e => parseFloat(inputs[e].value) || 0);
    const scaled = raw.map(x => x / 10);
    const n = norm(scaled);
    if (n === 0) return { error: `User ${i + 1}: set at least one emotion slider above 0.` };
    vectors.push(scaled.map(x => x / n));
  }
  return { vectors };
}

function getOriginalScaledVectors() {
  const section = document.getElementById('usersSection');
  const cards = section.querySelectorAll('.user-card');
  const vecs = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const inputs = card._inputs;
    if (!inputs) continue;
    const raw = EMOTIONS.map(e => parseFloat(inputs[e].value) || 0);
    vecs.push(raw.map(x => x / 10));
  }
  return vecs;
}

function compute() {
  const result = getUserVectors();
  if (result.error) {
    showToast(result.error);
    return;
  }
  const userUnits = result.vectors;
  const n = userUnits.length;

  const U = userUnits.map(u => u.slice());

  const perUserTop3 = [];
  const perUserSims = [];
  for (let i = 0; i < n; i++) {
    const sim = movieUnit.map(row => {
      let d = 0;
      for (let j = 0; j < EMOTIONS.length; j++) d += row[j] * userUnits[i][j];
      return d;
    });
    perUserSims.push(sim);
    const order = sim
      .map((s, idx) => ({ s, idx }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(x => x.idx);
    perUserTop3.push(order.map(idx => ({ idx, title: df[idx].title, year: df[idx].year, sim: sim[idx] })));
  }

  const originalVecs = getOriginalScaledVectors();
  let groupVec = originalVecs[0].slice();
  for (let i = 1; i < originalVecs.length; i++) {
    for (let j = 0; j < groupVec.length; j++) groupVec[j] += originalVecs[i][j];
  }
  for (let j = 0; j < groupVec.length; j++) groupVec[j] /= n;
  const groupNorm = norm(groupVec);
  if (groupNorm === 0) {
    showToast('Group vector is zero. At least one user must set an emotion above 0.');
    return;
  }
  const groupUnit = groupVec.map(x => x / groupNorm);

  const groupSim = movieUnit.map(row => {
    let d = 0;
    for (let j = 0; j < EMOTIONS.length; j++) d += row[j] * groupUnit[j];
    return d;
  });
  const groupOrder = groupSim
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(x => ({ idx: x.idx, title: df[x.idx].title, year: df[x.idx].year, sim: x.s }));

  const pairwise = [];
  for (let i = 0; i < n; i++) {
    pairwise[i] = [];
    for (let j = 0; j < n; j++) {
      let d = 0;
      for (let k = 0; k < EMOTIONS.length; k++) d += U[i][k] * U[j][k];
      pairwise[i][j] = d;
    }
  }

  let consensus = 1;
  if (n > 1) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sum += pairwise[i][j];
        count++;
      }
    }
    consensus = count ? sum / count : 1;
  }

  const userToGroup = userUnits.map(u => {
    let d = 0;
    for (let k = 0; k < EMOTIONS.length; k++) d += u[k] * groupUnit[k];
    return d;
  });

  const groupTitlesSet = new Set(groupOrder.map(x => x.title));
  const overlaps = perUserTop3.map(tops => {
    const userSet = new Set(tops.map(t => t.title));
    let count = 0;
    groupTitlesSet.forEach(t => { if (userSet.has(t)) count++; });
    return count;
  });

  renderResults({
    perUserTop3,
    groupOrder,
    pairwise,
    consensus,
    userToGroup,
    overlaps,
    n
  });
}

function renderResults(data) {
  const section = document.getElementById('resultsSection');
  const content = document.getElementById('resultsContent');
  content.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'results-grid';

  for (let i = 0; i < data.n; i++) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = '<h4>User ' + (i + 1) + ' — Top 3</h4><ul></ul>';
    const ul = card.querySelector('ul');
    data.perUserTop3[i].forEach((item, r) => {
      const li = document.createElement('li');
      const yearStr = item.year != null && !isNaN(item.year) ? item.year : 'N/A';
      li.innerHTML = `${r + 1}. ${escapeHtml(item.title)} (${yearStr}) <span class="similarity-badge">${item.sim.toFixed(3)}</span>`;
      ul.appendChild(li);
    });
    grid.appendChild(card);
  }

  const groupCard = document.createElement('div');
  groupCard.className = 'result-card group';
  groupCard.innerHTML = '<h4>Group top 3 (averaged)</h4><ul></ul>';
  const groupUl = groupCard.querySelector('ul');
  data.groupOrder.forEach((item, r) => {
    const li = document.createElement('li');
    const yearStr = item.year != null && !isNaN(item.year) ? item.year : 'N/A';
    li.innerHTML = `${r + 1}. ${escapeHtml(item.title)} (${yearStr}) <span class="similarity-badge">${item.sim.toFixed(3)}</span>`;
    groupUl.appendChild(li);
  });
  grid.appendChild(groupCard);

  const matrixCard = document.createElement('div');
  matrixCard.className = 'result-card';
  matrixCard.innerHTML = '<h4>Pairwise cosine similarity (users)</h4><div class="matrix-wrap"></div>';
  const matrixWrap = matrixCard.querySelector('.matrix-wrap');
  const table = document.createElement('table');
  table.className = 'matrix-table';
  let thead = '<tr><th></th>';
  for (let j = 0; j < data.n; j++) thead += `<th>U${j + 1}</th>`;
  thead += '</tr>';
  table.innerHTML = thead;
  for (let i = 0; i < data.n; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<th>U${i + 1}</th>`;
    for (let j = 0; j < data.n; j++) {
      const td = document.createElement('td');
      td.textContent = data.pairwise[i][j].toFixed(3);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  matrixWrap.appendChild(table);
  grid.appendChild(matrixCard);

  const consensusCard = document.createElement('div');
  consensusCard.className = 'result-card';
  consensusCard.innerHTML = `
    <h4>Consensus</h4>
    <div class="consensus-box">
      <span class="value">${(data.consensus * 100).toFixed(1)}%</span>
      <span class="label">average similarity between users</span>
    </div>
  `;
  grid.appendChild(consensusCard);

  const overlapCard = document.createElement('div');
  overlapCard.className = 'result-card';
  let overlapHtml = '<h4>User → group similarity & overlap with group top 3</h4><ul class="overlap-list">';
  for (let i = 0; i < data.n; i++) {
    overlapHtml += `<li><span class="dot"></span> User ${i + 1}: similarity to group = <strong>${data.userToGroup[i].toFixed(3)}</strong>, overlap with group top-3 = <strong>${data.overlaps[i]}/3</strong></li>`;
  }
  overlapHtml += '</ul>';
  overlapCard.innerHTML = overlapHtml;
  grid.appendChild(overlapCard);

  content.appendChild(grid);
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function previewUserTop3(card) {
  const idx = parseInt(card.dataset.userIndex, 10);
  const inputs = card._inputs;
  if (!inputs) return;
  const raw = EMOTIONS.map(e => parseFloat(inputs[e].value) || 0);
  const scaled = raw.map(x => x / 10);
  const n = norm(scaled);
  if (n === 0) {
    showToast('Set at least one emotion slider above 0 to preview.');
    return;
  }
  const unit = scaled.map(x => x / n);
  const sim = movieUnit.map(row => {
    let d = 0;
    for (let j = 0; j < EMOTIONS.length; j++) d += row[j] * unit[j];
    return d;
  });
  const order = sim
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  const msg = order.map((x, r) => {
    const row = df[x.i];
    const yr = row.year != null && !isNaN(row.year) ? row.year : 'N/A';
    return `${r + 1}. ${row.title} (${yr}) — ${x.s.toFixed(3)}`;
  }).join('\n');
  showToast(`User ${idx + 1} top 3:\n${msg}`, 6000);
}

function resetAllSliders() {
  const section = document.getElementById('usersSection');
  section.querySelectorAll('.user-card input[type="range"]').forEach(input => {
    input.value = 5;
    const wrap = input.closest('.slider-wrap');
    const val = wrap && wrap.querySelector('.slider-value');
    if (val) val.textContent = '5';
  });
  showToast('All sliders reset to 5.');
}

function init() {
  document.getElementById('addUserCard').addEventListener('click', addUser);
  document.getElementById('addUserCard').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addUser(); }
  });
  document.getElementById('computeBtn').addEventListener('click', compute);
  document.getElementById('resetSlidersBtn').addEventListener('click', resetAllSliders);

  loadDataset();
}

init();
