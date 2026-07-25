const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');

// ═══════════════════════════════════════════════════════════════
// روبوت زورا - ردود جاهزة (Rule-based) بدون أي تكلفة API خارجية.
// بيدور على كلمات مفتاحية في رسالة المستخدم ويرجع أنسب رد جاهز.
// عايز تضيف نية/موضوع جديد؟ ضيف عنصر جديد في مصفوفة INTENTS تحت.
//
// ⚠️ الذاكرة: البوت أصلاً مالوش أي حالة محفوظة بين الرسايل (كل
// POST مستقل). عشان سيناريوهات زي "تتبع الطلب" اللي محتاجة خطوتين
// (نسأل عن رقم الطلب، وبعدين نستقبله)، بنرجّع مع الرد حقل `context`،
// والفلاتر (zura_chat_screen.dart) بترجّعه تاني مع الرسالة اللي بعدها
// عشان نعرف إحنا مستنيين رقم طلب لإيه بالظبط.
// ═══════════════════════════════════════════════════════════════

const STATUS_LABELS = {
  pending: 'قيد المراجعة',
  confirmed: 'تم تأكيد الطلب',
  preparing: 'جاري التجهيز',
  delivering: 'في الطريق',
  completed: 'تم التسليم',
  cancelled: 'ملغي',
};

const STATUS_MESSAGES = {
  pending: 'تم استلام طلبك بنجاح وهو الآن قيد المراجعة من المتجر. سيتم تحديث حالته بمجرد بدء التجهيز.',
  confirmed: 'تم تأكيد طلبك، وهيدخل مرحلة التجهيز خلال شوية.',
  preparing: 'طلبك قيد التجهيز الآن، ويعمل المتجر على إعداده في أسرع وقت.',
  delivering: 'طلبك خرج مع مندوب التوصيل وهو الآن في الطريق إليك. نتوقع وصوله قريبًا.',
  completed: 'تم تسليم طلبك بنجاح. نتمنى أن تكون تجربتك مع زورا ممتازة. 💙',
  cancelled: 'تم إلغاء هذا الطلب. إذا كنت ترغب في معرفة السبب أو تحتاج إلى مساعدة، يسعدني مساعدتك.',
};

const INTENTS = [
  {
    key: 'track_order',
    keywords: ['تتبع', 'طلبي', 'اوردر', 'أوردر', 'وصل امتى', 'فين طلبي', 'حالة الطلب', 'اين طلبي', 'أين طلبي'],
    reply: 'بالتأكيد، أقدر أساعدك في تتبع طلبك. 😊\nمن فضلك أرسل رقم الطلب حتى أتحقق من حالته.',
    suggestions: ['روح لطلباتي بدل كده'],
    nextContext: { pendingIntent: 'track_order' },
  },
  {
    key: 'cancel_order',
    keywords: ['الغاء الطلب', 'إلغاء الطلب', 'عايز الغي', 'عايز ألغي', 'الغي طلبي', 'ألغي طلبي'],
    reply: 'بالتأكيد. من فضلك أرسل رقم الطلب حتى أتحقق من إمكانية إلغائه.',
    nextContext: { pendingIntent: 'cancel_order' },
  },
  {
    key: 'modify_order',
    keywords: ['تعديل الطلب', 'عايز اعدل', 'عايز أعدل', 'غير طلبي', 'أغير طلبي'],
    reply: 'يسعدني مساعدتك. أرسل رقم الطلب أولًا، وبعدها أخبرني بالتعديل الذي ترغب في إجرائه.',
    nextContext: { pendingIntent: 'modify_order_awaiting_id' },
  },
  {
    key: 'delayed_order',
    keywords: ['طلبي متأخر', 'اتأخر', 'تأخر الطلب', 'وصل لسه'],
    reply: 'أعتذر عن التأخير. من فضلك أرسل رقم الطلب حتى أتحقق من سبب التأخير وأخبرك بآخر التحديثات.',
    nextContext: { pendingIntent: 'delayed_order' },
  },
  {
    key: 'missing_product',
    keywords: ['منتج ناقص', 'ناقص من الطلب', 'فيه منتج ناقص'],
    reply: 'أعتذر عن ذلك. من فضلك أرسل رقم الطلب أولًا.',
    nextContext: { pendingIntent: 'missing_product_awaiting_id' },
  },
  {
    key: 'wrong_product',
    keywords: ['منتج غلط', 'المنتج غلط', 'منتج خاطئ', 'استلمت منتج خطأ', 'المنتج مش اللي طلبته'],
    reply: 'أعتذر عن هذا الخطأ. أرسل رقم الطلب أولًا.',
    nextContext: { pendingIntent: 'wrong_product_awaiting_id' },
  },
  {
    key: 'invoice',
    keywords: ['فاتورة', 'عايز الفاتورة', 'تفاصيل الفاتورة'],
    reply: 'بالتأكيد، أرسل رقم الطلب وسأعرض لك تفاصيل الفاتورة.',
    nextContext: { pendingIntent: 'invoice' },
  },
  {
    key: 'delivery_fee',
    keywords: ['رسوم التوصيل', 'سعر التوصيل', 'كام التوصيل', 'التوصيل بكام'],
    reply: 'تختلف رسوم التوصيل حسب عنوانك والمنطقة. أخبرني بمنطقة التوصيل أو ابدأ الطلب وسأعرض لك الرسوم قبل تأكيده.',
  },
  {
    key: 'payment_issue',
    keywords: ['الدفع فشل', 'فشل الدفع', 'مشكلة في الدفع', 'الدفع مش شغال', 'مقدرتش ادفع'],
    reply: 'أعتذر عن ذلك. أخبرني بطريقة الدفع التي استخدمتها (بطاقة - محفظة - كاش)، وسأساعدك في حل المشكلة.',
    nextContext: { pendingIntent: 'payment_issue' },
  },
  {
    key: 'human_agent',
    keywords: [
      'موظف', 'خدمة عملاء', 'حد يكلمني', 'مسؤول', 'انسان', 'إنسان',
      'أكلم خدمة العملاء', 'الأدمن', 'ادمن', 'المدير', 'الوصول للادمن',
      'الوصول للأدمن',
    ],
    reply: 'تقدر تتواصل مباشرة مع الأدمن/المدير على الإيميل ده:\nsamostafa963@gmail.com 📧\nوهيتم الرد عليك في أقرب وقت.',
  },
  {
    key: 'exchange_product',
    keywords: ['استبدال', 'استبدل', 'عايز استبدل', 'أستبدل'],
    reply: 'تمام، من فضلك أرسل رقم الطلب اللي عايز تستبدل منتج منه.',
    nextContext: { pendingIntent: 'exchange_awaiting_id' },
  },
  {
    key: 'who_is_zura',
    keywords: ['من هي زورا', 'إيه هي زورا', 'ايه هي زورا', 'زورا ايه'],
    reply: 'زورا هي منصة ذكية تجمع لك أفضل المتاجر في مكان واحد، لتطلب البقالة والخضار والفاكهة واللحوم والمجمدات والمشروبات وغيرها، مع توصيل سريع وتجربة شراء سهلة.',
  },
  {
    key: 'where_zura_operates',
    keywords: ['زورا شغالة فين', 'فين شغالين', 'اماكن التوصيل', 'أماكن التوصيل', 'مناطق التوصيل'],
    reply: 'نعمل حاليًا في مناطق محددة، ونعمل باستمرار على التوسع لتغطية المزيد من المناطق في جميع أنحاء مصر.',
  },
  {
    key: 'coupon',
    keywords: ['كوبون', 'كود خصم'],
    reply: 'ممتاز! أدخل كود الكوبون أثناء إتمام الطلب، وسيتم تطبيق الخصم تلقائيًا إذا كان الكوبون صالحًا.',
  },
  {
    key: 'repeat_last_order',
    keywords: ['كرر اخر طلب', 'كرر آخر طلب', 'اطلب زي المرة اللي فاتت', 'نفس الطلب اللي فات'],
    handler: 'repeat_last_order',
  },
  {
    key: 'offers',
    keywords: ['عرض', 'عروض', 'خصم', 'خصومات', 'تخفيض'],
    reply: 'عندنا عروض يومية على مجموعة كبيرة من المنتجات 🎉 تقدر تشوفها كلها من قسم "عروض اليوم" في الصفحة الرئيسية.',
    action: 'open_offers',
  },
  {
    key: 'payment',
    keywords: ['دفع', 'فيزا', 'كاش', 'الدفع', 'ادفع', 'أدفع'],
    reply: 'بتقدر تدفع عن طريق الدفع عند الاستلام (كاش) أو بالفيزا/الماستركارد أونلاين وقت إتمام الطلب 💳.',
  },
  {
    key: 'shipping',
    keywords: ['شحن', 'توصيل', 'التوصيل', 'وقت التوصيل', 'هيوصل امتى'],
    reply: 'التوصيل عندنا بيستغرق من 30 لـ 45 دقيقة في المناطق اللي بنغطيها 🛵، وبتقدر تشوف تفاصيل التوصيل قبل تأكيد الطلب.',
  },
  {
    key: 'returns',
    keywords: ['استرجاع', 'ارجاع', 'استبدال', 'ابدل', 'ارجع المنتج'],
    reply: 'لو في مشكلة في أي منتج، تقدر تطلب استرجاعه أو استبداله خلال 24 ساعة من الاستلام عن طريق صفحة الطلب نفسه أو من هنا معايا وأنا أوصلك بفريق الدعم.',
  },
  {
    key: 'greeting',
    keywords: ['مرحبا', 'اهلا', 'أهلا', 'السلام عليكم', 'هاي', 'صباح الخير', 'مساء الخير'],
    reply: 'أهلاً بيك! 👋 أنا روبوت زورا، تقدر تسألني عن الطلبات، المنتجات، العروض، أو طرق الدفع والشحن.',
  },
];

// أسماء الأقسام (بنفس كلمات المطابقة المستخدمة في التطبيق) - لو المستخدم
// ذكر اسم قسم، البوت يرد عليه بعرض القسم ده بالتحديد.
const CATEGORY_INTENTS = [
  { key: 'grocery', keywords: ['بقالة', 'سوبر ماركت'], label: 'سوبر ماركت' },
  { key: 'vegetables', keywords: ['خضار', 'خضروات', 'فاكهة', 'فواكه'], label: 'خضروات وفاكهة' },
  { key: 'dairy', keywords: ['ألبان', 'البان', 'جبن'], label: 'ألبان وجبن' },
  { key: 'frozen', keywords: ['مجمدات'], label: 'مجمدات' },
  { key: 'meat', keywords: ['بروتينات', 'لحوم', 'دواجن', 'أسماك'], label: 'لحوم ودواجن وأسماك' },
  { key: 'bakery', keywords: ['مخبوزات', 'خبز'], label: 'مخبوزات' },
  { key: 'cleaning', keywords: ['منظفات'], label: 'منظفات' },
  { key: 'drinks', keywords: ['مشروبات'], label: 'مشروبات' },
  { key: 'snacks', keywords: ['سناكس'], label: 'سناكس' },
  { key: 'herbs', keywords: ['عطارة'], label: 'عطارة' },
  { key: 'household', keywords: ['مستلزمات منزلية', 'مستلزمات'], label: 'مستلزمات منزلية' },
  { key: 'health', keywords: ['صحة وجمال', 'صحة', 'جمال'], label: 'صحة وجمال' },
  { key: 'baby', keywords: ['عناية بالطفل', 'الطفل'], label: 'عناية بالطفل' },
  { key: 'sweets', keywords: ['حلويات وتسالي', 'حلويات', 'تسالي'], label: 'حلويات وتسالي' },
];

function findCategoryIntent(message) {
  for (const cat of CATEGORY_INTENTS) {
    for (const kw of cat.keywords) {
      if (message.includes(kw)) return cat;
    }
  }
  return null;
}

function findIntent(message) {
  for (const intent of INTENTS) {
    for (const kw of intent.keywords) {
      if (message.includes(kw)) return intent;
    }
  }
  return null;
}

// بيستخرج كود الطلب القصير من رسالة المستخدم (بيشيل # والمسافات).
// التطبيق بيعرض للعميل آخر 6 حروف من الـ_id بحروف كبيرة (زي EC7DF9)،
// مش الـ_id الكامل - فبنقبل الشكلين (الكود القصير أو الـid الكامل).
function extractOrderId(message) {
  const cleaned = message.replace(/#/g, '').replace(/\s/g, '').trim();
  if (mongoose.Types.ObjectId.isValid(cleaned) && cleaned.length === 24) {
    return { type: 'full', value: cleaned };
  }
  if (/^[a-fA-F0-9]{4,8}$/.test(cleaned)) {
    return { type: 'short', value: cleaned.toLowerCase() };
  }
  return null;
}

async function findOrderByExtractedId(extracted) {
  if (extracted.type === 'full') {
    return Order.findById(extracted.value);
  }
  // كود قصير: ندور على أي طلب الـ_id بتاعه بينتهي بنفس الحروف دي
  const matches = await Order.aggregate([
    { $addFields: { idStr: { $toString: '$_id' } } },
    { $match: { idStr: { $regex: `${extracted.value}$`, $options: 'i' } } },
    { $limit: 2 },
  ]);
  if (matches.length !== 1) return null; // مفيش تطابق، أو أكتر من طلب لنفس الكود
  return Order.findById(matches[0]._id);
}

// بيتأكد إن الطلب فعلاً بتاع نفس الشخص اللي بيكلم البوت. بنقبل أي
// تطابق مع Firebase UID أو الـid القديم أو رقم التليفون (لأن التطبيق
// بيسجل الطلبات بأي واحد منهم حسب طريقة تسجيل الدخول). لو مفيش أي
// هوية اتبعتت من الفلاتر أصلاً، منرفضش الطلب (نفضل نساعد المستخدم).
async function findOrderSafe(extracted, identity) {
  const order = await findOrderByExtractedId(extracted);
  if (!order) return null;

  const knownIds = [identity?.firebaseUid, identity?.legacyUserId]
    .filter(Boolean)
    .map(String);
  const knownPhone = identity?.phone ? String(identity.phone).replace(/[+\s]/g, '') : null;

  if (knownIds.length === 0 && !knownPhone) return order; // مفيش هوية نتحقق بيها

  const orderUserId = order.userId ? String(order.userId) : null;
  const orderPhone = order.phone ? String(order.phone).replace(/[+\s]/g, '') : null;

  const idMatches = orderUserId && knownIds.includes(orderUserId);
  const phoneMatches = orderPhone && knownPhone && orderPhone === knownPhone;

  if (idMatches || phoneMatches) return order;
  // لو الطلب أصلاً مالوش userId ولا phone مسجلين، منقدرش نتأكد - نسيبه يعدي
  if (!orderUserId && !orderPhone) return order;
  return 'forbidden';
}

function invoiceText(order) {
  const lines = (order.items || [])
    .map((it) => `- ${it.name} × ${it.quantity} = ${it.total} ج.م`)
    .join('\n');
  return `📋 فاتورة الطلب:\n${lines}\n\nالإجمالي الفرعي: ${order.subtotal} ج.م\nالتوصيل: ${order.delivery} ج.م\nالإجمالي: ${order.total} ج.م`;
}

/**
 * POST /api/ai
 * body: { message: string, context?: {...}, identity?: {firebaseUid?, legacyUserId?, phone?} }
 * response: { reply, action?, categoryLabel?, suggestions, context? }
 */
router.post('/', async (req, res) => {
  try {
    const raw = (req.body.message || '').toString().trim();
    const identity = req.body.identity || {};
    const context = req.body.context || null;

    if (!raw) {
      return res.status(400).json({ message: 'message مطلوب' });
    }

    // ── لو إحنا مستنيين رقم طلب (أو تفصيلة تانية) من رسالة سابقة ──
    if (context && context.pendingIntent) {
      return await handlePendingIntent(context, raw, identity, res);
    }

    // القسم له أولوية أعلى (زي مثال "عايز اطلب خضار وفاكهة" في التصميم)
    const category = findCategoryIntent(raw);
    if (category) {
      return res.json({
        reply: `أكيد! عندنا قسم ${category.label} طازج ومتوفر دلوقتي 🛒 هل تحب أعرضلك المنتجات؟`,
        action: 'open_category',
        categoryLabel: category.label,
        suggestions: ['أيوه من فضلك', 'لأ، حاجة تانية'],
      });
    }

    const intent = findIntent(raw);
    if (intent) {
      if (intent.handler === 'repeat_last_order') {
        return await handleRepeatLastOrder(identity, res);
      }
      return res.json({
        reply: intent.reply,
        action: intent.action || null,
        suggestions: intent.suggestions || ['عروض اليوم', 'تتبع الطلب', 'طرق الدفع'],
        context: intent.nextContext || null,
      });
    }

    // مفيش تطابق - رد افتراضي
    return res.json({
      reply: 'مش متأكد إني فهمت قصدك بالظبط 🤔 اختار من الاقتراحات دي أو اسألني بشكل تاني.',
      action: null,
      suggestions: ['عروض اليوم', 'تتبع الطلب', 'طرق الدفع', 'تحدث مع موظف'],
    });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ message: 'حصل خطأ في معالجة الرسالة' });
  }
});

// ── معالجة الرسايل اللي بتيجي رد على سؤال سابق (رقم طلب/تفصيلة) ──
async function handlePendingIntent(context, raw, identity, res) {
  const { pendingIntent } = context;

  // كل السيناريوهات دي أول خطوة فيها إنها تستقبل رقم/كود الطلب
  const needsOrderIdFirst = [
    'track_order',
    'cancel_order',
    'modify_order_awaiting_id',
    'delayed_order',
    'missing_product_awaiting_id',
    'wrong_product_awaiting_id',
    'invoice',
    'exchange_awaiting_id',
  ];

  if (needsOrderIdFirst.includes(pendingIntent)) {
    const extracted = extractOrderId(raw);
    if (!extracted) {
      return res.json({
        reply: 'كود الطلب اللي بعتهولي مش واضح 🤔 تأكد إنك ناسخه صح من صفحة "طلباتي" (شكله زي #EC7DF9) وابعتهولي تاني.',
        context, // نفضل مستنيين نفس الحاجة
      });
    }

    const order = await findOrderSafe(extracted, identity);
    if (order === 'forbidden') {
      return res.json({
        reply: 'الكود ده مش مرتبط بحسابك، تأكد إنك ناسخ كود الطلب الصح من صفحة "طلباتي".',
        context,
      });
    }
    if (!order) {
      return res.json({
        reply: 'معلش، مش لاقي طلب بالكود ده. تأكد منه وابعتهولي تاني.',
        context,
      });
    }

    switch (pendingIntent) {
      case 'track_order':
      case 'delayed_order':
        return res.json({
          reply: STATUS_MESSAGES[order.status] || 'جاري التحقق من حالة طلبك.',
          action: 'open_orders',
          suggestions: ['عروض اليوم', 'تتبع الطلب', 'طرق الدفع'],
        });

      case 'cancel_order': {
        const cancellable = ['pending', 'confirmed'].includes(order.status);
        if (!cancellable) {
          return res.json({
            reply: `للأسف مش هينفع نلغي الطلب ده لأنه بالفعل ${STATUS_LABELS[order.status]}. لو محتاج مساعدة تانية، تقدر تتكلم مع موظف الدعم.`,
          });
        }
        order.status = 'cancelled';
        await order.save();
        return res.json({
          reply: 'تم إلغاء طلبك بنجاح ✅',
        });
      }

      case 'modify_order_awaiting_id': {
        const shortCode = order._id.toString().slice(-6).toUpperCase();
        return res.json({
          reply: 'تمام، دلوقتي أخبرني بالتعديل اللي حابب تعمله في الطلب ده.',
          context: { pendingIntent: 'modify_order_awaiting_detail', orderCode: shortCode },
        });
      }

      case 'missing_product_awaiting_id': {
        const shortCode = order._id.toString().slice(-6).toUpperCase();
        return res.json({
          reply: 'تمام، اكتبلي اسم المنتج الناقص من الطلب.',
          context: { pendingIntent: 'missing_product_awaiting_detail', orderCode: shortCode },
        });
      }

      case 'wrong_product_awaiting_id': {
        const shortCode = order._id.toString().slice(-6).toUpperCase();
        return res.json({
          reply: 'تمام، اكتبلي اسم المنتج اللي استلمته غلط.',
          context: { pendingIntent: 'wrong_product_awaiting_detail', orderCode: shortCode },
        });
      }

      case 'invoice':
        return res.json({ reply: invoiceText(order) });

      case 'exchange_awaiting_id': {
        const exchangeable = ['pending', 'confirmed', 'preparing'].includes(order.status);
        if (!exchangeable) {
          return res.json({
            reply: `للأسف الطلب ده بقى ${STATUS_LABELS[order.status]} ومش هينفع نستبدل منتج فيه دلوقتي. تقدر تتواصل مع الأدمن على samostafa963@gmail.com لو محتاج مساعدة.`,
          });
        }
        if (!order.items || order.items.length === 0) {
          return res.json({ reply: 'الطلب ده مفيهوش أي منتجات أستبدلها.' });
        }
        const itemsList = order.items.map((it) => `- ${it.name}`).join('\n');
        return res.json({
          reply: `تمام، دي منتجات الطلب:\n${itemsList}\n\nاكتبلي اسم المنتج اللي عايز تستبدله.`,
          context: { pendingIntent: 'exchange_awaiting_old_product', orderId: order._id.toString() },
        });
      }
    }
  }

  // ── خطوة ثانية: استقبال تفصيلة إضافية بعد رقم الطلب ──
  if (pendingIntent === 'modify_order_awaiting_detail') {
    return res.json({
      reply: `تمام، سجّلت طلب التعديل بتاعك على الطلب #${context.orderCode}: "${raw}". فريق خدمة العملاء هيتواصل معاك يأكد التعديل في أقرب وقت. 🙏`,
    });
  }
  if (pendingIntent === 'missing_product_awaiting_detail') {
    return res.json({
      reply: `تم تسجيل ملاحظتك بخصوص "${raw}" في الطلب #${context.orderCode}، وفريق الدعم هيتواصل معاك لحل المشكلة في أقرب وقت. 🙏`,
    });
  }
  if (pendingIntent === 'wrong_product_awaiting_detail') {
    return res.json({
      reply: `تم تسجيل ملاحظتك بخصوص "${raw}" في الطلب #${context.orderCode}، وفريق الدعم هيتواصل معاك لحل المشكلة في أقرب وقت. 🙏`,
    });
  }
  if (pendingIntent === 'payment_issue') {
    return res.json({
      reply: `شكرًا لتوضيح طريقة الدفع (${raw}). لو المبلغ اتخصم من حسابك ومحصلش تأكيد للطلب، محتاج تتكلم مع الأدمن على samostafa963@gmail.com عشان يتأكد من حالة العملية.`,
    });
  }

  // ── الاستبدال: خطوة اختيار المنتج المطلوب استبداله من الطلب ──
  if (pendingIntent === 'exchange_awaiting_old_product') {
    const order = await Order.findById(context.orderId);
    if (!order) {
      return res.json({ reply: 'معلش، حصلت مشكلة والطلب مبقاش موجود، ابدأ الاستبدال تاني من الأول.' });
    }
    const query = raw.trim().toLowerCase();
    const matchIndex = (order.items || []).findIndex((it) =>
      (it.name || '').toLowerCase().includes(query)
    );
    if (matchIndex === -1) {
      const itemsList = order.items.map((it) => `- ${it.name}`).join('\n');
      return res.json({
        reply: `مش لاقي منتج بالاسم ده في الطلب. دي منتجات الطلب تاني:\n${itemsList}\n\nاكتب اسم المنتج بالظبط.`,
        context,
      });
    }
    return res.json({
      reply: `تمام، هنستبدل "${order.items[matchIndex].name}". اكتبلي اسم المنتج البديل اللي عايزه.`,
      context: {
        pendingIntent: 'exchange_awaiting_new_product',
        orderId: context.orderId,
        oldItemIndex: matchIndex,
      },
    });
  }

  // ── الاستبدال: خطوة اختيار المنتج البديل وتنفيذ الاستبدال فعليًا ──
  if (pendingIntent === 'exchange_awaiting_new_product') {
    const order = await Order.findById(context.orderId);
    if (!order) {
      return res.json({ reply: 'معلش، حصلت مشكلة والطلب مبقاش موجود، ابدأ الاستبدال تاني من الأول.' });
    }
    const query = raw.trim();
    const newProduct = await Product.findOne({
      name: { $regex: query, $options: 'i' },
    });
    if (!newProduct) {
      return res.json({
        reply: `مش لاقي منتج اسمه "${query}" عندنا. جرب تكتب اسم مختلف أو تأكد من الإملاء.`,
        context,
      });
    }

    const oldItem = order.items[context.oldItemIndex];
    const newLineTotal = newProduct.price * oldItem.quantity;
    order.items[context.oldItemIndex] = {
      productId: newProduct._id.toString(),
      name: newProduct.name,
      price: newProduct.price,
      quantity: oldItem.quantity,
      total: newLineTotal,
    };
    order.subtotal = order.items.reduce((sum, it) => sum + (it.total || 0), 0);
    order.total = order.subtotal + (order.delivery || 0);
    await order.save();

    return res.json({
      reply:
        `تم الاستبدال بنجاح ✅\n"${oldItem.name}" اتستبدل بـ"${newProduct.name}".\n` +
        `الإجمالي الجديد للطلب: ${order.total} ج.م`,
    });
  }

  // فولباك: لو حصل أي حاجة غريبة في الـ context، نرجع للوضع العادي
  return res.json({
    reply: 'تمام، تقدر تسألني عن أي حاجة تانية 🙂',
    suggestions: ['عروض اليوم', 'تتبع الطلب', 'طرق الدفع'],
  });
}

async function handleRepeatLastOrder(identity, res) {
  const orConditions = [];
  if (identity?.firebaseUid) orConditions.push({ userId: identity.firebaseUid });
  if (identity?.legacyUserId) orConditions.push({ userId: identity.legacyUserId });
  if (identity?.phone) {
    orConditions.push({ phone: String(identity.phone).replace(/[+\s]/g, '') });
  }

  if (orConditions.length === 0) {
    return res.json({
      reply: 'محتاج تكون مسجّل دخول الأول عشان أقدر أجيبلك آخر طلب ليك.',
    });
  }

  const lastOrder = await Order.findOne({ $or: orConditions }).sort({ createdAt: -1 });
  if (!lastOrder) {
    return res.json({
      reply: 'لسه معملتش أي طلب معانا 🙂 يومك النهارده يبقى أول طلب!',
    });
  }
  const itemsText = (lastOrder.items || [])
    .map((it) => `- ${it.name} × ${it.quantity}`)
    .join('\n');
  return res.json({
    reply:
      `يسعدني ذلك 😊 آخر طلب ليك كان فيه:\n${itemsText}\n\nالإجمالي: ${lastOrder.total} ج.م\n\n` +
      `افتح "طلباتي" من التطبيق وتقدر تطلب نفس المنتجات تاني بسهولة.`,
    action: 'open_orders',
  });
}

module.exports = router;