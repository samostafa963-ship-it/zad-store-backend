const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');

// POST /api/fix/categories - يصلح كل المنتجات اللي عندها category = ObjectId
router.get('/categories', async (req, res) => {
  try {
    // جيب كل الـ categories
    const categories = await Category.find({});
    const mapping = {};
    categories.forEach(cat => {
      mapping[cat._id.toString()] = cat.category_key;
    });

    // جيب المنتجات اللي الـ category بتاعتها مش موجودة في الـ mapping كـ key
    const allProducts = await Product.find({});
    let fixed = 0;
    let skipped = 0;

    for (const product of allProducts) {
      const catValue = product.category_key || product.category || '';
      // لو الـ category_key مش موجود أو هو ObjectId
      if (!product.category_key || mapping[product.category_key]) {
        const newKey = mapping[catValue] || mapping[product.category?.toString()] || '';
        if (newKey) {
          await Product.updateOne({ _id: product._id }, { $set: { category_key: newKey } });
          fixed++;
        } else {
          skipped++;
        }
      }
    }

    res.json({ success: true, fixed, skipped, total: allProducts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;