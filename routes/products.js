const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const https = require('https');
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

async function searchImage(productName) {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: { engine: 'google_images', q: productName + ' product', api_key: SERP_API_KEY, num: 3 },
      timeout: 10000,
    });
    const images = response.data.images_results;
    if (!images || images.length === 0) return null;
    for (const img of images) {
      if (img.original && img.original.startsWith('http')) return img.original;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function downloadImage(url) {
  const tmpFile = path.join(os.tmpdir(), `zad_${Date.now()}.jpg`);
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const file = fs.createWriteStream(tmpFile);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpFile); });
    }).on('error', (err) => { fs.unlink(tmpFile, () => {}); reject(err); });
  });
}

async function uploadToCloudinary(imagePath, productName) {
  try {
    const result = await cloudinary.uploader.upload(imagePath, {
      folder: 'zad_products',
      public_id: productName.replace(/\s+/g, '_').substring(0, 50),
      overwrite: false,
      transformation: [{ width: 800, height: 800, crop: 'fill', gravity: 'auto' }, { quality: 'auto', fetch_format: 'auto' }],
    });
    return result.secure_url;
  } catch (err) {
    return null;
  }
}

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
      {
        $group: {
          _id: "$sub_category",
          products: { $push: "$$ROOT" },
          sub_category_order: { $first: "$sub_category_order" }
        }
      },
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

// ✅ route رفع الصور
router.get('/admin/upload-images', async (req, res) => {
  res.json({ message: '🚀 بدأ رفع الصور في الخلفية...' });

  const products = await Product.find({
    $or: [{ image: '' }, { image: null }, { image: { $exists: false } }],
  }).limit(BATCH_LIMIT);

  let success = 0, failed = 0;

  for (const product of products) {
    const imageUrl = await searchImage(product.name);
    if (!imageUrl) { failed++; continue; }

    let tmpFile;
    try { tmpFile = await downloadImage(imageUrl); }
    catch { failed++; continue; }

    const cloudUrl = await uploadToCloudinary(tmpFile, product.name);
    fs.unlink(tmpFile, () => {});

    if (!cloudUrl) { failed++; continue; }

    await Product.updateOne({ _id: product._id }, { $set: { image: cloudUrl } });
    success++;

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ نجح: ${success} | ❌ فشل: ${failed}`);
});

module.exports = router;