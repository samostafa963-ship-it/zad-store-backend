const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  paymentMethod: { type: String, enum: ['cash', 'online', 'card', 'wallet'], default: 'cash' },
  notes: { type: String, default: '' },
  // ⚠️ ضفت image هنا - كانت ناقصة تمامًا، عشان كده صور المنتجات
  // مكانتش بتظهر في تفاصيل الطلب خالص (البيانات نفسها مكنتش بتتحفظ).
  items: [{ productId: String, name: String, image: { type: String, default: '' }, price: Number, quantity: Number, total: Number }],
  subtotal: { type: Number, required: true },
  delivery: { type: Number, default: 20 },
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'preparing', 'delivering', 'completed', 'cancelled'], default: 'pending' },
  driverId: { type: String, default: null },
  // ⚠️ كان ناقص تمامًا - fcm.js و orders.js بيحاولوا يقروا/يكتبوا فيه
  fcmToken: { type: String, default: null },
  userId: { type: String, default: null },

  // ── وقت التوصيل: asap (أسرع وقت) | specific (وقت محدد) | scheduled (جدولة لاحقاً) ──
  deliveryTimeType: { type: String, enum: ['asap', 'specific', 'scheduled'], default: 'asap' },
  scheduledDateTime: { type: Date, default: null }, // لو deliveryTimeType = scheduled
  specificTime: { type: String, default: null }, // لو deliveryTimeType = specific، شكله "HH:mm"
}, { timestamps: true });
module.exports = mongoose.model('Order', orderSchema);