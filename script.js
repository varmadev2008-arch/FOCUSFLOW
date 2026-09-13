/**
 * ============================================================================
 * FocusFlow — Minimal Study Session Timer & Task Tracker
 * ============================================================================
 * A clean, beginner-friendly JavaScript application using standard DOM APIs,
 * setInterval timer engine, and localStorage for persistence.
 */

// ============================================================================
// 1. CONSTANTS & CONFIGURATION
// ============================================================================
const STUDY_TIME_SECONDS = 25 * 60; // 25 minutes = 1500 seconds
const BREAK_TIME_SECONDS = 5 * 60;  // 5 minutes = 300 seconds

const STORAGE_KEYS = {
  TASKS: "focusflow_tasks",
  STATS: "focusflow_stats",
  LAST_DATE: "focusflow_last_date"
};

// ============================================================================
// 2. APPLICATION STATE
// ============================================================================
// Variables to hold the current runtime state of our app
let currentMode = "study";          // "study" or "break"
let timeLeft = STUDY_TIME_SECONDS;  // Remaining seconds
let timerId = null;                 // Holds the setInterval reference
let isRunning = false;              // Timer running flag

let tasks = [];                     // Array of task objects: [{ id, text, completed }]
let stats = {                       // Daily progress stats
  sessionsCompleted: 0,
  tasksCompleted: 0,
  totalFocusedMinutes: 0
};

// ============================================================================
// 3. DOM ELEMENT REFERENCES
// ============================================================================
// Cache all needed HTML elements for efficient DOM manipulation
const timerDisplay = document.getElementById("timerDisplay");
const timerModeLabel = document.getElementById("timerModeLabel");
const progressBar = document.getElementById("progressBar");
const startPauseBtn = document.getElementById("startPauseBtn");
const startPauseIcon = document.getElementById("startPauseIcon");
const startPauseText = document.getElementById("startPauseText");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const studyModeBtn = document.getElementById("studyModeBtn");
const breakModeBtn = document.getElementById("breakModeBtn");
const timerCard = document.querySelector(".timer-card");

const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const emptyState = document.getElementById("emptyState");
const taskSummary = document.getElementById("taskSummary");

const statSessionsEl = document.getElementById("statSessions");
const statTasksEl = document.getElementById("statTasks");
const statMinutesEl = document.getElementById("statMinutes");
const resetStatsBtn = document.getElementById("resetStatsBtn");
const currentDateBadge = document.getElementById("currentDateBadge");

// ============================================================================
// 4. AUDIO NOTIFICATION (Web Audio API)
// ============================================================================
/**
 * Plays a clean, pleasant notification tone using the browser's built-in Web Audio API.
 * This avoids requiring external MP3/audio files.
 */
function playChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (error) {
    console.log("Audio notification not supported or blocked by user gesture:", error);
  }
}

// ============================================================================
// 5. TIMER ENGINE FUNCTIONS
// ============================================================================

/**
 * Formats a number of seconds into "MM:SS" format.
 * @param {number} totalSeconds 
 * @returns {string} e.g. "25:00"
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Pad with leading zero if single digit (e.g. 5 -> "05")
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Updates the digital timer display, progress bar, and browser tab title.
 */
function updateDisplay() {
  const formatted = formatTime(timeLeft);
  timerDisplay.textContent = formatted;

  // Update browser tab title
  const modeName = currentMode === "study" ? "Study" : "Break";
  document.title = `(${formatted}) FocusFlow - ${modeName}`;

  // Update Progress Bar
  const totalDuration = currentMode === "study" ? STUDY_TIME_SECONDS : BREAK_TIME_SECONDS;
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;
  progressBar.style.width = `${progressPercent}%`;
}

/**
 * Starts or Resumes the countdown timer.
 */
function startTimer() {
  if (isRunning) return;

  isRunning = true;
  startPauseIcon.textContent = "⏸";
  startPauseText.textContent = "Pause";

  // setInterval runs our tick function every 1000 milliseconds (1 second)
  timerId = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateDisplay();
    } else {
      handleTimerComplete();
    }
  }, 1000);
}

/**
 * Pauses the countdown timer without resetting elapsed time.
 */
function pauseTimer() {
  if (!isRunning) return;

  isRunning = false;
  clearInterval(timerId);
  timerId = null;

  startPauseIcon.textContent = "▶";
  startPauseText.textContent = "Resume";
}

/**
 * Toggles between Start and Pause/Resume.
 */
function toggleStartPause() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

/**
 * Resets the timer to the beginning of the currently selected mode.
 */
function resetTimer() {
  pauseTimer();
  startPauseText.textContent = "Start";
  timeLeft = currentMode === "study" ? STUDY_TIME_SECONDS : BREAK_TIME_SECONDS;
  updateDisplay();
}

/**
 * Switches between 'study' and 'break' modes.
 * @param {string} mode - "study" | "break"
 * @param {boolean} autoStart - Whether to immediately start the timer after switching
 */
function switchMode(mode, autoStart = false) {
  pauseTimer();
  startPauseText.textContent = "Start";
  currentMode = mode;

  // Update Mode buttons UI
  if (mode === "study") {
    studyModeBtn.classList.add("active");
    breakModeBtn.classList.remove("active");
    timerModeLabel.textContent = "Focus Session";
    timerCard.classList.remove("mode-break");
    timeLeft = STUDY_TIME_SECONDS;
  } else {
    breakModeBtn.classList.add("active");
    studyModeBtn.classList.remove("active");
    timerModeLabel.textContent = "Short Break";
    timerCard.classList.add("mode-break");
    timeLeft = BREAK_TIME_SECONDS;
  }

  updateDisplay();

  if (autoStart) {
    startTimer();
  }
}

/**
 * Called automatically when the countdown reaches 00:00.
 */
function handleTimerComplete() {
  pauseTimer();
  playChime();

  if (currentMode === "study") {
    // Record completed study session & add focused minutes
    stats.sessionsCompleted++;
    stats.totalFocusedMinutes += Math.round(STUDY_TIME_SECONDS / 60);
    saveStats();
    renderStats();

    // Automatically transition to Short Break
    switchMode("break", true);
  } else {
    // Break is over, automatically transition back to Study
    switchMode("study", true);
  }
}

/**
 * Skip to the next mode manually.
 */
function skipToNextMode() {
  const nextMode = currentMode === "study" ? "break" : "study";
  switchMode(nextMode, false);
}

// ============================================================================
// 6. TASK MANAGEMENT (CRUD & localStorage)
// ============================================================================

/**
 * Renders the task list in the DOM.
 */
function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    emptyState.style.display = "block";
    taskSummary.textContent = "0 tasks";
    return;
  }

  emptyState.style.display = "none";
  const completedCount = tasks.filter(t => t.completed).length;
  taskSummary.textContent = `${completedCount} of ${tasks.length} done`;

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.dataset.id = task.id;

    // Left section (checkbox + text)
    const leftDiv = document.createElement("div");
    leftDiv.className = "task-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", "Mark task as completed");
    checkbox.addEventListener("change", () => toggleTaskCompletion(task.id));

    const textSpan = document.createElement("span");
    textSpan.className = "task-text";
    textSpan.textContent = task.text;

    leftDiv.appendChild(checkbox);
    leftDiv.appendChild(textSpan);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    li.appendChild(leftDiv);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

/**
 * Adds a new task to the list.
 * @param {string} text 
 */
function addTask(text) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  const newTask = {
    id: Date.now().toString(), // Unique timestamp ID
    text: trimmedText,
    completed: false
  };

  tasks.push(newTask);
  saveTasks();
  renderTasks();
}

/**
 * Toggles a task's completed state.
 * @param {string} id 
 */
function toggleTaskCompletion(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;

  // Update daily completed tasks stat count
  recalculateCompletedTasksCount();

  saveTasks();
  renderTasks();
}

/**
 * Deletes a task from the list.
 * @param {string} id 
 */
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  recalculateCompletedTasksCount();
  saveTasks();
  renderTasks();
}

/**
 * Calculates how many tasks are marked completed and updates the daily progress state.
 */
function recalculateCompletedTasksCount() {
  stats.tasksCompleted = tasks.filter(t => t.completed).length;
  saveStats();
  renderStats();
}

/**
 * Saves tasks array to localStorage.
 */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks to localStorage:", error);
  }
}

/**
 * Loads tasks array from localStorage.
 */
function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (saved) {
      tasks = JSON.parse(saved);
    } else {
      tasks = [];
    }
  } catch (error) {
    console.error("Failed to parse tasks from localStorage:", error);
    tasks = [];
  }
  renderTasks();
}

// ============================================================================
// 7. DAILY PROGRESS & STATS MANAGEMENT
// ============================================================================

/**
 * Returns today's date formatted as YYYY-MM-DD.
 * @returns {string}
 */
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats today's date for display in the header badge (e.g. "Mon, Sep 14").
 */
function updateDateBadge() {
  const now = new Date();
  const options = { weekday: "short", month: "short", day: "numeric" };
  currentDateBadge.textContent = now.toLocaleDateString(undefined, options);
}

/**
 * Checks if the current day has changed since last visit.
 * If a new day has started, reset daily stats.
 */
function checkDateReset() {
  const today = getTodayDateString();
  const lastDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);

  if (lastDate && lastDate !== today) {
    // New day: reset daily stats
    stats = {
      sessionsCompleted: 0,
      tasksCompleted: 0,
      totalFocusedMinutes: 0
    };
    saveStats();
  }

  // Update stored last date
  localStorage.setItem(STORAGE_KEYS.LAST_DATE, today);
}

/**
 * Saves current stats object to localStorage.
 */
function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  } catch (error) {
    console.error("Failed to save stats to localStorage:", error);
  }
}

/**
 * Loads daily stats from localStorage.
 */
function loadStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.STATS);
    if (saved) {
      stats = JSON.parse(saved);
    }
  } catch (error) {
    console.error("Failed to parse stats from localStorage:", error);
  }
  renderStats();
}

/**
 * Renders the daily progress numbers on the UI cards.
 */
function renderStats() {
  statSessionsEl.textContent = stats.sessionsCompleted;
  statTasksEl.textContent = stats.tasksCompleted;
  statMinutesEl.textContent = `${stats.totalFocusedMinutes}m`;
}

/**
 * Resets today's stats manually.
 */
function resetDailyStats() {
  if (confirm("Reset today's study progress stats to zero?")) {
    stats = {
      sessionsCompleted: 0,
      tasksCompleted: tasks.filter(t => t.completed).length,
      totalFocusedMinutes: 0
    };
    saveStats();
    renderStats();
  }
}

// ============================================================================
// 8. EVENT LISTENERS & INITIALIZATION
// ============================================================================

// Timer Control Buttons
startPauseBtn.addEventListener("click", toggleStartPause);
resetBtn.addEventListener("click", resetTimer);
skipBtn.addEventListener("click", skipToNextMode);

// Mode Switcher Buttons
studyModeBtn.addEventListener("click", () => {
  if (currentMode !== "study") switchMode("study", false);
});

breakModeBtn.addEventListener("click", () => {
  if (currentMode !== "break") switchMode("break", false);
});

// Task Form Submission
taskForm.addEventListener("submit", (e) => {
  e.preventDefault(); // Prevent default page reload on form submit
  const text = taskInput.value;
  if (text.trim()) {
    addTask(text);
    taskInput.value = "";
    taskInput.focus();
  }
});

// Reset Stats Button
resetStatsBtn.addEventListener("click", resetDailyStats);

// Keyboard Shortcuts: Pressing 'Space' toggles Start/Pause (when not typing in an input)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault(); // Prevent page scrolling
    toggleStartPause();
  }
});

/**
 * Application Bootstrap / Initial Load
 */
function initApp() {
  updateDateBadge();
  checkDateReset();
  loadStats();
  loadTasks();
  recalculateCompletedTasksCount();
  updateDisplay();
}

// Run init when DOM is loaded
initApp();
