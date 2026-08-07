// ملف: routes/driverShift.js (نسخة مُصلَّحة)
const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver');

// ---------------- قايمة المندوبين المعروفين (ثابتة في الكود) ----------------
// بدل الاعتماد على ربط الإيميل/UID جوه قاعدة البيانات (اللي كان بيفشل
// بسبب مشاكل نشر ومزامنة)، بنحط هنا مباشرة إيميل كل مندوب مربوط برقم
// موبايله (اللي إجباري وفريد أصلاً في قاعدة البيانات، فمضمون موجود).
// لما مندوب جديد ينضم، ضيف سطر جديد هنا بس.
const KNOWN_DRIVERS = {
  'sasaelkarwan963@gmail.com': { name: 'مصطفى محمد', phone: '01129338238' },
};

// ---------------- GET /api/driver/shift-status ----------------
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    // بنفضّل الإيميل اللي جاي صراحة من التطبيق (query param) لو
    // موجود، لأن إيميل التوكن ممكن يوصل فاضي أحيانًا لو الطلب اتبعت
    // قبل ما بيانات حساب فايربيز تخلص مزامنة تمامًا.
    const email = req.query.email || req.driverEmail;
    console.log('🔵 [shift-status] email:', email, '(من query:', req.query.email, '| من التوكن:', req.driverEmail, ')');

    // أول حاجة: القايمة الثابتة في الكود - أسرع وأضمن، مفيش أي
    // اعتماد على حفظ حقول في قاعدة البيانات.
    const known = email ? KNOWN_DRIVERS[email] : null;
    let driver = null;

    if (known) {
      driver = await Driver.findOne({ phone: known.phone });
      console.log('🔵 [shift-status] لقى بالموبايل الثابت؟', !!driver);
    } else {
      // احتياطي: لو مش في القايمة الثابتة، نجرب الطريقة القديمة
      driver = await Driver.findOne({ firebaseUid: req.driverUid });
      if (!driver && email) {
        driver = await Driver.findOne({ email });
      }
    }

    if (!driver) {
      console.log('🔵 [shift-status] مفيش تطابق خالص للإيميل ده');
      return res.json({ isOnline: false, shiftStartTime: null });
    }
    console.log('🔵 [shift-status] الحالة الحقيقية:', driver.status);
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