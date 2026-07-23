const AppSettings = require('../models/AppSettings');

// GET /api/settings/public — anyone can read public settings (signup reward, etc.)
exports.getPublicSettings = async (req, res, next) => {
  try {
    const [signupReward, referralBonusPercent, referralDurationDays, maxReferralsPerUser, referralIPRestriction, minWithdrawalAmount] = await Promise.all([
      AppSettings.getSetting('signupReward', 0),
      AppSettings.getSetting('referralBonusPercent', 10),
      AppSettings.getSetting('referralDurationDays', 30),
      AppSettings.getSetting('maxReferralsPerUser', 50),
      AppSettings.getSetting('referralIPRestriction', true),
      AppSettings.getSetting('minWithdrawalAmount', 200),
    ]);
    res.json({
      success: true,
      signupReward: Number(signupReward),
      referralBonusPercent: Number(referralBonusPercent),
      referralDurationDays: Number(referralDurationDays),
      maxReferralsPerUser: Number(maxReferralsPerUser),
      referralIPRestriction: String(referralIPRestriction) === 'true',
      minWithdrawalAmount: Number(minWithdrawalAmount),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/settings — admin reads all settings
exports.getAllSettings = async (req, res, next) => {
  try {
    const docs = await AppSettings.find().sort('key').lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

// PUT /api/settings — admin updates settings
exports.updateSettings = async (req, res, next) => {
  try {
    const { signupReward, referralBonusPercent, referralDurationDays, maxReferralsPerUser, referralIPRestriction, minWithdrawalAmount } = req.body;

    if (signupReward !== undefined) {
      const val = Number(signupReward);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, message: 'signupReward must be a non-negative number' });
      }
      await AppSettings.setSetting('signupReward', val);
    }

    if (referralBonusPercent !== undefined) {
      const val = Number(referralBonusPercent);
      if (isNaN(val) || val < 0 || val > 100) {
        return res.status(400).json({ success: false, message: 'referralBonusPercent must be 0-100' });
      }
      await AppSettings.setSetting('referralBonusPercent', val);
    }

    if (referralDurationDays !== undefined) {
      const val = Number(referralDurationDays);
      if (isNaN(val) || val < 1 || val > 365) {
        return res.status(400).json({ success: false, message: 'referralDurationDays must be 1-365' });
      }
      await AppSettings.setSetting('referralDurationDays', val);
    }

    if (maxReferralsPerUser !== undefined) {
      const val = Number(maxReferralsPerUser);
      if (isNaN(val) || val < 1 || val > 1000) {
        return res.status(400).json({ success: false, message: 'maxReferralsPerUser must be 1-1000' });
      }
      await AppSettings.setSetting('maxReferralsPerUser', val);
    }

    if (referralIPRestriction !== undefined) {
      await AppSettings.setSetting('referralIPRestriction', !!referralIPRestriction);
    }

    if (minWithdrawalAmount !== undefined) {
      const val = Number(minWithdrawalAmount);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ success: false, message: 'minWithdrawalAmount must be a non-negative number' });
      }
      await AppSettings.setSetting('minWithdrawalAmount', val);
    }

    // Return updated settings
    const docs = await AppSettings.find().sort('key').lean();
    const settings = {};
    docs.forEach(d => { settings[d.key] = d.value; });
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};
