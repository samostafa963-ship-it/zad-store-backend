const mongoose = require('mongoose');

const miniBannerSchema = new mongoose.Schema({
  image: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('MiniBanner', miniBannerSchema);