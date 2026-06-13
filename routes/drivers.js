const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');

// POST driver login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: 'رقم الهاتف وكلمة المرور مطلوبين' });
    const driver = await Driver.findOne({ phone });
    if (!driver) return res.status(404).json({ success: false, message: 'المندوب غير موجود' });
    if (driver.password !== password) return res.status(401).json({ success: false, message: 'كلمة المرور غلط' });
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json({ success: true, drivers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single driver
router.get('/:id', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).populate('currentOrderId');
    if (!driver) return res.status(404).json({ success: false, message: 'المندوب غير موجود' });
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST create driver
router.post('/', async (req, res) => {
  try {
    const { name, phone, zone, password } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, message: 'الاسم والموبايل مطلوبين' });
    const driver = new Driver({ name, phone, zone: zone || '', password: password || '12345' });
    await driver.save();
    res.status(201).json({ success: true, driver });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'رقم الموبايل مسجل مسبقاً' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update driver
router.put('/:id', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!driver) return res.status(404).json({ success: false, message: 'المندوب غير موجود' });
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE driver
router.delete('/:id', async (req, res) => {
  try {
    await Driver.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT assign order to driver
router.put('/:id/assign', async (req, res) => {
  try {
    const { orderId } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { currentOrderId: orderId, status: 'busy' },
      { new: true }
    );
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT free driver
router.put('/:id/free', async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { currentOrderId: null, status: 'available', $inc: { totalDeliveries: 1 } },
      { new: true }
    );
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update driver location
router.put('/:id/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat و lng مطلوبين' });
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { location: { lat, lng, updatedAt: new Date() } },
      { new: true }
    );
    if (!driver) return res.status(404).json({ success: false, message: 'المندوب غير موجود' });
    res.json({ success: true, driver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET driver location
router.get('/:id/location', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select('location status name');
    if (!driver) return res.status(404).json({ success: false, message: 'المندوب غير موجود' });
    res.json({ success: true, location: driver.location, status: driver.status, name: driver.name });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;