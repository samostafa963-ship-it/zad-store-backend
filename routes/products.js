const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLOUDINARY_CLOUD_NAME = 'dchvb9n4n';
const CLOUDINARY_API_KEY = '512124546259122';
const CLOUDINARY_API_SECRET = '_mOnrmrNe2laya_57lKncQhjvwk';
const SERP_API_KEY = '0dd3ff42e909d59a4adc83634b007655146391f1746247f1c0d3551567a6052f';
const BATCH_LIMIT = 50;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

async function searchImage(productName, subCategory = '') {
  try {
    const query = `${productName} ${subCategory} product white background`;
    const response = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_images', q: query, api_key: SERP_API_KEY, num: 5, imgtype: 'photo' },
      timeout: 10000,
    });
    const images = response.data.images_results;
    if (!images || images.length === 0) return null;
    for (const img of images) {
      if (img.original && img.original.startsWith('http') && img.original_width > 200 && img.original_height > 200) {
        return img.original;
      }
    }
    return images[0]?.original || null;
  } catch (err) {
    return null;
  }
}

async function downloadImage(url) {
  const tmpFile = path.join(os.tmpdir(), `zad_${Date.now()}.jpg`);
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 15000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        fs.unlink(tmpFile, () => {});
        return downloadImage(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) { reject(new Error(`Status: ${response.statusCode}`)); return; }
      const file = fs.createWriteStream(tmpFile);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpFile); });
      file.on('error', reject);
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('timeout')); });
  });
}

async function uploadToCloudinary(imagePath, productName) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'zad_products',
      public_id: productName.replace(/\s+/g, '_').replace(/[^\w]/g, '').substring(0, 50) + '_' + Date.now(),
      transformation: [
        { width: 800, height: 800, crop: 'pad', background: 'white' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });
    return result.secure_url;
  } catch (err) {
    return null;
  }
}

let isRunning = false;

async function processBatch() {
  if (isRunning) return;
  isRunning = true;
  try {
    const products = await Product.find({
      $or: [{ image: '' }, { image: null }, { image: { $exists: false } }],
    }).limit(BATCH_LIMIT);

    if (products.length === 0) {
      console.log('✅ كل الصور اتحطت!');
      isRunning = false;
      return;
    }

    console.log(`🔄 بيشتغل على ${products.length} منتج...`);

    for (const product of products) {
      const imageUrl = await searchImage(product.name, product.sub_category || '');
      if (!imageUrl) {
        await Product.updateOne({ _id: product._id }, { $set: { image: 'no_image' } });
        continue;
      }
      let tmpFile;
      try { tmpFile = await downloadImage(imageUrl); } catch { continue; }
      const cloudUrl = await uploadToCloudinary(tmpFile, product.name);
      fs.unlink(tmpFile, () => {});
      if (!cloudUrl) continue;
      await Product.updateOne({ _id: product._id }, { $set: { image: cloudUrl } });
      console.log(`✅ ${product.name}`);
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  isRunning = false;
}

// شغل بعد 5 ثواني من الـ start
setTimeout(async () => {
  console.log('⏰ بدأ أول batch...');
  await processBatch();
}, 5000);

// كل دقيقتين تلقائي
setInterval(async () => {
  console.log('⏰ batch جديد...');
  await processBatch();
}, 2 * 60 * 1000);

router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/category/:key/grouped', async (req, res) => {
  try {
    const products = await Product.aggregate([
      { $match: { category_key: req.params.key } },
      { $group: { _id: "$sub_category", products: { $push: "$$ROOT" }, sub_category_order: { $first: "$sub_category_order" } } },
      { $sort: { sub_category_order: 1 } }
    ]);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/category/:key', async (req, res) => {
  try {
    const products = await Product.find({ category_key: req.params.key }).sort({ order: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/upload-images', async (req, res) => {
  res.json({ message: '🚀 بدأ رفع الصور...' });
  await processBatch();
});

router.get('/admin/image-stats', async (req, res) => {
  try {
    const total = await Product.countDocuments();
    const withImage = await Product.countDocuments({ image: { $nin: ['', null, 'no_image'] } });
    const noImage = await Product.countDocuments({ $or: [{ image: '' }, { image: null }, { image: { $exists: false } }] });
    res.json({ total, withImage, noImage, percentage: Math.round((withImage / total) * 100) + '%' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;