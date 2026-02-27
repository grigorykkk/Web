const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
const port = 3000;

let products = [
    { id: nanoid(6), name: 'MacBook Pro 14"', category: 'Ноутбуки', description: 'Мощный ноутбук с чипом M3 Pro, 18 ГБ RAM, 512 ГБ SSD. Идеален для разработки и работы с медиа.', price: 189990, stock: 5, rating: 4.9 },
    { id: nanoid(6), name: 'iPhone 15 Pro', category: 'Смартфоны', description: 'Флагманский смартфон с чипом A17 Pro, камерой 48 МП и титановым корпусом.', price: 114990, stock: 12, rating: 4.8 },
    { id: nanoid(6), name: 'Samsung Galaxy S24 Ultra', category: 'Смартфоны', description: 'Топовый Android-смартфон со встроенным стилусом S Pen и камерой 200 МП.', price: 109990, stock: 8, rating: 4.7 },
    { id: nanoid(6), name: 'iPad Pro 12.9"', category: 'Планшеты', description: 'Планшет с дисплеем Liquid Retina XDR, чипом M2 и поддержкой Apple Pencil 2.', price: 99990, stock: 7, rating: 4.8 },
    { id: nanoid(6), name: 'Sony WH-1000XM5', category: 'Наушники', description: 'Беспроводные наушники с лучшим в классе шумоподавлением и 30 часами автономной работы.', price: 29990, stock: 20, rating: 4.9 },
    { id: nanoid(6), name: 'Dell XPS 15', category: 'Ноутбуки', description: 'Премиальный ноутбук с OLED-дисплеем 3.5K, Intel Core i7 13-го поколения и RTX 4060.', price: 159990, stock: 4, rating: 4.6 },
    { id: nanoid(6), name: 'Apple Watch Series 9', category: 'Умные часы', description: 'Умные часы с дисплеем Always-On, датчиком ЧСС, SpO2 и новым жестом Double Tap.', price: 39990, stock: 15, rating: 4.7 },
    { id: nanoid(6), name: 'LG OLED C3 55"', category: 'Телевизоры', description: '4K OLED телевизор с идеальным чёрным цветом, поддержкой Dolby Vision и игровым режимом 120 Гц.', price: 124990, stock: 3, rating: 4.9 },
    { id: nanoid(6), name: 'Logitech MX Master 3S', category: 'Периферия', description: 'Профессиональная беспроводная мышь с тихими кнопками, точным сенсором и зарядкой USB-C.', price: 7990, stock: 30, rating: 4.8 },
    { id: nanoid(6), name: 'Samsung 970 EVO Plus 1TB', category: 'Накопители', description: 'Высокоскоростной NVMe SSD со скоростью чтения до 3500 МБ/с. Идеален для игр и работы.', price: 8990, stock: 25, rating: 4.7 },
    { id: nanoid(6), name: 'NVIDIA RTX 4070', category: 'Видеокарты', description: 'Мощная видеокарта с поддержкой DLSS 3, трассировки лучей и 12 ГБ памяти GDDR6X.', price: 59990, stock: 6, rating: 4.8 },
    { id: nanoid(6), name: 'Keychron K2 Pro', category: 'Периферия', description: 'Компактная механическая клавиатура 75% с горячей заменой свитчей, RGB и Bluetooth.', price: 12990, stock: 18, rating: 4.6 },
];

app.use(express.json());

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            console.log('Body:', req.body);
        }
    });
    next();
});

function findProductOr404(id, res) {
    const product = products.find(p => p.id === id);
    if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return null;
    }
    return product;
}

// GET /api/products
app.get('/api/products', (req, res) => {
    res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
    const product = findProductOr404(req.params.id, res);
    if (!product) return;
    res.json(product);
});

// POST /api/products
app.post('/api/products', (req, res) => {
    const { name, category, description, price, stock, rating } = req.body;
    if (!name || !category || !description || price === undefined || stock === undefined) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }
    const newProduct = {
        id: nanoid(6),
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        rating: rating ? Number(rating) : 5.0,
    };
    products.push(newProduct);
    res.status(201).json(newProduct);
});

// PATCH /api/products/:id
app.patch('/api/products/:id', (req, res) => {
    const product = findProductOr404(req.params.id, res);
    if (!product) return;
    const { name, category, description, price, stock, rating } = req.body;
    if (name !== undefined) product.name = name.trim();
    if (category !== undefined) product.category = category.trim();
    if (description !== undefined) product.description = description.trim();
    if (price !== undefined) product.price = Number(price);
    if (stock !== undefined) product.stock = Number(stock);
    if (rating !== undefined) product.rating = Number(rating);
    res.json(product);
});

// DELETE /api/products/:id
app.delete('/api/products/:id', (req, res) => {
    const exists = products.some(p => p.id === req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found' });
    products = products.filter(p => p.id !== req.params.id);
    res.status(204).send();
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});