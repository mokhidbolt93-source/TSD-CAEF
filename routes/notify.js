const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { sendEmail, buildAlertHtml } = require('../lib/mailer');

// POST /api/notify/test — envoyer un email de test
router.post('/test', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  try {
    await sendEmail({
      to: email,
      subject: '✅ NECTA Monitor — Test de notification',
      html: buildAlertHtml({
        title: '✅ Notifications configurées',
        subtitle: 'Vous recevrez désormais des alertes automatiques depuis NECTA Monitor.',
        items: [
          '🚨 Alerte critique : machine en dessous du seuil critique',
          '⏰ Rappel de maintenance : machine non visitée depuis X jours'
        ],
        cta: 'Accéder au tableau de bord'
      })
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
