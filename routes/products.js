const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String,
  description: String,
  category_key: String,
  sub_category: String,
  sub_type: String, // المستوى التاني الخفيف (زي: معلب / فريش / ذرة / عباد شمس)
  order: Number,
});

module.exports = mongoose.model('Product', ProductSchema, 'products');