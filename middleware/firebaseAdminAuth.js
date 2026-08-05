// ملف جديد: middleware/firebaseAdminAuth.js
// بيتحقق من توكن Firebase اللي جاي من تطبيق الفلاتر (Bearer token)
// ويحط UID المندوب في req.driverUid عشان الراوتس تستخدمه.
//
// المتطلبات: npm install firebase-admin
// محتاج ملف مفتاح خدمة (service account JSON) من Firebase Console:
// Project Settings → Service accounts → Generate new private key
// وحطه كـ env var اسمه FIREBASE_SERVICE_ACCOUNT (JSON string) أو
// ملف منفصل حسب إعدادك الحالي.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
  });
}

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'غير مصرح - سجل الدخول' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.driverUid = decoded.uid;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'جلسة الدخول منتهية' });
  }
}

module.exports = { verifyFirebaseToken };