import React from 'react';

const CATEGORY_COLORS = {
  'Ноутбуки':    '#7c6af7',
  'Смартфоны':   '#34d399',
  'Планшеты':    '#60a5fa',
  'Наушники':    '#f472b6',
  'Умные часы':  '#fb923c',
  'Телевизоры':  '#a78bfa',
  'Периферия':   '#facc15',
  'Накопители':  '#38bdf8',
  'Видеокарты':  '#f87171',
};

function StarRating({ rating }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= full ? '#facc15' : i === full + 1 && half ? 'url(#half)' : 'rgba(255,255,255,0.15)'}>
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="#facc15"/>
              <stop offset="50%" stopColor="rgba(255,255,255,0.15)"/>
            </linearGradient>
          </defs>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
      <span style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', marginLeft: 2 }}>{rating}</span>
    </div>
  );
}

export default function ProductCard({ product, onEdit, onDelete }) {
  const color = CATEGORY_COLORS[product.category] || '#7c6af7';
  const lowStock = product.stock <= 5;

  return (
    <div className="product-card">
      <div className="product-card__top">
        <span className="product-card__category" style={{ color, borderColor: color + '40', background: color + '15' }}>
          {product.category}
        </span>
        <span className={`product-card__stock ${lowStock ? 'low' : ''}`}>
          {product.stock > 0 ? `${product.stock} шт.` : 'Нет в наличии'}
        </span>
      </div>

      <h3 className="product-card__name">{product.name}</h3>
      <p className="product-card__desc">{product.description}</p>

      <div className="product-card__meta">
        <StarRating rating={product.rating} />
      </div>

      <div className="product-card__footer">
        <div className="product-card__price">
          {product.price.toLocaleString('ru-RU')} ₽
        </div>
        <div className="product-card__actions">
          <button className="btn btn--sm" onClick={() => onEdit(product)}>Изменить</button>
          <button className="btn btn--sm btn--danger" onClick={() => onDelete(product.id)}>Удалить</button>
        </div>
      </div>
    </div>
  );
}