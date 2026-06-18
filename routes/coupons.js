const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'zad_secret_2026';

// جيب كوبون العميل
router.get('/my', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('coupon name');
    if (!user) return res.status(404).json({ success: false });
    res.json({ success: true, coupon: user.coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// تحقق من الكوبون واستخدامه
router.post('/apply', async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findOne({ 'coupon.code': code });
    if (!user) return res.status(404).json({ success: false, message: 'الكوبون غير صحيح' });
    if (user.coupon.used) return res.status(400).json({ success: false, message: 'تم استخدام الكوبون مسبقاً' });
    res.json({ success: true, type: user.coupon.type, userId: user._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// استخدم الكوبون لما الأوردر يتأكد
router.post('/use', async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findOne({ 'coupon.code': code });
    if (!user) return res.status(404).json({ success: false, message: 'الكوبون غير صحيح' });
    if (user.coupon.used) return res.status(400).json({ success: false, message: 'تم استخدام الكوبون مسبقاً' });
    user.coupon.used = true;
    await user.save();
    res.json({ success: true, message: 'تم استخدام الكوبون' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;