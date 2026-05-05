# NECTA Monitor — Serveur

Backend Express + Supabase pour NECTA Monitor.

## 🚀 Déploiement en 15 minutes (tout gratuit)

### Étape 1 — Supabase (base de données gratuite)

1. Aller sur **https://supabase.com** → "Start your project" → compte GitHub
2. New project → donner un nom → choisir une région (Europe West)
3. Une fois créé, aller dans **SQL Editor** → New query
4. Copier-coller le contenu de `schema.sql` → Run
5. Aller dans **Settings → API** :
   - Copier **Project URL** → c'est votre `SUPABASE_URL`
   - Copier **service_role** (secret) → c'est votre `SUPABASE_SERVICE_KEY`

### Étape 2 — Railway (hébergement gratuit)

1. Aller sur **https://railway.app** → compte GitHub
2. New Project → Deploy from GitHub repo
3. Connecter ce repo GitHub (ou "Deploy from local" avec la CLI)
4. Dans Variables, ajouter :
   ```
   SUPABASE_URL      = https://xxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJhb...
   JWT_SECRET        = (générez avec la commande ci-dessous)
   ```
5. Railway détecte automatiquement Node.js et lance `npm start`

**Générer JWT_SECRET :**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Étape 3 — Créer le compte superadmin

Une fois le serveur déployé, dans Railway → ouvrir un terminal :
```bash
npm run seed
```

Ou en local :
```bash
npm install
cp .env.example .env
# Remplir .env
npm run seed
```

### Étape 4 — Accéder à l'application

Railway vous donne une URL comme `https://necta-monitor.railway.app`

Connexion superadmin : `superadmin` / `necta@2025`

## 📋 Commandes utiles

```bash
npm install      # Installer les dépendances
npm run dev      # Lancer en développement (avec rechargement auto)
npm start        # Lancer en production
npm run seed     # Créer le compte superadmin (une seule fois)
```

## 💰 Coûts free tier

| Service | Limite gratuite | Votre usage estimé |
|---------|----------------|-------------------|
| Supabase | 500 MB, 50k req/jour | ~1 MB, ~500 req/jour ✅ |
| Railway | $5 crédit/mois | ~$0.50/mois ✅ |
| **Total** | **$0/mois** | **Largement suffisant** ✅ |

## 🔑 Comptes par défaut

| Rôle | Login | Mot de passe |
|------|-------|-------------|
| Super Admin | `superadmin` | `necta@2025` |

*Les comptes admin/tech sont créés depuis le Super Admin via l'interface.*
