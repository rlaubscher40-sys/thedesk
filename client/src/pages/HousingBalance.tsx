import { HousingBalanceRead } from "@shared/HousingBalanceRead";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
export default function HousingBalancePage() {
  useDocumentTitle("Australia's housing supply gap");
  return <HousingBalanceRead />;
}
