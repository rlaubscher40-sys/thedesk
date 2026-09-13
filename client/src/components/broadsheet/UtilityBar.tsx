import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";
import { useTheme } from "@/lib/theme";
import { MoreMenu } from "./MoreMenu";
import { GUTTER } from "./tokens";
/** Reader context and utilities; primary product destinations live in the masthead. */
export function UtilityBar({ filedLine, children }: { filedLine: string; children?: ReactNode }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  return (
    <div className={cn(GUTTER, "rule-hair-b flex items-center justify-between gap-2 py-1")}>
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <span className={cn("bs-label", !!children && "hidden xl:inline")}>{filedLine}</span>
        {children}
      </div>
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <Link href="/archive" className="bs-label bs-link min-h-11 flex items-center px-2">
          Search
        </Link>
        <button
          className="hidden lg:block bs-label bs-link min-h-11 px-2"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <MoreMenu />
      </div>
    </div>
  );
}
