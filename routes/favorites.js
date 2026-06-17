const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');

// GET favorites بتاع user
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    // جيب تفاصيل المنتجات
    const products = await Product.find({ _id: { $in: user.favorites } });
    res.json({ success: true, favorites: user.favorites, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST toggle favorite
router.post('/:userId/toggle', async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    const index = user.favorites.indexOf(productId);
    if (index === -1) {
      user.favorites.push(productId);
    } else {
      user.favorites.splice(index, 1);
    }
    await user.save();
    res.json({ success: true, favorites: user.favorites, isFavorite: index === -1 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;