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
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, phone });
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

// ── Send OTP ──
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'رقم الهاتف مطلوب' });
    }

    const client = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verifications.create({
        to: phone,
        channel: 'sms',
      });

    res.json({ message: 'تم إرسال الكود بنجاح' });
  } catch (err) {
    console.error('OTP Error:', err.message);
    res.status(500).json({ message: 'فشل إرسال الكود', error: err.message });
  }
});

// ── Verify OTP ──
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ message: 'رقم الهاتف والكود مطلوبان' });
    }

    const client = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const verification = await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks.create({
        to: phone,
        code,
      });

    if (verification.status !== 'approved') {
      return res.status(400).json({ message: 'الكود غلط أو منتهي' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      const hashedPassword = await bcrypt.hash(`phone_${phone}`, 10);
      user = new User({
        name: 'مستخدم جديد',
        email: `${phone.replace('+', '')}@zad.app`,
        password: hashedPassword,
        phone,
      });
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
      }
    });
  } catch (err) {
    console.error('Verify OTP Error:', err.message);
    res.status(500).json({ message: 'فشل التحقق', error: err.message });
  }
});

module.exports = router;