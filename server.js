require("dotenv").config();

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/practice20";

mongoose.set("strictQuery", true);

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false },
);

const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    first_name: { type: String, required: true, trim: true, maxlength: 80 },
    last_name: { type: String, required: true, trim: true, maxlength: 80, index: true },
    age: { type: Number, required: true, min: 0, max: 130 },
    created_at: { type: Number, required: true },
    updated_at: { type: Number, required: true },
  },
  {
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  },
);

userSchema.index({ first_name: "text", last_name: "text" });

const Counter = mongoose.model("Counter", counterSchema);
const User = mongoose.model("User", userSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(ROOT_DIR));

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function parsePositiveInt(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getNextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return counter.seq;
}

function sanitizeUserPayload(body, { partial = false } = {}) {
  const payload = {};
  const errors = [];

  if (!partial || Object.hasOwn(body, "first_name")) {
    const firstName = String(body.first_name || "").trim();
    if (!firstName) {
      errors.push("first_name обязателен.");
    } else if (firstName.length > 80) {
      errors.push("first_name должен быть не длиннее 80 символов.");
    } else {
      payload.first_name = firstName;
    }
  }

  if (!partial || Object.hasOwn(body, "last_name")) {
    const lastName = String(body.last_name || "").trim();
    if (!lastName) {
      errors.push("last_name обязателен.");
    } else if (lastName.length > 80) {
      errors.push("last_name должен быть не длиннее 80 символов.");
    } else {
      payload.last_name = lastName;
    }
  }

  if (!partial || Object.hasOwn(body, "age")) {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 0 || age > 130) {
      errors.push("age должен быть целым числом от 0 до 130.");
    } else {
      payload.age = age;
    }
  }

  if (partial && Object.keys(payload).length === 0 && errors.length === 0) {
    errors.push("Передайте хотя бы одно поле для обновления.");
  }

  return { payload, errors };
}

function toPublicUser(user) {
  return user.toJSON();
}

app.get("/api/health", async (_request, response) => {
  try {
    const state = mongoose.connection.readyState;
    response.json({
      ok: state === 1,
      database: "MongoDB",
      databaseTime: new Date().toISOString(),
      readyState: state,
    });
  } catch (error) {
    response.status(503).json({
      ok: false,
      message: "Нет подключения к MongoDB.",
      detail: error.message,
    });
  }
});

app.post("/api/users", async (request, response) => {
  const { payload, errors } = sanitizeUserPayload(request.body);

  if (errors.length) {
    response.status(400).json({ message: "Ошибка валидации.", errors });
    return;
  }

  try {
    const timestamp = nowUnix();
    const user = await User.create({
      id: await getNextSequence("users"),
      ...payload,
      created_at: timestamp,
      updated_at: timestamp,
    });

    response.status(201).json(toPublicUser(user));
  } catch (error) {
    response.status(500).json({ message: "Не удалось создать пользователя.", detail: error.message });
  }
});

app.get("/api/users", async (request, response) => {
  const search = String(request.query.search || "").trim();

  try {
    const filter = search
      ? {
          $or: [
            { first_name: { $regex: search, $options: "i" } },
            { last_name: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const users = await User.find(filter).sort({ id: -1 });
    response.json(users.map(toPublicUser));
  } catch (error) {
    response.status(500).json({ message: "Не удалось получить пользователей.", detail: error.message });
  }
});

app.get("/api/users/:id", async (request, response) => {
  const id = parsePositiveInt(request.params.id);

  if (!id) {
    response.status(400).json({ message: "id должен быть положительным целым числом." });
    return;
  }

  try {
    const user = await User.findOne({ id });

    if (!user) {
      response.status(404).json({ message: "Пользователь не найден." });
      return;
    }

    response.json(toPublicUser(user));
  } catch (error) {
    response.status(500).json({ message: "Не удалось получить пользователя.", detail: error.message });
  }
});

app.patch("/api/users/:id", async (request, response) => {
  const id = parsePositiveInt(request.params.id);

  if (!id) {
    response.status(400).json({ message: "id должен быть положительным целым числом." });
    return;
  }

  const { payload, errors } = sanitizeUserPayload(request.body, { partial: true });

  if (errors.length) {
    response.status(400).json({ message: "Ошибка валидации.", errors });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { id },
      { $set: { ...payload, updated_at: nowUnix() } },
      { new: true, runValidators: true },
    );

    if (!user) {
      response.status(404).json({ message: "Пользователь не найден." });
      return;
    }

    response.json(toPublicUser(user));
  } catch (error) {
    response.status(500).json({ message: "Не удалось обновить пользователя.", detail: error.message });
  }
});

app.delete("/api/users/:id", async (request, response) => {
  const id = parsePositiveInt(request.params.id);

  if (!id) {
    response.status(400).json({ message: "id должен быть положительным целым числом." });
    return;
  }

  try {
    const user = await User.findOneAndDelete({ id });

    if (!user) {
      response.status(404).json({ message: "Пользователь не найден." });
      return;
    }

    response.json({ message: "Пользователь удален.", id });
  } catch (error) {
    response.status(500).json({ message: "Не удалось удалить пользователя.", detail: error.message });
  }
});

app.use((_request, response) => {
  response.sendFile(path.join(ROOT_DIR, "index.html"));
});

async function start() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    await User.init();

    app.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
      console.log("Connected to MongoDB");
    });
  } catch (error) {
    console.error("Не удалось подключиться к MongoDB:", error.message);
    console.error("Проверьте MONGODB_URI в .env или запустите локальный MongoDB.");
    process.exit(1);
  }
}

start();
