const express = require('express');
const router = express.Router();
const User = require('../models/User');

// ═══════════════════════════════════════════════════════════════
// نظام رصيد زورا (عملة مكافآت داخلية - مش دفع حقيقي)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/wallet/:userId
 * بيرجع الرصيد الحالي + آخر 20 عملية (للتطبيق - شاشة تفاصيل الرصيد)
 */
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      'walletBalance walletTransactions'
    );
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    const transactions = [...(user.walletTransactions || [])]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20);

    const totalEarned = (user.walletTransactions || [])
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalUsed = (user.walletTransactions || [])
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    res.json({
      success: true,
      balance: user.walletBalance || 0,
      totalEarned,
      totalUsed,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ message: 'تعذر جلب الرصيد', error: err.message });
  }
});

/**
 * POST /api/wallet/:userId/add
 * body: { amount: number, title?: string }
 * ⚠️ ده اللي هتستخدمه لوحة الأدمن (لما تتجهز) عشان تضيف رصيد لعميل.
 * amount موجب دايمًا هنا - بيتسجل كـ"مكتسب".
 */
router.post('/:userId/add', async (req, res) => {
  try {
    const { amount, title } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'المبلغ لازم يكون رقم موجب' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    user.walletBalance = (user.walletBalance || 0) + amount;
    user.walletTransactions.push({
      amount,
      title: title || 'إضافة رصيد',
      createdAt: new Date(),
    });
    await user.save();

    res.json({ success: true, balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'تعذر إضافة الرصيد', error: err.message });
  }
});

/**
 * POST /api/wallet/:userId/use
 * body: { amount: number, orderCode?: string }
 * بيخصم من الرصيد وقت استخدامه في طلب - بيرفض لو الرصيد مش كافي.
 */
router.post('/:userId/use', async (req, res) => {
  try {
    const { amount, orderCode } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'المبلغ لازم يكون رقم موجب' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if ((user.walletBalance || 0) < amount) {
      return res.status(400).json({ message: 'الرصيد غير كافٍ' });
    }

    user.walletBalance -= amount;
    user.walletTransactions.push({
      amount: -amount,
      title: 'تم استخدامه في طلب',
      orderCode: orderCode || null,
      createdAt: new Date(),
    });
    await user.save();

    res.json({ success: true, balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'تعذر خصم الرصيد', error: err.message });
  }
});

module.exports = router;