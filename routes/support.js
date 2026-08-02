const express = require('express');
const router = express.Router();
const admin = require('../firebase'); // نفس تهيئة firebase-admin المستخدمة في auth.js

const db = admin.firestore();

// ═══════════════════════════════════════════════════════════════
// شات الدعم: العميل بيكتب جوه التطبيق، الرسالة بتتخزن في Firestore
// (عشان التطبيق يستقبلها لحظيًا من غير Polling) وكمان بتتبعت لواتساب
// صاحب المتجر عن طريق Twilio - من غير ما رقمه يبان للعميل خالص.
// رد صاحب المتجر من واتساب بيوصل عن طريق Webhook تحت ويترجع في
// Firestore تاني عشان يبان للعميل فورًا.
//
// ⚠️ محدودية بسيطة في المرحلة دي: الردود بترجع لآخر عميل بعت رسالة
// (مش لكل العملاء في نفس اللحظة لو أكتر من واحد بيكلم في نفس الوقت).
// ═══════════════════════════════════════════════════════════════

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
// ⚠️ رقم الـ Sandbox التجريبي بتاع Twilio - لازم يتغيّر لرقم واتساب
// بيزنس حقيقي لما تخرج من مرحلة التجربة.
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
// ⚠️ رقم واتسابك الشخصي (اللي عمل "join" للـ Sandbox)
const OWNER_WHATSAPP_TO = 'whatsapp:+201030496174';

async function sendWhatsAppMessage(body) {
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
  const params = new URLSearchParams();
  params.append('To', OWNER_WHATSAPP_TO);
  params.append('From', TWILIO_WHATSAPP_FROM);
  params.append('Body', body);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    }
  );
  const data = await res.json();
  if (!res.ok) {
    console.error('Twilio send error:', data);
    throw new Error(data.message || 'فشل إرسال رسالة واتساب');
  }
  return data;
}

/**
 * POST /api/support/send
 * body: { userId: string, name?: string, message: string }
 * العميل بيبعت رسالة من شات التطبيق - بتتسجل في Firestore وتتبعت
 * لواتساب صاحب المتجر فورًا.
 */
router.post('/send', async (req, res) => {
  try {
    const { userId, name, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ message: 'userId و message مطلوبين' });
    }

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1) نسجّل الرسالة في محادثة العميل عشان تظهر له فورًا في التطبيق
    await db
      .collection('support_chats')
      .doc(userId)
      .collection('messages')
      .add({ text: message, sender: 'customer', createdAt: timestamp });

    // 2) نسجّل إن العميل ده هو آخر واحد بعت رسالة، عشان لما صاحب
    // المتجر يرد من واتساب نعرف نوجّه الرد لمين
    await db.collection('support_meta').doc('lastActiveUser').set({
      userId,
      name: name || '',
      updatedAt: timestamp,
    });

    // 3) نبعت نسخة لواتساب صاحب المتجر
    const shortId = userId.toString().slice(-6).toUpperCase();
    const displayName = name && name.trim().length > 0 ? name : `عميل #${shortId}`;
    await sendWhatsAppMessage(`💬 رسالة جديدة من ${displayName}:\n${message}`);

    res.json({ success: true });
  } catch (err) {
    console.error('support/send error:', err);
    res.status(500).json({ message: 'تعذر إرسال الرسالة', error: err.message });
  }
});

/**
 * POST /api/support/webhook
 * ⚠️ ده الرابط اللي هتحطه في إعدادات Twilio Sandbox تحت
 * "WHEN A MESSAGE COMES IN". Twilio بيبعتله فورمات form-urlencoded
 * (Body, From, To) - لازم يكون فيه express.urlencoded() شغال عليه.
 */
router.post('/webhook', async (req, res) => {
  try {
    const incomingText = (req.body.Body || '').trim();

    if (incomingText) {
      const metaDoc = await db.collection('support_meta').doc('lastActiveUser').get();
      const lastActiveUserId = metaDoc.exists ? metaDoc.data().userId : null;

      if (lastActiveUserId) {
        await db
          .collection('support_chats')
          .doc(lastActiveUserId)
          .collection('messages')
          .add({
            text: incomingText,
            sender: 'agent',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      } else {
        console.warn('WhatsApp reply received but no active customer to route it to.');
      }
    }

    // Twilio محتاج رد بصيغة TwiML (حتى لو فاضي) عشان يعرف إن الاستلام تم
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) {
    console.error('support/webhook error:', err);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

/**
 * GET /api/support/messages/:userId
 * (اختياري - لو حبيت تجيب المحادثة كاملة مرة واحدة بدل الاعتماد بس على
 * الاستماع اللحظي من Firestore في الفلاتر مباشرة)
 */
router.get('/messages/:userId', async (req, res) => {
  try {
    const snapshot = await db
      .collection('support_chats')
      .doc(req.params.userId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();
    const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ message: 'تعذر جلب المحادثة', error: err.message });
  }
});

module.exports = router;