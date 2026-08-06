// ملف جديد: routes/staffLocation.js
// محتاج تركيبه في index.js:
//   app.use('/api/staff', require('./routes/staffLocation'));
//
// TODO: لسه من غير حماية توكن - أي حد يعرف الرابط يقدر يحدّث/يقرا
// المواقع. لو عايز تحميه، اربطه بتحقق توكن جوجل بتاع لوحة التحكم.

const express = require('express');
const router = express.Router();
const StaffLocation = require('../models/StaffLocation');

// ---------------- POST /api/staff/location ----------------
// بينادى من orders.html كل ما يحدّد موقعه (لوحده أو من إنترفال دوري) -
// بيعمل upsert بالإيميل عشان كل حساب يبقى له سجل واحد بس بيتحدث.
router.post('/location', async (req, res) => {
  try {
    const { email, name, avatar, lat, lng } = req.body;
    if (!email || lat == null || lng == null) {
      return res.status(400).json({ message: 'بيانات ناقصة' });
    }
    await StaffLocation.findOneAndUpdate(
      { email },
      { email, name, avatar, lat, lng, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- GET /api/staff/locations ----------------
// بيرجع مواقع كل الموظفين/الأدمن اللي حدّثوا موقعهم آخر 10 دقايق بس
// (عشان لو حد قفل اللوحة، يختفي من الخريطة تلقائيًا بدل ما يفضل
// ظاهر غلط في مكانه القديم).
router.get('/locations', async (req, res) => {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const list = await StaffLocation.find({ updatedAt: { $gte: since } });
    res.json({ staff: list });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;