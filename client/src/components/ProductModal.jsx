import React, { useEffect, useState } from 'react';

const EMPTY = { name: '', category: '', description: '', price: '', stock: '', rating: '' };

export default function ProductModal({ open, mode, initialProduct, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setForm({
        name: initialProduct.name,
        category: initialProduct.category,
        description: initialProduct.description,
        price: String(initialProduct.price),
        stock: String(initialProduct.stock),
        rating: String(initialProduct.rating),
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, initialProduct]);

  if (!open) return null;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Введите название';
    if (!form.category.trim()) e.category = 'Введите категорию';
    if (!form.description.trim()) e.description = 'Введите описание';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) e.price = 'Введите корректную цену';
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0) e.stock = 'Введите корректное количество';
    if (form.rating && (isNaN(Number(form.rating)) || Number(form.rating) < 0 || Number(form.rating) > 5)) e.rating = 'Рейтинг от 0 до 5';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({
      id: initialProduct?.id,
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      rating: form.rating ? Number(form.rating) : 5.0,
    });
  };

  const fields = [
    { key: 'name', label: 'Название', placeholder: 'Например, iPhone 15 Pro', type: 'text' },
    { key: 'category', label: 'Категория', placeholder: 'Например, Смартфоны', type: 'text' },
    { key: 'price', label: 'Цена (₽)', placeholder: '99990', type: 'number' },
    { key: 'stock', label: 'Количество на складе', placeholder: '10', type: 'number' },
    { key: 'rating', label: 'Рейтинг (0–5)', placeholder: '4.8', type: 'number' },
  ];

  return (
    <div className="backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{mode === 'edit' ? 'Редактировать товар' : 'Добавить товар'}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form className="modal__form" onSubmit={handleSubmit}>
          {fields.map(f => (
            <label key={f.key} className="field">
              <span className="field__label">{f.label}</span>
              <input
                className={`field__input ${errors[f.key] ? 'field__input--error' : ''}`}
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={set(f.key)}
              />
              {errors[f.key] && <span className="field__error">{errors[f.key]}</span>}
            </label>
          ))}
          <label className="field">
            <span className="field__label">Описание</span>
            <textarea
              className={`field__input field__textarea ${errors.description ? 'field__input--error' : ''}`}
              placeholder="Подробное описание товара..."
              value={form.description}
              onChange={set('description')}
              rows={3}
            />
            {errors.description && <span className="field__error">{errors.description}</span>}
          </label>
          <div className="modal__footer">
            <button type="button" className="btn" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">
              {mode === 'edit' ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}