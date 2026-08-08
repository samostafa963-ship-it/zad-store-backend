// ملف جديد: routes/pushNotifications.js
// محتاج تركيبه في index.js:
//   app.use('/api', require('./routes/pushNotifications'));
//
// بيستخدم firebase-admin (نفس FIREBASE_SERVICE_ACCOUNT الموجود عندك
// في Variables بالفعل) عشان يبعت إشعارات حقيقية بره التطبيق - توصل
// حتى لو التطبيق مقفول تمامًا، بصوت.

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const Driver = require('../models/Driver');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

// ---------------- PUT /api/driver/fcm-token ----------------
// التطبيق بيبعتها أول ما يسجل دخول (وكل ما التوكن يتغيّر) - بيحفظ
// معرّف الجهاز عشان نقدر نبعتله إشعارات بعد كده.
router.put('/driver/fcm-token', async (req, res) => {
  try {
    const { phone, fcmToken } = req.body;
    if (!phone || !fcmToken) {
      return res.status(400).json({ message: 'رقم الهاتف والتوكن مطلوبين' });
    }
    await Driver.findOneAndUpdate(
      { phone: phone.trim() },
      { fcmToken }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// ---------------- POST /api/driver/notify-new-order ----------------
// بينادى من لوحة التحكم (orders.html) بعد ما الأدمن يسند طلب لمندوب -
// بيبعت إشعار حقيقي بصوت لجهاز المندوب حتى لو التطبيق مقفول.
router.post('/driver/notify-new-order', async (req, res) => {
  try {
    const { driverId, orderId, customerName, total } = req.body;
    if (!driverId || !orderId) {
      return res.status(400).json({ message: 'driverId و orderId مطلوبين' });
    }
    const driver = await Driver.findById(driverId);
    if (!driver || !driver.fcmToken) {
      console.log('🔵 [notify] المندوب مفيهوش fcmToken محفوظ - مفيش إشعار اتبعت');
      return res.json({ sent: false, reason: 'no_token' });
    }

    await admin.messaging().send({
      token: driver.fcmToken,
      notification: {
        title: '🛍️ طلب جديد وصلك',
        body: customerName
          ? `طلب من ${customerName} - ${total || 0} ج.م`
          : `طلب جديد #${orderId.toString().slice(-6).toUpperCase()}`,
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'zura_orders',
          sound: 'default',
          priority: 'max',
          defaultVibrateTimings: true,
        },
      },
      data: {
        type: 'new_order',
        orderId: orderId.toString(),
      },
    });

    console.log('🔵 [notify] تم إرسال إشعار لـ', driver.name);
    res.json({ sent: true });
  } catch (err) {
    console.error('🔴 [notify] فشل إرسال الإشعار:', err.message);
    res.status(500).json({ message: 'فشل إرسال الإشعار', error: err.message });
  }
});

module.exports = router;