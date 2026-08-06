// ملف: middleware/firebaseAdminAuth.js (نسخة مُصلَّحة)
// بيتحقق من توكن Firebase اللي جاي من تطبيق الفلاتر (Bearer token)
// وبيحط UID المندوب وإيميله في req عشان الراوتس تستخدمهم.
//
// المتطلبات: npm install firebase-admin
// محتاج ملف مفتاح خدمة (service account JSON) من Firebase Console -
// نفس FIREBASE_SERVICE_ACCOUNT اللي ضفناه في .env قبل كده.

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
    // ⚠️ ده كان ناقص وهو سبب مشكلة "التطبيق فاضل يقول غير متصل" -
    // كنا بنعرف الـ UID بس مش الإيميل، فمكانش فيه طريقة نربط حساب
    // المندوب بالسجل اللي الأدمن عمله بالإيميل.
    req.driverEmail = decoded.email || null;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'جلسة الدخول منتهية' });
  }
}

module.exports = { verifyFirebaseToken };