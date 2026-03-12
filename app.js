const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { nanoid } = require("nanoid");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Секреты подписи
const ACCESS_SECRET = "access_secret_key_change_in_prod";
const REFRESH_SECRET = "refresh_secret_key_change_in_prod";

// Время жизни токенов
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

// email: grigory@example.com | password: grigory123
let users = [
  {
    id: "usr_grigory",
    email: "grigory@example.com",
    first_name: "Григорий",
    last_name: "Костин",
    passwordHash:
      "$2b$10$akAt3HLdpFiBHxvmsLOcYuYY38ixwzhZrAOBqnscRQTVqSatE20XC",
  },
];

let products = [];

// Хранилище refresh-токенов в памяти
const refreshTokens = new Set();

const serverUrl = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-${PORT}.app.github.dev`
  : `http://localhost:${PORT}`;

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Auth + Products",
      version: "1.0.0",
      description:
        "Практические занятия 7-9: bcrypt + JWT + refresh token + CRUD товаров.\nЛогин: grigory@example.com / grigory123",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        refreshTokenHeader: {
          type: "apiKey",
          in: "header",
          name: "x-refresh-token",
        },
      },
    },
  },
  apis: ["./app.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`
    );

    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      const body = { ...req.body };
      if (body.password) body.password = "***";
      if (body.refreshToken) body.refreshToken = "***";
      console.log("Body:", body);
    }
  });

  next();
});

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function findProductOr404(id, res) {
  const product = products.find((p) => p.id === id);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return null;
  }

  return product;
}

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Аутентификация
 *   - name: Products
 *     description: CRUD товаров
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: grigory@example.com
 *               password:
 *                 type: string
 *                 example: grigory123
 *     responses:
 *       200:
 *         description: Успешный вход, возвращает accessToken и refreshToken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Отсутствуют обязательные поля
 *       401:
 *         description: Неверные учётные данные
 */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = users.find((u) => u.email === email);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  refreshTokens.add(refreshToken);

  res.json({
    accessToken,
    refreshToken,
  });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновить accessToken и refreshToken
 *     tags: [Auth]
 *     security:
 *       - refreshTokenHeader: []
 *     parameters:
 *       - in: header
 *         name: x-refresh-token
 *         required: true
 *         schema:
 *           type: string
 *         description: Refresh-токен
 *     responses:
 *       200:
 *         description: Новая пара токенов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Refresh-токен не передан
 *       401:
 *         description: Невалидный или истёкший refresh-токен
 */
app.post("/api/auth/refresh", (req, res) => {
  const refreshToken =
    req.headers["x-refresh-token"] || req.headers["refresh-token"];

  if (!refreshToken) {
    return res.status(400).json({ error: "refresh token is required in headers" });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find((u) => u.id === payload.sub);

    if (!user) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: "User not found" });
    }

    // Ротация refresh-токена
    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.add(newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch {
    refreshTokens.delete(refreshToken);
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить текущего пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Объект текущего пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 first_name:
 *                   type: string
 *                 last_name:
 *                   type: string
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Пользователь не найден
 */
app.get("/api/auth/me", authMiddleware, (req, res) => {
  const user = users.find((u) => u.id === req.user.sub);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, category, description, price]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Ноутбук
 *               category:
 *                 type: string
 *                 example: Электроника
 *               description:
 *                 type: string
 *                 example: Мощный ноутбук для работы
 *               price:
 *                 type: number
 *                 example: 75000
 *     responses:
 *       201:
 *         description: Товар создан
 *       400:
 *         description: Некорректные данные
 */
app.post("/api/products", (req, res) => {
  const { title, category, description, price } = req.body;

  if (!title || !category || !description || price === undefined) {
    return res.status(400).json({
      error: "title, category, description and price are required",
    });
  }

  if (typeof price !== "number" || price < 0) {
    return res.status(400).json({
      error: "price must be a non-negative number",
    });
  }

  const product = {
    id: nanoid(8),
    title,
    category,
    description,
    price,
  };

  products.push(product);

  res.status(201).json(product);
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список товаров
 */
app.get("/api/products", (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по id
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Объект товара
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.get("/api/products/:id", authMiddleware, (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить параметры товара
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Обновлённый товар
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.put("/api/products/:id", authMiddleware, (req, res) => {
  const product = findProductOr404(req.params.id, res);
  if (!product) return;

  const { title, category, description, price } = req.body;

  if (title !== undefined) product.title = title;
  if (category !== undefined) product.category = category;
  if (description !== undefined) product.description = description;

  if (price !== undefined) {
    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({
        error: "price must be a non-negative number",
      });
    }

    product.price = price;
  }

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Товар удалён
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.delete("/api/products/:id", authMiddleware, (req, res) => {
  const idx = products.findIndex((p) => p.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  const deleted = products.splice(idx, 1)[0];

  res.json({
    message: "Product deleted",
    product: deleted,
  });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Swagger UI: ${serverUrl}/api-docs`);
});