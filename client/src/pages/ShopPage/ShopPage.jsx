import React, { useEffect, useState } from 'react';
import './ShopPage.css';
import ProductCard from '../../components/ProductCard';
import ProductModal from '../../components/ProductModal';
import { api } from '../../api';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingProduct, setEditingProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('Все');

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      setError('Не удалось загрузить товары. Убедитесь, что сервер запущен.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setModalMode('create'); setEditingProduct(null); setModalOpen(true); };
  const openEdit = (p) => { setModalMode('edit'); setEditingProduct(p); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingProduct(null); };

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить товар?')) return;
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch {
      alert('Ошибка при удалении товара');
    }
  };

  const handleSubmit = async (payload) => {
    try {
      if (modalMode === 'create') {
        const created = await api.createProduct(payload);
        setProducts(prev => [...prev, created]);
      } else {
        const updated = await api.updateProduct(payload.id, payload);
        setProducts(prev => prev.map(p => p.id === payload.id ? updated : p));
      }
      closeModal();
    } catch {
      alert('Ошибка при сохранении товара');
    }
  };

  const categories = ['Все', ...Array.from(new Set(products.map(p => p.category)))];

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'Все' || p.category === filterCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="shop">
      <header className="shop__header">
        <div className="shop__header-inner">
          <div className="shop__logo">
            <span className="shop__logo-icon">⚡</span>
            <span className="shop__logo-text">TechStore</span>
          </div>
          <div className="shop__header-right">
            <span className="shop__count">{products.length} товаров</span>
            <button className="btn btn--primary" onClick={openCreate}>+ Добавить товар</button>
          </div>
        </div>
      </header>

      <main className="shop__main">
        <div className="shop__container">

          <div className="shop__controls">
            <div className="search-wrap">
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                placeholder="Поиск товаров..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
            <div className="filters">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-btn ${filterCategory === cat ? 'active' : ''}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="state-box">
              <div className="spinner" />
              <p>Загрузка товаров...</p>
            </div>
          )}

          {error && (
            <div className="state-box state-box--error">
              <span style={{ fontSize: 32 }}>⚠️</span>
              <p>{error}</p>
              <button className="btn btn--primary" onClick={loadProducts}>Повторить</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="state-box">
              <span style={{ fontSize: 32 }}>📦</span>
              <p>{search || filterCategory !== 'Все' ? 'Ничего не найдено' : 'Товаров пока нет'}</p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="products-grid">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="shop__footer">
        <div className="shop__container">
          © {new Date().getFullYear()} TechStore — интернет-магазин электроники
        </div>
      </footer>

      <ProductModal
        open={modalOpen}
        mode={modalMode}
        initialProduct={editingProduct}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}