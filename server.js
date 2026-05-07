require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');

const { supabase }                 = require('./db/supabase');
const { sendEmail, buildAlertHtml } = require('./lib/mailer');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes API ──
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/machines',   require('./routes/machines'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/history',    require('./routes/history'));
app.use('/api/tours',      require('./routes/tours'));
app.use('/api/notify',     require('./routes/notify'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════
// CRON — Vérifications automatiques
// ══════════════════════════════════════════

/**
 * Chaque heure : vérifie les machines critiques et envoie un email si configuré.
 * Évite les doublons en ne renvoyant qu'une alerte max par heure par workspace.
 */
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Vérification des machines critiques...');
  try {
    // Récupérer tous les workspaces avec email configuré
    const { data: settingsList } = await supabase
      .from('workspace_settings')
      .select('workspace_id, notif_email, thresh_crit')
      .not('notif_email', 'is', null)
      .neq('notif_email', '');

    for (const settings of settingsList || []) {
      const thresh = settings.thresh_crit || 15;
      const { data: machines } = await supabase
        .from('machines').select('machine_id, data').eq('workspace_id', settings.workspace_id);

      const critMachines = (machines || []).filter(m => {
        const d = m.data || {};
        const levels = ['cafe','sucre','lait','choco','eau']
          .map(k => d[k]).filter(v => v !== undefined && v !== null);
        return levels.length > 0 && Math.min(...levels) < thresh;
      });

      if (critMachines.length > 0) {
        const items = critMachines.map(m => {
          const d = m.data || {};
          const minLvl = Math.min(...['cafe','sucre','lait','choco','eau']
            .map(k => d[k]).filter(v => v !== undefined && v !== null));
          return `🔴 ${d.name || m.machine_id} — niveau minimum : <strong>${minLvl}%</strong>`;
        });

        await sendEmail({
          to: settings.notif_email,
          subject: `🚨 NECTA Monitor — ${critMachines.length} machine(s) en état critique`,
          html: buildAlertHtml({
            title: `🚨 ${critMachines.length} machine(s) critique(s)`,
            subtitle: `Des machines ont des niveaux en dessous du seuil d'alerte (${thresh}%)`,
            items,
            cta: 'Voir les machines'
          })
        });
      }
    }
  } catch (e) {
    console.error('[CRON] Erreur alerte critique:', e.message);
  }
});

/**
 * Chaque jour à 8h00 : rappel de maintenance pour les machines non visitées.
 */
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Vérification des rappels de maintenance...');
  try {
    const { data: settingsList } = await supabase
      .from('workspace_settings')
      .select('workspace_id, notif_email, maintenance_days')
      .not('notif_email', 'is', null)
      .neq('notif_email', '');

    for (const settings of settingsList || []) {
      const days = settings.maintenance_days || 7;
      if (days === 0) continue; // 0 = désactivé

      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Machines du workspace
      const { data: machines } = await supabase
        .from('machines').select('machine_id, data').eq('workspace_id', settings.workspace_id);

      // Interventions récentes (done ou refill_all)
      const { data: recent } = await supabase
        .from('interventions')
        .select('machine_id')
        .eq('workspace_id', settings.workspace_id)
        .in('type', ['done', 'refill_all'])
        .gte('done_at', since);

      const visitedIds = new Set((recent || []).map(i => i.machine_id));
      const notVisited = (machines || []).filter(m => !visitedIds.has(m.machine_id));

      if (notVisited.length > 0) {
        const items = notVisited.map(m => `⚠️ ${(m.data || {}).name || m.machine_id}`);
        await sendEmail({
          to: settings.notif_email,
          subject: `⏰ NECTA Monitor — ${notVisited.length} machine(s) non visitées depuis ${days}j`,
          html: buildAlertHtml({
            title: `⏰ Rappel maintenance (${days} jours)`,
            subtitle: `Ces machines n'ont pas été visitées depuis plus de ${days} jours`,
            items,
            cta: 'Planifier une tournée'
          })
        });
      }
    }
  } catch (e) {
    console.error('[CRON] Erreur rappel maintenance:', e.message);
  }
});

// ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ NECTA Monitor server running on port ${PORT}`));
