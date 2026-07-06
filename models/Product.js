const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  old_price: Number,
  is_bestseller: Boolean,
  image: String,
  description: String,
  category_key: String,
  sub_category: String,
  sub_type: String,
  size_group: String, // بيربط بين نفس المنتج بأحجام مختلفة (زي: لتر / 200 مل)
  order: Number,
});

module.exports = mongoose.model('Product', ProductSchema, 'products');