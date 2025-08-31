// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import Shell from '@/shell/Shell';
import Dashboard from '@/pages/Dashboard';
import KanalKontrolBotu from '@/pages/KanalKontrolBotu';
import PaymentSim from '@/pages/PaymentSim';
import KartDurumRaporu from '@/pages/KartDurumRaporu';


const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'kanal-kontrol-botu', element: <KanalKontrolBotu /> },
      // { path: 'payment-sim', element: <PaymentSim /> }, 
        { path: 'kart-durum-raporu', element: <KartDurumRaporu /> },
      { path: 'kanal-kontrol', element: <Navigate to="/kanal-kontrol-botu" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
