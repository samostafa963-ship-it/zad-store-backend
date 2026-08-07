// ملف: routes/driverShift.js (نسخة مُصلَّحة)
const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver');

// ---------------- GET /api/driver/shift-status ----------------
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    console.log('🔵 [shift-status] uid:', req.driverUid, '| email:', req.driverEmail);

    let driver = await Driver.findOne({ firebaseUid: req.driverUid });
    console.log('🔵 [shift-status] لقى بالـ UID؟', !!driver);

    if (!driver && req.driverEmail) {
      driver = await Driver.findOne({ email: req.driverEmail });
      console.log('🔵 [shift-status] لقى بالإيميل؟', !!driver);
      if (driver) {
        driver.firebaseUid = req.driverUid;
        await driver.save();
        console.log('🔵 [shift-status] تم ربط الـ UID بحساب:', driver.name);
      }
    }

    if (!driver) {
      const allEmails = await Driver.find({}, 'name email');
      console.log('🔵 [shift-status] مفيش تطابق. الإيميلات المسجلة عندنا:', JSON.stringify(allEmails));
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

// ---------------- PATCH /api/drivers/:id/link-uid ----------------
// راوت منفصل تمامًا عشان بس يحفظ الـ Firebase UID - مش هيتأثر بأي
// قيود موجودة في راوت تعديل المندوب العادي عندك.
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
    console.log('🔵 [link-uid] تم ربط', driver.name, 'بـ UID:', firebaseUid);
    res.json(driver);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;