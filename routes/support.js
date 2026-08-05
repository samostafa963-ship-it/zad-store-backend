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
// ⚠️ توجيه الردود: لو صاحب المتجر كتب رقم العميل (زي #HBBR42) في أول
// ردّه، الرد بيتوجّه لصاحب الرقم ده بالظبط (والرقم بيتشال قبل ما
// يتحفظ، العميل مش شايفه خالص). لو رد من غير رقم، بيترجع للسلوك
// القديم (آخر عميل بعت) كـfallback بس - عشان الراحة لو محادثة واحدة
// شغالة وقتها.
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
    const shortId = userId.toString().slice(-6).toUpperCase();

    // 1) نسجّل الرسالة في محادثة العميل عشان تظهر له فورًا في التطبيق
    await db
      .collection('support_chats')
      .doc(userId)
      .collection('messages')
      .add({ text: message, sender: 'customer', createdAt: timestamp });

    // 2) نسجّل إن العميل ده هو آخر واحد بعت رسالة (fallback لو صاحب
    // المتجر رد من غير ما يكتب رقم العميل)
    await db.collection('support_meta').doc('lastActiveUser').set({
      userId,
      name: name || '',
      updatedAt: timestamp,
    });

    // 3) نسجّل تعريف "رقم العميل القصير" (#HBBR42) → الـid الحقيقي بتاعه
    // عشان لما صاحب المتجر يكتب الرقم ده في ردّه من واتساب، نعرف
    // نوجّه الرد لصاحبه بالظبط مهما كان عدد العملاء اللي بيكلموا وقتها
    await db.collection('support_shortids').doc(shortId).set({
      userId,
      name: name || '',
      updatedAt: timestamp,
    });

    // 4) نبعت نسخة لواتساب صاحب المتجر
    const displayName = name && name.trim().length > 0 ? name : `عميل #${shortId}`;
    await sendWhatsAppMessage(
      `💬 رسالة جديدة من ${displayName} (#${shortId}):\n${message}`
    );

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
    let incomingText = (req.body.Body || '').trim();

    if (incomingText) {
      // ⚠️ لو الرسالة بادئة برقم عميل زي "#HBBR42" (بأي حروف كبيرة/
      // صغيرة، وبمسافة أو من غيرها بعده)، نستخدمه لتحديد العميل
      // المقصود بالظبط، ونشيل الرقم من النص قبل ما يتحفظ - العميل
      // مش المفروض يشوف الرقم ده خالص.
      const codeMatch = incomingText.match(/^#([a-zA-Z0-9]{4,8})\s*/);
      let targetUserId = null;

      if (codeMatch) {
        const shortId = codeMatch[1].toUpperCase();
        incomingText = incomingText.slice(codeMatch[0].length).trim();
        const shortIdDoc = await db.collection('support_shortids').doc(shortId).get();
        if (shortIdDoc.exists) {
          targetUserId = shortIdDoc.data().userId;
        } else {
          console.warn(`WhatsApp reply referenced unknown customer code #${shortId}`);
        }
      }

      if (!targetUserId) {
        // Fallback: مفيش رقم مكتوب (أو مش معروف) - نستخدم آخر عميل بعت
        const metaDoc = await db.collection('support_meta').doc('lastActiveUser').get();
        targetUserId = metaDoc.exists ? metaDoc.data().userId : null;
      }

      if (targetUserId && incomingText) {
        await db
          .collection('support_chats')
          .doc(targetUserId)
          .collection('messages')
          .add({
            text: incomingText,
            sender: 'agent',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      } else if (!targetUserId) {
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