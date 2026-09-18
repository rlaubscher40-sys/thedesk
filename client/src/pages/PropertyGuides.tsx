import { useParams } from "wouter";
import { PropertyGuideRead } from "@shared/PropertyGuideRead";
import { propertyGuide } from "@shared/propertyGuides";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { LoanRateScenario } from "@/components/LoanRateScenario";
import NotFound from "./NotFound";

export default function PropertyGuides() {
  const { slug } = useParams<{ slug?: string }>();
  const guide = slug ? propertyGuide(slug) : undefined;
  useDocumentTitle(guide?.title ?? "Property explained");
  if (slug && !guide) return <NotFound />;
  return (
    <PropertyGuideRead guide={guide}>
      {guide?.slug === "interest-rates" && <LoanRateScenario />}
    </PropertyGuideRead>
  );
}
