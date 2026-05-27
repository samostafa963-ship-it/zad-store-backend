const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'zad_secret_2026';
const client = new OAuth2Client('213514981477-2l4hcd7ohamopijd1c32090iii87pjad.apps.googleusercontent.com');

// ── Nodemailer (Gmail) ──
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // زي: zad.store.app@gmail.com
    pass: process.env.GMAIL_PASS,   // App Password من جوجل
  },
});

// OTP store مؤقت في الذاكرة
const otpStore = new Map(); // email -> { otp, name, password, expiresAt }

// ── توليد OTP ──
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── إرسال OTP ──
async function sendOTPEmail(email, otp, name) {
  await transporter.sendMail({
    from: `"زورا 🛍️" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'كود التحقق - زورا',
    html: `
      <div dir="rtl" style="font-family:Arial;max-width:400px;margin:auto;padding:30px;background:#fff;border-radius:16px;border:1px solid #eee">
        <h2 style="color:#D100BC;text-align:center">زورا 🛍️</h2>
        <p style="font-size:16px">مرحباً <strong>${name}</strong>،</p>
        <p>كود التحقق الخاص بك هو:</p>
        <div style="background:#fce8f9;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
          <span style="font-size:36px;font-weight:900;color:#D100BC;letter-spacing:8px">${otp}</span>
        </div>
        <p style="color:#888;font-size:13px">الكود صالح لمدة 10 دقائق فقط.</p>
        <p style="color:#888;font-size:13px">لو مطلبتش الكود ده، تجاهل الإيميل.</p>
      </div>
    `,
  });
}

// ── STEP 1: إرسال OTP ──
router.post('/send-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'برجاء ملء جميع الحقول' });
    }

    // validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    }

    // تأكد إن الإيميل مش مسجل
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);

    otpStore.set(email.toLowerCase(), {
      otp,
      name,
      password: hashedPassword,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 دقائق
    });

    await sendOTPEmail(email, otp, name);

    res.json({ success: true, message: 'تم إرسال كود التحقق على بريدك' });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ message: 'فشل إرسال الكود، تأكد من البريد الإلكتروني' });
  }
});

// ── STEP 2: تأكيد OTP وإنشاء الحساب ──
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const key = email.toLowerCase();
    const stored = otpStore.get(key);

    if (!stored) {
      return res.status(400).json({ message: 'لم يتم إرسال كود لهذا البريد' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({ message: 'انتهت صلاحية الكود، أعد المحاولة' });
    }
    if (stored.otp !== otp.trim()) {
      return res.status(400).json({ message: 'الكود غير صحيح' });
    }

    // إنشاء المستخدم
    const user = new User({
      name: stored.name,
      email: key,
      password: stored.password,
    });
    await user.save();
    otpStore.delete(key);

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ message: 'حدث خطأ، حاول مرة أخرى' });
  }
});

// ── تسجيل الدخول ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير مسجل' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'هذا الحساب مسجل بجوجل' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ' });
  }
});

// ── جوجل ──
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: '213514981477-2l4hcd7ohamopijd1c32090iii87pjad.apps.googleusercontent.com',
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({ name, email: email.toLowerCase(), avatar: picture });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar },
    });
  } catch (err) {
    res.status(500).json({ message: 'فشل تسجيل الدخول بجوجل' });
  }
});

// ── بيانات المستخدم ──
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'غير مصرح' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ message: 'جلسة منتهية' });
  }
});

module.exports = router;