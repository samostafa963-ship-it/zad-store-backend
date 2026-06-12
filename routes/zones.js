const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');

// GET all zones
router.get('/', async (req, res) => {
  try {
    const zones = await Zone.find().sort({ name: 1 });
    res.json({ success: true, zones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create zone
router.post('/', async (req, res) => {
  try {
    const { name, deliveryFee, minTime, maxTime } = req.body;
    if (!name || deliveryFee === undefined) return res.status(400).json({ success: false, message: 'الاسم وسعر التوصيل مطلوبين' });
    const zone = new Zone({ name, deliveryFee, minTime: minTime || 30, maxTime: maxTime || 60 });
    await zone.save();
    res.status(201).json({ success: true, zone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update zone
router.put('/:id', async (req, res) => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!zone) return res.status(404).json({ success: false, message: 'المنطقة غير موجودة' });
    res.json({ success: true, zone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE zone
router.delete('/:id', async (req, res) => {
  try {
    await Zone.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;