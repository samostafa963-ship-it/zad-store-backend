const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  category_key: String,
  sub_category: String,
  order: Number,
});

module.exports = mongoose.model('Product', ProductSchema, 'products');