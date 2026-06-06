// ── MINI BANNERS CRUD ──
router.get('/mini', async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    const banners = await MiniBanner.find().sort({ order: 1 });
    res.json({ success: true, banners });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/mini', async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    const banner = new MiniBanner(req.body);
    await banner.save();
    res.status(201).json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/mini/:id', async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    const banner = await MiniBanner.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, banner });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/mini/:id', async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    await MiniBanner.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/mini/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    const MiniBanner = require('../models/MiniBanner');
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'zad_mini_banners', transformation: [{ width: 800, height: 400, crop: 'fill' }, { quality: 'auto' }] },
        (err, result) => err ? reject(err) : resolve(result)
      ).end(req.file.buffer);
    });
    await MiniBanner.findByIdAndUpdate(req.params.id, { image: result.secure_url });
    res.json({ success: true, image: result.secure_url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});