import { useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/lib/theme";
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const links: [string, string][] = [
    ["/archive", "Search reporting"],
    ["/guides", "Property explained"],
    ["/projects", "Project follow-through"],
    ["/editions", "Weekly editions"],
    ["/trends", "Data charts"],
    ["/settings", "Preferences"],
    ["/subscribe", "Email briefing"],
    ["/install", "Install The Desk"],
    ["/about", "About The Desk"],
    [
      user?.role === "admin" ? "/admin" : "/login",
      user?.role === "admin" ? "Curator workspace" : "Curator sign in",
    ],
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="bs-label bs-link min-h-11 px-2">More</button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto w-[calc(100%_-_2rem)]">
        <DialogTitle className="font-serif text-2xl">Explore The Desk</DialogTitle>
        <DialogDescription className="text-sm text-[var(--color-fg-muted)]">
          Reporting, reading preferences and account tools.
        </DialogDescription>
        <nav aria-label="More destinations" className="grid sm:grid-cols-2 gap-1">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="bs-link min-h-11 flex items-center border-b border-[var(--color-border)] py-2"
            >
              {label}
            </Link>
          ))}
        </nav>
        <button className="bs-btn bs-btn-outline" onClick={toggleTheme}>
          Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
        </button>
      </DialogContent>
    </Dialog>
  );
}
