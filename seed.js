const mongoose = require('mongoose');
const Product = require('./models/Product');
const products = require('./products_to_upload.json');

mongoose.connect('mongodb+srv://samostafa963:zadstor@cluster0.utximqz.mongodb.net/ZAD_Database', {
  serverSelectionTimeoutMS: 10000,
  family: 4
})
.then(async () => {
  console.log('متصل...');
  const mapped = products.map(p => ({
    name: p.name,
    price: p.price,
    image: p.image,
    category_key: p.category,
    sub_category: p.subCategory,
    order: p.subCategoryOrder,
  }));
  await Product.insertMany(mapped);
  console.log('تم رفع ' + mapped.length + ' منتج');
  process.exit(0);
})
.catch(e => { console.error(e); process.exit(1); });