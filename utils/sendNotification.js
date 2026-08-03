const admin = require('../firebase');

const ORDER_MESSAGES = {
  confirmed:  { title: 'تم تأكيد طلبك', body: 'طلبك اتأكد وجاري التجهيز' },
  preparing:  { title: 'جاري تجهيز طلبك', body: 'المطبخ بيجهز طلبك دلوقتي' },
  delivering: { title: 'طلبك في الطريق', body: 'المندوب خرج بطلبك' },
  completed:  { title: 'تم التوصيل', body: 'استمتع بطلبك، شكراً لتسوقك مع زورا' },
  cancelled:  { title: 'تم إلغاء طلبك', body: 'للاستفسار تواصل معنا' }
};

async function sendOrderNotification(fcmToken, status, orderId) {
  if (!fcmToken) return;
  const msg = ORDER_MESSAGES[status];
  if (!msg) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title: msg.title, body: msg.body },
      data: { orderId: String(orderId), status },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'orders_channel' } },
      apns: { payload: { aps: { sound: 'default' } } }
    });
    console.log('✅ FCM sent:', status);
  } catch (e) {
    console.error('❌ FCM error:', e.message);
    // ⚠️ كانت ناقصة - الكود المستدعي (orders.js) بيتحقق من
    // result === 'expired' عشان يمسح التوكن القديم، بس الدالة دي
    // مكنتش بترجّع أي حاجة خالص فكان الفحص ده ميت وبيفضل يحاول يبعت
    // لتوكن منتهي كل مرة. دلوقتي بنكتشف كود الخطأ الصح ونرجّعه.
    if (
      e.code === 'messaging/registration-token-not-registered' ||
      e.code === 'messaging/invalid-registration-token'
    ) {
      return 'expired';
    }
  }
}

async function sendToMultiple(tokens, title, body, data = {}) {
  if (!tokens?.length) return;
  try {
    return await admin.messaging().sendEachForMulticast({
      tokens, notification: { title, body }, data,
      android: { priority: 'high' }
    });
  } catch (e) {
    console.error('❌ Multicast error:', e.message);
  }
}

module.exports = { sendOrderNotification, sendToMultiple };