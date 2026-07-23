const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  // مفتاح البانر/القسم اللي اتقيّم: 'vegetables' | 'meat' | 'bakery' | 'fruits' ...
  category: {
    type: String,
    required: true,
    trim: true,
  },
  // اسم عرض اختياري (لو حبيت تشوفه في الداشبورد من غير ما تدور على المفتاح)
  categoryLabel: {
    type: String,
    default: '',
  },
  stars: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  // معرف الجهاز/المستخدم (اختياري) - لو حابب تمنع نفس الجهاز يقيّم أكتر من مرة
  deviceId: {
    type: String,
    default: null,
  },
}, { timestamps: true });

ratingSchema.index({ category: 1 });

module.exports = mongoose.model('Rating', ratingSchema);