import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

/** Shared tRPC client. Pages import from "@/lib/trpc" — single import path. */
export const trpc = createTRPCReact<AppRouter>();
