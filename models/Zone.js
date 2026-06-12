const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  deliveryFee: { type: Number, required: true, default: 20 },
  minTime: { type: Number, default: 30 },
  maxTime: { type: Number, default: 60 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Zone', zoneSchema);