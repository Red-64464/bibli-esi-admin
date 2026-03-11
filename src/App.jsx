import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Livres from "./pages/Livres";
import Etudiants from "./pages/Etudiants";
import Prets from "./pages/Prets";
import Notifications from "./pages/Notifications";
import Historique from "./pages/Historique";
import Statistiques from "./pages/Statistiques";
import Admins from "./pages/Admins";
import Parametres from "./pages/Parametres";
import Login from "./pages/Login";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/livres" element={<Livres />} />
                  <Route path="/etudiants" element={<Etudiants />} />
                  <Route path="/prets" element={<Prets />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/historique" element={<Historique />} />
                  <Route path="/statistiques" element={<Statistiques />} />
                  <Route path="/admins" element={<RoleRoute requiredRole="super_admin"><Admins /></RoleRoute>} />
                  <Route path="/parametres" element={<RoleRoute requiredRole="super_admin"><Parametres /></RoleRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
