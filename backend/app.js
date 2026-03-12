const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { nanoid } = require("nanoid");

const app = express();

const PORT = process.env.PORT || 3000;

function isAllowedOrigin(origin) {
  if (!origin) return true;

  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  if (
    process.env.CODESPACE_NAME &&
    origin.includes(`${process.env.CODESPACE_NAME}-`) &&
    origin.endsWith(".app.github.dev")
  ) {
    return true;
  }

  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
  })
);

app.use(express.json());

const ACCESS_SECRET = "access_secret_key_change_me";
const REFRESH_SECRET = "refresh_secret_key_change_me";

const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

// Тестовый пользователь
// email: grigory@example.com
// password: grigory123
let users = [
  {
    id: "usr_grigory",
    email: "grigory@example.com",
    first_name: "Григорий",
    last_name: "Костин",
    passwordHash: bcrypt.hashSync("grigory123", 10),
  },
];

let products = [
  {
    id: nanoid(8),
    title: "Ноутбук",
    category: "Электроника",
    description: "Мощный ноутбук для работы",
    price: 75000,
  },
  {
    id: nanoid(8),
    title: "Наушники",
    category: "Электроника",
    description: "Беспроводные наушники",
    price: 8500,
  },
];

const refreshTokens = new Set();

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
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

function getRefreshTokenFromHeaders(req) {
  return req.headers["x-refresh-token"] || req.headers["refresh-token"];
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      error: "email, password, first_name and last_name are required",
    });
  }

  const exists = users.some((u) => u.email === email);
  if (exists) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    id: nanoid(10),
    email,
    first_name,
    last_name,
    passwordHash,
  };

  users.push(user);

  res.status(201).json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "email and password are required",
    });
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
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

app.post("/api/auth/refresh", (req, res) => {
  const refreshToken = getRefreshTokenFromHeaders(req);

  if (!refreshToken) {
    return res.status(400).json({
      error: "refresh token is required in headers",
    });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      error: "Invalid refresh token",
      refresh_expired: true,
    });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find((u) => u.id === payload.sub);

    if (!user) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({
        error: "User not found",
        refresh_expired: true,
      });
    }

    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    refreshTokens.add(newRefreshToken);

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      refresh_expired: false,
    });
  } catch (error) {
    refreshTokens.delete(refreshToken);
    return res.status(401).json({
      error: "Invalid or expired refresh token",
      refresh_expired: true,
    });
  }
});

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

app.post("/api/products", authMiddleware, (req, res) => {
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

app.get("/api/products", authMiddleware, (req, res) => {
  res.json(products);
});

app.get("/api/products/:id", authMiddleware, (req, res) => {
  const product = products.find((p) => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  res.json(product);
});

app.put("/api/products/:id", authMiddleware, (req, res) => {
  const product = products.find((p) => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

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

app.delete("/api/products/:id", authMiddleware, (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  const deleted = products.splice(index, 1)[0];

  res.json({
    message: "Product deleted",
    product: deleted,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  const backendUrl = process.env.CODESPACE_NAME
    ? `https://${process.env.CODESPACE_NAME}-${PORT}.app.github.dev`
    : `http://localhost:${PORT}`;

  console.log(`Backend started: ${backendUrl}`);
});