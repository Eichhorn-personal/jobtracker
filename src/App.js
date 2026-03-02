import { Routes, Route, Navigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DataTable from "./components/DataTable";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import SiteAdminPage from "./pages/SiteAdminPage";
import LogsPage from "./pages/LogsPage";
import ProfilePage from "./pages/ProfilePage";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function SiteAdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.username !== "ceichhorn@gmail.com") return <Navigate to="/" replace />;
  return children;
}

function PageLayout({ children }) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <a href="#main-content" className="visually-hidden-focusable">Skip to main content</a>
      <Header />
      <main id="main-content" className="flex-grow-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PageLayout>
                <Container className="pt-3">
                  <DataTable />
                </Container>
              </PageLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <PageLayout>
                <AdminPage />
              </PageLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/site-admin"
          element={
            <SiteAdminRoute>
              <PageLayout>
                <SiteAdminPage />
              </PageLayout>
            </SiteAdminRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <AdminRoute>
              <PageLayout>
                <LogsPage />
              </PageLayout>
            </AdminRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PageLayout>
                <ProfilePage />
              </PageLayout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
