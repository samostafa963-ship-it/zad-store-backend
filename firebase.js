// ===================================================
// firebase.js  (في root الـ backend)
// ===================================================
const admin = require('firebase-admin');

// الطريقة 1: من ملف JSON (للـ local)
// const serviceAccount = require('./serviceAccountKey.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// الطريقة 2: من Environment Variable (للـ Railway) ✅ الأفضل
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

module.exports = admin;
