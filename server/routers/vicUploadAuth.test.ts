import { expect, it, vi } from "vitest";
vi.mock("../localData/vicUpload", () => ({ uploadVicWorkbook: vi.fn() }));
import { healthRouter } from "./health";
import { uploadVicWorkbook } from "../localData/vicUpload";
import type { TrpcContext } from "../core/context";

it("rejects unauthenticated workbook imports before parsing", async () => {
  const caller = healthRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
  await expect(caller.importVicWorkbook({base64:"YQ==", resourceUrl:"https://www.dffh.vic.gov.au/quarterly-median-rents-local-government-area-september-quarter-2025-excel",commit:false})).rejects.toMatchObject({code:"FORBIDDEN"});
  expect(uploadVicWorkbook).not.toHaveBeenCalled();
});
