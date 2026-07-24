// routes/home.js
// ضيفها في ZAD_Backend/routes/home.js
// وفي ملف السيرفر الرئيسي (server.js / index.js / app.js) ضيف:
// app.use('/api/home', require('./routes/home'));
//
// كل منتج راجع من هنا متحول لنفس شكل الـ JSON اللي ProductModel.fromJson
// في الفلاتر متوقعه بالظبط (original_price, category_path, ...) عشان
// تستخدمه في الشاشة من غير ما تلمس ProductModel خالص.

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Product = require('../models/Product'); // غيّر المسار لو مختلف
const Order = require('../models/Order');     // غيّر المسار لو مختلف

// ⚠️ حط هنا قيم category_key الحقيقية بتاعة فئات الاحتياجات اليومية عندك بالظبط
const DAILY_ESSENTIAL_CATEGORY_KEYS = ['dairy', 'eggs', 'bakery', 'vegetables', 'beverages'];

const LIMIT_PER_SECTION = 10;

const toObjectIdSafe = {
  $convert: { input: '$items.productId', to: 'objectId', onError: null, onNull: null },
};

// بيحول doc المنتج الخام (من الـ schema بتاعك) لنفس شكل الـ JSON
// اللي ProductModel.fromJson في الفلاتر متوقعه
function mapProduct(doc) {
  const categoryPath = [doc.category_key, doc.sub_category, doc.sub_type].filter(Boolean);
  return {
    _id: doc._id.toString(),
    name: doc.name || '',
    price: doc.price || 0,
    original_price: doc.old_price || 0,
    image: doc.image || '',
    size_group: doc.size_group || '',
    category: doc.category_key || '',
    category_path: categoryPath,
    is_available: true,
  };
}

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
    // 1) احتياجات يومية
    // ─────────────────────────────────────────────
    let dailyEssentials = await Product.aggregate([
      { $match: { category_key: { $in: DAILY_ESSENTIAL_CATEGORY_KEYS } } },
      { $sample: { size: LIMIT_PER_SECTION } },
    ]);
    dailyEssentials = markUsed(dailyEssentials);

    // ─────────────────────────────────────────────
    // 2) عروض اليوم
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
    // 3) الأكثر طلبًا (كل الأوقات)
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
    // 4) يطلبه الآخرون الآن (آخر 3 أيام)
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
    // 5) رائج لك (فئات المستخدم المفضلة، fallback عشوائي)
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
    // 6) مقترح لك (فئات لسه ما جربهاش، fallback عشوائي)
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
        { $match: { category_key: { $nin: triedCategories }, ...excludeUsed() } },
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
        dailyOffers: offers.map(mapProduct),
        dailyNeeds: dailyEssentials.map(mapProduct),
        mostOrdered: mostOrdered.map(mapProduct),
        othersOrder: trendingNow.map(mapProduct),
        trending: trendingForYou.map(mapProduct),
        suggested: forYou.map(mapProduct),
      },
    });
  } catch (err) {
    console.error('home route error:', err);
    res.status(500).json({ success: false, message: 'حصل خطأ في تحميل الصفحة الرئيسية', error: err.message });
  }
});

module.exports = router;