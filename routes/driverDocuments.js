// ملف: routes/driverDocuments.js (نسخة مُصلَّحة)
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyFirebaseToken } = require('../middleware/firebaseAdminAuth');
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

// بيدوّر على سجل المندوب فعليًا (مش بيعمل واحد جديد) - أول بالـ UID
// لو مربوط قبل كده، وإلا بالإيميل مع ربط الـ UID فورًا. ⚠️ ده بيفترض
// إن الأدمن عمل سجل المندوب من اللوحة الأول (بالإيميل) - لو محدش
// عمل كده، الرفع هيفشل برسالة واضحة بدل ما يعمل سجل مكرر فاضي.
async function findLinkedDriver(req) {
  let driver = await Driver.findOne({ firebaseUid: req.driverUid });
  if (!driver && req.driverEmail) {
    driver = await Driver.findOne({ email: req.driverEmail });
    if (driver) {
      driver.firebaseUid = req.driverUid;
      await driver.save();
    }
  }
  return driver;
}

// ---------------- POST /api/driver/documents ----------------
router.post(
  '/documents',
  verifyFirebaseToken,
  upload.single('file'),
  async (req, res) => {
    try {
      const { type } = req.body;
      if (!req.file || !type) {
        return res.status(400).json({ message: 'الملف والنوع مطلوبين' });
      }

      const driver = await findLinkedDriver(req);
      if (!driver) {
        return res.status(404).json({
          message: 'حسابك مش مربوط بسجل مندوب - كلم الأدمن يتأكد إن إيميلك متسجل صح في اللوحة',
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