import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
    accept: "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

const api = {
  register(data) {
    return apiClient.post("/auth/register", data);
  },

  login(data) {
    return apiClient.post("/auth/login", data);
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
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      if (!accessToken || !refreshToken) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return Promise.reject(error);
      }

      try {
        const response = await api.refresh(refreshToken);
        const isRefreshExpired = response.data.refresh_expired;

        if (isRefreshExpired) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          return Promise.reject(error);
        }

        const newAccessToken = response.data.accessToken;
        const newRefreshToken = response.data.refreshToken;

        localStorage.setItem("accessToken", newAccessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;