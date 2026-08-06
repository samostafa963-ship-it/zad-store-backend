// ملف: routes/driverShift.js (نسخة مُصلَّحة)
const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver');

// ---------------- GET /api/driver/shift-status ----------------
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    // أول محاولة: لو الحساب اتربط بالـ UID قبل كده (زيارة سابقة)
    let driver = await Driver.findOne({ firebaseUid: req.driverUid });

    // لو لسه مش مربوط، ندوّر بالإيميل (اللي الأدمن حطه وقت إضافة
    // المندوب) - ولو لقيناه، نربط الـ UID بيه فورًا عشان المرة الجاية
    // تبقى أسرع ومباشرة.
    if (!driver && req.driverEmail) {
      driver = await Driver.findOne({ email: req.driverEmail });
      if (driver) {
        driver.firebaseUid = req.driverUid;
        await driver.save();
      }
    }

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