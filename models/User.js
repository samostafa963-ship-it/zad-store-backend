const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: Number, default: 0 },
  quantity: { type: Number, default: 1 },
}, { _id: false });

const couponSchema = new mongoose.Schema({
  code: { type: String, default: null },
  used: { type: Boolean, default: false },
  type: { type: String, default: 'free_delivery' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, minlength: 6, default: null },
  phone: { type: String, default: '' },
  googleId: { type: String, default: '' },
  avatar: { type: String, default: '' },
  favorites: [{ type: String }],
  savedAddress: { type: String, default: '' },
  savedCart: [cartItemSchema],
  coupon: { type: couponSchema, default: () => ({}) },
}, { timestamps: true });

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);