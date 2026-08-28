import { Component, lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Layout from "./components/Layout";
import { Loader2 } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

// Chargement synchrone pour la page de login (critique)
import Login from "./pages/Login";

// Lazy loading pour réduire le bundle initial
// Quand une PWA est encore ouverte pendant un déploiement, un ancien fichier de
// page peut avoir disparu. On recharge une fois afin de récupérer la version à jour.
const lazyWithUpdateRecovery = (importPage) =>
  lazy(async () => {
    try {
      const page = await importPage();
      sessionStorage.removeItem("bibliesi-reload-after-update");
      return page;
    } catch (error) {
      const alreadyReloaded = sessionStorage.getItem(
        "bibliesi-reload-after-update",
      );
      if (!alreadyReloaded) {
        sessionStorage.setItem("bibliesi-reload-after-update", "1");
        window.location.reload();
      }
      throw error;
    }
  });

const Dashboard = lazyWithUpdateRecovery(() => import("./pages/Dashboard"));
const Affluence = lazyWithUpdateRecovery(() => import("./pages/Affluence"));
const Livres = lazyWithUpdateRecovery(() => import("./pages/Livres"));
const Etudiants = lazyWithUpdateRecovery(() => import("./pages/Etudiants"));
const EtudiantDetail = lazyWithUpdateRecovery(() => import("./pages/EtudiantDetail"));
const Prets = lazyWithUpdateRecovery(() => import("./pages/Prets"));
const Notifications = lazyWithUpdateRecovery(() => import("./pages/Notifications"));
const Historique = lazyWithUpdateRecovery(() => import("./pages/Historique"));
const Statistiques = lazyWithUpdateRecovery(() => import("./pages/Statistiques"));
const Admins = lazyWithUpdateRecovery(() => import("./pages/Admins"));
const Parametres = lazyWithUpdateRecovery(() => import("./pages/Parametres"));
const Reservations = lazyWithUpdateRecovery(() => import("./pages/Reservations"));
const Calendrier = lazyWithUpdateRecovery(() => import("./pages/Calendrier"));
const RechercheGlobale = lazyWithUpdateRecovery(() => import("./pages/RechercheGlobale"));

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Erreur de chargement Bibl'ESI", error);
  }

  reloadApp = () => {
    sessionStorage.removeItem("bibliesi-reload-after-update");
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
        <section className="max-w-sm rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Mise à jour de Bibl&apos;ESI
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Une page a été mise à jour pendant votre utilisation. Relancez-la pour continuer.
          </p>
          <button
            type="button"
            onClick={this.reloadApp}
            className="mt-5 w-full rounded-xl bg-biblio-accent px-4 py-3 font-semibold text-white"
          >
            Actualiser l&apos;application
          </button>
        </section>
      </main>
    );
  }
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
    </div>
  );
}

function PwaUpdateNotice() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdateServiceWorker(() => update);
  }, []);

  if (!needRefresh || !updateServiceWorker) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl bg-slate-900 p-4 text-white shadow-2xl">
      <p className="font-semibold">Une mise à jour est prête</p>
      <p className="mt-1 text-sm text-slate-200">
        Mettez l&apos;application à jour quand vous avez terminé votre action en cours.
      </p>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="mt-3 rounded-xl bg-biblio-accent px-4 py-2 font-semibold text-white"
      >
        Mettre à jour
      </button>
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <PwaUpdateNotice />
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <PermissionsProvider>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route
                          path="/affluence"
                          element={
                            <RoleRoute requiredRole="super_admin">
                              <Affluence />
                            </RoleRoute>
                          }
                        />
                        <Route path="/livres" element={<Livres />} />
                        <Route path="/etudiants" element={<Etudiants />} />
                        <Route
                          path="/etudiants/:id"
                          element={<EtudiantDetail />}
                        />
                        <Route path="/prets" element={<Prets />} />
                        <Route
                          path="/notifications"
                          element={<Notifications />}
                        />
                        <Route path="/historique" element={<Historique />} />
                        <Route
                          path="/statistiques"
                          element={<Statistiques />}
                        />
                        <Route
                          path="/reservations"
                          element={<Reservations />}
                        />
                        <Route path="/calendrier" element={<Calendrier />} />
                        <Route
                          path="/recherche"
                          element={<RechercheGlobale />}
                        />
                        <Route
                          path="/admins"
                          element={
                            <RoleRoute requiredRole="super_admin">
                              <Admins />
                            </RoleRoute>
                          }
                        />
                        <Route
                          path="/parametres"
                          element={
                            <RoleRoute requiredRole="super_admin">
                              <Parametres />
                            </RoleRoute>
                          }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </PermissionsProvider>
              </ProtectedRoute>
            }
          />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
