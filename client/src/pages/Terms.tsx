import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { EDITORIAL_CONTACT, LEGAL_UPDATED_LABEL } from "@shared/legal";

export default function Terms() {
  useDocumentTitle("Terms of use");
  return (
    <article className="max-w-[68ch] mx-auto py-10 space-y-6 leading-relaxed">
      <header className="space-y-2">
        <p className="overline-amber">The Desk</p>
        <h1 className="font-serif text-4xl sm:text-5xl font-bold leading-tight">Terms of use</h1>
        <p className="text-sm text-[var(--color-fg-muted)]">Last updated: {LEGAL_UPDATED_LABEL}</p>
      </header>
      <div className="editorial-rule-soft" aria-hidden="true" />
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">About The Desk</h2>
        <p>
          The Desk publishes Australian property reporting, data and editorial analysis. Ruben
          Laubscher is the editorial contact at{" "}
          <a className="underline" href={`mailto:${EDITORIAL_CONTACT}`}>
            {EDITORIAL_CONTACT}
          </a>
          . These terms cover the website and its reading and sharing tools. Any separately offered
          paid service needs its own clear pricing and terms.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Information and AI tools</h2>
        <p>
          Reporting, charts and AI-generated answers provide information and commentary. They are
          not a personalised recommendation to buy, sell, borrow or establish an SMSF. Check the
          cited records, their dates and the limitations of the measure. AI can make mistakes. Seek
          appropriately qualified advice for decisions about your circumstances. A disclaimer does
          not remove our legal obligations.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Sources and corrections</h2>
        <p>
          Data may be delayed, revised, incomplete or unavailable. An estimate, approval or
          preliminary auction result must be read in its stated context. We aim to correct material
          errors. Use{" "}
          <a className="underline" href="/corrections">
            Corrections
          </a>{" "}
          or email us with the page link and supporting evidence. External sources remain
          responsible for their own services and terms.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Sharing and intellectual property</h2>
        <p>
          You may link to The Desk and use its sharing tools. For original Desk material we are
          entitled to license, you may share short attributed excerpts in conversations,
          presentations or social posts with a link to the original. This permission does not extend
          to third-party photographs, footage, music, source articles or datasets. Their owners and
          licences control reuse. Ask before republishing complete stories or editions,
          redistributing bulk content or using our branding in a way that suggests endorsement.
          Rights and licences already validly granted are not revoked by this notice.
        </p>
        <p>
          <a className="underline" href="/third-party-licenses.txt">Browser software licences</a>
          {" "}list the open-source components shipped with this website. These software licences
          do not grant rights to our reporting or third-party content.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Acceptable use</h2>
        <p>
          Use the site lawfully. Do not bypass access controls, interfere with the service, misuse
          another person's account or extract personal information without authority. Do not upload
          material you are not entitled to provide. Protect any credentials and avoid submitting
          confidential or sensitive information to AI tools.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Consumer rights and responsibility</h2>
        <p>
          Nothing in these terms excludes, restricts or modifies rights, guarantees or remedies that
          cannot lawfully be excluded under the Australian Consumer Law or other applicable law. We
          do not promise uninterrupted access or error-free information. Any question of
          responsibility or remedy remains subject to applicable law.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl mt-8">Updates and contact</h2>
        <p>
          The date above identifies this version. Material changes should be explained clearly;
          where agreement or notice is required, a changed webpage alone does not replace that
          requirement. Send questions about reuse, copyright or these terms to the editorial contact
          above. See our{" "}
          <a className="underline" href="/privacy">
            privacy notice
          </a>{" "}
          for information handling.
        </p>
      </section>
    </article>
  );
}
