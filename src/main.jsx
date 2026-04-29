import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import './index.css';
import App from './App.jsx';
import Control from './pages/Control';
import Dashboard from './pages/Dashboard';
import ArtistProfile from './pages/ArtistProfile';
import TrackProfile from './pages/TrackProfile';
import AlbumProfile from './pages/AlbumProfile';
import PlaylistProfile from './pages/PlaylistProfile';
import PlaylistsPage from './pages/PlaylistsPage';
import TracksPage from './pages/TracksPage';
import ChartProfile from './pages/ChartProfile';
import ReportsList from './pages/ReportsList';
import ReportCenter from './pages/ReportCenter';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Control />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="artist/:id" element={<ArtistProfile />} />
          <Route path="track/:id" element={<TrackProfile />} />
          <Route path="album/:id" element={<AlbumProfile />} />
          <Route path="playlist/:id" element={<PlaylistProfile />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="tracks" element={<TracksPage />} />
          <Route path="chart/:id" element={<ChartProfile />} />
          <Route path="reports" element={<ReportsList />} />
          <Route path="reports/:id" element={<ReportCenter />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
