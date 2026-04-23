const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { createClient } = require("redis");
const { nanoid } = require("nanoid");

const app = express();

const PORT = process.env.PORT || 3000;

const ROLES = {
  USER: "user",
  SELLER: "seller",
  ADMIN: "admin",
};

const ACCESS_SECRET = "access_secret_key_change_me";
const REFRESH_SECRET = "refresh_secret_key_change_me";

const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";
const USERS_CACHE_TTL = 60;
const PRODUCTS_CACHE_TTL = 600;

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const redisClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 1000,
    reconnectStrategy: false,
  },
});
let redisReady = false;

redisClient.on("error", (error) => {
  redisReady = false;
  console.error("Redis error:", error.message);
});

redisClient.on("ready", () => {
  redisReady = true;
  console.log(`Redis connected: ${redisUrl}`);
});

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

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  return next(error);
});

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    blocked: user.blocked,
  };
}

const users = [
  {
    id: "usr_admin",
    email: "admin@example.com",
    first_name: "Админ",
    last_name: "Системный",
    role: ROLES.ADMIN,
    blocked: false,
    passwordHash: bcrypt.hashSync("admin123", 10),
  },
  {
    id: "usr_seller",
    email: "seller@example.com",
    first_name: "Ирина",
    last_name: "Продавец",
    role: ROLES.SELLER,
    blocked: false,
    passwordHash: bcrypt.hashSync("seller123", 10),
  },
  {
    id: "usr_user",
    email: "user@example.com",
    first_name: "Павел",
    last_name: "Покупатель",
    role: ROLES.USER,
    blocked: false,
    passwordHash: bcrypt.hashSync("user123", 10),
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
      role: user.role,
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
      role: user.role,
      jti: nanoid(12),
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function revokeRefreshTokensForUser(userId) {
  Array.from(refreshTokens).forEach((token) => {
    const payload = jwt.decode(token);
    if (payload?.sub === userId) {
      refreshTokens.delete(token);
    }
  });
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
    const user = users.find((item) => item.id === payload.sub);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.blocked) {
      return res.status(403).json({ error: "User is blocked" });
    }

    req.user = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    req.currentUser = user;

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

function getRefreshToken(req) {
  const headerToken =
    req.headers["x-refresh-token"] || req.headers["refresh-token"];

  if (typeof req.body?.refreshToken === "string") {
    return req.body.refreshToken;
  }

  return headerToken;
}

function getJsonBody(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return null;
  }

  return req.body;
}

function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

async function initRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    redisReady = false;
    console.warn("Redis is unavailable, caching disabled:", error.message);
  }
}

async function getFromCache(key) {
  if (!redisReady) {
    return null;
  }

  try {
    return await redisClient.get(key);
  } catch (error) {
    console.warn(`Failed to read cache key "${key}":`, error.message);
    return null;
  }
}

async function saveToCache(key, ttlSeconds, data) {
  if (!redisReady) {
    return;
  }

  try {
    await redisClient.set(key, JSON.stringify(data), {
      EX: ttlSeconds,
    });
  } catch (error) {
    console.warn(`Failed to write cache key "${key}":`, error.message);
  }
}

async function deleteCacheKeys(keys) {
  if (!redisReady || keys.length === 0) {
    return;
  }

  try {
    await redisClient.del(keys);
  } catch (error) {
    console.warn("Failed to invalidate cache:", error.message);
  }
}

async function invalidateUsersCache(userId) {
  const keys = ["users:list"];
  if (userId) {
    keys.push(`users:${userId}`);
  }

  await deleteCacheKeys(keys);
}

async function invalidateProductsCache(productId) {
  const keys = ["products:list"];
  if (productId) {
    keys.push(`products:${productId}`);
  }

  await deleteCacheKeys(keys);
}

function cacheMiddleware(getKey, ttlSeconds) {
  return async (req, res, next) => {
    const cacheKey =
      typeof getKey === "function" ? getKey(req) : String(getKey);

    const cachedValue = await getFromCache(cacheKey);
    if (cachedValue) {
      try {
        return res.json({
          source: "cache",
          data: JSON.parse(cachedValue),
        });
      } catch (error) {
        console.warn(`Failed to parse cache key "${cacheKey}":`, error.message);
      }
    }

    req.cacheKey = cacheKey;
    req.cacheTTL = ttlSeconds;
    return next();
  };
}

app.post("/api/auth/register", async (req, res) => {
  const body = getJsonBody(req, res);
  if (!body) {
    return;
  }

  const { email, password, first_name, last_name } = body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      error: "email, password, first_name and last_name are required",
    });
  }

  const exists = users.some((user) => user.email === email);
  if (exists) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    id: nanoid(10),
    email,
    first_name,
    last_name,
    role: ROLES.USER,
    blocked: false,
    passwordHash,
  };

  users.push(user);

  return res.status(201).json(sanitizeUser(user));
});

app.post("/api/auth/login", async (req, res) => {
  const body = getJsonBody(req, res);
  if (!body) {
    return;
  }

  const { email, password } = body;

  if (!email || !password) {
    return res.status(400).json({
      error: "email and password are required",
    });
  }

  const user = users.find((item) => item.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user.blocked) {
    return res.status(403).json({ error: "User is blocked" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  refreshTokens.add(refreshToken);

  return res.json({
    accessToken,
    refreshToken,
  });
});

app.post("/api/auth/refresh", (req, res) => {
  const refreshToken = getRefreshToken(req);

  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({
      error: "refreshToken is required",
      refresh_expired: true,
    });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({
      error: "Invalid or expired refresh token",
      refresh_expired: true,
    });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find((item) => item.id === payload.sub);

    if (!user || user.blocked) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({
        error: "Invalid or expired refresh token",
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

app.get(
  "/api/auth/me",
  authMiddleware,
  roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    return res.json(sanitizeUser(req.currentUser));
  }
);

app.get(
  "/api/protected-route",
  authMiddleware,
  roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  (req, res) => {
    return res.json({
      message: "Protected route for seller or admin",
      user: sanitizeUser(req.currentUser),
    });
  }
);

app.get(
  "/api/protected-admin-route",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  (req, res) => {
    return res.json({
      message: "Admin only route",
      user: sanitizeUser(req.currentUser),
    });
  }
);

app.get(
  "/api/users",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  cacheMiddleware(() => "users:list", USERS_CACHE_TTL),
  async (req, res) => {
    const data = users.map(sanitizeUser);
    await saveToCache(req.cacheKey, req.cacheTTL, data);
    return res.json({
      source: "server",
      data,
    });
  }
);

app.get(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  cacheMiddleware((req) => `users:${req.params.id}`, USERS_CACHE_TTL),
  async (req, res) => {
    const user = users.find((item) => item.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const data = sanitizeUser(user);
    await saveToCache(req.cacheKey, req.cacheTTL, data);
    return res.json({
      source: "server",
      data,
    });
  }
);

app.put(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  async (req, res) => {
    const user = users.find((item) => item.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const body = getJsonBody(req, res);
    if (!body) {
      return;
    }

    const { email, first_name, last_name, role } = body;

    if (email !== undefined) {
      const emailTaken = users.some(
        (item) => item.email === email && item.id !== user.id
      );

      if (emailTaken) {
        return res.status(409).json({ error: "User already exists" });
      }

      user.email = email;
    }

    if (first_name !== undefined) {
      user.first_name = first_name;
    }

    if (last_name !== undefined) {
      user.last_name = last_name;
    }

    if (role !== undefined) {
      if (!isValidRole(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      user.role = role;
    }

    await invalidateUsersCache(user.id);
    return res.json(sanitizeUser(user));
  }
);

app.delete(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  async (req, res) => {
    const user = users.find((item) => item.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.id === req.currentUser.id) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    user.blocked = true;
    revokeRefreshTokensForUser(user.id);
    await invalidateUsersCache(user.id);

    return res.json({
      message: "User blocked",
      user: sanitizeUser(user),
    });
  }
);

app.post(
  "/api/products",
  authMiddleware,
  roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  async (req, res) => {
    const body = getJsonBody(req, res);
    if (!body) {
      return;
    }

    const { title, category, description, price } = body;

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
    await invalidateProductsCache(product.id);
    return res.status(201).json(product);
  }
);

app.get(
  "/api/products",
  authMiddleware,
  roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]),
  cacheMiddleware(() => "products:list", PRODUCTS_CACHE_TTL),
  async (req, res) => {
    const data = products;
    await saveToCache(req.cacheKey, req.cacheTTL, data);
    return res.json({
      source: "server",
      data,
    });
  }
);

app.get(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]),
  cacheMiddleware((req) => `products:${req.params.id}`, PRODUCTS_CACHE_TTL),
  async (req, res) => {
    const product = products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const data = product;
    await saveToCache(req.cacheKey, req.cacheTTL, data);
    return res.json({
      source: "server",
      data,
    });
  }
);

app.put(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware([ROLES.SELLER, ROLES.ADMIN]),
  async (req, res) => {
    const product = products.find((item) => item.id === req.params.id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const body = getJsonBody(req, res);
    if (!body) {
      return;
    }

    const { title, category, description, price } = body;

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

    await invalidateProductsCache(product.id);
    return res.json(product);
  }
);

app.delete(
  "/api/products/:id",
  authMiddleware,
  roleMiddleware([ROLES.ADMIN]),
  async (req, res) => {
    const index = products.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Product not found" });
    }

    const deleted = products.splice(index, 1)[0];
    await invalidateProductsCache(deleted.id);

    return res.json({
      message: "Product deleted",
      product: deleted,
    });
  }
);

initRedis().finally(() => {
  app.listen(PORT, "0.0.0.0", () => {
    const backendUrl = process.env.CODESPACE_NAME
      ? `https://${process.env.CODESPACE_NAME}-${PORT}.app.github.dev`
      : `http://localhost:${PORT}`;

    console.log(`Backend started: ${backendUrl}`);
  });
});
