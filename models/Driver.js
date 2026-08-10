const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, default: '12345' },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
  zone: { type: String, default: '' },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  pendingOrders: [{ type: String, default: [] }],
  totalDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0 },
  isActive: { type: Boolean, default: true },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    speed: { type: Number, default: 0 }, // م/ث - سرعة حقيقية من GPS الجهاز (Position.speed)
    updatedAt: { type: Date, default: null },
  },
  shiftStartTime: { type: Date, default: null },
  firebaseUid: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);