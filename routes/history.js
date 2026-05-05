const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../db/supabase');

// GET /api/history  — récupérer l'historique des interventions
router.get('/', requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const { data, error } = await supabase
    .from('interventions')
    .select('*')
    .eq('workspace_id', req.user.workspaceId)
    .order('done_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/history  — enregistrer une intervention
router.post('/', requireAuth, async (req, res) => {
  const { machine_id, machine_name, type, detail } = req.body;

  const { error } = await supabase.from('interventions').insert({
    workspace_id: req.user.workspaceId,
    machine_id,
    machine_name,
    type,             // 'refill_all' | 'refill_eau' | 'edit' | 'delete' | 'create'
    detail:   detail || {},
    done_by:  req.user.username,
    done_at:  new Date().toISOString()
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
