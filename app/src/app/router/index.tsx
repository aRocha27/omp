import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { AdminRoute } from '@/components/layout/admin-route'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { OrdersPage } from '@/features/orders/orders-page'
import { OrderDetailPage } from '@/features/orders/components/order-detail-page'
import { ClientsPage } from '@/features/clients/clients-page'
import { ClientDetailPage } from '@/features/clients/components/client-detail-page'
import { ClientCreatePage } from '@/features/clients/components/client-create-page'
import { AdministrationPage } from '@/features/administration/administration-page'
import { RecognitionPage } from '@/features/recognition/recognition-page'
import { PlaceholderPage } from '@/components/layout/placeholder-page'
import { OrderCreatePage } from '@/features/orders/components/order-create-page'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/orders', element: <OrdersPage /> },
      {
        path: '/orders/new',
        element: <OrderCreatePage />,
      },
      { path: '/orders/:id', element: <OrderDetailPage /> },
      { path: '/clients', element: <ClientsPage /> },
      { path: '/clients/new', element: <ClientCreatePage /> },
      { path: '/clients/:id', element: <ClientDetailPage /> },
      {
        path: '/invoicing',
        element: (
          <PlaceholderPage
            title="Factory / Invoicing"
            description="Invoicing workflow lands in a later slice."
          />
        ),
      },
      {
        path: '/recognition',
        element: <RecognitionPage />,
      },
      {
        path: '/stock',
        element: (
          <PlaceholderPage title="Stock" description="Stock management lands in a later slice." />
        ),
      },
      {
        path: '/reports',
        element: (
          <PlaceholderPage title="Reports" description="Reporting lands in a later slice." />
        ),
      },
      {
        path: '/admin',
        element: (
          <AdminRoute>
            <AdministrationPage />
          </AdminRoute>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
