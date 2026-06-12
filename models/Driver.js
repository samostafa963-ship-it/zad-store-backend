const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
  zone: { type: String, default: '' },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  totalDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);