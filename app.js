const STORAGE_KEY = "workout-tracker-v1";

const form = document.getElementById("workout-form");
const workoutList = document.getElementById("workout-list");
const emptyState = document.getElementById("empty-state");
const filterType = document.getElementById("filter-type");
const stats = document.getElementById("stats");
const clearAllButton = document.getElementById("clear-all");

/** @type {Array<{
 * id: string,
 * date: string,
 * type: string,
 * exercise: string,
 * sets: number | null,
 * reps: number | null,
 * weight: number | null,
 * duration: number | null,
 * notes: string
 * }>} */
let workouts = loadWorkouts();

setDefaultDate();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const newWorkout = {
    id: crypto.randomUUID(),
    date: document.getElementById("date").value,
    type: document.getElementById("type").value,
    exercise: document.getElementById("exercise").value.trim(),
    sets: parseOptionalNumber(document.getElementById("sets").value),
    reps: parseOptionalNumber(document.getElementById("reps").value),
    weight: parseOptionalNumber(document.getElementById("weight").value),
    duration: parseOptionalNumber(document.getElementById("duration").value),
    notes: document.getElementById("notes").value.trim(),
  };

  workouts.unshift(newWorkout);
  saveWorkouts(workouts);

  form.reset();
  setDefaultDate();
  render();
});

filterType.addEventListener("change", render);

clearAllButton.addEventListener("click", () => {
  const shouldDelete = window.confirm("Delete all stored workouts?");
  if (!shouldDelete) return;

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

  stats.innerHTML = `
    <div class="stat"><strong>${totalWorkouts}</strong><span>Workouts</span></div>
    <div class="stat"><strong>${totalMinutes}</strong><span>Minutes</span></div>
    <div class="stat"><strong>${totalVolume}</strong><span>Volume (lb)</span></div>
    <div class="stat"><strong>${uniqueExercises}</strong><span>Exercises</span></div>
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
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function loadWorkouts() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed;
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
