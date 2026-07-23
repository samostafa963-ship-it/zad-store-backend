const express = require('express');
const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// روبوت زورا - ردود جاهزة (Rule-based) بدون أي تكلفة API خارجية.
// بيدور على كلمات مفتاحية في رسالة المستخدم ويرجع أنسب رد جاهز.
// عايز تضيف نية/موضوع جديد؟ ضيف عنصر جديد في مصفوفة INTENTS تحت.
// ═══════════════════════════════════════════════════════════════

const INTENTS = [
  {
    key: 'track_order',
    keywords: ['تتبع', 'طلبي', 'اوردر', 'أوردر', 'وصل امتى', 'فين طلبي', 'حالة الطلب'],
    reply: 'تقدر تتابع طلبك أول بأول من صفحة "طلباتي" في التطبيق 📦، هتلاقي فيها حالة الطلب لحظة بلحظة من التجهيز لحد التوصيل.',
    action: 'open_orders',
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
    key: 'human_agent',
    keywords: ['موظف', 'خدمة عملاء', 'حد يكلمني', 'مسؤول', 'انسان', 'إنسان'],
    reply: 'تمام، هحولك لموظف من فريق خدمة العملاء يكمل معاك 🙋، ثانية وهيكون معاك.',
    action: 'escalate_human',
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

/**
 * POST /api/ai
 * body: { message: 'عايز اطلب خضار وفاكهة' }
 * response: { reply: '...', action: 'open_category' | 'open_orders' | ..., categoryLabel?, suggestions: [...] }
 */
router.post('/', (req, res) => {
  try {
    const raw = (req.body.message || '').toString().trim();
    if (!raw) {
      return res.status(400).json({ message: 'message مطلوب' });
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
      return res.json({
        reply: intent.reply,
        action: intent.action || null,
        suggestions: ['عروض اليوم', 'تتبع الطلب', 'طرق الدفع'],
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

module.exports = router;