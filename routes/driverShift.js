// ملف: routes/driverShift.js (نسخة نهائية - تسجيل دخول برقم الهاتف
// وكلمة مرور، مفيش جوجل ولا فايربيز توكن خالص - مقارنة بيانات مباشرة)
const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const Order = require('../models/Order'); // عدّل الاسم لو الموديل عندك اسمه مختلف

// ---------------- POST /api/driver/login ----------------
// المندوب بيبعت رقم الهاتف وكلمة المرور اللي الأدمن سجّلهملوه في
// اللوحة - مطابقة مباشرة، مفيش أي تعقيد.
router.post('/driver/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'رقم الهاتف وكلمة المرور مطلوبين' });
    }
    const driver = await Driver.findOne({ phone: phone.trim(), password: password.trim() });
    if (!driver) {
      return res.status(401).json({ message: 'رقم الهاتف أو كلمة المرور غلط' });
    }
    res.json({
      _id: driver._id,
      name: driver.name,
      phone: driver.phone,
      avatar: driver.avatar,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// بيدوّر على المندوب برقم الهاتف بس - ده كل حاجة، مفيش تعقيد إيميل
// ولا توكن ولا حاجة.
async function findDriverByPhone(req) {
  const phone = req.query.phone;
  if (!phone) return null;
  return Driver.findOne({ phone: phone.trim() });
}

// ---------------- GET /api/driver/shift-status ----------------
router.get('/driver/shift-status', async (req, res) => {
  try {
    const driver = await findDriverByPhone(req);
    if (!driver) {
      console.log('🔵 [shift-status] مفيش مندوب برقم:', req.query.phone);
      return res.json({ isOnline: false, shiftStartTime: null });
    }
    res.json({
      isOnline: driver.status && driver.status !== 'offline',
      shiftStartTime: driver.shiftStartTime || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- PATCH /api/drivers/:id/shift ----------------
// الأدمن بس هو اللي بيبدأ/بينهي الشيفت - المندوب مالوش زرار لده خالص.
router.patch('/drivers/:id/shift', async (req, res) => {
  try {
    const { isOnline } = req.body;
    const update = isOnline
      ? { status: 'available', shiftStartTime: new Date() }
      : { status: 'offline', shiftStartTime: null };

    const driver = await Driver.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!driver) {
      return res.status(404).json({ message: 'المندوب غير موجود' });
    }
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- GET /api/driver/current-order ----------------
router.get('/driver/current-order', async (req, res) => {
  try {
    const driver = await findDriverByPhone(req);
    if (!driver || !driver.currentOrderId) {
      return res.json({ order: null });
    }
    const order = await Order.findById(driver.currentOrderId);
    res.json({ order: order || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- PATCH /api/driver/location ----------------
router.patch('/driver/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: 'lat/lng مطلوبين' });
    }
    const driver = await findDriverByPhone(req);
    if (!driver) {
      return res.status(404).json({ message: 'حسابك مش مربوط بسجل مندوب' });
    }
    driver.location = { lat, lng, updatedAt: new Date() };
    await driver.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;