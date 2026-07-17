import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import './index.css';
import App from './App.jsx';
import AppGate from './components/AppGate';
import Landing from './pages/Landing';
import Pitch from './pages/Pitch';
import Control from './pages/Control';
import Dashboard from './pages/Dashboard';
import ArtistProfile from './pages/ArtistProfile';
import TrackProfile from './pages/TrackProfile';
import AlbumProfile from './pages/AlbumProfile';
import PlaylistProfile from './pages/PlaylistProfile';
import PlaylistsPage from './pages/PlaylistsPage';
import TracksPage from './pages/TracksPage';
import ArtistsPage from './pages/ArtistsPage';
import ChartProfile from './pages/ChartProfile';
import ReportsList from './pages/ReportsList';
import ReportCenter from './pages/ReportCenter';
import ArtistSheet from './pages/ArtistSheet';
import SheetsPage from './pages/SheetsPage';
import ActionsPage from './pages/ActionsPage';
import ArtistActionsPage from './pages/ArtistActionsPage';
import AdsPage from './pages/AdsPage';
import CampaignDetail from './pages/CampaignDetail';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppGate>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pitch" element={<Pitch />} />
        <Route path="app" element={<App />}>
          <Route index element={<Control />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="actions/:artistSlug" element={<ArtistActionsPage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="artist/:id" element={<ArtistProfile />} />
          <Route path="artist/:id/sheet" element={<ArtistSheet />} />
          <Route path="track/:id" element={<TrackProfile />} />
          <Route path="album/:id" element={<AlbumProfile />} />
          <Route path="playlist/:id" element={<PlaylistProfile />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="tracks" element={<TracksPage />} />
          <Route path="artists" element={<ArtistsPage />} />
          <Route path="chart/:id" element={<ChartProfile />} />
          <Route path="sheets" element={<SheetsPage />} />
          <Route path="ads" element={<AdsPage />} />
          <Route path="ads/:id" element={<CampaignDetail />} />
          <Route path="reports" element={<ReportsList />} />
          <Route path="reports/:id" element={<ReportCenter />} />
        </Route>
      </Routes>
      </AppGate>
    </BrowserRouter>
  </StrictMode>
);
