import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { EDITORIAL_CONTACT, LEGAL_UPDATED_LABEL } from "@shared/legal";

export default function Privacy() {
  useDocumentTitle("Privacy");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p className="overline-amber">The Desk</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">Privacy</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Last updated: {LEGAL_UPDATED_LABEL}</p>
      </header>
      <div className="editorial-rule-soft" aria-hidden="true" />
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">About this notice</h2>
        <p>
          This notice explains how The Desk handles information when you read the site, subscribe,
          sign in or use its tools. Contact Ruben Laubscher at{" "}
          <a className="underline" href={`mailto:${EDITORIAL_CONTACT}`}>
            {EDITORIAL_CONTACT}
          </a>{" "}
          about privacy or your information.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Subscriptions and enquiries</h2>
        <p>
          We collect your email address and, if provided, your name, signup placement and referring
          channel or campaign. We keep subscription requests, the notice version supplied by the
          form, confirmation and unsubscribe status to manage delivery and consent. Emails include
          the weekday morning briefing and Sunday edition. Enquiries contain whatever information
          you choose to send us.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Accounts and saved items</h2>
        <p>
          Where an account is available, we store account identifiers, name or email where provided,
          access role, sign-in information and saved bookmarks. Signed session cookies keep you
          logged in. Your theme, reading preferences, guest bookmarks and watch settings may be
          stored on your device. Signing in can import local bookmarks into your account.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">AI questions and sharing</h2>
        <p>
          Ask The Desk sends your question and selected source material to Anthropic to generate and
          check an answer. Other AI-assisted tools may also process text you submit. Avoid entering
          confidential client information, financial account details or other sensitive personal
          information. AI answers can be wrong. If you create or send a share link or image, its
          question and answer can be read by people who receive it; share links are not private
          account storage.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Analytics and security</h2>
        <p>
          Our own analytics record page paths, limited product actions, referring hostnames,
          campaign labels and a temporary browser-session identifier. This is not a guarantee of
          anonymity. Analytics exclude question text and respect Do Not Track. Performance samples
          use a rolling 30-day window as new measurements arrive. Browser storage also remembers
          arrival campaigns and preferences. Security controls and infrastructure process connection
          information and identifiers to prevent abuse; infrastructure providers may maintain their
          own logs.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Service providers and overseas processing</h2>
        <p>
          We use providers for hosting, databases, email and AI. The application uses Resend for
          email and Anthropic for AI text processing, and supports OpenAI for production assets such
          as narration. Providers receive the information needed for those functions. Processing or
          storage may occur outside Australia. Provider retention and account settings can differ
          from The Desk's own storage. Links to other websites and social platforms are subject to
          their privacy practices.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Retention and your choices</h2>
        <p>
          Unsubscribing stops future newsletter delivery; it does not itself delete all records. We
          retain suppression and relevant consent records to respect opt-outs and handle disputes.
          Other information is retained as needed to operate the service, maintain security and meet
          applicable legal obligations. Request access, correction or deletion by email. We may need
          to verify your identity and explain any information we must retain. Browser preferences
          can also be cleared in your browser settings.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Questions or complaints</h2>
        <p>
          Email the contact above with the relevant page, account or subscription details, without
          sending passwords. You can also request manual unsubscribe assistance. If a privacy
          complaint remains unresolved, the{" "}
          <a className="underline" href="https://www.oaic.gov.au/privacy/privacy-complaints">
            Office of the Australian Information Commissioner
          </a>{" "}
          explains available complaint options and whether it can handle your matter.
        </p>
      </section>
    </article>
  );
}
