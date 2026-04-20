const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'zad_secret_key';
const googleClient = new OAuth2Client();

// ── Register ──
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'يرجى ملء جميع الحقول' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    const user = new User({ name, email, password, phone });
    await user.save();
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ── Login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'يرجى إدخال البريد وكلمة المرور' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير موجود' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة المرور غلط' });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر', error: err.message });
  }
});

// ── Google Sign-In ──
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Token مطلوب' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        '213514981477-j42arsf7oo03eb9mvhi8liq78v2etvmh.apps.googleusercontent.com',
        '213514981477-2l4hcd7ohamopijd1c32090iii87pjad.apps.googleusercontent.com',
      ],
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // hash الباسورد يدوياً عشان نتجنب مشكلة الـ hook
      const hashedPassword = await bcrypt.hash(`google_${googleId}`, 10);
      user = new User({
        name,
        email,
        password: hashedPassword,
        phone: '',
        googleId,
        avatar: picture,
      });
      await user.save();
    } else {
      user.googleId = googleId;
      user.avatar = picture;
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
      }
    });
  } catch (err) {
    console.error('Google Auth Error:', err.message);
    res.status(401).json({ message: 'فشل التحقق من جوجل', error: err.message });
  }
});

module.exports = router;