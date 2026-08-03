const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
}, { _id: false });

const couponSchema = new mongoose.Schema({
  code: { type: String, default: null },
  used: { type: Boolean, default: false },
  type: { type: String, default: 'free_delivery' },
}, { _id: false });

// ⚠️ سجل عمليات الرصيد (زيادة/خصم) - كل عملية بتتسجل هنا عشان "سجل
// العمليات" في شاشة تفاصيل الرصيد يعرضها فعليًا بدل ما تفضل فاضية
const walletTransactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true }, // موجب = مكتسب، سالب = مستخدم
  title: { type: String, required: true }, // "هدية ترحيب"، "تم استخدامه في طلب"...
  orderCode: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6, default: null },
  phone: { type: String, default: '' },
  googleId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  favorites: [{ type: String }],
  savedAddress: { type: String, default: '' },
  savedCart: [cartItemSchema],
  coupon: { type: couponSchema, default: () => ({}) },
  // ⚠️ رصيد زورا الحقيقي - ده اللي كان ناقص بالكامل
  walletBalance: { type: Number, default: 0 },
  walletTransactions: [walletTransactionSchema],
  // ⚠️ كان ناقص تمامًا - من غيره routes/fcm.js مبيقدرش يحفظ توكن
  // الإشعارات للمستخدم خالص
  fcmToken: { type: String, default: null },
}, { timestamps: true });

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);