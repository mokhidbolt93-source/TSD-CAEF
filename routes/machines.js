const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../db/supabase');

// GET /api/machines  — récupérer toutes les machines du workspace
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('workspace_id', req.user.workspaceId);
  if (error) return res.status(500).json({ error: error.message });
  // Transformer le tableau en objet { id: machine }
  const obj = {};
  (data || []).forEach(m => { obj[m.machine_id] = m.data; });
  res.json(obj);
});

// POST /api/machines  — sauvegarder une machine
router.post('/', requireAuth, async (req, res) => {
  const { id, data: machineData } = req.body;
  if (!id) return res.status(400).json({ error: 'ID requis' });

  const { error } = await supabase.from('machines').upsert({
    workspace_id: req.user.workspaceId,
    machine_id:   id,
    data:         machineData,
    updated_at:   new Date().toISOString()
  }, { onConflict: 'workspace_id,machine_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// POST /api/machines/bulk  — sauvegarder toutes les machines d'un coup
router.post('/bulk', requireAuth, async (req, res) => {
  const { machines } = req.body;
  if (!machines || typeof machines !== 'object') {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const rows = Object.entries(machines).map(([id, data]) => ({
    workspace_id: req.user.workspaceId,
    machine_id:   id,
    data:         data,
    updated_at:   new Date().toISOString()
  }));

  if (!rows.length) return res.json({ ok: true });

  const { error } = await supabase.from('machines')
    .upsert(rows, { onConflict: 'workspace_id,machine_id' });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, saved: rows.length });
});

// DELETE /api/machines/:id  — supprimer une machine
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('machines')
    .delete()
    .eq('workspace_id', req.user.workspaceId)
    .eq('machine_id',   req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
