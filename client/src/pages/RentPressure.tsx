import { RentPressureRead } from "@shared/RentPressureRead";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
export default function RentPressure() {
  useDocumentTitle("Rent pressure monitor: July 2026");
  return <RentPressureRead />;
}
