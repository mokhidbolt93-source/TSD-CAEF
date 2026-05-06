const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Champs requis' });
  }

  // Chercher l'utilisateur
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.trim())
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign(
    {
      userId:      user.id,
      username:    user.username,
      role:        user.role,
      workspaceId: user.workspace_id
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    role:        user.role,
    username:    user.username,
    userId:      user.id,
    workspaceId: user.workspace_id
  });
});

// POST /api/auth/change-password  (utilisateur connecté)
router.post('/change-password', require('../middleware/auth').requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Données invalides' });
  }

  const { data: user } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', req.user.userId)
    .single();

  const match = await bcrypt.compare(oldPassword, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await supabase.from('users').update({ password_hash: hash }).eq('id', req.user.userId);

  res.json({ ok: true });
});

module.exports = router;
