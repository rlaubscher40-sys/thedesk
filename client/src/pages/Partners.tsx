import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { EDITORIAL_CONTACT } from "@shared/legal";
export default function Partners() {
  useDocumentTitle("Partner with The Desk");
  return (
    <article className="max-w-4xl mx-auto px-5 py-10 sm:py-14">
      <p className="bs-label-accent">Commercial enquiries</p>
      <h1 className="font-serif text-4xl sm:text-6xl mt-4 leading-tight">
        Support useful Australian property explanation.
      </h1>
      <p className="text-xl leading-8 mt-6">
        The Desk brings together a weekday property brief, a Sunday edition, sourced market research
        and social explainers. We welcome enquiries about clearly disclosed support for this work.
      </p>
      <section className="rule-major mt-9 pt-6">
        <h2 className="font-serif text-3xl">Formats to discuss</h2>
        <div className="grid sm:grid-cols-2 gap-7 mt-6">
          <div>
            <h3 className="font-serif text-xl">Brief and edition sponsorship</h3>
            <p className="leading-7 mt-3">
              Enquire about a labelled sponsor message alongside a website brief or email edition.
              Placement, copy, timing and availability require an individual agreement.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-xl">Explainer support</h3>
            <p className="leading-7 mt-3">
              Discuss support for an existing guide, research series or social explainer. The Desk
              retains control of its questions, sources, findings and corrections.
            </p>
          </div>
        </div>
        <p className="text-sm leading-7 mt-6">
          These are enquiry options, not bookable inventory. Any proposal will state the
          deliverables, disclosure, usage rights and reporting we can actually provide before work
          is agreed.
        </p>
      </section>
      <section className="rule-hair mt-8 pt-6">
        <h2 className="font-serif text-3xl">Editorial independence is part of the offer.</h2>
        <p className="leading-7 mt-4">
          Payment does not buy a favourable market conclusion, remove a correction or turn
          commercial copy into independent reporting. Sponsored material must be recognisable as
          such. Advertisers do not receive subscriber contact details.
        </p>
        <p className="leading-7 mt-4">
          Measurement uses the privacy-preserving analytics available for the agreed placement. Page
          views, reader actions and confirmed subscriptions are different measures; we do not
          promise audience size, enquiries or sales.
        </p>
        <a className="bs-link underline inline-block mt-4" href="/editorial-standards">
          Read the editorial standards →
        </a>
      </section>
      <section className="rule-hair mt-8 pt-6">
        <h2 className="font-serif text-3xl">Start with the purpose.</h2>
        <p className="leading-7 mt-4">
          Tell us about your organisation, the reader need you want to support, your preferred
          format and timing. Ruben Laubscher will assess fit and availability.
        </p>
        <a
          className="bs-btn bs-btn-solid inline-flex mt-5"
          href={`mailto:${EDITORIAL_CONTACT}?subject=The%20Desk%20partnership%20enquiry`}
        >
          Email a partnership enquiry →
        </a>
      </section>
    </article>
  );
}
