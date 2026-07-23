const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');

/**
 * POST /api/ratings
 * body: { category: 'vegetables', categoryLabel: 'خضروات', stars: 4, deviceId: '...' }
 * بيحفظ تقييم جديد. بيتنادى من التطبيق كل مرة يدوس المستخدم على نجمة.
 */
router.post('/', async (req, res) => {
  try {
    const { category, categoryLabel, stars, deviceId } = req.body;

    if (!category || !stars) {
      return res.status(400).json({ message: 'category و stars مطلوبين' });
    }
    if (stars < 1 || stars > 5) {
      return res.status(400).json({ message: 'stars لازم يكون بين 1 و 5' });
    }

    const rating = await Rating.create({
      category,
      categoryLabel: categoryLabel || '',
      stars,
      deviceId: deviceId || null,
    });

    res.status(201).json({ success: true, rating });
  } catch (err) {
    console.error('Rating create error:', err);
    res.status(500).json({ message: 'حصل خطأ في حفظ التقييم' });
  }
});

/**
 * GET /api/ratings/summary
 * بيرجع متوسط التقييم وعدد التقييمات لكل قسم، مرتبة من الأكثر تقييمًا
 * (عدد التقييمات) عشان تعرف الجودة عاجبة الناس ولا لأ ولأي قسم بالظبط.
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await Rating.aggregate([
      {
        $group: {
          _id: '$category',
          categoryLabel: { $last: '$categoryLabel' },
          averageStars: { $avg: '$stars' },
          totalRatings: { $sum: 1 },
        },
      },
      { $sort: { totalRatings: -1 } },
    ]);

    const formatted = summary.map((s) => ({
      category: s._id,
      categoryLabel: s.categoryLabel,
      averageStars: Math.round(s.averageStars * 10) / 10,
      totalRatings: s.totalRatings,
    }));

    res.json({ summary: formatted });
  } catch (err) {
    console.error('Rating summary error:', err);
    res.status(500).json({ message: 'حصل خطأ في جلب الملخص' });
  }
});

module.exports = router;