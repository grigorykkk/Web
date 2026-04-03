const STORAGE_KEY = "taskflow-tasks-v1";
const LEGACY_NOTES_KEY = "taskflow-notes-v2";

const contentDiv = document.getElementById("app-content");

let socket = null;
let vapidPublicKey = "";
let tasks = [];

function migrateLegacyNotes() {
  if (localStorage.getItem(STORAGE_KEY)) {
    return;
  }

  const rawLegacyNotes = localStorage.getItem(LEGACY_NOTES_KEY);
  if (!rawLegacyNotes) {
    return;
  }

  try {
    const notes = JSON.parse(rawLegacyNotes);
    const migratedTasks = Array.isArray(notes)
      ? notes.map((note) => ({
          id: note.id || crypto.randomUUID(),
          title: note.title || "Без названия",
          description: note.description || "",
          completed: false,
          createdAt: note.createdAt || new Date().toISOString(),
          reminder: note.reminder || null,
        }))
      : [];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedTasks));
  } catch (error) {
    console.error("Не удалось перенести старые заметки", error);
  }
}

function loadTasks() {
  migrateLegacyNotes();

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

async function saveTasksToServer() {
  const response = await fetch("./api/tasks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });

  if (!response.ok) {
    throw new Error(`Ошибка сохранения ${response.status}`);
  }
}

function createTask(title, description) {
  return {
    id: crypto.randomUUID(),
    title,
    description,
    completed: false,
    createdAt: new Date().toISOString(),
    reminder: null,
  };
}

async function loadTasksFromServer() {
  const response = await fetch("./api/tasks", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Ошибка загрузки ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.tasks) ? payload.tasks : [];
}

async function hydrateTasks() {
  const localTasks = loadTasks();

  try {
    const remoteTasks = await loadTasksFromServer();
    if (remoteTasks.length) {
      tasks = remoteTasks;
      saveTasks();
      return;
    }

    tasks = localTasks;
    if (localTasks.length) {
      await saveTasksToServer();
    }
  } catch (error) {
    console.error("Не удалось синхронизировать задачи с сервером", error);
    tasks = localTasks;
  }
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString));
}

function getTaskDescription(task) {
  return [task.description, task.reminder ? `Напоминание: ${formatDate(task.reminder)}` : ""]
    .filter(Boolean)
    .join(" • ");
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function getFilteredTasks() {
  const filterSelect = document.getElementById("filter-status");
  const filter = filterSelect?.value || "all";

  if (filter === "active") {
    return tasks.filter((task) => !task.completed);
  }
  if (filter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}

function renderStats() {
  const totalCount = document.getElementById("total-count");
  const activeCount = document.getElementById("active-count");
  const completedCount = document.getElementById("completed-count");

  if (!totalCount || !activeCount || !completedCount) {
    return;
  }

  const completed = tasks.filter((task) => task.completed).length;
  totalCount.textContent = String(tasks.length);
  activeCount.textContent = String(tasks.length - completed);
  completedCount.textContent = String(completed);
}

function renderTasks() {
  const taskList = document.getElementById("task-list");
  const taskTemplate = document.getElementById("task-template");

  if (!taskList || !taskTemplate) {
    return;
  }

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
    description.textContent = getTaskDescription(task);
    date.textContent = formatDate(task.createdAt);

    toggle.addEventListener("change", () => {
      tasks = tasks.map((currentTask) =>
        currentTask.id === task.id
          ? { ...currentTask, completed: !currentTask.completed }
          : currentTask,
      );
      saveTasks();
      saveTasksToServer().catch((error) => {
        console.error("Не удалось сохранить изменение задачи", error);
      });
      renderStats();
      renderTasks();
    });

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter((currentTask) => currentTask.id !== task.id);
      saveTasks();
      saveTasksToServer().catch((error) => {
        console.error("Не удалось удалить задачу на сервере", error);
      });
      renderStats();
      renderTasks();
    });

    taskList.append(fragment);
  }
}

function upsertRemoteTask(task) {
  const hasTask = tasks.some((currentTask) => currentTask.id === task.id);
  if (hasTask) {
    return;
  }

  tasks = [
    {
      id: task.id || crypto.randomUUID(),
      title: task.title || "Без названия",
      description: task.description || "",
      completed: false,
      createdAt: task.createdAt || new Date().toISOString(),
      reminder: task.reminder || null,
    },
    ...tasks,
  ];
  saveTasks();
  saveTasksToServer().catch((error) => {
    console.error("Не удалось сохранить удалённую задачу на сервере", error);
  });
}

async function loadContent(page) {
  try {
    const response = await fetch(`./content/${page}.html`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}`);
    }

    const html = await response.text();
    contentDiv.innerHTML = html;

    if (page === "home") {
      await initTasks();
    }
  } catch (error) {
    console.error("Ошибка загрузки страницы", error);
    contentDiv.innerHTML = `
      <section class="panel">
        <h2>Ошибка загрузки</h2>
        <p class="panel-text">Не удалось получить содержимое страницы.</p>
      </section>
    `;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
    showToast("Push-уведомления в этом браузере недоступны.", "error");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await fetch("./subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });

  updatePushButtons(true);
  showToast("Push-уведомления включены.", "success");
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    updatePushButtons(false);
    return;
  }

  await fetch("./unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
  updatePushButtons(false);
  showToast("Push-уведомления отключены.", "info");
}

function updatePushButtons(hasSubscription) {
  const enableButton = document.getElementById("enable-push");
  const disableButton = document.getElementById("disable-push");

  if (!enableButton || !disableButton) {
    return;
  }

  enableButton.hidden = hasSubscription;
  disableButton.hidden = !hasSubscription;
}

async function initPushControls() {
  const enableButton = document.getElementById("enable-push");
  const disableButton = document.getElementById("disable-push");

  if (!enableButton || !disableButton || !("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  updatePushButtons(Boolean(existingSubscription));

  enableButton.addEventListener("click", async () => {
    try {
      if (Notification.permission === "denied") {
        showToast("Уведомления заблокированы в настройках браузера.", "error");
        return;
      }

      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          showToast("Необходимо разрешить уведомления.", "error");
          return;
        }
      }

      await subscribeToPush();
    } catch (error) {
      console.error("Ошибка подписки на push", error);
      showToast("Не удалось включить push-уведомления.", "error");
    }
  });

  disableButton.addEventListener("click", async () => {
    try {
      await unsubscribeFromPush();
    } catch (error) {
      console.error("Ошибка отключения push", error);
      showToast("Не удалось отключить push-уведомления.", "error");
    }
  });
}

async function initTasks() {
  const form = document.getElementById("task-form");
  const titleInput = document.getElementById("task-title");
  const descriptionInput = document.getElementById("task-description");
  const reminderInput = document.getElementById("task-reminder");
  const clearCompletedButton = document.getElementById("clear-completed");
  const filterSelect = document.getElementById("filter-status");

  await hydrateTasks();
  renderStats();
  renderTasks();
  initPushControls();

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = titleInput?.value.trim() || "";
    const description = descriptionInput?.value.trim() || "";
    const reminderValue = reminderInput?.value || "";

    if (!title) {
      titleInput?.focus();
      return;
    }

    let reminder = null;
    if (reminderValue) {
      const reminderDate = new Date(reminderValue);
      if (Number.isNaN(reminderDate.getTime()) || reminderDate.getTime() <= Date.now()) {
        showToast("Дата напоминания должна быть в будущем.", "error");
        reminderInput?.focus();
        return;
      }

      reminder = reminderDate.toISOString();
    }

    const newTask = {
      ...createTask(title, description),
      reminder,
    };
    tasks = [newTask, ...tasks];
    saveTasks();
    saveTasksToServer().catch((error) => {
      console.error("Не удалось сохранить новую задачу на сервере", error);
    });
    renderStats();
    renderTasks();
    form.reset();
    titleInput?.focus();

    if (socket?.connected) {
      socket.emit("newTask", newTask);
      if (newTask.reminder) {
        socket.emit("newReminder", {
          id: newTask.id,
          title: newTask.title,
          description: newTask.description,
          reminderTime: newTask.reminder,
        });
      }
    }
  });

  clearCompletedButton?.addEventListener("click", () => {
    tasks = tasks.filter((task) => !task.completed);
    saveTasks();
    saveTasksToServer().catch((error) => {
      console.error("Не удалось удалить выполненные задачи на сервере", error);
    });
    renderStats();
    renderTasks();
  });

  filterSelect?.addEventListener("change", renderTasks);
}

async function loadRuntimeConfig() {
  try {
    const response = await fetch("./api/config");
    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}`);
    }

    const config = await response.json();
    vapidPublicKey = config.vapidPublicKey || "";
  } catch (error) {
    console.error("Не удалось загрузить конфигурацию клиента", error);
  }
}

function connectSocket() {
  if (!window.io) {
    return;
  }

  socket = window.io({
    transports: ["websocket", "polling"],
  });

  socket.on("taskAdded", (task) => {
    if (task.senderId === socket.id) {
      return;
    }

    upsertRemoteTask(task);
    showToast(`Новая задача: ${task.title}`, "info");
    renderStats();
    renderTasks();
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js", {
      updateViaCache: "none",
    });
    await registration.update();
  } catch (error) {
    console.error("Ошибка регистрации Service Worker", error);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadRuntimeConfig();
  connectSocket();
  await registerServiceWorker();
  await loadContent("home");
});
