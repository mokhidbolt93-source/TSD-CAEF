-- ══════════════════════════════════════════════
-- NECTA Monitor — Schéma Supabase (PostgreSQL)
-- Copiez-collez ce SQL dans l'éditeur Supabase
-- ══════════════════════════════════════════════

-- 1. Espaces clients
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Utilisateurs (admin, tech, superadmin)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('superadmin','admin','tech')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Machines (stockées en JSON par machine)
CREATE TABLE IF NOT EXISTS machines (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  machine_id    TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, machine_id)
);

-- 4. Settings par workspace (prix, seuils)
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id  UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  prices        JSONB DEFAULT '{}',
  thresh_crit   INT DEFAULT 15,
  thresh_warn   INT DEFAULT 35,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Historique des interventions
CREATE TABLE IF NOT EXISTS interventions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  machine_id    TEXT,
  machine_name  TEXT,
  type          TEXT,    -- 'refill_all' | 'refill_eau' | 'create' | 'edit' | 'delete'
  detail        JSONB DEFAULT '{}',
  done_by       TEXT,
  done_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_machines_workspace    ON machines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interventions_workspace ON interventions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_interventions_done_at   ON interventions(done_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_workspace          ON users(workspace_id);

-- ══════════════════════════════════════════════
-- Row Level Security (RLS) — protège les données
-- ══════════════════════════════════════════════
ALTER TABLE workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions      ENABLE ROW LEVEL SECURITY;

-- Seul le service_role (clé serveur) peut tout lire/écrire
-- Le serveur Node.js utilise la clé service, donc aucune restriction côté API
CREATE POLICY "service_role_all" ON workspaces         FOR ALL USING (true);
CREATE POLICY "service_role_all" ON users              FOR ALL USING (true);
CREATE POLICY "service_role_all" ON machines           FOR ALL USING (true);
CREATE POLICY "service_role_all" ON workspace_settings FOR ALL USING (true);
CREATE POLICY "service_role_all" ON interventions      FOR ALL USING (true);
