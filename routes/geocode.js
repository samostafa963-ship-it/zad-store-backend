// routes/geocode.js
// ضيفها في ZAD_Backend/routes/geocode.js
// وفي ملف السيرفر الرئيسي ضيف:
// app.use('/api/geocode', require('./routes/geocode'));
//
// ⚠️ لازم تضيف متغير بيئة جديد في Railway اسمه GOOGLE_GEOCODING_KEY:
// - اعمل API key جديد في Google Cloud Console مخصص للسيرفر بس
// - Application restrictions: None (الكود ده سري وموجود في متغيرات
//   البيئة على Railway بس، مش داخل الـ APK، فمينفعش حد يشوفه أو يسرقه)
// - API restrictions: Geocoding API + Places API (الاتنين مطلوبين -
//   Places API لازمة لـ/nearby-place اللي بتجيب اسم أقرب محل/مكان)
//
// السبب في وجود البروكسي ده: تقييد "Android apps" على الـ API key بيشتغل
// بس مع الطلبات الجاية من مكتبات جوجل الرسمية (Maps SDK) اللي بترفق
// معلومات التطبيق تلقائيًا. طلب REST عادي (http.get) من الموبايل مباشرة
// لجوجل مبيبعتش المعلومات دي، فجوجل بيرفضه دايمًا مهما كان الـ SHA-1
// مسجل - فالحل الصحيح إن السيرفر (مش الموبايل) هو اللي يكلم جوجل.

const express = require('express');
const router = express.Router();

const GOOGLE_GEOCODING_KEY = process.env.GOOGLE_GEOCODING_KEY;

// GET /api/geocode/reverse?lat=..&lng=..
router.get('/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ status: 'INVALID_REQUEST', error_message: 'lat و lng مطلوبين' });
    }
    if (!GOOGLE_GEOCODING_KEY) {
      return res.status(500).json({ status: 'ERROR', error_message: 'GOOGLE_GEOCODING_KEY مش متسجل في متغيرات البيئة' });
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_GEOCODING_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('geocode reverse error:', err);
    res.status(500).json({ status: 'ERROR', error_message: 'تعذر تحديد العنوان' });
  }
});

// GET /api/geocode/forward?address=..
router.get('/forward', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ status: 'INVALID_REQUEST', error_message: 'address مطلوب' });
    }
    if (!GOOGLE_GEOCODING_KEY) {
      return res.status(500).json({ status: 'ERROR', error_message: 'GOOGLE_GEOCODING_KEY مش متسجل في متغيرات البيئة' });
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_GEOCODING_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('geocode forward error:', err);
    res.status(500).json({ status: 'ERROR', error_message: 'تعذر البحث عن العنوان' });
  }
});

// GET /api/geocode/nearby-place?lat=..&lng=..
// ⚠️ ده الجديد - بيستخدم Places API (Nearby Search) بترتيب "الأقرب
// مسافة" (rankby=distance)، عشان يرجّع اسم حقيقي زي "أنستونا كافيه"
// أو "Elite Smash Padel" بدل عنوان رسمي بس زي Geocoding العادي.
// بيرجّع أقرب مكانين تلاتة، والفلاتر هو اللي يقرر يستخدم إيه بناءً
// على المسافة الفعلية (distance بالمتر) المرجعة مع كل نتيجة.
router.get('/nearby-place', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ status: 'INVALID_REQUEST', error_message: 'lat و lng مطلوبين' });
    }
    if (!GOOGLE_GEOCODING_KEY) {
      return res.status(500).json({ status: 'ERROR', error_message: 'GOOGLE_GEOCODING_KEY مش متسجل في متغيرات البيئة' });
    }
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&key=${GOOGLE_GEOCODING_KEY}&language=ar`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('geocode nearby-place error:', err);
    res.status(500).json({ status: 'ERROR', error_message: 'تعذر جلب أقرب مكان' });
  }
});

module.exports = router;