// ملف جديد: models/StaffLocation.js
const mongoose = require('mongoose');

const staffLocationSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  avatar: { type: String, default: '' },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StaffLocation', staffLocationSchema);