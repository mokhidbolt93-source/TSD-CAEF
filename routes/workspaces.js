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
  res.json(data || { prices: {}, thresh_crit: 15, thresh_warn: 35, notif_email: '', maintenance_days: 7, start_address: '', start_lat: null, start_lng: null });
});

// POST /api/workspaces/settings  — sauvegarder les settings
router.post('/settings', requireAuth, async (req, res) => {
  const { prices, thresh_crit, thresh_warn, notif_email, maintenance_days, start_address, start_lat, start_lng } = req.body;
  const payload = {
    workspace_id:      req.user.workspaceId,
    prices:            prices || {},
    thresh_crit:       thresh_crit ?? 15,
    thresh_warn:       thresh_warn ?? 35,
    notif_email:       notif_email !== undefined ? notif_email : null,
    maintenance_days:  maintenance_days !== undefined ? parseInt(maintenance_days) : 7,
    start_address:     start_address || '',
    start_lat:         start_lat ? parseFloat(start_lat) : null,
    start_lng:         start_lng ? parseFloat(start_lng) : null
  };
  await supabase.from('workspace_settings').upsert(payload, { onConflict: 'workspace_id' });
  res.json({ ok: true });
});

// ══ POSITION GPS DES TECHNICIENS ══

// POST /api/workspaces/tech-position  — technicien envoie sa position
router.post('/tech-position', requireAuth, async (req, res) => {
  if (req.user.role !== 'tech') return res.status(403).json({ error: 'Réservé aux techniciens' });
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng requis' });

  // Stocker dans interventions (type 'gps_position', machine_id = userId)
  const { error } = await supabase.from('interventions').insert({
    workspace_id: req.user.workspaceId,
    machine_id:   req.user.userId,
    machine_name: req.user.username,
    type:         'gps_position',
    detail:       { lat: parseFloat(lat), lng: parseFloat(lng) },
    done_by:      req.user.username,
    done_at:      new Date().toISOString()
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// GET /api/workspaces/tech-positions  — admin récupère les dernières positions
router.get('/tech-positions', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data } = await supabase
    .from('interventions')
    .select('done_by, machine_id, detail, done_at')
    .eq('workspace_id', req.user.workspaceId)
    .eq('type', 'gps_position')
    .order('done_at', { ascending: false })
    .limit(200);

  // Garder uniquement la dernière position par technicien
  const latest = {};
  (data || []).forEach(r => {
    if (!latest[r.done_by]) latest[r.done_by] = r;
  });
  res.json(Object.values(latest));
});

// ══ GESTION DES TECHNICIENS (admin only) ══

// GET /api/workspaces/techs  — liste les techniciens du workspace courant
router.get('/techs', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data, error } = await supabase
    .from('users')
    .select('id, username, created_at')
    .eq('workspace_id', req.user.workspaceId)
    .eq('role', 'tech')
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// POST /api/workspaces/techs  — créer un nouveau technicien
router.post('/techs', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Identifiant et mot de passe (4 car. min) requis' });
  }
  const { data: existing } = await supabase.from('users').select('id').eq('username', username.trim()).maybeSingle();
  if (existing) return res.status(409).json({ error: 'Identifiant déjà utilisé' });

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('users').insert({
    workspace_id:  req.user.workspaceId,
    username:      username.trim(),
    password_hash: hash,
    role:          'tech'
  }).select('id, username').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, tech: data });
});

// PUT /api/workspaces/techs/:id  — modifier un technicien (nom et/ou mot de passe)
router.put('/techs/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data: tech } = await supabase.from('users').select('id').eq('id', req.params.id).eq('workspace_id', req.user.workspaceId).eq('role', 'tech').maybeSingle();
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });

  const { username, password } = req.body;
  const upd = {};
  if (username) upd.username = username.trim();
  if (password && password.length >= 4) upd.password_hash = await bcrypt.hash(password, 10);
  if (!Object.keys(upd).length) return res.status(400).json({ error: 'Rien à modifier' });

  const { error } = await supabase.from('users').update(upd).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /api/workspaces/techs/:id  — supprimer un technicien
router.delete('/techs/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.isSuperAdmin) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { data: tech } = await supabase.from('users').select('id').eq('id', req.params.id).eq('workspace_id', req.user.workspaceId).eq('role', 'tech').maybeSingle();
  if (!tech) return res.status(404).json({ error: 'Technicien introuvable' });

  await supabase.from('users').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
