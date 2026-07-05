const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  old_price: Number,       // السعر قبل الخصم (اختياري) - لو موجود وأكبر من price بيظهر شارة الخصم
  is_bestseller: Boolean,  // لو true بتظهر شارة "الأكثر مبيعاً" بدل الخصم
  image: String,
  description: String,     // نص خفيف تحت الاسم (زي: 1 لتر / 900 مل)
  category_key: String,
  sub_category: String,
  sub_type: String,
  order: Number,
});

module.exports = mongoose.model('Product', ProductSchema, 'products');