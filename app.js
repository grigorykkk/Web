const express = require('express');
const app = express();
const port = 6000;

// Список товаров
let products = [
    { id: 1, name: 'Ноутбук', price: 75000 },
    { id: 2, name: 'Мышь', price: 1500 },
    { id: 3, name: 'Клавиатура', price: 3000 },
];

// Middleware для парсинга JSON
app.use(express.json());

// Просмотр всех товаров
app.get('/products', (req, res) => {
    res.json(products);
});

// Просмотр товара по id
app.get('/products/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(product);
});

// Добавление нового товара
app.post('/products', (req, res) => {
    const { name, price } = req.body;
    if (!name || price === undefined) {
        return res.status(400).json({ error: 'Укажите name и price' });
    }
    const newProduct = {
        id: Date.now(),
        name,
        price
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
});

// Редактирование товара по id
app.patch('/products/:id', (req, res) => {
    const product = products.find(p => p.id == req.params.id);
    if (!product) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    const { name, price } = req.body;
    if (name !== undefined) product.name = name;
    if (price !== undefined) product.price = price;
    res.json(product);
});

// Удаление товара по id
app.delete('/products/:id', (req, res) => {
    const exists = products.some(p => p.id == req.params.id);
    if (!exists) {
        return res.status(404).json({ error: 'Товар не найден' });
    }
    products = products.filter(p => p.id != req.params.id);
    res.json({ message: 'Товар удалён' });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});