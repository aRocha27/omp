import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { OrdersPage } from '@/features/orders/orders-page'
import { OrderDetailPage } from '@/features/orders/components/order-detail-page'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/orders', element: <OrdersPage /> },
      { path: '/orders/new', element: <PlaceholderPage title="New order" description="Create-order form lands in a later slice." /> },
      { path: '/orders/:id', element: <OrderDetailPage /> },
      { path: '/clients', element: <PlaceholderPage title="Clients" description="Client directory lands in a later slice." /> },
      { path: '/invoicing', element: <PlaceholderPage title="Factory / Invoicing" description="Invoicing workflow lands in a later slice." /> },
      { path: '/recognition', element: <PlaceholderPage title="Recognition" description="Revenue recognition rules land in a later slice." /> },
      { path: '/stock', element: <PlaceholderPage title="Stock" description="Stock management lands in a later slice." /> },
      { path: '/reports', element: <PlaceholderPage title="Reports" description="Reporting lands in a later slice." /> },
      { path: '/admin', element: <PlaceholderPage title="Administration" description="Admin tools land in a later slice." /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])