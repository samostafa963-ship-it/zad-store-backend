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
const fixRouter = require('./routes/fix');
const couponsRouter = require('./routes/coupons');
const ratingsRouter = require('./routes/ratings');

require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();
app.use(cors());
app.use(express.json());
// ⚠️ ضروري عشان Twilio (وأي خدمة تانية بتبعت form-urlencoded زي ده)
// تقدر تبعت بيانات الـwebhook - من غيره req.body هتفضل فاضية.
app.use(express.urlencoded({ extended: false }));

app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/banners', bannersRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/users', usersRouter);
app.use('/api/fix', fixRouter);
app.use('/api/coupons', couponsRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/ai', require('./routes/ai'));
app.use('/api/fcm', require('./routes/fcm'));
app.use('/api/home', require('./routes/home'));
app.use('/api/geocode', require('./routes/geocode'));
app.use('/api/support', require('./routes/support'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/driver', require('./routes/driverDocuments'));
app.use(express.static('public'));
app.use('/api', require('./routes/driverShift'));
app.use('/api/staff', require('./routes/staffLocation'));

app.use(express.static('public'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use('/admin', express.static(path.join(__dirname, 'public')));

mongoose.set('bufferTimeoutMS', 120000);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    setTimeout(connectDB, 5000);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('❌ MongoDB disconnected, reconnecting...');
  setTimeout(connectDB, 5000);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message);
});

connectDB();

app.get('/', (req, res) => res.json({ message: "ZAD Backend is Live! 🚀" }));

app.get('/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    db: dbStatus,
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ ZAD Server running on port: ${PORT}`));