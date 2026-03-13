import axios from "axios";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const SESSION_EXPIRED_MESSAGE = "Сессия истекла. Войдите снова.";
const AUTH_REFRESH_EXCLUDED_URLS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
]);

function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return "/api";
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const backendPort = import.meta.env.VITE_BACKEND_PORT || "3000";

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:${backendPort}/api`;
  }

  if (hostname.endsWith(".app.github.dev")) {
    const subdomain = hostname.replace(".app.github.dev", "");
    const lastDashIndex = subdomain.lastIndexOf("-");
    const codespaceName =
      lastDashIndex !== -1 ? subdomain.slice(0, lastDashIndex) : subdomain;

    return `${protocol}//${codespaceName}-${backendPort}.app.github.dev/api`;
  }

  return `${protocol}//${hostname}/api`;
}

function parseJwtPayload(token) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch (error) {
    return null;
  }
}

function getTokenExpiryMs(token) {
  const payload = parseJwtPayload(token);

  if (!payload || typeof payload.exp !== "number") {
    return null;
  }

  return payload.exp * 1000;
}

function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  };
}

function clearStoredTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const sessionListeners = new Set();
let logoutTimerId = null;
let refreshPromise = null;

function emitSessionEvent(event) {
  sessionListeners.forEach((listener) => listener(event));
}

function clearLogoutTimer() {
  if (logoutTimerId !== null) {
    window.clearTimeout(logoutTimerId);
    logoutTimerId = null;
  }
}

function clearSession({ reason = "logout", message = "", notify = true } = {}) {
  const { accessToken, refreshToken } = getStoredTokens();
  const hadSession = Boolean(accessToken || refreshToken || logoutTimerId !== null);

  clearLogoutTimer();
  clearStoredTokens();
  refreshPromise = null;

  if (notify && (hadSession || reason === "logout")) {
    emitSessionEvent({ reason, message });
  }
}

function scheduleSessionExpiry(accessToken, refreshToken) {
  const accessExpiryMs = getTokenExpiryMs(accessToken);
  const refreshExpiryMs = getTokenExpiryMs(refreshToken);

  if (!accessExpiryMs || !refreshExpiryMs) {
    clearSession({
      reason: "invalid",
      message: SESSION_EXPIRED_MESSAGE,
    });
    return false;
  }

  const expiresAt = Math.min(accessExpiryMs, refreshExpiryMs);
  const delayMs = expiresAt - Date.now();

  if (delayMs <= 0) {
    clearSession({
      reason: "expired",
      message: SESSION_EXPIRED_MESSAGE,
    });
    return false;
  }

  clearLogoutTimer();
  logoutTimerId = window.setTimeout(() => {
    clearSession({
      reason: "expired",
      message: SESSION_EXPIRED_MESSAGE,
    });
  }, delayMs);

  return true;
}

function shouldSkipAuthToken(config) {
  return Boolean(config?.skipAuthToken);
}

function shouldSkipAuthRefresh(config) {
  return Boolean(
    config?.skipAuthRefresh ||
      AUTH_REFRESH_EXCLUDED_URLS.has(config?.url || "")
  );
}

export const session = {
  initialize() {
    const { accessToken, refreshToken } = getStoredTokens();

    if (!accessToken || !refreshToken) {
      clearLogoutTimer();
      return false;
    }

    return scheduleSessionExpiry(accessToken, refreshToken);
  },

  hasSession() {
    const { accessToken, refreshToken } = getStoredTokens();
    return Boolean(accessToken && refreshToken);
  },

  saveTokens({ accessToken, refreshToken }) {
    if (!accessToken || !refreshToken) {
      clearSession({
        reason: "invalid",
        message: SESSION_EXPIRED_MESSAGE,
      });
      return false;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    return scheduleSessionExpiry(accessToken, refreshToken);
  },

  clear(options) {
    clearSession(options);
  },

  logout(message = "Вы вышли из системы") {
    clearSession({
      reason: "logout",
      message,
    });
  },

  subscribe(listener) {
    sessionListeners.add(listener);

    return () => {
      sessionListeners.delete(listener);
    };
  },

  getAccessToken() {
    return getStoredTokens().accessToken;
  },

  getRefreshToken() {
    return getStoredTokens().refreshToken;
  },
};

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    accept: "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    config.headers = config.headers || {};

    if (shouldSkipAuthToken(config)) {
      delete config.headers.Authorization;
      return config;
    }

    const accessToken = session.getAccessToken();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const api = {
  register(data) {
    return apiClient.post("/auth/register", data, {
      skipAuthToken: true,
      skipAuthRefresh: true,
    });
  },

  login(data) {
    return apiClient.post("/auth/login", data, {
      skipAuthToken: true,
      skipAuthRefresh: true,
    });
  },

  me() {
    return apiClient.get("/auth/me");
  },

  refresh(refreshToken) {
    return apiClient.post(
      "/auth/refresh",
      {},
      {
        headers: {
          "x-refresh-token": refreshToken,
        },
        skipAuthToken: true,
        skipAuthRefresh: true,
      }
    );
  },

  getProducts() {
    return apiClient.get("/products");
  },

  getProductById(id) {
    return apiClient.get(`/products/${id}`);
  },

  createProduct(data) {
    return apiClient.post("/products", data);
  },

  updateProduct(id, data) {
    return apiClient.put(`/products/${id}`, data);
  },

  deleteProduct(id) {
    return apiClient.delete(`/products/${id}`);
  },
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      !error.response ||
      error.response.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipAuthRefresh(originalRequest)
    ) {
      return Promise.reject(error);
    }

    const refreshToken = session.getRefreshToken();
    if (!refreshToken) {
      clearSession({
        reason: "expired",
        message: SESSION_EXPIRED_MESSAGE,
      });
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.refresh(refreshToken).finally(() => {
          refreshPromise = null;
        });
      }

      const response = await refreshPromise;
      const newAccessToken = response.data?.accessToken;
      const newRefreshToken = response.data?.refreshToken;
      const saved = session.saveTokens({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      if (!saved) {
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession({
        reason: "expired",
        message: SESSION_EXPIRED_MESSAGE,
      });
      return Promise.reject(refreshError);
    }
  }
);

export default api;
