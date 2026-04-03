const cors = require("cors");
const crypto = require("node:crypto");
const express = require("express");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const { Server } = require("socket.io");
const webpush = require("web-push");

const HTTP_PORT = Number(process.env.PORT) || 3001;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const HOST = process.env.HOST || "0.0.0.0";
const IS_CODESPACES = process.env.CODESPACES === "true";
const ROOT_DIR = __dirname;
const CERT_PATH = path.join(ROOT_DIR, "localhost.pem");
const KEY_PATH = path.join(ROOT_DIR, "localhost-key.pem");
const VAPID_PATH = path.join(ROOT_DIR, "vapid-keys.json");
const DATA_DIR = path.join(ROOT_DIR, "data");
const NOTES_DIR = path.join(DATA_DIR, "notes");
const CLIENT_COOKIE = "taskflow_client_id";

fs.mkdirSync(NOTES_DIR, { recursive: true });

function ensureVapidKeys() {
  if (fs.existsSync(VAPID_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_PATH, "utf8"));
  }

  const generatedKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, `${JSON.stringify(generatedKeys, null, 2)}\n`, "utf8");
  return generatedKeys;
}

const vapidKeys = ensureVapidKeys();

webpush.setVapidDetails(
  process.env.VAPID_CONTACT || "mailto:student@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

const app = express();
const subscriptions = new Map();
const reminders = new Map();

app.use(cors());
app.use(express.json());

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function getClientNotesPath(clientId) {
  return path.join(NOTES_DIR, `${clientId}.json`);
}

function readClientTasks(clientId) {
  const filePath = getClientNotesPath(clientId);
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const tasks = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(tasks) ? tasks : [];
  } catch (error) {
    console.error("Не удалось прочитать задачи пользователя", clientId, error);
    return [];
  }
}

function writeClientTasks(clientId, tasks) {
  const filePath = getClientNotesPath(clientId);
  fs.writeFileSync(filePath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
}

function getClientSubscriptions(clientId) {
  if (!subscriptions.has(clientId)) {
    subscriptions.set(clientId, new Map());
  }

  return subscriptions.get(clientId);
}

function getReminderKey(clientId, reminderId) {
  return `${clientId}:${String(reminderId)}`;
}

async function sendPushNotifications(clientId, payload) {
  const clientSubscriptions = getClientSubscriptions(clientId);
  const results = [...clientSubscriptions.values()].map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      const statusCode = error?.statusCode || 0;
      if (statusCode === 404 || statusCode === 410) {
        clientSubscriptions.delete(subscription.endpoint);
      } else {
        console.error("Push error:", error.message || error);
      }
    }
  });

  await Promise.all(results);
}

function clearReminder(clientId, reminderId) {
  const reminderKey = getReminderKey(clientId, reminderId);
  const scheduledReminder = reminders.get(reminderKey);
  if (!scheduledReminder) {
    return;
  }

  clearTimeout(scheduledReminder.timeoutId);
  reminders.delete(reminderKey);
}

function scheduleReminder(clientId, task) {
  if (!task?.id) {
    return false;
  }

  clearReminder(clientId, task.id);

  if (!task.reminder || task.completed) {
    return false;
  }

  const reminderTimestamp = new Date(task.reminder).getTime();
  if (Number.isNaN(reminderTimestamp)) {
    return false;
  }

  const delay = reminderTimestamp - Date.now();
  if (delay <= 0) {
    return false;
  }

  const reminderKey = getReminderKey(clientId, task.id);
  const text = task.description ? `${task.title}: ${task.description}` : task.title;
  const timeoutId = setTimeout(async () => {
    try {
      await sendPushNotifications(
        clientId,
        JSON.stringify({
          title: "Напоминание",
          body: text,
          reminderId: task.id,
        }),
      );
    } finally {
      reminders.delete(reminderKey);
    }
  }, delay);

  reminders.set(reminderKey, {
    clientId,
    reminderId: task.id,
    text,
    timeoutId,
    reminderTime: task.reminder,
  });

  return true;
}

function syncRemindersForClient(clientId, tasks) {
  const actualReminderKeys = new Set(tasks.map((task) => getReminderKey(clientId, task.id)));

  for (const reminderKey of reminders.keys()) {
    if (reminderKey.startsWith(`${clientId}:`) && !actualReminderKeys.has(reminderKey)) {
      const scheduledReminder = reminders.get(reminderKey);
      clearTimeout(scheduledReminder.timeoutId);
      reminders.delete(reminderKey);
    }
  }

  for (const task of tasks) {
    scheduleReminder(clientId, task);
  }
}

app.use((request, response, next) => {
  const cookies = parseCookies(request.headers.cookie);
  const clientId = cookies[CLIENT_COOKIE] || crypto.randomUUID();

  request.clientId = clientId;
  if (!cookies[CLIENT_COOKIE]) {
    response.cookie(CLIENT_COOKIE, clientId, {
      sameSite: "lax",
      secure: request.secure,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }

  next();
});

app.use(express.static(ROOT_DIR));

app.get("/api/config", (request, response) => {
  response.json({
    vapidPublicKey: vapidKeys.publicKey,
    isSecure: request.secure,
    origin: `${request.protocol}://${request.get("host")}`,
  });
});

app.get("/api/tasks", (request, response) => {
  response.json({
    tasks: readClientTasks(request.clientId),
  });
});

app.put("/api/tasks", (request, response) => {
  const { tasks } = request.body || {};

  if (!Array.isArray(tasks)) {
    response.status(400).json({ message: "Ожидается массив задач." });
    return;
  }

  writeClientTasks(request.clientId, tasks);
  syncRemindersForClient(request.clientId, tasks);
  response.json({ ok: true });
});

app.post("/subscribe", (request, response) => {
  const subscription = request.body;

  if (!subscription?.endpoint) {
    response.status(400).json({ message: "Некорректная push-подписка." });
    return;
  }

  const clientSubscriptions = getClientSubscriptions(request.clientId);
  clientSubscriptions.set(subscription.endpoint, subscription);
  response.status(201).json({ message: "Подписка сохранена." });
});

app.post("/unsubscribe", (request, response) => {
  const { endpoint } = request.body || {};

  if (!endpoint) {
    response.status(400).json({ message: "Endpoint обязателен." });
    return;
  }

  const clientSubscriptions = getClientSubscriptions(request.clientId);
  clientSubscriptions.delete(endpoint);
  response.json({ message: "Подписка удалена." });
});

app.post("/snooze", (request, response) => {
  const { reminderId } = request.body || {};
  const reminderKey = getReminderKey(request.clientId, reminderId);

  if (!reminderId || !reminders.has(reminderKey)) {
    response.status(404).json({ message: "Напоминание не найдено." });
    return;
  }

  const scheduledReminder = reminders.get(reminderKey);
  clearTimeout(scheduledReminder.timeoutId);

  const newReminderTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const timeoutId = setTimeout(async () => {
    try {
      await sendPushNotifications(
        request.clientId,
        JSON.stringify({
          title: "Напоминание отложено",
          body: scheduledReminder.text,
          reminderId,
        }),
      );
    } finally {
      reminders.delete(reminderKey);
    }
  }, 5 * 60 * 1000);

  reminders.set(reminderKey, {
    ...scheduledReminder,
    timeoutId,
    reminderTime: newReminderTime,
  });

  const tasks = readClientTasks(request.clientId).map((task) =>
    task.id === reminderId
      ? {
          ...task,
          reminder: newReminderTime,
        }
      : task,
  );
  writeClientTasks(request.clientId, tasks);

  response.json({ message: "Напоминание отложено на 5 минут." });
});

function createServer() {
  if (IS_CODESPACES) {
    return {
      isSecure: false,
      port: HTTP_PORT,
      server: http.createServer(app),
    };
  }

  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    const credentials = {
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH),
    };

    return {
      isSecure: true,
      port: HTTPS_PORT,
      server: https.createServer(credentials, app),
    };
  }

  return {
    isSecure: false,
    port: HTTP_PORT,
    server: http.createServer(app),
  };
}

const runtime = createServer();
const io = new Server(runtime.server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("Клиент подключён:", socket.id);
  const clientId = parseCookies(socket.handshake.headers.cookie)[CLIENT_COOKIE];

  socket.on("newTask", async (task) => {
    const taskPayload = {
      ...task,
      senderId: socket.id,
      createdAt: task.createdAt || new Date().toISOString(),
    };

    io.emit("taskAdded", taskPayload);
    if (clientId) {
      await sendPushNotifications(
        clientId,
        JSON.stringify({
          title: "Новая задача",
          body: task.description ? `${task.title}: ${task.description}` : task.title,
        }),
      );
    }
  });

  socket.on("newReminder", (reminder) => {
    if (!clientId) {
      return;
    }

    scheduleReminder(clientId, {
      id: reminder.id,
      title: reminder.title || "Без названия",
      description: reminder.description || "",
      reminder: reminder.reminderTime,
      completed: false,
    });
  });

  socket.on("disconnect", () => {
    console.log("Клиент отключён:", socket.id);
  });
});

function startListening(port) {
  runtime.server.listen(port, HOST, () => {
    runtime.port = port;
    const protocol = runtime.isSecure ? "https" : "http";

    console.log(`Сервер запущен: ${protocol}://localhost:${port}`);
    if (IS_CODESPACES) {
      console.log(`Codespaces URL: https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    }
    if (!runtime.isSecure && !IS_CODESPACES) {
      console.log(
        "HTTPS-сертификаты не найдены. Добавьте localhost.pem и localhost-key.pem, чтобы включить HTTPS.",
      );
    }
  });
}

runtime.server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = runtime.port + 1;
    console.log(`Порт ${runtime.port} занят, пробую ${nextPort}...`);
    runtime.port = nextPort;
    startListening(nextPort);
    return;
  }

  throw error;
});

startListening(runtime.port);
