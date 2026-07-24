/**
 * scripts/bust_image_cache.js
 *
 * بيضيف query param (?v=timestamp) لكل رابط صورة منتج، من غير أي
 * معالجة صور خالص - بس تحديث نص الرابط في الداتابيز. ده بيخلي
 * CachedNetworkImage في الفلاتر يعتبره رابط جديد ويجبر تنزيل النسخة
 * الحقيقية من السيرفر بدل ما يفضل عارض النسخة القديمة المحفوظة في
 * الكاش المحلي على جهاز المستخدم.
 *
 * آمن للتشغيل أكتر من مرة (بيشيل أي ?v= قديم ويحط واحد جديد).
 *
 * تشغيله:
 *   node scripts/bust_image_cache.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const Product = require('../models/Product');

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ متصل بـ MongoDB');

  const version = Date.now();
  const products = await Product.find({ image: { $exists: true, $ne: '' } });
  console.log(`عدد المنتجات: ${products.length}`);

  let updated = 0;
  for (const product of products) {
    const baseUrl = product.image.split('?')[0]; // شيل أي ?v= قديم لو موجود
    product.image = `${baseUrl}?v=${version}`;
    await product.save();
    updated++;
  }

  console.log(`✅ اتحدثت ${updated} صورة برقم إصدار جديد (v=${version})`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ خطأ عام:', err);
  process.exit(1);
});
