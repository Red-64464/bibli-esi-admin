import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import { useAuth } from "../contexts/AuthContext";
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
  X,
  Save,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";

const INPUT_CLASS =
  "bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-biblio-text placeholder-biblio-muted focus:outline-none focus:ring-2 focus:ring-biblio-accent w-full text-sm";

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

export default function Admins() {
  const { session } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Formulaire ajout
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    username: "",
    password: "",
    role: "admin",
  });
  const [addLoading, setAddLoading] = useState(false);

  // Formulaire changement mdp
  const [changePwdId, setChangePwdId] = useState(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("users")
        .select("id, username, role, created_at, last_login")
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
      const { error: err } = await supabase.from("users").insert([
        {
          username: addForm.username.trim(),
          password_hash: hash,
          role: addForm.role,
        },
      ]);
      if (err) throw err;

      await logActivity({
        action_type: "admin_cree",
        description: `Admin "${addForm.username.trim()}" créé`,
        user_info: session?.username || "",
      });

      setAddForm({ username: "", password: "", role: "admin" });
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
    if (
      !window.confirm(
        `Supprimer l'admin "${admin.username}" ? Cette action est irréversible.`,
      )
    )
      return;

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
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
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
          </div>

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
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-biblio-text">
                        {admin.username}
                      </span>
                      {admin.id === session?.id && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-biblio-accent/20 text-biblio-accent">
                          Vous
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-biblio-muted capitalize">
                        {admin.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
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
                          Dernière connexion :{" "}
                          {new Date(admin.last_login).toLocaleDateString(
                            "fr-FR",
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setChangePwdId(
                        changePwdId === admin.id ? null : admin.id,
                      );
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
                      onClick={() => handleDelete(admin)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-biblio-danger/10 hover:bg-biblio-danger/20 text-biblio-danger rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

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
