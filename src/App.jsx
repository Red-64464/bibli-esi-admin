import { Component, lazy, Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, useIsPresent } from "motion/react";
import { useAdminMotion } from "./contexts/MotionContext";
import * as m from "motion/react-m";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Layout from "./components/Layout";
import { Loader2 } from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import { pageMotion } from "./lib/motion";

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
    <div className="flex items-center justify-center h-64" role="status" aria-label="Chargement de la page">
      <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
    </div>
  );
}

function PwaUpdateNotice() {
  useEffect(() => {
    registerSW({ immediate: true });
  }, []);
  return null;
}

function RouteContent({ pathname, navigationType, children }) {
  const content = useRef(null);
  const isPresent = useIsPresent();
  const { reduceMotion } = useAdminMotion();

  useEffect(() => {
    if (navigationType !== "POP") {
      content.current?.closest("main")?.scrollTo(0, 0);
      window.scrollTo(0, 0);
    }
  }, [pathname, navigationType]);

  return (
    <m.div
      ref={content}
      data-page-motion={pathname}
      inert={isPresent ? undefined : ""}
      {...(reduceMotion ? {} : pageMotion)}
    >
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </m.div>
  );
}

function AnimatedPages({ children }) {
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <RouteContent key={location.pathname} pathname={location.pathname} navigationType={navigationType}>
        {children(location)}
      </RouteContent>
    </AnimatePresence>
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
                    <AnimatedPages>
                      {(location) => <Routes location={location}>
                        <Route path="/" element={<Dashboard />} />
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
                      </Routes>}
                    </AnimatedPages>
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
