// ملف جديد: routes/driverShift.js
// محتاج تركيبه في server.js/index.js:
//   app.use('/api', require('./routes/driverShift'));
//
// بيستخدم middleware/firebaseAdminAuth.js اللي عملناه قبل كده لأي
// نداء من التطبيق نفسه (المندوب)، وبيفترض إن عندك موديل Driver فيه
// حقل "status" (available/busy/offline) و"firebaseUid" أصلاً -
// نفس الموديل اللي بتستخدمه صفحة orders.html.
//
// ⚠️ حط حقل shiftStartTime في models/Driver.js لو مش موجود:
//   shiftStartTime: { type: Date, default: null }

const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver'); // عدّل المسار لو مختلف عندك

// ---------------- GET /api/driver/shift-status ----------------
// بينادى من تطبيق الفلاتر (المندوب) بتوكن Firebase حقيقي - بيرجع
// حالة الاتصال ومعاد بداية الشيفت اللي الأدمن ضبطهم من لوحة التحكم.
// المندوب مش بيقدر يغيّرهم من هنا - القراءة بس.
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    const driver = await Driver.findOne({ firebaseUid: req.driverUid });
    if (!driver) {
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
// بينادى من لوحة التحكم (orders.html) بس - الأدمن هو اللي بيبدأ أو
// ينهي شيفت المندوب، مش المندوب نفسه.
// TODO: لسه من غير حماية صلاحية أدمن (زي باقي راوتس اللوحة الحالية) -
// اربطه بنظام تسجيل دخول الأدمن (Google Sign-In) لو حبيت تحميه أكتر.
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

module.exports = router;