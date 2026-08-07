// ملف: routes/driverShift.js (نسخة نهائية - مطابقة ديناميكية بالإيميل)
const express = require('express');
const router = express.Router();
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver');
const Order = require('../models/Order'); // عدّل الاسم لو الموديل عندك اسمه مختلف

// بيدوّر على المندوب بنفس منطق شاشة الاتصال (UID لو مربوط قبل كده،
// وإلا بالإيميل مع ربط الـ UID أوتوماتيك) - مستخدمة هنا وفي شاشة
// الاتصال عشان نفس المنطق يتكرر في مكان واحد بس.
async function findDriverByRequest(req) {
  const email = req.query.email || req.driverEmail;
  let driver = await Driver.findOne({ firebaseUid: req.driverUid });
  if (!driver && email) {
    driver = await Driver.findOne({ email });
    if (driver) {
      driver.firebaseUid = req.driverUid;
      await driver.save();
    }
  }
  return driver;
}

// ---------------- GET /api/driver/shift-status ----------------
// بيدوّر على المندوب بالإيميل اللي أضفته له في اللوحة (تسجيل عادي،
// مفيش تعديل كود مطلوب) - وأول ما يلاقيه، بيربط الـ Firebase UID
// بيه أوتوماتيك عشان يبقى أسرع بعد كده.
router.get('/driver/shift-status', verifyFirebaseToken, async (req, res) => {
  try {
    // بنفضّل الإيميل اللي جاي صراحة من التطبيق (query param) لو
    // موجود، لأن إيميل التوكن ممكن يوصل فاضي أحيانًا لو الطلب اتبعت
    // قبل ما بيانات حساب فايربيز تخلص مزامنة تمامًا.
    const email = req.query.email || req.driverEmail;
    console.log('🔵 [shift-status] email:', email);

    let driver = await Driver.findOne({ firebaseUid: req.driverUid });
    console.log('🔵 [shift-status] لقى بالـ UID المربوط قبل كده؟', !!driver);

    if (!driver && email) {
      driver = await Driver.findOne({ email });
      console.log('🔵 [shift-status] لقى بالإيميل؟', !!driver);
      if (driver) {
        driver.firebaseUid = req.driverUid;
        await driver.save();
        console.log('🔵 [shift-status] تم ربط الحساب بـ:', driver.name);
      }
    }

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

// ---------------- GET /api/driver/current-order ----------------
// ⚠️ ده كان ناقص خالص من الأول - شاشة "الرئيسية" عند المندوب مفيهاش
// أي نداء حقيقي يجيب الطلب المُسنَد له، فمهما الأدمن يسند طلبات، مكانتش
// هتظهر عند المندوب أبدًا. ده بيستخدم نفس منطق العثور على المندوب
// اللي في شاشة الاتصال، وبعدين بيجيب الطلب من حقل currentOrderId
// الموجود أصلاً في موديل Driver.
router.get('/driver/current-order', verifyFirebaseToken, async (req, res) => {
  try {
    const driver = await findDriverByRequest(req);
    if (!driver) {
      console.log('🔵 [current-order] مفيش مندوب مطابق');
      return res.json({ order: null });
    }
    if (!driver.currentOrderId) {
      return res.json({ order: null });
    }
    const order = await Order.findById(driver.currentOrderId);
    console.log('🔵 [current-order] الطلب الحالي لـ', driver.name, ':', order ? order._id : 'مفيش');
    res.json({ order: order || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;