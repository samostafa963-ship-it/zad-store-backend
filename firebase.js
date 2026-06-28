const firebaseAdmin = require('firebase-admin');

if (!firebaseAdmin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount)
  });
}

module.exports = firebaseAdmin;
