import React, { useEffect, useState } from "react";
import api from "./api";

const emptyProductForm = {
  title: "",
  category: "",
  description: "",
  price: "",
};

export default function App() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [createForm, setCreateForm] = useState(emptyProductForm);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState(emptyProductForm);
  const [deleteId, setDeleteId] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      loadMe();
      loadProducts();
    }
  }, []);

  async function loadMe() {
    try {
      const response = await api.me();
      setUser(response.data);
    } catch (error) {
      setUser(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }

  async function loadProducts() {
    try {
      const response = await api.getProducts();
      setProducts(response.data);
    } catch (error) {
      setProducts([]);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await api.login(loginForm);

      localStorage.setItem("accessToken", response.data.accessToken);
      localStorage.setItem("refreshToken", response.data.refreshToken);

      await loadMe();
      await loadProducts();

      setLoginForm({
        email: "",
        password: "",
      });

      setMessage("Вход выполнен");
    } catch (error) {
      setMessage(error.response?.data?.error || "Ошибка входа");
    }
  }

  function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setProducts([]);
    setSelectedProduct(null);
    setSelectedProductId("");
    setMessage("Вы вышли из системы");
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    setMessage("");

    try {
      await api.createProduct({
        ...createForm,
        price: Number(createForm.price),
      });

      setCreateForm(emptyProductForm);
      await loadProducts();
      setMessage("Товар создан");
    } catch (error) {
      setMessage(error.response?.data?.error || "Ошибка создания товара");
    }
  }

  async function handleGetProductById(e) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await api.getProductById(selectedProductId);
      setSelectedProduct(response.data);
      setMessage("Товар найден");
    } catch (error) {
      setSelectedProduct(null);
      setMessage(error.response?.data?.error || "Ошибка получения товара");
    }
  }

  async function handleUpdateProduct(e) {
    e.preventDefault();
    setMessage("");

    try {
      const payload = {};
      if (editForm.title !== "") payload.title = editForm.title;
      if (editForm.category !== "") payload.category = editForm.category;
      if (editForm.description !== "") payload.description = editForm.description;
      if (editForm.price !== "") payload.price = Number(editForm.price);

      await api.updateProduct(editId, payload);
      setEditId("");
      setEditForm(emptyProductForm);
      await loadProducts();
      setMessage("Товар обновлён");
    } catch (error) {
      setMessage(error.response?.data?.error || "Ошибка обновления товара");
    }
  }

  async function handleDeleteProduct(e) {
    e.preventDefault();
    setMessage("");

    try {
      await api.deleteProduct(deleteId);
      setDeleteId("");
      await loadProducts();
      setMessage("Товар удалён");
    } catch (error) {
      setMessage(error.response?.data?.error || "Ошибка удаления товара");
    }
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Практика 10</h1>

        {message && <div className="message">{message}</div>}

        <form className="card" onSubmit={handleLogin}>
          <h2>Вход</h2>

          <input
            type="email"
            placeholder="Email"
            value={loginForm.email}
            onChange={(e) =>
              setLoginForm({ ...loginForm, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Пароль"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm({ ...loginForm, password: e.target.value })
            }
          />

          <button type="submit">Войти</button>

          <div className="demo">
            Тестовый вход: grigory@example.com / grigory123
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <h1>Практика 10</h1>
          <p>
            Пользователь: <strong>{user.first_name} {user.last_name}</strong> ({user.email})
          </p>
        </div>
        <button onClick={handleLogout}>Выйти</button>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="grid">
        <div className="card">
          <h2>Текущий пользователь</h2>
          <button onClick={loadMe}>Обновить /api/auth/me</button>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>

        <form className="card" onSubmit={handleCreateProduct}>
          <h2>Создать товар</h2>

          <input
            type="text"
            placeholder="Название"
            value={createForm.title}
            onChange={(e) =>
              setCreateForm({ ...createForm, title: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Категория"
            value={createForm.category}
            onChange={(e) =>
              setCreateForm({ ...createForm, category: e.target.value })
            }
          />

          <textarea
            placeholder="Описание"
            value={createForm.description}
            onChange={(e) =>
              setCreateForm({ ...createForm, description: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Цена"
            value={createForm.price}
            onChange={(e) =>
              setCreateForm({ ...createForm, price: e.target.value })
            }
          />

          <button type="submit">Создать</button>
        </form>

        <form className="card" onSubmit={handleGetProductById}>
          <h2>Получить товар по ID</h2>

          <input
            type="text"
            placeholder="ID товара"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          />

          <button type="submit">Получить</button>

          {selectedProduct && (
            <pre>{JSON.stringify(selectedProduct, null, 2)}</pre>
          )}
        </form>

        <form className="card" onSubmit={handleUpdateProduct}>
          <h2>Обновить товар</h2>

          <input
            type="text"
            placeholder="ID товара"
            value={editId}
            onChange={(e) => setEditId(e.target.value)}
          />

          <input
            type="text"
            placeholder="Новое название"
            value={editForm.title}
            onChange={(e) =>
              setEditForm({ ...editForm, title: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Новая категория"
            value={editForm.category}
            onChange={(e) =>
              setEditForm({ ...editForm, category: e.target.value })
            }
          />

          <textarea
            placeholder="Новое описание"
            value={editForm.description}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
          />

          <input
            type="number"
            placeholder="Новая цена"
            value={editForm.price}
            onChange={(e) =>
              setEditForm({ ...editForm, price: e.target.value })
            }
          />

          <button type="submit">Обновить</button>
        </form>

        <form className="card" onSubmit={handleDeleteProduct}>
          <h2>Удалить товар</h2>

          <input
            type="text"
            placeholder="ID товара"
            value={deleteId}
            onChange={(e) => setDeleteId(e.target.value)}
          />

          <button type="submit" className="danger">
            Удалить
          </button>
        </form>
      </div>

      <div className="card">
        <div className="listHeader">
          <h2>Список товаров</h2>
          <button onClick={loadProducts}>Обновить список</button>
        </div>

        {products.length === 0 ? (
          <p>Товаров пока нет</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Категория</th>
                <th>Описание</th>
                <th>Цена</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.title}</td>
                  <td>{item.category}</td>
                  <td>{item.description}</td>
                  <td>{item.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}