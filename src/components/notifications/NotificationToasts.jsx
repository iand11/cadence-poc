import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';
import { NotificationIcon } from './NotificationBell';

/** Bottom-right toast stack for newly arrived notifications. */
export default function NotificationToasts() {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-4 sm:right-6 z-[60] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-80 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {toasts.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto flex items-start gap-3 p-3 rounded-lg border border-[#2C2B28] bg-[#171614] shadow-2xl shadow-black/60"
          >
            <NotificationIcon n={n} size="w-9 h-9" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#F5F0E8]">{n.title}</p>
              {n.body && <p className="text-[11px] text-[#9B9590] mt-0.5">{n.body}</p>}
              {n.type === 'artist_added' && n.data?.slug && (
                <Link
                  to={`/app/artist/${n.data.slug}`}
                  onClick={() => dismissToast(n.id)}
                  className="inline-block mt-1.5 text-[11px] text-[#DA7756] hover:underline"
                >
                  View artist
                </Link>
              )}
            </div>
            <button
              onClick={() => dismissToast(n.id)}
              aria-label="Dismiss"
              className="p-0.5 rounded text-[#6B6560] hover:text-[#9B9590] cursor-pointer"
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
