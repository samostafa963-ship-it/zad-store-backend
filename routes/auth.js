const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'zad_secret_2026';
const client = new OAuth2Client();

// تهيئة firebase-admin لتسجيل الدخول برقم الهاتف - محمية بشرط عشان
// متتكررش لو firebase-admin أصلاً متهيأ في مكان تاني بالمشروع (زي ملف الـ FCM)
const admin = require('../firebase');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

const otpStore = new Map();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateCoupon() {
  return 'ZURA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function sendOTPEmail(email, otp, name) {
  await transporter.sendMail({
    from: `"زورا 🛍️" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'كود التحقق - زورا',
    html: `<div dir="rtl" style="font-family:Arial;max-width:400px;margin:auto;padding:30px;background:#fff;border-radius:16px;border:1px solid #eee"><h2 style="color:#E91E8C;text-align:center">زورا 🛍️</h2><p>مرحباً <strong>${name}</strong>،</p><p>كود التحقق الخاص بك هو:</p><div style="background:#fce8f5;border-radius:12px;padding:20px;text-align:center;margin:20px 0"><span style="font-size:36px;font-weight:900;color:#E91E8C;letter-spacing:8px">${otp}</span></div><p style="color:#888;font-size:13px">الكود صالح لمدة 10 دقائق فقط.</p></div>`,
  });
}

router.post('/send-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'برجاء ملء جميع الحقول' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: 'البريد الإلكتروني غير صحيح' });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);
    otpStore.set(email.toLowerCase(), { otp, name, password: hashedPassword, expiresAt: Date.now() + 10 * 60 * 1000 });
    await sendOTPEmail(email, otp, name);
    res.json({ success: true, message: 'تم إرسال كود التحقق على بريدك' });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ message: 'فشل إرسال الكود، تأكد من البريد الإلكتروني' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const key = email.toLowerCase();
    const stored = otpStore.get(key);
    if (!stored) return res.status(400).json({ message: 'لم يتم إرسال كود لهذا البريد' });
    if (Date.now() > stored.expiresAt) { otpStore.delete(key); return res.status(400).json({ message: 'انتهت صلاحية الكود، أعد المحاولة' }); }
    if (stored.otp !== otp.trim()) return res.status(400).json({ message: 'الكود غير صحيح' });
    const couponCode = generateCoupon();
    const user = new User({
      name: stored.name,
      email: key,
      password: stored.password,
      coupon: { code: couponCode, used: false, type: 'free_delivery' }
    });
    await user.save();
    otpStore.delete(key);
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, coupon: user.coupon } });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ message: 'حدث خطأ، حاول مرة أخرى' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'البريد الإلكتروني غير مسجل' });
    if (!user.password) return res.status(400).json({ message: 'هذا الحساب مسجل بجوجل' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, coupon: user.coupon } });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        '213514981477-ug7u2ucq39jmnkiu6s3hofmdjaii9dfh.apps.googleusercontent.com',
        '213514981477-u193a3pu7hb2gnl4qgppu6ugloru1prd.apps.googleusercontent.com',
        '213514981477-2l4hcd7ohamopijd1c32090iii87pjad.apps.googleusercontent.com',
      ]
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const couponCode = generateCoupon();
      user = await User.create({
        name,
        email: email.toLowerCase(),
        avatar: picture,
        coupon: { code: couponCode, used: false, type: 'free_delivery' }
      });
    }
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, coupon: user.coupon } });
  } catch (err) {
    console.error('google auth error:', err);
    res.status(500).json({ message: 'فشل تسجيل الدخول بجوجل', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// تسجيل الدخول برقم الهاتف (بعد التحقق من كود الـ SMS عن طريق
// Firebase Phone Authentication جوه التطبيق نفسه)
// ═══════════════════════════════════════════════════════════════
router.post('/firebase-phone', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken مطلوب' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const phone = decoded.phone_number;

    if (!phone) {
      return res.status(400).json({ message: 'مفيش رقم هاتف في الـ token ده' });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      const couponCode = generateCoupon();
      user = await User.create({
        phone,
        name: '',
        coupon: { code: couponCode, used: false, type: 'free_delivery' },
      });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        coupon: user.coupon,
      },
    });
  } catch (err) {
    console.error('firebase-phone auth error:', err);
    res.status(500).json({ message: 'تعذر التحقق من الهاتف', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// مزامنة عامة لأي مستخدم مسجّل دخول في Firebase مباشرة (إيميل/باسورد
// أو جوجل عن طريق FirebaseAuth.instance.signInWithCredential) - ده
// بيغطي حالة login_page.dart اللي بتستخدم Firebase مباشرة من غير ما
// تعدي على /google أو /login بتوعنا. بيدور على المستخدم بالإيميل أو
// رقم الهاتف المستخرجين من الـ idToken، ولو مش موجود بيعمله حساب جديد.
//
// ⚠️ بيدور كمان بالإيميل الوهمي المولّد (uid@firebase.local) قبل ما
// يعمل حساب جديد - عشان لو الحساب اتعمل قبل كده بنفس الـ uid (من خلال
// /firebase-phone أو محاولة sync سابقة) بصيغة رقم هاتف مختلفة شكليًا
// (زي +20 بدل الصفر)، منحاولش نعمله حساب تاني بنفس الإيميل الوهمي
// فيدّي duplicate key error زي اللي كان بيحصل.
// ═══════════════════════════════════════════════════════════════
router.post('/firebase-sync', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken مطلوب' });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    const phone = decoded.phone_number;
    const name = decoded.name || '';
    const avatar = decoded.picture || '';
    const fallbackEmail = `${decoded.uid}@firebase.local`;

    let user = null;
    if (email) user = await User.findOne({ email: email.toLowerCase() });
    if (!user && phone) user = await User.findOne({ phone });
    // فحص إضافي: نفس الـ uid يمكن يكون له حساب اتعمل قبل كده بإيميل وهمي
    if (!user) user = await User.findOne({ email: fallbackEmail });

    if (!user) {
      const couponCode = generateCoupon();
      try {
        user = await User.create({
          name: name || 'مستخدم زورا',
          // الحقل مطلوب وunique في الموديل - لو مفيش إيميل حقيقي (تسجيل
          // بالهاتف بس) بنستخدم إيميل وهمي فريد مبني على الـ uid
          email: email ? email.toLowerCase() : fallbackEmail,
          phone: phone || '',
          avatar,
          coupon: { code: couponCode, used: false, type: 'free_delivery' },
        });
      } catch (createErr) {
        // لو حصل تصادم إيميل رغم كل الفحوصات (سباق بين طلبين في نفس
        // اللحظة)، نجيب اليوزر الموجود فعلاً بدل ما نكسر الطلب بالكامل
        if (createErr.code === 11000) {
          user = await User.findOne({
            email: email ? email.toLowerCase() : fallbackEmail,
          });
        } else {
          throw createErr;
        }
      }
    }

    if (!user) {
      return res.status(500).json({ message: 'تعذر إنشاء أو إيجاد الحساب' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        coupon: user.coupon,
      },
    });
  } catch (err) {
    console.error('firebase-sync error:', err);
    res.status(500).json({ message: 'تعذر مزامنة الحساب', error: err.message });
  }
});

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

router.put('/update', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'غير مصرح' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, phone, avatar } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;
    const user = await User.findByIdAndUpdate(decoded.id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ' });
  }
});

module.exports = router;