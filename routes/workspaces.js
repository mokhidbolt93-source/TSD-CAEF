const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { supabase } = require('../db/supabase');

// GET /api/workspaces  — liste tous les workspaces (superadmin)
router.get('/', requireSuperAdmin, async (req, res) => {
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Récupérer le nombre de machines par workspace
  const { data: machineCounts } = await supabase
    .from('machines')
    .select('workspace_id');

  const counts = {};
  (machineCounts || []).forEach(m => {
    counts[m.workspace_id] = (counts[m.workspace_id] || 0) + 1;
  });

  // Récupérer les users de chaque workspace
  const { data: users } = await supabase.from('users').select('*').neq('role','superadmin');
  const usersByWs = {};
  (users || []).forEach(u => {
    if (!usersByWs[u.workspace_id]) usersByWs[u.workspace_id] = [];
    usersByWs[u.workspace_id].push(u);
  });

  const result = workspaces.map(ws => ({
    ...ws,
    machineCount: counts[ws.id] || 0,
    users: (usersByWs[ws.id] || []).map(u => ({ id: u.id, username: u.username, role: u.role }))
  }));

  res.json(result);
});

// POST /api/workspaces  — créer un nouveau workspace
router.post('/', requireSuperAdmin, async (req, res) => {
  const { name, adminUsername, adminPassword, techUsername, techPassword } = req.body;
  if (!name || !adminUsername || !adminPassword || !techUsername || !techPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  // Créer le workspace
  const { data: ws, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name })
    .select()
    .single();

  if (wsError) return res.status(500).json({ error: wsError.message });

  // Créer admin + tech
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const techHash  = await bcrypt.hash(techPassword, 10);

  const { error: userError } = await supabase.from('users').insert([
    { workspace_id: ws.id, username: adminUsername, password_hash: adminHash, role: 'admin' },
    { workspace_id: ws.id, username: techUsername,  password_hash: techHash,  role: 'tech'  }
  ]);

  if (userError) return res.status(500).json({ error: userError.message });

  // Créer les settings par défaut du workspace
  await supabase.from('workspace_settings').insert({
    workspace_id: ws.id,
    prices: {},
    thresh_crit: 15,
    thresh_warn: 35
  });

  res.json({ ok: true, workspace: ws });
});

// PUT /api/workspaces/:id  — modifier un workspace
router.put('/:id', requireSuperAdmin, async (req, res) => {
  const { name, adminUsername, adminPassword, techUsername, techPassword } = req.body;
  const wsId = req.params.id;

  if (name) {
    await supabase.from('workspaces').update({ name }).eq('id', wsId);
  }

  const { data: users } = await supabase.from('users')
    .select('*').eq('workspace_id', wsId).neq('role','superadmin');

  for (const user of users || []) {
    if (user.role === 'admin' && (adminUsername || adminPassword)) {
      const upd = {};
      if (adminUsername) upd.username = adminUsername;
      if (adminPassword) upd.password_hash = await bcrypt.hash(adminPassword, 10);
      await supabase.from('users').update(upd).eq('id', user.id);
    }
    if (user.role === 'tech' && (techUsername || techPassword)) {
      const upd = {};
      if (techUsername) upd.username = techUsername;
      if (techPassword) upd.password_hash = await bcrypt.hash(techPassword, 10);
      await supabase.from('users').update(upd).eq('id', user.id);
    }
  }

  res.json({ ok: true });
});

// DELETE /api/workspaces/:id
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const wsId = req.params.id;
  await supabase.from('machines').delete().eq('workspace_id', wsId);
  await supabase.from('interventions').delete().eq('workspace_id', wsId);
  await supabase.from('workspace_settings').delete().eq('workspace_id', wsId);
  await supabase.from('users').delete().eq('workspace_id', wsId);
  await supabase.from('workspaces').delete().eq('id', wsId);
  res.json({ ok: true });
});

// POST /api/workspaces/:id/enter  — superadmin entre dans un workspace (token scopé)
router.post('/:id/enter', requireSuperAdmin, async (req, res) => {
  const { data: ws } = await supabase.from('workspaces').select('*').eq('id', req.params.id).single();
  if (!ws) return res.status(404).json({ error: 'Workspace introuvable' });

  const token = jwt.sign(
    { userId: req.user.userId, username: 'superadmin', role: 'admin', workspaceId: ws.id, isSuperAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }
  );
  res.json({ token, workspace: ws });
});

// GET /api/workspaces/settings  — récupérer les settings du workspace courant
router.get('/settings', requireAuth, async (req, res) => {
  const { data } = await supabase.from('workspace_settings')
    .select('*').eq('workspace_id', req.user.workspaceId).single();
  res.json(data || { prices: {}, thresh_crit: 15, thresh_warn: 35 });
});

// POST /api/workspaces/settings  — sauvegarder les settings
router.post('/settings', requireAuth, async (req, res) => {
  const { prices, thresh_crit, thresh_warn } = req.body;
  await supabase.from('workspace_settings').upsert({
    workspace_id: req.user.workspaceId,
    prices:       prices || {},
    thresh_crit:  thresh_crit || 15,
    thresh_warn:  thresh_warn || 35
  }, { onConflict: 'workspace_id' });
  res.json({ ok: true });
});

module.exports = router;
