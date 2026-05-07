const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { supabase } = require('../db/supabase');

// GET /api/tours — liste les tournées (admin: toutes, tech: les siennes)
router.get('/', requireAuth, async (req, res) => {
  let query = supabase
    .from('tours')
    .select('*')
    .order('tour_date', { ascending: false })
    .limit(100);

  if (req.user.role === 'tech') {
    // Tech : chercher TOUTES les tournées qui lui sont assignées (par id OU par nom)
    // Sans filtre workspace pour éviter les problèmes de workspace mismatch
    query = query.or(`tech_id.eq.${req.user.userId},tech_name.eq.${req.user.username}`);
  } else {
    // Admin : uniquement son workspace
    query = query.eq('workspace_id', req.user.workspaceId);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// GET /api/tours/today — tournée du jour pour le technicien connecté
router.get('/today', requireAuth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('tours')
    .select('*')
    .eq('workspace_id', req.user.workspaceId)
    .eq('tech_id', req.user.userId)
    .eq('tour_date', today)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

// POST /api/tours — créer une tournée (admin uniquement)
router.post('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Réservé aux admins' });
  }
  const { tech_id, tech_name, tour_date, machines, notes, start_address, start_lat, start_lng } = req.body;
  if (!tech_id || !tour_date) {
    return res.status(400).json({ error: 'tech_id et tour_date requis' });
  }

  const { data, error } = await supabase.from('tours').insert({
    workspace_id:  req.user.workspaceId,
    tech_id,
    tech_name:     tech_name || '',
    tour_date,
    machines:      machines || [],
    notes:         notes || '',
    start_address: start_address || '',
    start_lat:     start_lat || null,
    start_lng:     start_lng || null,
    status:        'pending'
  }).select().single();

  if (error) return res.status(500).json({ error: error.message });

  // Enregistrer la création dans l'historique
  await supabase.from('interventions').insert({
    workspace_id: req.user.workspaceId,
    machine_id:   tech_id,
    machine_name: tech_name || 'Technicien',
    type:         'tour_create',
    detail:       { tour_date, machine_count: (machines || []).length },
    done_by:      req.user.username,
    done_at:      new Date().toISOString()
  });

  res.json({ ok: true, tour: data });
});

// PUT /api/tours/:id — modifier une tournée
router.put('/:id', requireAuth, async (req, res) => {
  // Vérifier que la tournée appartient au workspace
  const { data: tour } = await supabase.from('tours')
    .select('*').eq('id', req.params.id).eq('workspace_id', req.user.workspaceId).single();
  if (!tour) return res.status(404).json({ error: 'Tournée introuvable' });

  const upd = {};
  // Admin peut tout modifier
  if (req.user.role === 'admin' || req.user.isSuperAdmin) {
    if (req.body.tech_id !== undefined)       upd.tech_id = req.body.tech_id;
    if (req.body.tech_name !== undefined)     upd.tech_name = req.body.tech_name;
    if (req.body.tour_date !== undefined)     upd.tour_date = req.body.tour_date;
    if (req.body.notes !== undefined)         upd.notes = req.body.notes;
    if (req.body.start_address !== undefined) upd.start_address = req.body.start_address;
    if (req.body.start_lat !== undefined)     upd.start_lat = req.body.start_lat;
    if (req.body.start_lng !== undefined)     upd.start_lng = req.body.start_lng;
  }
  // Admin et tech peuvent modifier les machines (statut) et le status global
  if (req.body.machines !== undefined) upd.machines = req.body.machines;
  if (req.body.status !== undefined)   upd.status   = req.body.status;

  if (!Object.keys(upd).length) return res.status(400).json({ error: 'Rien à modifier' });

  const { error } = await supabase.from('tours').update(upd).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/tours/:id — supprimer une tournée (admin uniquement)
router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Réservé aux admins' });
  }
  await supabase.from('tours').delete()
    .eq('id', req.params.id).eq('workspace_id', req.user.workspaceId);
  res.json({ ok: true });
});

module.exports = router;
