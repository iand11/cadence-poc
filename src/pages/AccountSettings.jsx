import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { User, Shield, Users, Star, LogOut, Check, Loader2, Mail, Music } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { useTrackedArtists } from '../hooks/useTrackedArtists';
import { fetchArtistsBySlugs } from '../data/artistsRemote';
import TrackedArtistPicker from '../components/TrackedArtistPicker';

const PROVIDER_LABELS = {
  password: 'Email & password',
  'google.com': 'Google',
};

function Section({ icon: Icon, title, description, children, action }) {
  return (
    <section className="bg-[#171614] border border-[#2C2B28] rounded-lg">
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-md bg-[#DA7756]/10 flex items-center justify-center shrink-0">
            <Icon size={15} className="text-[#DA7756]" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-[#F5F0E8]">{title}</h2>
            {description && <p className="text-xs text-[#9B9590] mt-0.5">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="grid sm:grid-cols-[160px_1fr] gap-1 sm:gap-4 items-center py-3 border-t border-[#2C2B28] first:border-t-0">
      <span className="text-xs text-[#6B6560]">{label}</span>
      <div className="text-sm text-[#F5F0E8] min-w-0">{children}</div>
    </div>
  );
}

function ProfileSection({ user, updateProfile }) {
  const [name, setName] = useState(user.displayName || '');
  const [status, setStatus] = useState('idle'); // idle | saving | saved | error
  const dirty = name.trim() !== (user.displayName || '');

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || status === 'saving') return;
    setStatus('saving');
    try {
      await updateProfile({ displayName: name.trim() });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const providers = (user.providerData || []).map((p) => PROVIDER_LABELS[p.providerId] || p.providerId);
  const created = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

  return (
    <Section icon={User} title="Profile" description="How you appear across Prelude.">
      <div className="flex items-center gap-4 pb-4">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#DA7756]/15 text-[#DA7756] flex items-center justify-center text-xl font-mono font-bold">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base text-[#F5F0E8] truncate">{user.displayName || 'Unnamed'}</p>
          <p className="text-xs text-[#9B9590] truncate">{user.email}</p>
        </div>
      </div>

      <form onSubmit={save}>
        <Field label="Display name">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setStatus('idle'); }}
              placeholder="Your name"
              maxLength={80}
              className="flex-1 min-w-0 h-9 px-3 rounded-md bg-[#0D0C0B] border border-[#2C2B28] focus:border-[#DA7756]/50 text-sm text-[#F5F0E8] placeholder-[#6B6560] outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!dirty || status === 'saving'}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold bg-[#DA7756] text-[#0D0C0B] hover:bg-[#DA7756]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {status === 'saving' ? <Loader2 size={12} className="animate-spin" /> : null}
              Save
            </button>
          </div>
          {status === 'saved' && !dirty && (
            <p className="text-[11px] text-[#7BAF73] mt-1.5 flex items-center gap-1"><Check size={11} /> Saved</p>
          )}
          {status === 'error' && (
            <p className="text-[11px] text-[#C75F4F] mt-1.5">Couldn't save — please try again.</p>
          )}
        </Field>
        <Field label="Email">{user.email || '—'}</Field>
        <Field label="Sign-in method">{providers.join(', ') || '—'}</Field>
        {created && <Field label="Member since">{created}</Field>}
      </form>
    </Section>
  );
}

function SecuritySection({ user, sendPasswordReset }) {
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const hasPassword = (user.providerData || []).some((p) => p.providerId === 'password');

  const reset = async () => {
    setStatus('sending');
    try {
      await sendPasswordReset();
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Section icon={Shield} title="Security" description="Manage how you sign in.">
      <Field label="Password">
        {hasPassword ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={reset}
              disabled={status === 'sending' || status === 'sent'}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs border border-[#2C2B28] text-[#F5F0E8] hover:border-[#3D3B37] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {status === 'sending' ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              Send password reset email
            </button>
            {status === 'sent' && <span className="text-xs text-[#7BAF73]">Check {user.email} for a reset link.</span>}
            {status === 'error' && <span className="text-xs text-[#C75F4F]">Couldn't send — please try again.</span>}
          </div>
        ) : (
          <span className="text-[#9B9590]">Managed by your Google account</span>
        )}
      </Field>
    </Section>
  );
}

function FavoritesSection() {
  const { favorites, removeFavorite } = useFavorites();
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    if (!favorites.length) return;
    let cancelled = false;
    fetchArtistsBySlugs(favorites)
      .then((list) => { if (!cancelled) setArtists(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [favorites]);

  const bySlug = new Map(artists.map((a) => [a.slug, a]));

  return (
    <Section
      icon={Star}
      title="Favorites"
      description="Artists you've starred. Adding an artist to your roster favorites it automatically."
    >
      {favorites.length === 0 ? (
        <p className="text-xs text-[#6B6560]">No favorites yet — star an artist from their profile.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {favorites.map((slug) => {
            const a = bySlug.get(slug);
            return (
              <span key={slug} className="inline-flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full bg-[#0D0C0B] border border-[#2C2B28]">
                {a?.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#2C2B28] flex items-center justify-center">
                    <Music size={11} className="text-[#6B6560]" />
                  </span>
                )}
                <Link to={`/app/artist/${slug}`} className="text-xs text-[#F5F0E8] hover:text-[#DA7756] transition-colors">
                  {a?.name || slug}
                </Link>
                <button
                  onClick={() => removeFavorite(slug)}
                  className="p-0.5 rounded-full text-[#DA7756] hover:bg-[#DA7756]/15 cursor-pointer"
                  aria-label={`Unfavorite ${a?.name || slug}`}
                  title="Remove from favorites"
                >
                  <Star size={12} className="fill-[#DA7756]" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </Section>
  );
}

export default function AccountSettings() {
  const { user, signOut, updateProfile, sendPasswordReset } = useAuth();
  const { tracked, toggleTracked } = useTrackedArtists();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try { await signOut(); } finally { navigate('/login'); }
  };

  if (!user) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-5 pb-16">
      <div className="mb-2">
        <h1 className="text-2xl font-light text-[#F5F0E8]">Account settings</h1>
        <p className="text-xs text-[#9B9590] mt-1">Your profile, sign-in, and the artists your workspace is built around.</p>
      </div>

      <ProfileSection key={user.uid} user={user} updateProfile={updateProfile} />
      <SecuritySection user={user} sendPasswordReset={sendPasswordReset} />

      <Section
        icon={Users}
        title="Tracked artists"
        description={`${tracked.length} artist${tracked.length === 1 ? '' : 's'} on your roster — this scopes your dashboard, lists, and reports.`}
      >
        <TrackedArtistPicker tracked={tracked} onToggle={toggleTracked} />
      </Section>

      <FavoritesSection />

      <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-lg border border-[#2C2B28]">
        <div>
          <p className="text-sm text-[#F5F0E8]">Sign out</p>
          <p className="text-xs text-[#9B9590] mt-0.5">Your roster and favorites are saved to your account.</p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs border border-[#C75F4F]/30 text-[#C75F4F] hover:bg-[#C75F4F]/10 transition-colors cursor-pointer"
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </motion.div>
  );
}
