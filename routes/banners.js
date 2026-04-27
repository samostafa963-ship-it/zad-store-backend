const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: 'dchvb9n4n',
  api_key: '512124546259122',
  api_secret: '_mOnrmrNe2laya_57lKncQhjvwk',
});

router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const banner = new Banner(req.body);
    await banner.save();
    res.status(201).json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'zad_banners', transformation: [{ width: 1200, height: 400, crop: 'fill' }, { quality: 'auto' }] },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });
    await Banner.findByIdAndUpdate(req.params.id, { image: result.secure_url });
    res.json({ success: true, image: result.secure_url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/mini', async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    const banners = await MiniBanner.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;