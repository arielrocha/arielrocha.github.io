const STORAGE_KEY = "workout-tracker-v2";

const form = document.getElementById("workout-form");
const workoutList = document.getElementById("workout-list");
const emptyState = document.getElementById("empty-state");
const filterType = document.getElementById("filter-type");
const stats = document.getElementById("stats");
const clearAllButton = document.getElementById("clear-all");
const importFileInput = document.getElementById("import-file");
const importButton = document.getElementById("import-button");
const importResult = document.getElementById("import-result");
const aiInput = document.getElementById("ai-input");
const aiSend = document.getElementById("ai-send");
const aiChat = document.getElementById("ai-chat");

let workouts = loadWorkouts();

setDefaultDate();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const newWorkout = normalizeWorkout({
    id: crypto.randomUUID(),
    date: document.getElementById("date").value,
    type: document.getElementById("type").value,
    exercise: document.getElementById("exercise").value,
    description: document.getElementById("description").value,
    sets: document.getElementById("sets").value,
    reps: document.getElementById("reps").value,
    weight: document.getElementById("weight").value,
    duration: document.getElementById("duration").value,
    notes: document.getElementById("notes").value,
  });

  workouts.unshift(newWorkout);
  saveWorkouts(workouts);

  form.reset();
  setDefaultDate();
  render();
});

filterType.addEventListener("change", render);

clearAllButton.addEventListener("click", () => {
  if (!window.confirm("Delete all stored workouts?")) return;

  workouts = [];
  saveWorkouts(workouts);
  render();
});

workoutList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const id = target.dataset.id;
  if (!id) return;

  workouts = workouts.filter((w) => w.id !== id);
  saveWorkouts(workouts);
  render();
});

importButton.addEventListener("click", async () => {
  const file = importFileInput.files?.[0];
  if (!file) {
    importResult.textContent = "Please choose a file first.";
    return;
  }

  try {
    const imported = await importWorkoutsFromFile(file);
    const valid = imported
      .map((item) => normalizeWorkout({ ...item, id: crypto.randomUUID() }))
      .filter((item) => item.exercise);

    workouts = [...valid, ...workouts];
    saveWorkouts(workouts);
    render();

    importResult.textContent = `Imported ${valid.length} workout entries from ${file.name}.`;
  } catch (error) {
    importResult.textContent = `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
});

aiSend.addEventListener("click", handleAskAi);
aiInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleAskAi();
  }
});

function handleAskAi() {
  const question = aiInput.value.trim();
  if (!question) return;

  appendChat("user", question);
  aiInput.value = "";

  const response = generateAiResponse(question);
  appendChat("bot", response);
}

function appendChat(role, text) {
  const row = document.createElement("div");
  row.className = `chat-row ${role}`;
  row.textContent = text;
  aiChat.appendChild(row);
  aiChat.scrollTop = aiChat.scrollHeight;
}

function render() {
  const filtered = getFilteredWorkouts();
  renderStats(filtered);

  workoutList.innerHTML = "";

  filtered.forEach((workout) => {
    const item = document.createElement("li");
    item.className = "workout-item";

    const metrics = [
      workout.sets != null ? `${workout.sets} sets` : null,
      workout.reps != null ? `${workout.reps} reps` : null,
      workout.weight != null ? `${workout.weight} lb` : null,
      workout.duration != null ? `${workout.duration} min` : null,
    ]
      .filter(Boolean)
      .join(" • ");

    item.innerHTML = `
      <div class="workout-top">
        <strong>${escapeHtml(workout.exercise)}</strong>
        <span class="badge">${escapeHtml(workout.type)}</span>
      </div>
      <div class="meta">${formatDate(workout.date)}${metrics ? ` • ${metrics}` : ""}</div>
      ${workout.description ? `<div class="description">${escapeHtml(workout.description)}</div>` : ""}
      ${workout.notes ? `<div class="notes">${escapeHtml(workout.notes)}</div>` : ""}
      <button class="small-btn danger" type="button" data-id="${workout.id}">Delete</button>
    `;

    workoutList.appendChild(item);
  });

  emptyState.style.display = filtered.length > 0 ? "none" : "block";
}

function renderStats(entries) {
  const totalWorkouts = entries.length;
  const totalMinutes = entries.reduce((sum, item) => sum + (item.duration ?? 0), 0);
  const totalVolume = entries.reduce((sum, item) => {
    if (item.sets == null || item.reps == null || item.weight == null) return sum;
    return sum + item.sets * item.reps * item.weight;
  }, 0);
  const uniqueExercises = new Set(entries.map((item) => item.exercise.toLowerCase())).size;
  const averageWeight = Number(
    (entries.filter((item) => item.weight != null).reduce((sum, item) => sum + (item.weight ?? 0), 0) /
      Math.max(entries.filter((item) => item.weight != null).length, 1)).toFixed(1)
  );

  stats.innerHTML = `
    <div class="stat"><strong>${totalWorkouts}</strong><span>Workouts</span></div>
    <div class="stat"><strong>${totalMinutes}</strong><span>Minutes</span></div>
    <div class="stat"><strong>${totalVolume}</strong><span>Volume (lb)</span></div>
    <div class="stat"><strong>${uniqueExercises}</strong><span>Exercises</span></div>
    <div class="stat"><strong>${averageWeight}</strong><span>Avg Weight</span></div>
  `;
}

function getFilteredWorkouts() {
  const selected = filterType.value;
  if (selected === "all") return workouts;
  return workouts.filter((item) => item.type === selected);
}

function setDefaultDate() {
  const dateInput = document.getElementById("date");
  dateInput.value = new Date().toISOString().split("T")[0];
}

function parseOptionalNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeWorkout(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    date: normalizeDate(raw.date),
    type: normalizeType(raw.type),
    exercise: String(raw.exercise ?? "").trim(),
    description: String(raw.description ?? raw.explanation ?? "").trim(),
    sets: parseOptionalNumber(raw.sets),
    reps: parseOptionalNumber(raw.reps),
    weight: parseOptionalNumber(raw.weight),
    duration: parseOptionalNumber(raw.duration),
    notes: String(raw.notes ?? "").trim(),
  };
}

function normalizeType(value) {
  const incoming = String(value ?? "").toLowerCase().trim();
  const types = ["strength", "cardio", "mobility", "sport", "other"];
  const found = types.find((item) => item === incoming);
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : "Other";
}

function normalizeDate(value) {
  if (!value) return new Date().toISOString().split("T")[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split("T")[0];
  return date.toISOString().split("T")[0];
}

function loadWorkouts() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeWorkout).filter((item) => item.exercise);
  } catch {
    return [];
  }
}

function saveWorkouts(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function formatDate(date) {
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

async function importWorkoutsFromFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "json") {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("JSON must be an array of entries.");
    return parsed.map(mapIncomingRow);
  }

  if (ext === "xlsx" || ext === "xls") {
    if (typeof XLSX === "undefined") throw new Error("Spreadsheet parser failed to load.");

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return rows.map(mapIncomingRow);
  }

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    const text = await file.text();
    return parseDelimitedText(text, ext === "tsv" ? "\t" : ",").map(mapIncomingRow);
  }

  throw new Error("Unsupported format. Use CSV/TSV/TXT/JSON/XLSX.");
}

function parseDelimitedText(text, delimiter) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function mapIncomingRow(row) {
  return {
    date: pick(row, ["date", "day", "workout_date"]),
    type: pick(row, ["type", "category", "workout_type"]),
    exercise: pick(row, ["exercise", "name", "movement"]),
    description: pick(row, ["description", "explanation", "details"]),
    sets: pick(row, ["sets"]),
    reps: pick(row, ["reps", "rep"]),
    weight: pick(row, ["weight", "load", "lbs"]),
    duration: pick(row, ["duration", "minutes", "mins"]),
    notes: pick(row, ["notes", "comment", "comments"]),
  };
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") return row[key];
    const foundKey = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase());
    if (foundKey && row[foundKey] !== "") return row[foundKey];
  }
  return "";
}

function generateAiResponse(question) {
  const q = question.toLowerCase();
  const entries = getFilteredWorkouts();

  if (entries.length === 0) {
    return "You don't have workouts logged yet. Import a file or add one manually, then ask again.";
  }

  if (q.includes("summarize") || q.includes("summary") || q.includes("week")) {
    const totalWorkouts = entries.length;
    const totalMinutes = entries.reduce((sum, item) => sum + (item.duration ?? 0), 0);
    const topExercise = mostFrequent(entries.map((item) => item.exercise));
    return `Summary: ${totalWorkouts} workouts, ${totalMinutes} total minutes. Most frequent exercise: ${topExercise}.`;
  }

  if (q.includes("tomorrow") || q.includes("plan")) {
    const recentType = entries[0]?.type ?? "Strength";
    const alt = recentType === "Cardio" ? "Strength" : "Cardio";
    return `Suggested plan for tomorrow: 1) 5-10 min warm-up, 2) ${alt} focus session, 3) 5 min cooldown + mobility.`;
  }

  if (q.includes("improve") || q.includes("better") || q.includes("progress")) {
    return "Progress tip: add 2.5-5 lb when form is solid, or add 1-2 reps per set first. Keep notes on effort and recovery.";
  }

  return "I can help with summaries, next-day plans, and progress tips. Try: 'Summarize this week' or 'Suggest tomorrow plan'.";
}

function mostFrequent(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  let best = "N/A";
  let bestCount = 0;

  for (const [item, count] of counts.entries()) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }

  return best;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
