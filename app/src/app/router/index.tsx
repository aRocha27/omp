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
import { OrderCreatePage } from '@/features/orders/components/order-create-page'
import { InvoicingPage } from '@/features/invoicing/invoicing-page'
import { StockPage } from '@/features/stock/stock-page'
import { ReportsPage } from '@/features/reports/reports-page'
import { SettingsPage } from '@/features/settings/settings-page'

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
        element: <InvoicingPage />,
      },
      {
        path: '/recognition',
        element: <RecognitionPage />,
      },
      {
        path: '/stock',
        element: <StockPage />,
      },
      {
        path: '/reports',
        element: (
          <ReportsPage />
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
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
