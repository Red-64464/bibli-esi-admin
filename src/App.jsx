import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Layout from "./components/Layout";
import { Loader2 } from "lucide-react";

// Chargement synchrone pour la page de login (critique)
import Login from "./pages/Login";

// Lazy loading pour réduire le bundle initial
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Livres = lazy(() => import("./pages/Livres"));
const Etudiants = lazy(() => import("./pages/Etudiants"));
const EtudiantDetail = lazy(() => import("./pages/EtudiantDetail"));
const Prets = lazy(() => import("./pages/Prets"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Historique = lazy(() => import("./pages/Historique"));
const Statistiques = lazy(() => import("./pages/Statistiques"));
const Admins = lazy(() => import("./pages/Admins"));
const Parametres = lazy(() => import("./pages/Parametres"));
const Reservations = lazy(() => import("./pages/Reservations"));
const Calendrier = lazy(() => import("./pages/Calendrier"));
const RechercheGlobale = lazy(() => import("./pages/RechercheGlobale"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-biblio-accent" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
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
  );
}

export default App;

