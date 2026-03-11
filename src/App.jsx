import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Livres from "./pages/Livres";
import Etudiants from "./pages/Etudiants";
import Prets from "./pages/Prets";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/livres" element={<Livres />} />
        <Route path="/etudiants" element={<Etudiants />} />
        <Route path="/prets" element={<Prets />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
