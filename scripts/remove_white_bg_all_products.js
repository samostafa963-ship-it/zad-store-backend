/**
 * scripts/remove_white_bg_all_products.js
 *
 * بيطبق نفس منطق التجربة اللي شفتها كويسة (test_remove_white_bg_sample.js)
 * على كل المنتجات: بيشيل الخلفية البيضا من صورة كل منتج، يحفظها في
 * public/products/<id>.png على سيرفرك، ويحدّث حقل image في المنتج.
 *
 * آمن للتشغيل أكتر من مرة: أي منتج صورته أصلاً على سيرفرك (يعني
 * اتعالج قبل كده) هيتخطاه تلقائيًا.
 *
 * تشغيله:
 *   node scripts/remove_white_bg_all_products.js
 */

require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');

const OWN_BASE_URL = 'https://zad-backend-production-39a3.up.railway.app';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'products');
const WHITE_THRESHOLD = 232; // خط دفاع إضافي: أي أبيض نقي فعلي بيتشال دايمًا
const COLOR_TOLERANCE = 26; // أقصى فرق لوني عن لون الركن عشان يتحسب "خلفية"

function removeWhiteBackground(data, width, height) {
  // بنسمع لون الخلفية الحقيقي من متوسط الأركان الأربعة (بدل ما نفترض
  // إنه أبيض نقي بالظبط) - كده بتشتغل مع أي درجة (كريمي، ظل خفيف، ...)
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const idx of corners) {
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR /= corners.length;
  bgG /= corners.length;
  bgB /= corners.length;

  const isBackground = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // أبيض نقي فعلي - يتشال دايمًا بغض النظر عن لون الركن
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      return true;
    }
    // قريب من لون خلفية الصورة دي بالتحديد (كريمي/رمادي فاتح/... إلخ)
    const dr = r - bgR;
    const dg = g - bgG;
    const db = b - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db) <= COLOR_TOLERANCE;
  };

  const visited = new Uint8Array(width * height);
  const queue = [];

  const pushIfBackground = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    const idx = pos * 4;
    if (isBackground(idx)) {
      visited[pos] = 1;
      queue.push(pos);
    }
  };

  for (let x = 0; x < width; x++) {
    pushIfBackground(x, 0);
    pushIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    pushIfBackground(0, y);
    pushIfBackground(width - 1, y);
  }

  while (queue.length) {
    const pos = queue.shift();
    const x = pos % width;
    const y = Math.floor(pos / width);
    pushIfBackground(x - 1, y);
    pushIfBackground(x + 1, y);
    pushIfBackground(x, y - 1);
    pushIfBackground(x, y + 1);
  }

  for (let pos = 0; pos < width * height; pos++) {
    if (visited[pos]) {
      data[pos * 4 + 3] = 0;
    }
  }

  return data;
}

async function processOne(product) {
  const res = await fetch(product.image);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const processed = removeWhiteBackground(data, info.width, info.height);

  const outPath = path.join(OUTPUT_DIR, `${product._id}.png`);
  await sharp(processed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(outPath);

  const newUrl = `${OWN_BASE_URL}/products/${product._id}.png`;
  product.image = newUrl;
  await product.save();

  return newUrl;
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('✅ متصل بـ MongoDB');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const products = await Product.find({ image: { $exists: true, $ne: '' } });
  console.log(`عدد المنتجات اللي عندها صورة: ${products.length}`);

  let converted = 0;
  let failed = 0;

  for (const product of products) {
    try {
      const newUrl = await processOne(product);
      converted++;
      console.log(`✅ [${converted}] ${product.name} → ${newUrl}`);
    } catch (err) {
      failed++;
      console.error(`❌ فشل مع "${product.name}": ${err.message}`);
    }
  }

  console.log('\n──────── ملخص ────────');
  console.log(`اتحول: ${converted}`);
  console.log(`فشل: ${failed}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ خطأ عام:', err);
  process.exit(1);
});
