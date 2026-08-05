// ملف جديد: routes/driverDocuments.js
// محتاج ضبطه في ZAD_Backend وتركيبه في server.js:
//   app.use('/api/driver', require('./routes/driverDocuments'));
//
// المتطلبات (لو مش مثبتة):
//   npm install multer cloudinary firebase-admin
//
// ⚠️ ده بيفترض إن firebase-admin متهيأ في مكان تاني في المشروع
// (زي admin.js) - لو مش متهيأ، شوف firebaseAdminAuth.js تحت أول.

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
const Driver = require('../models/Driver'); // عدّل المسار لو مختلف عندك

const router = express.Router();

// رفع مؤقت في الذاكرة قبل ما نبعته لـ Cloudinary
const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: 'dchvb9n4n', // نفس حساب زورا
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBufferToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

// ---------------- POST /api/driver/documents ----------------
// بيستقبل مستند واحد (البطاقة/الرخصة/رخصة المركبة) ويحطه
// "قيد المراجعة" لحد ما تراجعه من لوحة التحكم.
router.post(
  '/documents',
  verifyFirebaseToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { type } = req.body; // زي national_id_front, driving_license...
      if (!req.file || !type) {
        return res.status(400).json({ message: 'الملف والنوع مطلوبين' });
      }

      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        'zura/driver-documents'
      );

      await Driver.findOneAndUpdate(
        { firebaseUid: req.driverUid },
        {
          $set: {
            [`documents.${type}`]: {
              url: result.secure_url,
              status: 'pending', // pending | approved | rejected
              uploadedAt: new Date(),
            },
          },
        },
        { upsert: true }
      );

      res.json({ url: result.secure_url, status: 'pending' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'خطأ في رفع المستند' });
    }
  }
);

// ---------------- POST /api/driver/profile-photo ----------------
router.post(
  '/profile-photo',
  verifyFirebaseToken,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'الملف مطلوب' });
      }
      const result = await uploadBufferToCloudinary(
        req.file.buffer,
        'zura/driver-profile-photos'
      );
      res.json({ url: result.secure_url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'خطأ في رفع الصورة' });
    }
  }
);

// ---------------- PATCH /api/driver/documents/:driverId/:type ----------------
// ده للوحة التحكم (الأدمن) عشان توافق/ترفض مستند - مش بينادى من التطبيق.
// TODO: احمي الراوت ده بصلاحية أدمن مش صلاحية سائق عادي.
router.patch('/documents/:driverId/:type', async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'حالة غير صحيحة' });
    }
    await Driver.findByIdAndUpdate(req.params.driverId, {
      $set: { [`documents.${req.params.type}.status`]: status },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;