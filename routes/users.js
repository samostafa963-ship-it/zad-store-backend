const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET profile
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'مش موجود' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update address
router.put('/:userId/address', async (req, res) => {
  try {
    const { address } = req.body;
    await User.findByIdAndUpdate(req.params.userId, { savedAddress: address });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT sync cart
router.put('/:userId/cart', async (req, res) => {
  try {
    const { cart } = req.body;
    await User.findByIdAndUpdate(req.params.userId, { savedCart: cart });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;