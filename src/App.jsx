import { Outlet } from 'react-router';
import AppBar from './components/layout/AppBar';

export default function App() {
  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#F5F0E8]">
      <AppBar />
      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-6 pb-10">
        <Outlet />
      </main>
    </div>
  );
}
