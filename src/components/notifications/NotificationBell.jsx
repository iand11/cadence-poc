import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, UserPlus, AlertCircle, Music } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';

function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationIcon({ n, size = 'w-8 h-8' }) {
  if (n.type === 'artist_added' && n.data?.imageUrl) {
    return <img src={n.data.imageUrl} alt="" className={`${size} rounded-full object-cover shrink-0`} />;
  }
  const Icon = n.type === 'artist_added' ? UserPlus : n.type === 'artist_request_rejected' ? AlertCircle : Music;
  const tone = n.type === 'artist_request_rejected' ? 'bg-[#C75F4F]/10 text-[#C75F4F]' : 'bg-[#DA7756]/10 text-[#DA7756]';
  return (
    <div className={`${size} rounded-full flex items-center justify-center shrink-0 ${tone}`}>
      <Icon size={14} />
    </div>
  );
}

export default function NotificationBell() {
  const { notifications, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
        aria-expanded={open}
        className={`relative p-1.5 rounded transition-colors cursor-pointer ${open ? 'text-[#F5F0E8] bg-[#171614]' : 'text-[#9B9590] hover:text-[#F5F0E8]'}`}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-[#DA7756] text-[#0D0C0B] text-[9px] font-bold leading-[15px] text-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-[#2C2B28] bg-[#171614] shadow-2xl shadow-black/60 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#2C2B28]">
              <p className="text-xs font-medium text-[#F5F0E8]">Notifications</p>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={18} className="mx-auto text-[#3D3B37] mb-2" />
                <p className="text-[11px] text-[#6B6560]">
                  Nothing yet. You'll hear here when a requested artist is added.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-[#2C2B28]">
                {notifications.map((n) => {
                  const content = (
                    <>
                      <NotificationIcon n={n} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#F5F0E8]">{n.title}</p>
                        {n.body && <p className="text-[11px] text-[#9B9590] mt-0.5">{n.body}</p>}
                        <p className="text-[10px] text-[#6B6560] mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#DA7756] mt-1.5 shrink-0" />}
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.type === 'artist_added' && n.data?.slug ? (
                        <Link
                          to={`/app/artist/${n.data.slug}`}
                          onClick={() => setOpen(false)}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-[#1C1A18] transition-colors"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
