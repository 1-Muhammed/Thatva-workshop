const STORAGE_KEY = "taskflow_tasks";
const THEME_KEY = "taskflow_theme";

const $ = id => document.getElementById(id);

function loadTasks() {
  try {
    const data = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

let tasks = loadTasks();
let currentView = "all";
let editingId = null;
let toastTimer;

const categories = {
  Personal: "◉",
  Work: "▣",
  Study: "▤",
  Other: "◇"
};

const viewTitles = {
  all: "All Tasks",
  today: "Today's Tasks",
  upcoming: "Upcoming Tasks",
  important: "Important Tasks",
  completed: "Completed Tasks"
};

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function today() {
  return localDate();
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    showToast("Unable to save tasks. Check browser storage.");
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function formatDate(dateString) {
  if (!dateString) return "No due date";

  const date = new Date(dateString + "T12:00:00");

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function isOverdue(task) {
  return Boolean(
    task.date &&
    task.date < today() &&
    !task.completed
  );
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter(isOverdue).length;

  $("totalCount").textContent = total;
  $("pendingCount").textContent = pending;
  $("completedCount").textContent = completed;
  $("overdueCount").textContent = overdue;

  const percent = total
    ? Math.round((completed / total) * 100)
    : 0;

  $("progressPercent").textContent = percent + "%";
  $("progressBar").style.width = percent + "%";
}

function openModal(task = null) {
  $("taskForm").reset();

  editingId = task ? task.id : null;

  $("modalTitle").textContent = task
    ? "Edit Task"
    : "Create New Task";

  $("saveTaskBtn").textContent = task
    ? "Save Changes"
    : "Create Task";

  if (task) {
    $("taskTitle").value = task.name;
    $("taskDescription").value = task.description || "";
    $("taskDate").value = task.date || "";
    $("taskPriority").value = task.priority || "Medium";
    $("taskCategory").value = task.category || "Personal";
  }

  $("taskModal").hidden = false;
  $("taskTitle").focus();
}

function closeModal() {
  $("taskModal").hidden = true;
  editingId = null;
  $("taskForm").reset();
}

$("openTaskBtn").addEventListener("click", () => {
  openModal();
});

$("closeModalBtn").addEventListener("click", closeModal);
$("cancelModalBtn").addEventListener("click", closeModal);

$("taskModal").addEventListener("click", e => {
  if (e.target === $("taskModal")) closeModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

$("taskForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = $("taskTitle").value.trim();
  if (!name) return;

  const data = {
    name,
    description: $("taskDescription").value.trim(),
    date: $("taskDate").value,
    priority: $("taskPriority").value,
    category: $("taskCategory").value
  };

  if (editingId !== null) {
    const task = tasks.find(t => t.id === editingId);
    if (!task) return;

    Object.assign(task, data);
    showToast("Task updated successfully");
  } else {
    tasks.unshift({
      id: crypto.randomUUID(),
      ...data,
      completed: false,
      createdAt: Date.now()
    });

    showToast("New task created");
  }

  saveTasks();
  closeModal();
  render();
});

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();
  render();

  showToast(
    task.completed ? "Task completed 🎉" : "Task reopened"
  );
}

function deleteTask(id) {
  if (!confirm("Delete this task permanently?")) return;

  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
  showToast("Task deleted");
}

function getVisibleTasks() {
  const search = $("searchInput").value.toLowerCase().trim();
  const priority = $("priorityFilter").value;
  const sort = $("sortSelect").value;

  let visible = tasks.filter(task => {
    const name = (task.name || "").toLowerCase();
    const description = (task.description || "").toLowerCase();

    const matchesSearch =
      name.includes(search) || description.includes(search);

    const matchesPriority =
      priority === "all" || task.priority === priority;

    let matchesView = true;

    if (currentView === "today") {
      matchesView = task.date === today();
    } else if (currentView === "upcoming") {
      matchesView = Boolean(
        task.date &&
        task.date > today() &&
        !task.completed
      );
    } else if (currentView === "important") {
      matchesView = task.priority === "High";
    } else if (currentView === "completed") {
      matchesView = task.completed;
    } else if (currentView.startsWith("category:")) {
      matchesView =
        task.category === currentView.split(":")[1];
    }

    return matchesSearch && matchesPriority && matchesView;
  });

  const weights = { High: 3, Medium: 2, Low: 1 };

  visible.sort((a, b) => {
    if (sort === "oldest") {
      return (a.createdAt || 0) - (b.createdAt || 0);
    }

    if (sort === "due") {
      return (a.date || "9999-12-31")
        .localeCompare(b.date || "9999-12-31");
    }

    if (sort === "priority") {
      return (weights[b.priority] || 0) -
             (weights[a.priority] || 0);
    }

    if (sort === "alphabetical") {
      return a.name.localeCompare(b.name);
    }

    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return visible;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderTasks() {
  const list = $("taskList");
  list.replaceChildren();

  const visible = getVisibleTasks();

  $("taskCountBadge").textContent =
    `${visible.length} task${visible.length === 1 ? "" : "s"}`;

  if (!visible.length) {
    const empty = createElement("div", "empty-state");
    empty.append(
      createElement("div", "empty-icon", "✦"),
      createElement("h3", "", "Nothing here yet"),
      createElement(
        "p", "",
        "Add a task or change your filters to get started."
      )
    );
    list.appendChild(empty);
    return;
  }

  visible.forEach(task => {
    const item = createElement(
      "div",
      "task-item" + (task.completed ? " done" : "")
    );

    const checkbox = createElement("input", "task-check");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.setAttribute(
      "aria-label",
      `Mark ${task.name} as completed`
    );
    checkbox.addEventListener("change", () => {
      toggleTask(task.id);
    });

    const info = createElement("div", "task-info");
    const title = createElement("h3", "task-title", task.name);
    info.appendChild(title);

    if (task.description) {
      info.appendChild(
        createElement(
          "p",
          "task-description",
          task.description
        )
      );
    }

    const meta = createElement("div", "task-meta");

    const priority = task.priority || "Medium";
    const badge = createElement(
      "span",
      "priority-badge priority-" + priority.toLowerCase(),
      priority
    );

    const category = createElement(
      "span",
      "",
      "◈ " + (task.category || "Personal")
    );

    const date = createElement(
      "span",
      isOverdue(task) ? "overdue-text" : "",
      "◷ " + formatDate(task.date)
    );

    meta.append(badge, category, date);

    if (isOverdue(task)) {
      meta.appendChild(
        createElement("span", "overdue-text", "Overdue")
      );
    }

    info.appendChild(meta);

    const actions = createElement("div", "task-actions");

    const edit = createElement("button", "icon-btn", "✎");
    edit.title = "Edit task";
    edit.setAttribute("aria-label", "Edit " + task.name);
    edit.addEventListener("click", () => openModal(task));

    const del = createElement(
      "button",
      "icon-btn delete-btn",
      "×"
    );
    del.title = "Delete task";
    del.setAttribute("aria-label", "Delete " + task.name);
    del.addEventListener("click", () => deleteTask(task.id));

    actions.append(edit, del);
    item.append(checkbox, info, actions);
    list.appendChild(item);
  });
}

function renderCategories() {
  const nav = $("categoryNav");
  nav.replaceChildren();

  Object.entries(categories).forEach(([name, symbol]) => {
    const button = createElement(
      "button",
      "nav-link",
      ""
    );

    const span = createElement("span", "", symbol);
    button.append(span, document.createTextNode(" " + name));

    button.dataset.view = "category:" + name;

    if (currentView === button.dataset.view) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      changeView(button.dataset.view);
    });

    nav.appendChild(button);
...

[Message clipped]  View entire message
