// ===================================================
// routes/fcm.js — حفظ وتحديث FCM Token
// ===================================================
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');

// POST /api/fcm/token — Flutter يبعت التوكن هنا
router.post('/token', async (req, res) => {
  try {
    const { userId, fcmToken, orderId } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });

    // حدّث الـ User
    if (userId) {
      await User.findByIdAndUpdate(userId, { fcmToken }, { new: true });
    }

    // حدّث الأوردر لو موجود
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, { fcmToken });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/fcm/token — لما اليوزر يسجل خروج
router.delete('/token', async (req, res) => {
  try {
    const { userId } = req.body;
    if (userId) await User.findByIdAndUpdate(userId, { fcmToken: null });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
