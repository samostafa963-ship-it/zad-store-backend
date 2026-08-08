const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  // ⚠️ إحداثيات عنوان التسليم - محتاجة عشان الخريطة تعرف تحسب
  // المسار وتتأكد من وصول المندوب فعليًا
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  paymentMethod: { type: String, enum: ['cash', 'online', 'card', 'wallet'], default: 'cash' },
  notes: { type: String, default: '' },
  items: [{ productId: String, name: String, image: { type: String, default: '' }, price: Number, quantity: Number, total: Number }],
  subtotal: { type: Number, required: true },
  delivery: { type: Number, default: 20 },
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled'], default: 'pending' },
  driverId: { type: String, default: null },
  fcmToken: { type: String, default: null },
  walletUsed: { type: Number, default: 0 },
  userId: { type: String, default: null },
  deliveryTimeType: { type: String, enum: ['asap', 'specific', 'scheduled'], default: 'asap' },
  scheduledDateTime: { type: Date, default: null },
  specificTime: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model('Order', orderSchema);