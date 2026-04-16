const form = document.getElementById("user-form");
const formTitle = document.getElementById("form-title");
const userIdInput = document.getElementById("user-id");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const ageInput = document.getElementById("age");
const resetButton = document.getElementById("reset-form");
const usersTable = document.getElementById("users-table");
const rowTemplate = document.getElementById("user-row-template");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search");
const dbStatus = document.getElementById("db-status");
const toast = document.getElementById("toast");
const activityLog = document.getElementById("activity-log");

let users = [];
let toastTimeout = null;

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function showToast(message, type = "ok") {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.dataset.type = type;
  toast.classList.add("visible");
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

function writeLog(command, message) {
  if (!activityLog) {
    return;
  }

  const item = document.createElement("li");
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  item.innerHTML = `<time>${time}</time> <code>${command}</code> ${message}`;
  activityLog.prepend(item);

  while (activityLog.children.length > 8) {
    activityLog.lastElementChild.remove();
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details = Array.isArray(payload.errors) ? ` ${payload.errors.join(" ")}` : "";
    throw new Error(`${payload.message || "Ошибка запроса."}${details}`);
  }

  return payload;
}

function resetForm() {
  form.reset();
  userIdInput.value = "";
  formTitle.textContent = "Добавить пользователя";
  firstNameInput.focus();
}

function fillForm(user) {
  userIdInput.value = user.id;
  firstNameInput.value = user.first_name;
  lastNameInput.value = user.last_name;
  ageInput.value = user.age;
  formTitle.textContent = `Изменить пользователя #${user.id}`;
  writeLog("EDIT", `пользователь #${user.id} загружен в форму`);
  firstNameInput.focus();
}

function renderUsers() {
  usersTable.innerHTML = "";
  emptyState.hidden = users.length !== 0;

  for (const user of users) {
    const row = rowTemplate.content.cloneNode(true);

    row.querySelector(".id-cell").textContent = user.id;
    row.querySelector(".first-name-cell").textContent = user.first_name;
    row.querySelector(".last-name-cell").textContent = user.last_name;
    row.querySelector(".age-cell").textContent = user.age;
    row.querySelector(".created-cell").textContent = formatDate(user.created_at);
    row.querySelector(".updated-cell").textContent = formatDate(user.updated_at);

    row.querySelector(".edit-button").addEventListener("click", () => fillForm(user));
    row.querySelector(".delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Удалить пользователя #${user.id}?`);
      if (!confirmed) {
        return;
      }

      await requestJson(`/api/users/${user.id}`, { method: "DELETE" });
      writeLog("DELETE", `пользователь #${user.id} удален`);
      showToast("Пользователь удален.");
      await loadUsers();
      resetForm();
    });

    usersTable.append(row);
  }
}

async function loadUsers() {
  const query = new URLSearchParams();
  const search = searchInput.value.trim();
  if (search) {
    query.set("search", search);
  }

  users = await requestJson(`/api/users${query.size ? `?${query}` : ""}`);
  renderUsers();
  writeLog("SELECT", `получено записей: ${users.length}`);
}

async function checkHealth() {
  try {
    const health = await requestJson("/api/health");
    dbStatus.textContent = `БД ОНЛАЙН ${formatDate(health.databaseTime)}`;
    dbStatus.dataset.state = "ok";
    writeLog("HEALTH", "подключение к базе установлено");
  } catch (error) {
    dbStatus.textContent = "БД НЕДОСТУПНА";
    dbStatus.dataset.state = "bad";
    writeLog("ERROR", error.message);
    showToast(error.message, "bad");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    first_name: firstNameInput.value.trim(),
    last_name: lastNameInput.value.trim(),
    age: Number(ageInput.value),
  };

  try {
    const id = userIdInput.value;
    if (id) {
      await requestJson(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      writeLog("PATCH", `пользователь #${id} обновлен`);
      showToast("Пользователь обновлен.");
    } else {
      const created = await requestJson("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      writeLog("POST", `создан пользователь #${created.id}`);
      showToast("Пользователь создан.");
    }

    await loadUsers();
    resetForm();
  } catch (error) {
    writeLog("ERROR", error.message);
    showToast(error.message, "bad");
  }
});

resetButton.addEventListener("click", resetForm);

let searchTimeout = null;
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    if (searchInput.value.trim()) {
      writeLog("GREP", `фильтр "${searchInput.value.trim()}"`);
    }
    loadUsers().catch((error) => showToast(error.message, "bad"));
  }, 250);
});

checkHealth();
loadUsers().catch((error) => showToast(error.message, "bad"));
