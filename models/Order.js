const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  paymentMethod: { type: String, enum: ['cash', 'online'], default: 'cash' },
  notes: { type: String, default: '' },
  items: [
    {
      productId: String,
      name: String,
      price: Number,
      quantity: Number,
      total: Number,
    }
  ],
  subtotal: { type: Number, required: true },
  delivery: { type: Number, default: 20 },
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'delivering', 'completed', 'cancelled'],
    default: 'pending'
  },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);