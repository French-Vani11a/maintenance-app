import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MaintenanceRecords from './pages/MaintenanceRecords'
import RecordForm from './pages/RecordForm'
import EquipmentManagement from './pages/EquipmentManagement'
import ImportPage from './pages/ImportPage'
import Reports from './pages/Reports'
import UsersManagement from './pages/UsersManagement'
import ChangePassword from './pages/ChangePassword'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="records" element={<MaintenanceRecords />} />
            <Route path="records/new" element={<RecordForm />} />
            <Route path="records/:id/edit" element={<RecordForm />} />
            <Route path="equipment" element={<EquipmentManagement />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="reports" element={<Reports />} />
            <Route
              path="change-password"
              element={
                <ProtectedRoute generalOnly>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute adminOnly>
                  <UsersManagement />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
