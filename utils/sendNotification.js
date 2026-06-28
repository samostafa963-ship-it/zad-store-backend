const { getMessaging } = require('../firebase');

const ORDER_MESSAGES = {
  confirmed:  { title: '✅ تم تأكيد طلبك!', body: 'طلبك اتأكد وجاري التجهيز 🎉' },
  preparing:  { title: '🍳 جاري تجهيز طلبك', body: 'المطبخ بيجهز طلبك دلوقتي' },
  delivering: { title: '🛵 طلبك في الطريق!', body: 'المندوب خرج بطلبك' },
  completed:  { title: '🎉 تم التوصيل!', body: 'استمتع بطلبك، شكراً لتسوقك مع زورا ❤️' },
  cancelled:  { title: '❌ تم إلغاء طلبك', body: 'للاستفسار تواصل معنا' }
};

async function sendOrderNotification(fcmToken, status, orderId) {
  if (!fcmToken) return;
  const msg = ORDER_MESSAGES[status];
  if (!msg) return;
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: { title: msg.title, body: msg.body },
      data: { orderId: String(orderId), status },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'orders_channel' } },
      apns: { payload: { aps: { sound: 'default' } } }
    });
    console.log('✅ FCM sent:', status);
  } catch (e) {
    console.error('❌ FCM error:', e.message);
  }
}

async function sendToMultiple(tokens, title, body, data = {}) {
  if (!tokens?.length) return;
  try {
    return await getMessaging().sendEachForMulticast({
      tokens, notification: { title, body }, data,
      android: { priority: 'high' }
    });
  } catch (e) {
    console.error('❌ Multicast error:', e.message);
  }
}

module.exports = { sendOrderNotification, sendToMultiple };
