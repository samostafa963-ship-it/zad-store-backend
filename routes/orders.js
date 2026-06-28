// ===================================================
// routes/orders.js  — النسخة المحدثة مع FCM
// ===================================================
const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const { sendOrderNotification, sendCustomNotification } = require('../utils/sendNotification');

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200);
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders — طلب جديد
router.post('/', async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();

    // إشعار للأدمن (اختياري - لو عندك FCM token للأدمن)
    // await sendCustomNotification(ADMIN_FCM_TOKEN, '🛍️ طلب جديد!', `${order.name} - ${order.total} ج.م`, { orderId: order._id.toString() });

    res.status(201).json({ order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/orders/:id — تحديث الطلب + FCM
router.put('/:id', async (req, res) => {
  try {
    const { status, ...rest } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, ...rest, updatedAt: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // ابعت إشعار للعميل
    if (status && order.fcmToken) {
      const result = await sendOrderNotification(order.fcmToken, status, order._id);
      // لو الـ token منتهي، امسحه
      if (result === 'expired') {
        await Order.findByIdAndUpdate(order._id, { fcmToken: null });
      }
    }

    // لو مش لاقي fcmToken في الأوردر، دور عليه في الـ User
    if (status && !order.fcmToken && order.userId) {
      const user = await User.findById(order.userId);
      if (user?.fcmToken) {
        await sendOrderNotification(user.fcmToken, status, order._id);
      }
    }

    res.json({ order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders/notify-all — إشعار لكل العملاء (كوبون / عرض)
router.post('/notify-all', async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    // جيب كل الـ FCM tokens الفريدة
    const users = await User.find({ fcmToken: { $exists: true, $ne: null } });
    const tokens = [...new Set(users.map(u => u.fcmToken).filter(Boolean))];

    if (!tokens.length) return res.json({ message: 'No tokens found', sent: 0 });

    const { sendToMultiple } = require('../utils/sendNotification');

    // FCM بيبعت max 500 في الـ batch
    let totalSuccess = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const result = await sendToMultiple(batch, title, body);
      totalSuccess += result?.successCount || 0;
    }

    res.json({ message: 'Notifications sent', sent: totalSuccess, total: tokens.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
