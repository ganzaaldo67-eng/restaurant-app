import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import StaffLayout from './pages/StaffLayout'
import CustomerOrder from './pages/CustomerOrder'
import Dashboard from './pages/Dashboard'
import MenuManagement from './pages/MenuManagement'
import TakeOrder from './pages/TakeOrder'
import ActiveOrders from './pages/ActiveOrders'
import OrderHistory from './pages/OrderHistory'
import Stock from './pages/Stock'
import Team from './pages/Team'
import Profile from './pages/Profile'
import Accounts from './pages/Accounts'
import Receipt from './pages/Receipt'

function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profile && (profile.status !== 'active' || profile.role === 'pending')) {
    return <Navigate to="/login" replace />
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/staff" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/order" element={<CustomerOrder />} />
      <Route path="/order/:table" element={<CustomerOrder />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route
          path="menu"
          element={
            <ProtectedRoute roles={['admin', 'manager']}>
              <MenuManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock"
          element={
            <ProtectedRoute roles={['admin', 'manager']}>
              <Stock />
            </ProtectedRoute>
          }
        />
        <Route
          path="team"
          element={
            <ProtectedRoute roles={['admin', 'manager']}>
              <Team />
            </ProtectedRoute>
          }
        />
        <Route
          path="accounts"
          element={
            <ProtectedRoute
              roles={['admin', 'manager', 'accountant', 'operations_manager']}
            >
              <Accounts />
            </ProtectedRoute>
          }
        />
        <Route path="receipt/:id" element={<Receipt />} />
        <Route path="take-order" element={<TakeOrder />} />
        <Route path="active" element={<ActiveOrders />} />
        <Route path="history" element={<OrderHistory />} />
      </Route>

      <Route path="/" element={<Navigate to="/order" replace />} />
      <Route path="*" element={<Navigate to="/order" replace />} />
    </Routes>
  )
}