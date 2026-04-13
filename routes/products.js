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

router.get('/category/:key', async (req, res) => {
  try {
    const products = await Product.find({
      parent_category: req.params.key
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── جيب المنتجات مجمعة بالـ sub_category ──
router.get('/category/:key/grouped', async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { parent_category: req.params.key } },
      {
        $group: {
          _id: "$category",
          products: { $push: "$$ROOT" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;