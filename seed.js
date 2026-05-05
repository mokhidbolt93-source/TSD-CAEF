// ══════════════════════════════════════
// Script de seed — crée le compte superadmin
// Lancer UNE SEULE FOIS : node seed.js
// ══════════════════════════════════════
require('dotenv').config();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function seed() {
  console.log('🌱 Démarrage du seed...');

  // Vérifier si le superadmin existe déjà
  const { data: existing } = await supabase
    .from('users').select('id').eq('username', 'superadmin').single();

  if (existing) {
    console.log('✅ Superadmin déjà créé — rien à faire.');
    process.exit(0);
  }

  const hash = await bcrypt.hash('necta@2025', 10);
  const { error } = await supabase.from('users').insert({
    workspace_id:  null,
    username:      'superadmin',
    password_hash: hash,
    role:          'superadmin'
  });

  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  console.log('✅ Superadmin créé avec succès !');
  console.log('   Login    : superadmin');
  console.log('   Password : necta@2025');
  console.log('\n⚠️  Changez le mot de passe après la première connexion.');
  process.exit(0);
}

seed();
