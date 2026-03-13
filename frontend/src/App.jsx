import React, { useEffect, useState } from "react";
import api, { session } from "./api";

const emptyProductForm = {
  title: "",
  category: "",
  description: "",
  price: "",
};

function getErrorMessage(error, fallbackMessage) {
  return error.response?.data?.error || error.message || fallbackMessage;
}

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

  function resetProtectedState() {
    setUser(null);
    setProducts([]);
    setSelectedProductId("");
    setSelectedProduct(null);
    setCreateForm(emptyProductForm);
    setEditId("");
    setEditForm(emptyProductForm);
    setDeleteId("");
  }

  useEffect(() => {
    const unsubscribe = session.subscribe((event) => {
      resetProtectedState();
      setMessage(event.message || "");
    });

    if (session.initialize()) {
      void restoreSession();
    }

    return unsubscribe;
  }, []);

  async function loadMe() {
    try {
      const response = await api.me();
      setUser(response.data);
      return response.data;
    } catch (error) {
      if (session.hasSession()) {
        session.clear({
          reason: "invalid",
          message: getErrorMessage(
            error,
            "Не удалось загрузить пользователя"
          ),
        });
      }

      return null;
    }
  }

  async function loadProducts() {
    try {
      const response = await api.getProducts();
      setProducts(response.data);
      return response.data;
    } catch (error) {
      if (!session.hasSession()) {
        return null;
      }

      setProducts([]);
      setMessage(getErrorMessage(error, "Не удалось загрузить список товаров"));
      return null;
    }
  }

  async function restoreSession() {
    const currentUser = await loadMe();
    if (!currentUser) {
      return;
    }

    await loadProducts();
  }

  async function handleLogin(e) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await api.login(loginForm);
      const saved = session.saveTokens({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });

      if (!saved) {
        return;
      }

      const currentUser = await loadMe();
      if (!currentUser) {
        return;
      }

      const loadedProducts = await loadProducts();
      if (!session.hasSession()) {
        return;
      }

      setLoginForm({
        email: "",
        password: "",
      });

      setMessage(
        loadedProducts ? "Вход выполнен" : "Вход выполнен, но товары не загружены"
      );
    } catch (error) {
      setMessage(getErrorMessage(error, "Ошибка входа"));
    }
  }

  function handleLogout() {
    session.logout();
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
      if (!session.hasSession()) {
        return;
      }

      setMessage("Товар создан");
    } catch (error) {
      if (!session.hasSession()) {
        return;
      }

      setMessage(getErrorMessage(error, "Ошибка создания товара"));
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
      if (!session.hasSession()) {
        return;
      }

      setSelectedProduct(null);
      setMessage(getErrorMessage(error, "Ошибка получения товара"));
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
      if (!session.hasSession()) {
        return;
      }

      setMessage("Товар обновлён");
    } catch (error) {
      if (!session.hasSession()) {
        return;
      }

      setMessage(getErrorMessage(error, "Ошибка обновления товара"));
    }
  }

  async function handleDeleteProduct(e) {
    e.preventDefault();
    setMessage("");

    try {
      await api.deleteProduct(deleteId);
      setDeleteId("");
      await loadProducts();
      if (!session.hasSession()) {
        return;
      }

      setMessage("Товар удалён");
    } catch (error) {
      if (!session.hasSession()) {
        return;
      }

      setMessage(getErrorMessage(error, "Ошибка удаления товара"));
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
            Пользователь: <strong>{user.first_name} {user.last_name}</strong> (
            {user.email})
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
