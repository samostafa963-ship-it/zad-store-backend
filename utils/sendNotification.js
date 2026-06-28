// ===================================================
// utils/sendNotification.js
// ===================================================
const admin = require('../firebase');

const ORDER_MESSAGES = {
  confirmed: {
    title: '✅ تم تأكيد طلبك!',
    body: 'طلبك اتأكد وجاري التجهيز قريباً 🎉'
  },
  preparing: {
    title: '🍳 جاري تجهيز طلبك',
    body: 'المطبخ بيجهز طلبك دلوقتي، متشوقيش! 😄'
  },
  delivering: {
    title: '🛵 طلبك في الطريق!',
    body: 'المندوب خرج بطلبك، هيوصلك قريباً'
  },
  completed: {
    title: '🎉 تم التوصيل!',
    body: 'استمتع بطلبك، شكراً لتسوقك مع زورا ❤️'
  },
  cancelled: {
    title: '❌ تم إلغاء طلبك',
    body: 'للاستفسار تواصل معنا على واتساب'
  }
};

async function sendOrderNotification(fcmToken, status, orderId) {
  if (!fcmToken) return;
  const msg = ORDER_MESSAGES[status];
  if (!msg) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: msg.title,
        body: msg.body
      },
      data: {
        orderId: String(orderId),
        status: status,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'orders_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    });
    console.log(`✅ FCM sent: ${status} → ${fcmToken.slice(0,20)}...`);
  } catch (e) {
    // Token منتهي أو غلط - امسحه
    if (e.code === 'messaging/registration-token-not-registered') {
      console.log('⚠️ FCM token expired, should remove from DB');
      return 'expired';
    }
    console.error('❌ FCM error:', e.message);
  }
}

async function sendCustomNotification(fcmToken, title, body, data = {}) {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'orders_channel' } },
      apns: { payload: { aps: { sound: 'default' } } }
    });
    console.log(`✅ Custom FCM sent to ${fcmToken.slice(0,20)}...`);
  } catch (e) {
    console.error('❌ FCM error:', e.message);
  }
}

// بعت لكل العملاء دفعة واحدة (Multicast)
async function sendToMultiple(fcmTokens, title, body, data = {}) {
  if (!fcmTokens?.length) return;
  try {
    const res = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: { priority: 'high', notification: { sound: 'default', channelId: 'orders_channel' } },
      apns: { payload: { aps: { sound: 'default' } } }
    });
    console.log(`✅ Multicast: ${res.successCount} success, ${res.failureCount} failed`);
    return res;
  } catch (e) {
    console.error('❌ Multicast error:', e.message);
  }
}

module.exports = { sendOrderNotification, sendCustomNotification, sendToMultiple };
