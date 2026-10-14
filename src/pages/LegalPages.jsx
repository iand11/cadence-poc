import { Link } from 'react-router';

// Public policy pages (no password gate, no login). Meta requires a privacy policy
// URL and a data deletion URL before the app can go Live.
export const CONTACT_EMAIL = 'privacy@preludemusic.ai';
const UPDATED = 'October 14, 2026';

function Shell({ title, children }) {
  return (
    <div className="min-h-screen bg-[#0D0C0B] text-[#F5F0E8]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <span className="w-7 h-7 rounded bg-[#DA7756]/15 flex items-center justify-center font-mono text-xs font-bold text-[#DA7756]">P</span>
          <span className="text-sm font-medium">Prelude</span>
        </Link>
        <h1 className="font-['Playfair_Display'] text-3xl mb-1">{title}</h1>
        <p className="text-[11px] font-mono text-[#6B6560] mb-8">Last updated {UPDATED}</p>
        <div className="space-y-6 text-sm leading-relaxed text-[#C9C2B8] [&_h2]:text-[#F5F0E8] [&_h2]:text-base [&_h2]:font-medium [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-[#DA7756] [&_a]:underline">
          {children}
        </div>
        <p className="mt-12 text-[11px] font-mono text-[#6B6560]">
          <Link to="/privacy">Privacy policy</Link> · <Link to="/data-deletion">Data deletion</Link>
        </p>
      </div>
    </div>
  );
}

const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

export function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <p>
        Prelude is a music marketing platform for artists and their teams. This policy explains what we
        collect, why, who we share it with, and how to have it deleted.
      </p>

      <section>
        <h2>Prelude account holders</h2>
        <ul>
          <li>Your sign-in details (name and email address).</li>
          <li>What you set up in Prelude: followed artists, groups, reports, campaigns, smart links, and images or videos you upload for ads.</li>
          <li>
            If you connect Meta (Facebook and Instagram): the IDs of the Pages, Instagram accounts and ad accounts you share
            with Prelude, and, if you connect with Facebook Login, an access token. We use them only to create, run, pause and
            report on the ads you set up in Prelude. Tokens are encrypted and never sent to your browser.
          </li>
          <li>
            If you let Prelude run ads for an Instagram account: Prelude's business is given advertiser access to that Page and
            Instagram account, and ads run from Prelude's ad account. You can stop this at any time in Ad Accounts, which also
            removes that access.
          </li>
          <li>Payments are handled by Stripe. We keep the amount and status of each payment, never your card details.</li>
        </ul>
      </section>

      <section>
        <h2>Visitors to smart links</h2>
        <p>When someone opens a Prelude smart link or clicks through to a streaming service, we record:</p>
        <ul>
          <li>The page and service clicked, time, referrer, and campaign tags in the link.</li>
          <li>Technical details: IP address, approximate location from it, browser, device, language and screen size.</li>
          <li>A first-party cookie that recognises repeat visits to Prelude links.</li>
          <li>
            Click events may be sent to Meta (Pixel and Conversions API) so the artist can measure their ads. Visitors in the
            EU, EEA, UK and Switzerland are asked for consent first, and we honour Global Privacy Control signals.
          </li>
        </ul>
        <p>Artists see totals for their links, never individual IP addresses or cookie IDs.</p>
      </section>

      <section>
        <h2>Fans who continue with Spotify</h2>
        <p>
          If you choose "Continue with Spotify" on a smart link, we receive your Spotify profile (name, email, country), follow
          the artist and save the release on your behalf, and store a token that lets us read your recently played tracks so the
          artist can see listening that followed their campaign. You can disconnect Prelude at any time in your Spotify account
          settings under Apps, or ask us to delete your data.
        </p>
      </section>

      <section>
        <h2>How we use and share data</h2>
        <ul>
          <li>To provide Prelude's features, measure campaigns and keep the service secure.</li>
          <li>With service providers that run Prelude for us (hosting, database, authentication, payments) and with Meta and Spotify as described above.</li>
          <li>We do not sell personal data.</li>
        </ul>
      </section>

      <section>
        <h2>Retention and deletion</h2>
        <p>
          We keep data while your account is active or as long as the artist uses the smart link, and delete it on request.
          See <Link to="/data-deletion">Data deletion</Link> for how to ask.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions or requests: <Mail />.</p>
      </section>
    </Shell>
  );
}

export function DataDeletion() {
  return (
    <Shell title="Data Deletion">
      <p>You can have the data Prelude holds about you deleted at any time.</p>

      <section>
        <h2>If you connected Facebook or Instagram</h2>
        <ul>
          <li>In Prelude, open Campaigns → Ad Accounts and click Disconnect. This deletes your stored Meta token right away.</li>
          <li>
            If Prelude runs ads for one of your Instagram accounts, click Stop next to it first. That removes Prelude's access to
            your Page and Instagram account.
          </li>
          <li>You can also remove Prelude in Facebook under Settings → Business integrations.</li>
        </ul>
      </section>

      <section>
        <h2>If you continued with Spotify on a smart link</h2>
        <p>Remove Prelude in your Spotify account under Apps, and email us to delete your stored profile and listening history.</p>
      </section>

      <section>
        <h2>Delete everything</h2>
        <p>
          Email <Mail /> from the address on your account (or the one on your Spotify profile) with the subject "Delete my data".
          We delete your account, connections, uploads and associated records within 30 days and confirm by email. Records we
          must keep by law, such as payment records, are kept only as long as required.
        </p>
      </section>
    </Shell>
  );
}
