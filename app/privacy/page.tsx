const T = {
  bg: "#0a0a0c",
  surf: "#131318",
  bdr: "#23232a",
  text: "#e5e5ea",
  body: "#b8b8c0",
  sub: "#8a8a92",
  meta: "#5a5a62",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
  serif: "'DM Serif Display', Georgia, serif",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');`;

export const metadata = {
  title: "Privacy Policy — Writers Room",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.sans }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px 80px" }}>
        <a
          href="/"
          style={{ fontFamily: T.mono, fontSize: 11, color: T.meta, letterSpacing: "0.1em", textDecoration: "none", display: "inline-block", marginBottom: 40 }}
        >
          ← WRITERS ROOM
        </a>

        <h1 style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 400, color: T.text, marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.meta, marginBottom: 48 }}>
          Last updated: June 2025
        </p>

        <Section title="Overview">
          Writers Room is a private writing collaboration tool. We collect only the data needed to run the service and do not sell or share your information with third parties.
        </Section>

        <Section title="Information We Collect">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><strong>Account data:</strong> Your name, email address, and profile photo provided by Google or GitHub when you sign in.</li>
            <li><strong>Content you create:</strong> Rooms, messages, folders, and notes you write within the app.</li>
            <li><strong>Usage data:</strong> Basic analytics (page views, feature usage) to improve the product. No personally identifiable information is included in analytics events.</li>
          </ul>
        </Section>

        <Section title="How We Use Your Data">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>To authenticate you and display your profile within the app.</li>
            <li>To store and retrieve the rooms, messages, and folders you create.</li>
            <li>To understand how the product is used so we can improve it.</li>
          </ul>
        </Section>

        <Section title="Google Calendar Access">
          If you sign in with Google and grant calendar access, we use it solely to display and create calendar events within Writers Room. We do not read, store, or share calendar data beyond what you explicitly request in the app.
        </Section>

        <Section title="Data Storage">
          Your data is stored in Supabase (PostgreSQL), hosted in the EU. We use industry-standard security practices including encrypted connections and server-side authentication.
        </Section>

        <Section title="Third-Party Services">
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li><strong>Google / GitHub OAuth:</strong> Used for authentication only.</li>
            <li><strong>Anthropic Claude API:</strong> Writing agent responses are processed by Anthropic. Content sent to agents is subject to Anthropic's privacy policy.</li>
            <li><strong>Supabase:</strong> Database and storage provider.</li>
            <li><strong>Vercel:</strong> Hosting and serverless functions.</li>
          </ul>
        </Section>

        <Section title="Data Retention">
          Your account data and content are retained as long as your account exists. You may request deletion by contacting us at the email below.
        </Section>

        <Section title="Your Rights">
          You may request access to, correction of, or deletion of your personal data at any time. Contact us at <a href="mailto:frederic.labadie@willowtreeapps.com" style={{ color: "#4da8ff" }}>frederic.labadie@willowtreeapps.com</a>.
        </Section>

        <Section title="Changes">
          We may update this policy occasionally. Continued use of the app after changes constitutes acceptance.
        </Section>

        <Section title="Contact">
          Questions? Email <a href="mailto:frederic.labadie@willowtreeapps.com" style={{ color: "#4da8ff" }}>frederic.labadie@willowtreeapps.com</a>.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: T.mono, fontSize: 11, color: "#4da8ff", letterSpacing: "0.12em", marginBottom: 12 }}>
        {title.toUpperCase()}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: T.body }}>
        {children}
      </div>
    </div>
  );
}
