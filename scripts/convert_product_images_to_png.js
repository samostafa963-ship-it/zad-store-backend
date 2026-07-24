/**
 * scripts/convert_product_images_to_png.js
 *
 * بيدور على كل المنتجات في MongoDB، ينزّل صورة كل منتج من رابطها
 * الحالي (زي روابط cdn.mafrservices.com)، يحوّلها PNG، يحفظها في
 * public/products/<productId>.png على سيرفرك نفسه، وبعدين يحدّث
 * حقل image في المنتج يشاور على الرابط الجديد بتاع سيرفرك.
 *
 * تشغيله مرة واحدة:
 *   npm install sharp   (لو مش مضافة أصلاً)
 *   node scripts/convert_product_images_to_png.js
 *
 * آمن للتشغيل أكتر من مرة: بيتخطى أي منتج صورته أصلاً بقت على
 * سيرفرك (يعني اتحولت قبل كده)، وبيتخطى أي منتج مالوش صورة أصلاً.
 */

require('dotenv').config();
const dns = require('dns');
// نفس الحل الموجود في server.js: بعض الشبكات مش بتحل DNS بتاع
// mongodb+srv:// صح، فبنجبر Node يستخدم DNS جوجل بدل DNS الشبكة
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Product = require('../models/Product');

// دومين سيرفرك على Railway - الصور الجديدة هتتفتح من هنا
const OWN_BASE_URL = 'https://zad-backend-production-39a3.up.railway.app';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'products');

// بيتخطى أي منتج صورته أصلاً بتاعة سيرفرنا (يعني اتحول قبل كده)
function alreadyMigrated(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.includes(OWN_BASE_URL);
}

// بينزّل أي URL كـ Buffer، وبيتبع أي redirect (3xx) لحد ما يوصل للصورة الحقيقية
function downloadBuffer(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ar-EG,ar;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity',
        Connection: 'keep-alive',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    };
    client
      .get(url, options, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          const nextUrl = new URL(res.headers.location, url).toString();
          resolve(downloadBuffer(nextUrl, redirectsLeft - 1));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} لـ ${url}`));
          res.resume();
          return;
        }
        const contentType = res.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
          const textChunks = [];
          res.on('data', (c) => textChunks.push(c));
          res.on('end', () => {
            const bodySnippet = Buffer.concat(textChunks)
              .toString('utf8')
              .slice(0, 300)
              .replace(/\s+/g, ' ');
            reject(
              new Error(
                `الرد مش صورة (status: ${res.statusCode}, content-type: ${
                  contentType || 'مش موجود'
                }) لـ ${url}\nنص الرد: ${bodySnippet}`
              )
            );
          });
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ متصل بـ MongoDB');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const products = await Product.find({
    image: { $exists: true, $ne: '' },
  });
  console.log(`عدد المنتجات اللي عندها صورة: ${products.length}`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    const originalUrl = product.image;

    if (alreadyMigrated(originalUrl)) {
      skipped++;
      continue;
    }

    try {
      const buffer = await downloadBuffer(originalUrl);
      const outPath = path.join(OUTPUT_DIR, `${product._id}.png`);

      await sharp(buffer).png().toFile(outPath);

      const newUrl = `${OWN_BASE_URL}/products/${product._id}.png`;
      product.image = newUrl;
      await product.save();

      converted++;
      console.log(`✅ [${converted}] ${product.name || product._id} → ${newUrl}`);
    } catch (err) {
      failed++;
      console.error(`❌ فشل مع "${product.name || product._id}": ${err.message}`);
    }
  }

  console.log('\n──────── ملخص ────────');
  console.log(`اتحول: ${converted}`);
  console.log(`اتخطى (متحول قبل كده): ${skipped}`);
  console.log(`فشل: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ خطأ عام في السكريبت:', err);
  process.exit(1);
});
