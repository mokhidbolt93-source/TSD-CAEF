const router = require('express').Router();
const { supabase } = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

// GET /api/state — charger toutes les données du workspace
router.get('/', requireAuth, async (req, res) => {
  const wsId = req.user.workspaceId;
  if (!wsId) return res.json({ machines: {}, prices: {}, threshCrit: 15, threshWarn: 35, refillLog: [] });

  const { data: ws } = await supabase
    .from('workspaces')
    .select('state')
    .eq('id', wsId)
    .single();

  res.json(ws?.state || { machines: {}, prices: {}, threshCrit: 15, threshWarn: 35, refillLog: [] });
});

// POST /api/state — sauvegarder toutes les données
router.post('/', requireAuth, async (req, res) => {
  const wsId = req.user.workspaceId;
  if (!wsId) return res.status(400).json({ error: 'Workspace requis' });

  const { machines, prices, threshCrit, threshWarn, refillLog } = req.body;

  await supabase
    .from('workspaces')
    .update({
      state: { machines, prices, threshCrit, threshWarn, refillLog },
      updated_at: new Date().toISOString()
    })
    .eq('id', wsId);

  res.json({ ok: true, savedAt: new Date().toISOString() });
});

module.exports = router;
