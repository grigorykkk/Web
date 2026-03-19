import React, { useEffect, useState } from "react";
import api, { session } from "./api";

const emptyProductForm = {
  title: "",
  category: "",
  description: "",
  price: "",
};

const emptyRegisterForm = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
};

const emptyUserEditForm = {
  id: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "user",
};

function getErrorMessage(error, fallbackMessage) {
  return error.response?.data?.error || error.message || fallbackMessage;
}

function formatRole(role) {
  if (role === "admin") return "Администратор";
  if (role === "seller") return "Продавец";
  return "Пользователь";
}

export default function App() {
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [authTab, setAuthTab] = useState("login");

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);

  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [createForm, setCreateForm] = useState(emptyProductForm);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState(emptyProductForm);
  const [deleteId, setDeleteId] = useState("");

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userEditForm, setUserEditForm] = useState(emptyUserEditForm);
  const [blockUserId, setBlockUserId] = useState("");

  const canViewProducts = Boolean(user);
  const canManageProducts = user?.role === "seller" || user?.role === "admin";
  const canDeleteProducts = user?.role === "admin";
  const canManageUsers = user?.role === "admin";

  function resetProtectedState() {
    setUser(null);
    setProducts([]);
    setSelectedProductId("");
    setSelectedProduct(null);
    setCreateForm(emptyProductForm);
    setEditId("");
    setEditForm(emptyProductForm);
    setDeleteId("");
    setUsers([]);
    setSelectedUserId("");
    setSelectedUser(null);
    setUserEditForm(emptyUserEditForm);
    setBlockUserId("");
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
          message: getErrorMessage(error, "Не удалось загрузить пользователя"),
        });
      }

      return null;
    }
  }

  async function loadProducts() {
    if (!session.hasSession()) {
      return null;
    }

    try {
      const response = await api.getProducts();
      setProducts(response.data);
      return response.data;
    } catch (error) {
      if (!session.hasSession()) {
        return null;
      }

      setProducts([]);
      setMessage(getErrorMessage(error, "Не удалось загрузить товары"));
      return null;
    }
  }

  async function loadUsers(role = user?.role) {
    if (!session.hasSession() || role !== "admin") {
      setUsers([]);
      return null;
    }

    try {
      const response = await api.getUsers();
      setUsers(response.data);
      return response.data;
    } catch (error) {
      if (!session.hasSession()) {
        return null;
      }

      setUsers([]);
      setMessage(getErrorMessage(error, "Не удалось загрузить пользователей"));
      return null;
    }
  }

  async function restoreSession() {
    const currentUser = await loadMe();
    if (!currentUser) {
      return;
    }

    await loadProducts();

    if (currentUser.role === "admin") {
      await loadUsers(currentUser.role);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
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

      await loadProducts();

      if (currentUser.role === "admin") {
        await loadUsers(currentUser.role);
      }

      if (!session.hasSession()) {
        return;
      }

      setLoginForm({
        email: "",
        password: "",
      });
      setMessage("Вход выполнен");
    } catch (error) {
      setMessage(getErrorMessage(error, "Ошибка входа"));
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setMessage("");

    try {
      await api.register(registerForm);
      setRegisterForm(emptyRegisterForm);
      setAuthTab("login");
      setMessage("Регистрация выполнена. Теперь можно войти.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Ошибка регистрации"));
    }
  }

  function handleLogout() {
    session.logout();
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
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
      if (session.hasSession()) {
        setMessage(getErrorMessage(error, "Ошибка создания товара"));
      }
    }
  }

  async function handleGetProductById(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.getProductById(selectedProductId);
      setSelectedProduct(response.data);
      setMessage("Товар найден");
    } catch (error) {
      if (session.hasSession()) {
        setSelectedProduct(null);
        setMessage(getErrorMessage(error, "Ошибка получения товара"));
      }
    }
  }

  async function handleUpdateProduct(event) {
    event.preventDefault();
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
      if (session.hasSession()) {
        setMessage(getErrorMessage(error, "Ошибка обновления товара"));
      }
    }
  }

  async function handleDeleteProduct(event) {
    event.preventDefault();
    setMessage("");

    try {
      await api.deleteProduct(deleteId);
      setDeleteId("");
      setSelectedProduct(null);
      await loadProducts();
      setMessage("Товар удалён");
    } catch (error) {
      if (session.hasSession()) {
        setMessage(getErrorMessage(error, "Ошибка удаления товара"));
      }
    }
  }

  async function handleGetUserById(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.getUserById(selectedUserId);
      setSelectedUser(response.data);
      setUserEditForm({
        id: response.data.id,
        email: response.data.email,
        first_name: response.data.first_name,
        last_name: response.data.last_name,
        role: response.data.role,
      });
      setMessage("Пользователь найден");
    } catch (error) {
      setSelectedUser(null);
      setMessage(getErrorMessage(error, "Ошибка получения пользователя"));
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await api.updateUser(userEditForm.id, {
        email: userEditForm.email,
        first_name: userEditForm.first_name,
        last_name: userEditForm.last_name,
        role: userEditForm.role,
      });

      setSelectedUser(response.data);

      if (user?.id === response.data.id) {
        setUser(response.data);
      }

      await loadUsers();
      setMessage("Пользователь обновлён");
    } catch (error) {
      setMessage(getErrorMessage(error, "Ошибка обновления пользователя"));
    }
  }

  async function handleBlockUser(event) {
    event.preventDefault();
    setMessage("");

    try {
      await api.blockUser(blockUserId);
      setBlockUserId("");
      if (selectedUser?.id === blockUserId) {
        setSelectedUser(null);
      }
      await loadUsers();
      setMessage("Пользователь заблокирован");
    } catch (error) {
      setMessage(getErrorMessage(error, "Ошибка блокировки пользователя"));
    }
  }

  if (!user) {
    return (
      <div className="page authPage">
        {message && <div className="message">{message}</div>}

        <div className="tabs authTabs">
          <button
            className={authTab === "login" ? "active" : ""}
            onClick={() => setAuthTab("login")}
            type="button"
          >
            Вход
          </button>
          <button
            className={authTab === "register" ? "active" : ""}
            onClick={() => setAuthTab("register")}
            type="button"
          >
            Регистрация
          </button>
        </div>

        {authTab === "login" ? (
          <form className="card authCard" onSubmit={handleLogin}>
            <h2>Войти в систему</h2>

            <input
              type="email"
              placeholder="Email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm({ ...loginForm, email: event.target.value })
              }
            />

            <input
              type="password"
              placeholder="Пароль"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm({ ...loginForm, password: event.target.value })
              }
            />

            <button type="submit">Войти</button>

            <div className="credentials">
              <div>admin@example.com / admin123</div>
              <div>seller@example.com / seller123</div>
              <div>user@example.com / user123</div>
            </div>
          </form>
        ) : (
          <form className="card authCard" onSubmit={handleRegister}>
            <h2>Создать пользователя</h2>

            <input
              type="text"
              placeholder="Имя"
              value={registerForm.first_name}
              onChange={(event) =>
                setRegisterForm({
                  ...registerForm,
                  first_name: event.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Фамилия"
              value={registerForm.last_name}
              onChange={(event) =>
                setRegisterForm({
                  ...registerForm,
                  last_name: event.target.value,
                })
              }
            />

            <input
              type="email"
              placeholder="Email"
              value={registerForm.email}
              onChange={(event) =>
                setRegisterForm({ ...registerForm, email: event.target.value })
              }
            />

            <input
              type="password"
              placeholder="Пароль"
              value={registerForm.password}
              onChange={(event) =>
                setRegisterForm({
                  ...registerForm,
                  password: event.target.value,
                })
              }
            />

            <button type="submit">Зарегистрироваться</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar card">
        <div>
          <p className="lead">
            {user.first_name} {user.last_name} ({user.email}) •{" "}
            {formatRole(user.role)}
          </p>
        </div>
        <button onClick={handleLogout}>Выйти</button>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="grid">
        <div className="card">
          <h2>Текущий пользователь</h2>
          <button onClick={restoreSession}>Обновить данные</button>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>

        {canViewProducts && (
          <form className="card" onSubmit={handleGetProductById}>
            <h2>Получить товар по ID</h2>

            <input
              type="text"
              placeholder="ID товара"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            />

            <button type="submit">Получить</button>

            {selectedProduct && (
              <pre>{JSON.stringify(selectedProduct, null, 2)}</pre>
            )}
          </form>
        )}

        {canManageProducts && (
          <form className="card" onSubmit={handleCreateProduct}>
            <h2>Создать товар</h2>

            <input
              type="text"
              placeholder="Название"
              value={createForm.title}
              onChange={(event) =>
                setCreateForm({ ...createForm, title: event.target.value })
              }
            />

            <input
              type="text"
              placeholder="Категория"
              value={createForm.category}
              onChange={(event) =>
                setCreateForm({ ...createForm, category: event.target.value })
              }
            />

            <textarea
              placeholder="Описание"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm({
                  ...createForm,
                  description: event.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Цена"
              value={createForm.price}
              onChange={(event) =>
                setCreateForm({ ...createForm, price: event.target.value })
              }
            />

            <button type="submit">Создать</button>
          </form>
        )}

        {canManageProducts && (
          <form className="card" onSubmit={handleUpdateProduct}>
            <h2>Обновить товар</h2>

            <input
              type="text"
              placeholder="ID товара"
              value={editId}
              onChange={(event) => setEditId(event.target.value)}
            />

            <input
              type="text"
              placeholder="Новое название"
              value={editForm.title}
              onChange={(event) =>
                setEditForm({ ...editForm, title: event.target.value })
              }
            />

            <input
              type="text"
              placeholder="Новая категория"
              value={editForm.category}
              onChange={(event) =>
                setEditForm({ ...editForm, category: event.target.value })
              }
            />

            <textarea
              placeholder="Новое описание"
              value={editForm.description}
              onChange={(event) =>
                setEditForm({
                  ...editForm,
                  description: event.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Новая цена"
              value={editForm.price}
              onChange={(event) =>
                setEditForm({ ...editForm, price: event.target.value })
              }
            />

            <button type="submit">Обновить</button>
          </form>
        )}

        {canDeleteProducts && (
          <form className="card" onSubmit={handleDeleteProduct}>
            <h2>Удалить товар</h2>

            <input
              type="text"
              placeholder="ID товара"
              value={deleteId}
              onChange={(event) => setDeleteId(event.target.value)}
            />

            <button type="submit" className="danger">
              Удалить
            </button>
          </form>
        )}

        {canManageUsers && (
          <form className="card" onSubmit={handleGetUserById}>
            <h2>Получить пользователя по ID</h2>

            <input
              type="text"
              placeholder="ID пользователя"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            />

            <button type="submit">Получить</button>

            {selectedUser && <pre>{JSON.stringify(selectedUser, null, 2)}</pre>}
          </form>
        )}

        {canManageUsers && (
          <form className="card" onSubmit={handleUpdateUser}>
            <h2>Обновить пользователя</h2>

            <input
              type="text"
              placeholder="ID пользователя"
              value={userEditForm.id}
              onChange={(event) =>
                setUserEditForm({ ...userEditForm, id: event.target.value })
              }
            />

            <input
              type="email"
              placeholder="Email"
              value={userEditForm.email}
              onChange={(event) =>
                setUserEditForm({
                  ...userEditForm,
                  email: event.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Имя"
              value={userEditForm.first_name}
              onChange={(event) =>
                setUserEditForm({
                  ...userEditForm,
                  first_name: event.target.value,
                })
              }
            />

            <input
              type="text"
              placeholder="Фамилия"
              value={userEditForm.last_name}
              onChange={(event) =>
                setUserEditForm({
                  ...userEditForm,
                  last_name: event.target.value,
                })
              }
            />

            <select
              value={userEditForm.role}
              onChange={(event) =>
                setUserEditForm({ ...userEditForm, role: event.target.value })
              }
            >
              <option value="user">Пользователь</option>
              <option value="seller">Продавец</option>
              <option value="admin">Администратор</option>
            </select>

            <button type="submit">Сохранить</button>
          </form>
        )}

        {canManageUsers && (
          <form className="card" onSubmit={handleBlockUser}>
            <h2>Заблокировать пользователя</h2>

            <input
              type="text"
              placeholder="ID пользователя"
              value={blockUserId}
              onChange={(event) => setBlockUserId(event.target.value)}
            />

            <button type="submit" className="danger">
              Заблокировать
            </button>
          </form>
        )}
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

      {canManageUsers && (
        <div className="card">
          <div className="listHeader">
            <h2>Список пользователей</h2>
            <button onClick={loadUsers}>Обновить список</button>
          </div>

          {users.length === 0 ? (
            <p>Пользователей пока нет</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Имя</th>
                  <th>Фамилия</th>
                  <th>Роль</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.email}</td>
                    <td>{item.first_name}</td>
                    <td>{item.last_name}</td>
                    <td>{formatRole(item.role)}</td>
                    <td>{item.blocked ? "Заблокирован" : "Активен"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
