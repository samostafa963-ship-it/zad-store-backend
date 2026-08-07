// ملف: routes/driverShift.js (نسخة نهائية)
const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver');
const Order = require('../models/Order'); // عدّل الاسم لو الموديل عندك اسمه مختلف

// مطابقة الإيميل مرنة (بتتجاهل فرق حروف كبيرة/صغيرة والمسافات
// الزيادة) عشان أي فرق بسيط زي مسافة أو حرف كابيتال متكسرش الربط.
function emailRegex(email) {
  const trimmed = (email || '').trim();
  return new RegExp('^' + trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
}

// بيدوّر على المندوب: أول بالـ Firebase UID لو مربوط قبل كده (أسرع)،
// وإلا بالإيميل (مرن) مع ربط الـ UID أوتوماتيك عشان المرة الجاية
// تبقى مباشرة.
async function findDriverByRequest(req) {
  const email = req.query.email || req.driverEmail;
  let driver = await Driver.findOne({ firebaseUid: req.driverUid });
  if (!driver && email) {
    driver = await Driver.findOne({ email: emailRegex(email) });
    if (driver) {
      driver.firebaseUid = req.driverUid;
      await driver.save();
      console.log('🔵 تم ربط UID بحساب:', driver.name);
    }
  }
  return driver;
}

// ---------------- GET /api/driver/shift-status ----------------
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    const email = req.query.email || req.driverEmail;
    console.log('🔵 [shift-status] email:', email);

    const driver = await findDriverByRequest(req);
    if (!driver) {
      console.log('🔵 [shift-status] مفيش مندوب بالإيميل ده متسجل في اللوحة');
      return res.json({ isOnline: false, shiftStartTime: null });
    }
    console.log('🔵 [shift-status] الحالة الحقيقية:', driver.status);
    res.json({
      isOnline: driver.status && driver.status !== 'offline',
      shiftStartTime: driver.shiftStartTime || null,
    });
  } catch (err) {
    console.error(err);
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

// ---------------- PATCH /api/drivers/:id/link-uid ----------------
router.patch('/drivers/:id/link-uid', async (req, res) => {
  try {
    const { firebaseUid } = req.body;
    if (!firebaseUid) {
      return res.status(400).json({ message: 'firebaseUid مطلوب' });
    }
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { firebaseUid },
      { new: true }
    );
    if (!driver) {
      return res.status(404).json({ message: 'المندوب غير موجود' });
    }
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- GET /api/driver/current-order ----------------
router.get('/driver/current-order', verifyFirebaseToken, async (req, res) => {
  try {
    const driver = await findDriverByRequest(req);
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
// ⚠️ جديد: بيبعته التطبيق أوتوماتيك أول ما المندوب يفتحه ويكون
// متصل - بيحدّث موقعه الحقيقي عشان يظهر على خريطة لوحة التحكم
// (نفس حقل location الموجود في موديل Driver).
router.patch('/driver/location', verifyFirebaseToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: 'lat/lng مطلوبين' });
    }
    const driver = await findDriverByRequest(req);
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