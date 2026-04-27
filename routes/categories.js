const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
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
    const categories = await Category.find().sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'zad_categories', transformation: [{ width: 500, height: 500, crop: 'fill' }, { quality: 'auto' }] },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });
    await Category.findByIdAndUpdate(req.params.id, { image_url: result.secure_url });
    res.json({ image_url: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;