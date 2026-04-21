const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

// POST /api/orders - إنشاء أوردر جديد
router.post('/', async (req, res) => {
  try {
    const { name, phone, address, paymentMethod, notes, items, subtotal, delivery, total } = req.body;

    if (!name || !phone || !address || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
    }

    const order = new Order({
      name,
      phone,
      address,
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      items,
      subtotal,
      delivery: delivery || 20,
      total,
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: 'تم تأكيد الطلب بنجاح',
      orderId: order._id,
    });
  } catch (err) {
    console.error('Order Error:', err.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

// GET /api/orders - جلب كل الأوردرات (للأدمن لاحقاً)
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;