// routes/home.js
// ضيفها في ZAD_Backend/routes/home.js
// وفي ملف السيرفر الرئيسي (server.js / index.js / app.js) ضيف:
// app.use('/api/home', require('./routes/home'));
//
// مبني على الـ schema الفعلي بتاعك:
// Product: { name, price, old_price, is_bestseller, image, description, category_key, sub_category, sub_type, size_group, order }
// Order:   { items: [{ productId (String), name, price, quantity, total }], status, userId (String), createdAt (timestamps) }

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Product = require('../models/Product'); // غيّر المسار لو مختلف
const Order = require('../models/Order');     // غيّر المسار لو مختلف

// ⚠️ حط هنا قيم category_key الحقيقية بتاعة فئات الاحتياجات اليومية عندك بالظبط
// (زي: 'dairy', 'eggs', 'bakery' ... حسب اللي مسجل فعليًا في الداتابيز)
const DAILY_ESSENTIAL_CATEGORY_KEYS = ['dairy', 'eggs', 'bakery', 'vegetables', 'beverages'];

const LIMIT_PER_SECTION = 10;

// يحول productId (String) لـ ObjectId بأمان، ولو مش صالح يرجع null بدل ما يعمل throw
const toObjectIdSafe = {
  $convert: { input: '$items.productId', to: 'objectId', onError: null, onNull: null },
};

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    const usedIds = new Set();

    const excludeUsed = () => ({
      _id: { $nin: Array.from(usedIds).map(id => new mongoose.Types.ObjectId(id)) },
    });

    const markUsed = (products) => {
      products.forEach(p => usedIds.add(p._id.toString()));
      return products;
    };

    // ─────────────────────────────────────────────
    // 1) احتياجات يومية: فئات ثابتة، عينة عشوائية
    // ─────────────────────────────────────────────
    let dailyEssentials = await Product.aggregate([
      { $match: { category_key: { $in: DAILY_ESSENTIAL_CATEGORY_KEYS } } },
      { $sample: { size: LIMIT_PER_SECTION } },
    ]);
    dailyEssentials = markUsed(dailyEssentials);

    // ─────────────────────────────────────────────
    // 2) عروض اليوم: old_price > price فعليًا
    // ─────────────────────────────────────────────
    let offers = await Product.aggregate([
      {
        $match: {
          ...excludeUsed(),
          old_price: { $exists: true, $ne: null },
          $expr: { $gt: ['$old_price', '$price'] },
        },
      },
      { $addFields: { discountPct: { $divide: [{ $subtract: ['$old_price', '$price'] }, '$old_price'] } } },
      { $sort: { discountPct: -1 } },
      { $limit: LIMIT_PER_SECTION },
    ]);
    offers = markUsed(offers);

    // ─────────────────────────────────────────────
    // 3) الأكثر طلبًا (كل الأوقات) - من الأوردرات الفعلية، غير الملغية
    // ─────────────────────────────────────────────
    const mostOrderedAgg = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $addFields: { productObjId: toObjectIdSafe } },
      { $match: { productObjId: { $ne: null } } },
      { $group: { _id: '$productObjId', totalOrdered: { $sum: '$items.quantity' } } },
      { $sort: { totalOrdered: -1 } },
      { $limit: LIMIT_PER_SECTION * 3 },
    ]);
    const mostOrderedIds = mostOrderedAgg.map(a => a._id).filter(id => !usedIds.has(id.toString()));
    let mostOrdered = await Product.find({ _id: { $in: mostOrderedIds } }).limit(LIMIT_PER_SECTION);
    const orderRank = new Map(mostOrderedAgg.map((a, i) => [a._id.toString(), i]));
    mostOrdered.sort((a, b) => orderRank.get(a._id.toString()) - orderRank.get(b._id.toString()));
    mostOrdered = markUsed(mostOrdered);

    // ─────────────────────────────────────────────
    // 4) يطلبه الآخرون الآن: أوردرات آخر 3 أيام فقط
    // ─────────────────────────────────────────────
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentAgg = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: threeDaysAgo } } },
      { $unwind: '$items' },
      { $addFields: { productObjId: toObjectIdSafe } },
      { $match: { productObjId: { $ne: null } } },
      { $group: { _id: '$productObjId', recentCount: { $sum: '$items.quantity' } } },
      { $sort: { recentCount: -1 } },
      { $limit: LIMIT_PER_SECTION * 3 },
    ]);
    const recentIds = recentAgg.map(a => a._id).filter(id => !usedIds.has(id.toString()));
    let trendingNow = await Product.find({ _id: { $in: recentIds } }).limit(LIMIT_PER_SECTION);
    const recentRank = new Map(recentAgg.map((a, i) => [a._id.toString(), i]));
    trendingNow.sort((a, b) => recentRank.get(a._id.toString()) - recentRank.get(b._id.toString()));
    trendingNow = markUsed(trendingNow);

    // ─────────────────────────────────────────────
    // 5) رائج لك: فئات المستخدم المفضلة (من تاريخ طلباته)
    //    لو مفيش userId أو مفيش تاريخ: fallback عشوائي
    // ─────────────────────────────────────────────
    let trendingForYou = [];
    if (userId) {
      const userCategories = await Order.aggregate([
        { $match: { userId: userId, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $addFields: { productObjId: toObjectIdSafe } },
        { $match: { productObjId: { $ne: null } } },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $group: { _id: '$product.category_key', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ]);
      const categories = userCategories.map(c => c._id).filter(Boolean);
      if (categories.length) {
        trendingForYou = await Product.aggregate([
          { $match: { category_key: { $in: categories }, ...excludeUsed() } },
          { $sample: { size: LIMIT_PER_SECTION } },
        ]);
      }
    }
    if (!trendingForYou.length) {
      trendingForYou = await Product.aggregate([
        { $match: { ...excludeUsed() } },
        { $sample: { size: LIMIT_PER_SECTION } },
      ]);
    }
    trendingForYou = markUsed(trendingForYou);

    // ─────────────────────────────────────────────
    // 6) مقترح لك: فئات لسه المستخدم ما جربهاش (اكتشاف فئات جديدة)
    //    لو مفيش userId: fallback عشوائي تاني مختلف
    // ─────────────────────────────────────────────
    let forYou = [];
    if (userId) {
      const orderedCategories = await Order.aggregate([
        { $match: { userId: userId, status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $addFields: { productObjId: toObjectIdSafe } },
        { $match: { productObjId: { $ne: null } } },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $group: { _id: '$product.category_key' } },
      ]);
      const triedCategories = orderedCategories.map(c => c._id).filter(Boolean);
      forYou = await Product.aggregate([
        {
          $match: {
            category_key: { $nin: triedCategories },
            ...excludeUsed(),
          },
        },
        { $sample: { size: LIMIT_PER_SECTION } },
      ]);
    }
    if (!forYou.length) {
      forYou = await Product.aggregate([
        { $match: { ...excludeUsed() } },
        { $sample: { size: LIMIT_PER_SECTION } },
      ]);
    }
    forYou = markUsed(forYou);

    res.json({
      success: true,
      sections: {
        dailyEssentials,
        offers,
        mostOrdered,
        trendingNow,
        trendingForYou,
        forYou,
      },
    });
  } catch (err) {
    console.error('home route error:', err);
    res.status(500).json({ success: false, message: 'حصل خطأ في تحميل الصفحة الرئيسية', error: err.message });
  }
});

module.exports = router;