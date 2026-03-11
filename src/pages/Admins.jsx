import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
import { ALL_PERMISSIONS } from "../contexts/PermissionsContext";
import ConfirmModal from "../components/ConfirmModal";
import bcrypt from "bcryptjs";
import {
  UserCog,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  ShieldCheck,
  X,
  Save,
  Eye,
  EyeOff,
  Clock,
  Pencil,
  Mail,
} from "lucide-react";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  librarian: "Bibliothécaire",
};

const PERMISSION_CATEGORIES = [
  { label: "🏠 Dashboard", keys: ["dashboard"] },
  {
    label: "📚 Livres",
    keys: [
      "livres_voir",
      "livres_ajouter",
      "livres_modifier",
      "livres_supprimer",
    ],
  },
  {
    label: "👩‍🎓 Étudiants",
    keys: [
      "etudiants_voir",
      "etudiants_ajouter",
      "etudiants_modifier",
      "etudiants_supprimer",
    ],
  },
  { label: "🔄 Prêts", keys: ["prets_voir", "prets_creer", "prets_retourner"] },
  { label: "📈 Statistiques", keys: ["statistiques"] },
  { label: "🔔 Notifications", keys: ["notifications"] },
  { label: "📜 Historique", keys: ["historique"] },
  { label: "🔖 Réservations", keys: ["reservations"] },
];

const PERMISSION_LABELS = {
  dashboard: "voir",
  livres_voir: "voir",
  livres_ajouter: "ajouter",
  livres_modifier: "modifier",
  livres_supprimer: "supprimer",
  etudiants_voir: "voir",
  etudiants_ajouter: "ajouter",
  etudiants_modifier: "modifier",
  etudiants_supprimer: "supprimer",
  prets_voir: "voir",
  prets_creer: "créer",
  prets_retourner: "retourner",
  statistiques: "voir",
  notifications: "voir",
  historique: "voir",
  reservations: "voir",
};

const PERM_FULL_LABELS = {
  dashboard: "Tableau de bord",
  livres_voir: "Livres – voir",
  livres_ajouter: "Livres – ajouter",
  livres_modifier: "Livres – modifier",
  livres_supprimer: "Livres – supprimer",
  etudiants_voir: "Étudiants – voir",
  etudiants_ajouter: "Étudiants – ajouter",
  etudiants_modifier: "Étudiants – modifier",
  etudiants_supprimer: "Étudiants – supprimer",
  prets_voir: "Prêts – voir",
  prets_creer: "Prêts – créer",
  prets_retourner: "Prêts – retourner",
  statistiques: "Statistiques",
  notifications: "Notifications",
  historique: "Historique",
  reservations: "Réservations",
};

const LIBRARIAN_PERM_KEYS = PERMISSION_CATEGORIES.flatMap((c) => c.keys);
const DEFAULT_PERMISSIONS = Object.fromEntries(
  LIBRARIAN_PERM_KEYS.map((k) => [k, ALL_PERMISSIONS[k] ?? false]),
);

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={INPUT_CLASS + " pr-10"}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-biblio-muted hover:text-biblio-text transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PermissionsGrid({ permissions, onChange }) {
  const grantAll = () =>
    onChange(Object.fromEntries(LIBRARIAN_PERM_KEYS.map((k) => [k, true])));
  const denyAll = () =>
    onChange(Object.fromEntries(LIBRARIAN_PERM_KEYS.map((k) => [k, false])));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-biblio-text flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-biblio-accent" />
          Permissions
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={grantAll}
            className="text-xs px-2.5 py-1 rounded-lg bg-biblio-success/10 text-biblio-success hover:bg-biblio-success/20 transition-colors"
          >
            Tout accorder
          </button>
          <button
            type="button"
            onClick={denyAll}
            className="text-xs px-2.5 py-1 rounded-lg bg-biblio-danger/10 text-biblio-danger hover:bg-biblio-danger/20 transition-colors"
          >
            Tout refuser
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        {PERMISSION_CATEGORIES.map((cat) => (
          <div key={cat.label} className="bg-white/5 rounded-lg px-3 py-2.5">
            <div className="text-xs font-semibold text-biblio-muted mb-2">
              {cat.label}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {cat.keys.map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={!!permissions[key]}
                    onChange={(e) =>
                      onChange({ ...permissions, [key]: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded accent-biblio-accent"
                  />
                  <span className="text-xs text-biblio-text">
                    {PERMISSION_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Admins() {
  const { session } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ open: false });
  const openConfirm = ({ title, message, onConfirm, danger = false }) =>
    setConfirmModal({ open: true, title, message, onConfirm, danger });
  const closeConfirm = () => setConfirmModal({ open: false });

  // Formulaire ajout
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    role: "librarian",
    permissions: { ...DEFAULT_PERMISSIONS },
  });
  const [addLoading, setAddLoading] = useState(false);

  // Formulaire changement mdp
  const [changePwdId, setChangePwdId] = useState(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Formulaire changement de rôle
  const [changeRoleId, setChangeRoleId] = useState(null);
  const [newRole, setNewRole] = useState("librarian");
  const [roleLoading, setRoleLoading] = useState(false);

  // Formulaire permissions
  const [changePermsId, setChangePermsId] = useState(null);
  const [editPerms, setEditPerms] = useState({ ...DEFAULT_PERMISSIONS });
  const [originalPerms, setOriginalPerms] = useState({
    ...DEFAULT_PERMISSIONS,
  });
  const [permsLoading, setPermsLoading] = useState(false);

  // Formulaire profil
  const [changeProfileId, setChangeProfileId] = useState(null);
  const [editProfile, setEditProfile] = useState({
    username: "",
    display_name: "",
    email: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("users")
        .select(
          "id, username, display_name, email, role, created_at, last_login, permissions",
        )
        .order("created_at", { ascending: true });
      if (err) throw err;
      setAdmins(data || []);
    } catch (err) {
      setError("Impossible de charger les admins : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 3500);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.username.trim() || !addForm.password) return;
    try {
      setAddLoading(true);
      setError("");

      const hash = await bcrypt.hash(addForm.password, 10);
      const payload = {
        username: addForm.username.trim(),
        password_hash: hash,
        role: addForm.role,
      };
      if (addForm.role === "librarian") {
        payload.permissions = addForm.permissions;
      }
      const { error: err } = await supabase.from("users").insert([payload]);
      if (err) throw err;

      await logActivity({
        action_type: "admin_cree",
        description: `Admin "${addForm.username.trim()}" créé`,
        user_info: session?.username || "",
      });

      setAddForm({
        username: "",
        password: "",
        role: "librarian",
        permissions: { ...DEFAULT_PERMISSIONS },
      });
      setShowAdd(false);
      showSuccess(`Admin "${addForm.username.trim()}" créé avec succès.`);
      await fetchAdmins();
    } catch (err) {
      setError("Erreur lors de la création : " + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (admin) => {
    if (admin.id === session?.id) {
      setError("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }
    openConfirm({
      title: "Supprimer l'administrateur",
      message: `Supprimer l'admin "${admin.username}" ? Cette action est irréversible.`,
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          const { error: err } = await supabase
            .from("users")
            .delete()
            .eq("id", admin.id);
          if (err) throw err;

          await logActivity({
            action_type: "admin_supprime",
            description: `Admin "${admin.username}" supprimé`,
            user_info: session?.username || "",
          });

          showSuccess(`Admin "${admin.username}" supprimé.`);
          await fetchAdmins();
        } catch (err) {
          setError("Erreur lors de la suppression : " + err.message);
        }
      },
    });
  };

  const handleChangePassword = async (adminId) => {
    if (!newPwd || newPwd.length < 6) {
      setError("Le nouveau mot de passe doit avoir au moins 6 caractères.");
      return;
    }
    try {
      setPwdLoading(true);
      setError("");
      const hash = await bcrypt.hash(newPwd, 10);
      const { error: err } = await supabase
        .from("users")
        .update({ password_hash: hash })
        .eq("id", adminId);
      if (err) throw err;

      setChangePwdId(null);
      setNewPwd("");
      showSuccess("Mot de passe modifié avec succès.");
    } catch (err) {
      setError("Erreur changement mot de passe : " + err.message);
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChangeRole = async (adminId) => {
    if (adminId === session?.id) {
      setError("Vous ne pouvez pas modifier votre propre rôle.");
      return;
    }
    try {
      setRoleLoading(true);
      setError("");
      const { error: err } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", adminId);
      if (err) throw err;

      const admin = admins.find((a) => a.id === adminId);
      await logActivity({
        action_type: "admin_role_modifie",
        description: `Rôle de "${admin?.username}" modifié en ${ROLE_LABELS[newRole] ?? newRole}`,
        user_info: session?.username || "",
      });

      setChangeRoleId(null);
      setNewRole("librarian");
      showSuccess("Rôle modifié avec succès.");
      await fetchAdmins();
    } catch (err) {
      setError("Erreur lors de la modification du rôle : " + err.message);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleSaveProfile = async (adminId) => {
    const newUsername = editProfile.username.trim();
    if (!newUsername) {
      setError("Le nom d'utilisateur ne peut pas être vide.");
      return;
    }
    const admin = admins.find((a) => a.id === adminId);
    try {
      setProfileLoading(true);
      setError("");
      const payload = {
        username: newUsername,
        display_name: editProfile.display_name.trim() || null,
        email: editProfile.email.trim() || null,
      };
      const { error: err } = await supabase
        .from("users")
        .update(payload)
        .eq("id", adminId);
      if (err) throw err;

      await logActivity({
        action_type: "admin_profil_modifie",
        description: `Profil de "${admin?.username}" modifié`,
        user_info: session?.username || "",
      });

      setChangeProfileId(null);
      showSuccess("Profil modifié avec succès.");
      await fetchAdmins();
    } catch (err) {
      setError("Erreur lors de la modification du profil : " + err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSavePermissions = async (adminId) => {
    try {
      setPermsLoading(true);
      setError("");
      const { error: err } = await supabase
        .from("users")
        .update({ permissions: editPerms })
        .eq("id", adminId);
      if (err) throw err;

      const admin = admins.find((a) => a.id === adminId);
      const granted = LIBRARIAN_PERM_KEYS.filter(
        (k) => editPerms[k] && !originalPerms[k],
      );
      const revoked = LIBRARIAN_PERM_KEYS.filter(
        (k) => !editPerms[k] && originalPerms[k],
      );
      const parts = [];
      if (granted.length)
        parts.push(
          `Accordées : ${granted.map((k) => PERM_FULL_LABELS[k] || k).join(", ")}`,
        );
      if (revoked.length)
        parts.push(
          `Révoquées : ${revoked.map((k) => PERM_FULL_LABELS[k] || k).join(", ")}`,
        );
      const description = `Permissions de "${admin?.username}" modifiées${
        parts.length ? ` — ${parts.join(" | ")}` : " (aucun changement)"
      }`;
      await logActivity({
        action_type: "admin_permissions_modifie",
        description,
        user_info: session?.username || "",
      });

      setChangePermsId(null);
      showSuccess("Permissions modifiées avec succès.");
      await fetchAdmins();
    } catch (err) {
      setError(
        "Erreur lors de la modification des permissions : " + err.message,
      );
    } finally {
      setPermsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Confirm modal */}
      {confirmModal.open && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          danger={confirmModal.danger}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirm}
        />
      )}
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <UserCog className="w-7 h-7 text-biblio-accent" />
            Gestion des admins
          </h1>
          <p className="text-biblio-muted mt-1 text-sm">
            {admins.length} compte{admins.length !== 1 ? "s" : ""}{" "}
            administrateur
            {admins.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setAddForm({
              username: "",
              password: "",
              role: "librarian",
              permissions: { ...DEFAULT_PERMISSIONS },
            });
            setError("");
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un admin
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-biblio-danger/10 text-biblio-danger p-4 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-biblio-success/10 text-biblio-success p-4 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Formulaire ajout */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="bg-biblio-card rounded-xl border border-white/10 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Nouvel administrateur</h2>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-biblio-muted hover:text-biblio-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Nom d'utilisateur *
              </label>
              <input
                type="text"
                value={addForm.username}
                onChange={(e) =>
                  setAddForm({ ...addForm, username: e.target.value })
                }
                placeholder="admin2"
                required
                className={INPUT_CLASS}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Mot de passe *
              </label>
              <PasswordInput
                value={addForm.password}
                onChange={(e) =>
                  setAddForm({ ...addForm, password: e.target.value })
                }
                placeholder="Min. 6 caractères"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-biblio-muted block mb-1">
                Rôle
              </label>
              <select
                value={addForm.role}
                onChange={(e) =>
                  setAddForm({ ...addForm, role: e.target.value })
                }
                className={INPUT_CLASS}
                style={{ colorScheme: "dark" }}
              >
                <option value="librarian">Bibliothécaire</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          {/* Permissions section — librarian only */}
          {addForm.role === "librarian" && (
            <div className="border border-white/10 rounded-lg p-4">
              <PermissionsGrid
                permissions={addForm.permissions}
                onChange={(perms) =>
                  setAddForm({ ...addForm, permissions: perms })
                }
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={addLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {addLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Créer
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg text-sm font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste des admins */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
        </div>
      ) : (
        <div className="bg-biblio-card rounded-xl border border-white/10 divide-y divide-white/5">
          {admins.map((admin) => (
            <div key={admin.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Infos */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-biblio-accent/20 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-biblio-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-biblio-text">
                        {admin.display_name || admin.username}
                      </span>
                      {admin.display_name && (
                        <span className="text-xs text-biblio-muted">
                          @{admin.username}
                        </span>
                      )}
                      {admin.id === session?.id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-biblio-accent/20 text-biblio-accent">
                          Vous
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-biblio-muted">
                        {ROLE_LABELS[admin.role] ?? admin.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {admin.email && (
                        <span className="text-xs text-biblio-muted flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {admin.email}
                        </span>
                      )}
                      {admin.created_at && (
                        <span className="text-xs text-biblio-muted">
                          Créé le{" "}
                          {new Date(admin.created_at).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      )}
                      {admin.last_login && (
                        <span className="text-xs text-biblio-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Connexion :{" "}
                          {new Date(admin.last_login).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const opening = changeProfileId !== admin.id;
                      setChangeProfileId(opening ? admin.id : null);
                      setChangePwdId(null);
                      setChangeRoleId(null);
                      setChangePermsId(null);
                      if (opening) {
                        setEditProfile({
                          username: admin.username,
                          display_name: admin.display_name || "",
                          email: admin.email || "",
                        });
                      }
                      setError("");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Profil
                  </button>
                  <button
                    onClick={() => {
                      setChangePwdId(
                        changePwdId === admin.id ? null : admin.id,
                      );
                      setChangeRoleId(null);
                      setChangePermsId(null);
                      setChangeProfileId(null);
                      setNewPwd("");
                      setError("");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Mot de passe
                  </button>
                  {admin.id !== session?.id && (
                    <button
                      onClick={() => {
                        setChangeRoleId(
                          changeRoleId === admin.id ? null : admin.id,
                        );
                        setChangePwdId(null);
                        setChangePermsId(null);
                        setChangeProfileId(null);
                        setNewRole(admin.role);
                        setError("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                    >
                      <UserCog className="w-3.5 h-3.5" />
                      Rôle
                    </button>
                  )}
                  {admin.role === "librarian" && (
                    <button
                      onClick={() => {
                        const opening = changePermsId !== admin.id;
                        setChangePermsId(opening ? admin.id : null);
                        setChangePwdId(null);
                        setChangeRoleId(null);
                        setChangeProfileId(null);
                        if (opening) {
                          setEditPerms({
                            ...DEFAULT_PERMISSIONS,
                            ...(admin.permissions || {}),
                          });
                        }
                        setError("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Permissions
                    </button>
                  )}
                  {admin.id !== session?.id && (
                    <button
                      onClick={() => handleDelete(admin)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-biblio-danger/10 hover:bg-biblio-danger/20 text-biblio-danger rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {/* Inline profile edit */}
              {changeProfileId === admin.id && (
                <div className="pt-2 space-y-3 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-biblio-text flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-biblio-accent" />
                    Modifier le profil
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-biblio-muted block mb-1">
                        Nom d'utilisateur (login) *
                      </label>
                      <input
                        type="text"
                        value={editProfile.username}
                        onChange={(e) =>
                          setEditProfile({
                            ...editProfile,
                            username: e.target.value,
                          })
                        }
                        placeholder="login"
                        className={INPUT_CLASS}
                        autoComplete="username"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-biblio-muted block mb-1">
                        Nom affiché
                      </label>
                      <input
                        type="text"
                        value={editProfile.display_name}
                        onChange={(e) =>
                          setEditProfile({
                            ...editProfile,
                            display_name: e.target.value,
                          })
                        }
                        placeholder="ex : Anaïs Dupont"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-biblio-muted block mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editProfile.email}
                        onChange={(e) =>
                          setEditProfile({
                            ...editProfile,
                            email: e.target.value,
                          })
                        }
                        placeholder="ex : anais@esi.dz"
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveProfile(admin.id)}
                      disabled={profileLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {profileLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setChangeProfileId(null)}
                      className="p-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Inline password change */}
              {changePwdId === admin.id && (
                <div className="flex gap-2 items-center pt-1 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <PasswordInput
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Nouveau mot de passe (min. 6 car.)"
                    />
                  </div>
                  <button
                    onClick={() => handleChangePassword(admin.id)}
                    disabled={pwdLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {pwdLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Enregistrer
                  </button>
                  <button
                    onClick={() => {
                      setChangePwdId(null);
                      setNewPwd("");
                    }}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Inline role change */}
              {changeRoleId === admin.id && (
                <div className="flex gap-2 items-center pt-1 flex-wrap">
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className={INPUT_CLASS + " flex-1 min-w-[180px]"}
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="librarian">Bibliothécaire</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <button
                    onClick={() => handleChangeRole(admin.id)}
                    disabled={roleLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {roleLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Appliquer
                  </button>
                  <button
                    onClick={() => {
                      setChangeRoleId(null);
                      setNewRole("librarian");
                    }}
                    className="p-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Inline permissions editor */}
              {changePermsId === admin.id && (
                <div className="pt-2 space-y-3 border border-white/10 rounded-lg p-4">
                  <PermissionsGrid
                    permissions={editPerms}
                    onChange={setEditPerms}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSavePermissions(admin.id)}
                      disabled={permsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 bg-biblio-accent hover:bg-biblio-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {permsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Enregistrer
                    </button>
                    <button
                      onClick={() => setChangePermsId(null)}
                      className="p-2.5 bg-white/10 hover:bg-white/20 text-biblio-text rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {admins.length === 0 && (
            <div className="p-8 text-center text-biblio-muted text-sm">
              Aucun administrateur trouvé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
