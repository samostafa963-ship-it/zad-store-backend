const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dns = require('dns');
const path = require('path');

const ordersRouter = require('./routes/orders');
const bannersRouter = require('./routes/banners');
const driversRouter = require('./routes/drivers');
const zonesRouter = require('./routes/zones');
const categoriesRouter = require('./routes/categories');
const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');
const favoritesRouter = require('./routes/favorites');
const usersRouter = require('./routes/users');

require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/users', usersRouter);
app.use('/api/ai', require('./routes/ai'));

app.use(express.static('public'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use('/admin', express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000, family: 4 })
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ Connection failed:', err.message));

app.get('/', (req, res) => res.json({ message: "ZAD Backend is Live! 🚀" }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ ZAD Server running on port: ${PORT}`));