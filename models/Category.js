const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  _id: String,
  name: String,
  price: Number,
  image: String,
});

const SubCategorySchema = new mongoose.Schema({
  _id: String,
  name: String,
  order: Number,
  products: [ProductSchema],
});

const CategorySchema = new mongoose.Schema({
  _id: String,
  name: String,
  image_url: String,
  color_class: String,
  action_url: String,
  order: Number,
  sub_categories: [SubCategorySchema],
});

module.exports = mongoose.model('Category', CategorySchema, 'categories');