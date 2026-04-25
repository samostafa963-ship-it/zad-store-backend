const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ الـ grouped الأول قبل /:key
router.get('/category/:key/grouped', async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { category_key: req.params.key } },
      {
        $group: {
          _id: "$sub_category",
          products: { $push: "$$ROOT" },
          sub_category_order: { $first: "$sub_category_order" }
        }
      },
      { $sort: { sub_category_order: 1 } }
    ]);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/category/:key', async (req, res) => {
  try {
    const products = await Product.find({
      category_key: req.params.key
    }).sort({ order: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;