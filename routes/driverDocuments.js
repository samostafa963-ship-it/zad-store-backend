// cache-bust-2026-08-08-v2
// ملف: routes/driverDocuments.js (نسخة نهائية - رفع صور وملفات
// المندوب برقم الهاتف، مفيش فايربيز توكن خالص، زي باقي النظام دلوقتي)
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const Driver = require('../models/Driver');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: 'dchvb9n4n',
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

// بيدوّر على المندوب برقم الهاتف بس - نفس منطق driverShift.js.
async function findDriverByPhone(req) {
  const phone = req.query.phone || req.body.phone;
  if (!phone) return null;
  return Driver.findOne({ phone: phone.trim() });
}

// ---------------- POST /api/driver/documents ----------------
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    const { type } = req.body;
    if (!req.file || !type) {
      return res.status(400).json({ message: 'الملف والنوع مطلوبين' });
    }
    const driver = await findDriverByPhone(req);
    if (!driver) {
      return res.status(404).json({
        message: 'حسابك مش مربوط بسجل مندوب - كلم الأدمن يتأكد إن رقمك متسجل صح في اللوحة',
      });
    }

    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'zura/driver-documents'
    );

    driver.documents = driver.documents || {};
    driver.documents[type] = {
      url: result.secure_url,
      status: 'pending',
      uploadedAt: new Date(),
    };
    driver.markModified('documents');
    await driver.save();

    res.json({ url: result.secure_url, status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في رفع المستند' });
  }
});

// ---------------- POST /api/driver/profile-photo ----------------
// ⚠️ ده اللي محتاجينه عشان صورة البروفايل - بيرفع الصورة فعليًا
// ويحفظ رابطها في حقل avatar بتاع سجل المندوب نفسه (نفس الحقل اللي
// اللوحة بتقراه)، مش بس بيرجعه للتطبيق.
router.post('/profile-photo', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'الملف مطلوب' });
    }
    const driver = await findDriverByPhone(req);
    if (!driver) {
      return res.status(404).json({
        message: 'حسابك مش مربوط بسجل مندوب - كلم الأدمن يتأكد إن رقمك متسجل صح في اللوحة',
      });
    }
    const result = await uploadBufferToCloudinary(
      req.file.buffer,
      'zura/driver-profile-photos'
    );
    driver.avatar = result.secure_url;
    await driver.save();
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في رفع الصورة' });
  }
});

// ---------------- PUT /api/driver/profile ----------------
// المندوب بيعدّل اسمه من شاشة "المعلومات الشخصية" - بيحدّث سجله
// مباشرة في قاعدة البيانات (نفس الاسم اللي هيظهر للأدمن في اللوحة).
router.put('/profile', async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || !name) {
      return res.status(400).json({ message: 'رقم الهاتف والاسم مطلوبين' });
    }
    const driver = await Driver.findOneAndUpdate(
      { phone: phone.trim() },
      { name: name.trim() },
      { new: true }
    );
    if (!driver) {
      return res.status(404).json({ message: 'المندوب غير موجود' });
    }
    res.json({ name: driver.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- PATCH /api/driver/documents/:driverId/:type ----------------
// TODO: احمي الراوت ده بصلاحية أدمن مش صلاحية سائق عادي.
router.patch('/documents/:driverId/:type', async (req, res) => {
  try {
    const { status } = req.body;
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