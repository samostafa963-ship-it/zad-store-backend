const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, paymentMethod, notes, items, subtotal, delivery, total } = req.body;
    if (!name || !phone || !address || !items || items.length === 0)
      return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
    const order = new Order({ name, phone, address, paymentMethod: paymentMethod || 'cash', notes: notes || '', items, subtotal, delivery: delivery || 20, total });
    await order.save();
    res.status(201).json({ success: true, message: 'تم تأكيد الطلب بنجاح', orderId: order._id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

router.get('/phone/:phone', async (req, res) => {
  try {
    const orders = await Order.find({ phone: req.params.phone }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;