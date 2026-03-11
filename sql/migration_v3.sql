-- ============================================================
-- Bibl'ESI – Migration v3 : Système de rôles
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- Renommer les anciens rôles vers les nouvelles valeurs :
--   "superadmin" → "super_admin"
--   "admin"      → "super_admin" (pour ne pas bloquer les comptes existants)
UPDATE users SET role = 'super_admin' WHERE role IN ('admin', 'superadmin');

-- RLS : autoriser les opérations INSERT / UPDATE / DELETE sur users
-- Note : cette application utilise une authentification personnalisée (bcrypt +
-- localStorage) et non Supabase Auth. La clé anon est utilisée pour toutes les
-- requêtes ; les permissions applicatives sont donc gérées côté client via
-- ProtectedRoute et RoleRoute. Les politiques USING(true) reproduisent le même
-- modèle que les autres tables du projet (activity_logs, settings, etc.).
DROP POLICY IF EXISTS "allow_insert_users" ON users;
CREATE POLICY "allow_insert_users" ON users FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "allow_update_users" ON users;
CREATE POLICY "allow_update_users" ON users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "allow_delete_users" ON users;
CREATE POLICY "allow_delete_users" ON users FOR DELETE USING (true);
