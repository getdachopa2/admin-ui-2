// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import './index.css';
import Shell from '@/shell/Shell';
import Dashboard from '@/pages/Dashboard';
import KanalKontrolBotu from '@/pages/KanalKontrolBotu';
import TestResults from '@/pages/TestResults';
import KartDurumRaporu from '@/pages/KartDurumRaporu';
import ParametreDurumKontrol from '@/pages/ParametreDurumKontrol';
import Changelog from '@/pages/Changelog';


const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'kanal-kontrol-botu', element: <KanalKontrolBotu /> },
      { path: 'test-results', element: <TestResults /> },
      { path: 'kart-durum-raporu', element: <KartDurumRaporu /> },
      { path: 'parametre-durum-kontrol', element: <ParametreDurumKontrol /> },
      { path: 'changelog', element: <Changelog /> },
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
