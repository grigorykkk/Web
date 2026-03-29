const STORAGE_KEY = "taskflow-tasks-v1";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const clearCompletedButton = document.getElementById("clear-completed");
const filterSelect = document.getElementById("filter-status");
const taskList = document.getElementById("task-list");
const taskTemplate = document.getElementById("task-template");
const totalCount = document.getElementById("total-count");
const activeCount = document.getElementById("active-count");
const completedCount = document.getElementById("completed-count");
const installHint = document.getElementById("install-hint");

let deferredInstallPrompt = null;
let tasks = loadTasks();

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    console.error("Не удалось прочитать задачи из localStorage", error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function createTask(title, description) {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function getFilteredTasks() {
  const filter = filterSelect.value;
  if (filter === "active") {
    return tasks.filter((task) => !task.completed);
  }
  if (filter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}

function renderStats() {
  const completed = tasks.filter((task) => task.completed).length;
  totalCount.textContent = String(tasks.length);
  activeCount.textContent = String(tasks.length - completed);
  completedCount.textContent = String(completed);
}

function renderTasks() {
  taskList.innerHTML = "";
  const filteredTasks = getFilteredTasks();

  for (const task of filteredTasks) {
    const fragment = taskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task-item");
    const toggle = fragment.querySelector(".task-toggle");
    const title = fragment.querySelector(".task-title");
    const description = fragment.querySelector(".task-description");
    const date = fragment.querySelector(".task-date");
    const deleteButton = fragment.querySelector(".delete-button");

    item.dataset.id = task.id;
    item.classList.toggle("is-completed", task.completed);
    toggle.checked = task.completed;
    title.textContent = task.title;
    description.textContent = task.description;
    date.textContent = formatDate(task.createdAt);

    toggle.addEventListener("change", () => {
      tasks = tasks.map((currentTask) =>
        currentTask.id === task.id
          ? { ...currentTask, completed: !currentTask.completed }
          : currentTask,
      );
      saveTasks();
      renderStats();
      renderTasks();
    });

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter((currentTask) => currentTask.id !== task.id);
      saveTasks();
      renderStats();
      renderTasks();
    });

    taskList.append(fragment);
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    if (installHint) {
      installHint.textContent = "Браузер не поддерживает Service Worker.";
    }
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Ошибка регистрации Service Worker", error);
      if (installHint) {
        installHint.textContent = "Не удалось зарегистрировать Service Worker.";
      }
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    return;
  }

  tasks = [createTask(title, description), ...tasks];
  saveTasks();
  renderStats();
  renderTasks();
  form.reset();
  titleInput.focus();
});

clearCompletedButton.addEventListener("click", () => {
  tasks = tasks.filter((task) => !task.completed);
  saveTasks();
  renderStats();
  renderTasks();
});

filterSelect.addEventListener("change", renderTasks);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installHint) {
    installHint.textContent = "Приложение готово к установке через меню браузера.";
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installHint) {
    installHint.textContent = "Приложение установлено и будет открываться в отдельном окне.";
  }
});

renderStats();
renderTasks();
registerServiceWorker();
