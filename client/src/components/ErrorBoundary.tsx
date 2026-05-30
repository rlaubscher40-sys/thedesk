/**
 * Section-level error boundary. Two flavours:
 *   - `ErrorBoundary` for the whole app shell.
 *   - `SectionErrorBoundary` for individual page sections (issue #3 in the
 *     brief, one section failing should not nuke the page).
 *
 * Both share the same implementation and only differ in the fallback shown.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { hardReload, isChunkLoadError } from "../lib/chunkReload";
import { Button } from "./ui/Button";

type Props = {
  children: ReactNode;
  /** Label shown above the fallback message. */
  section?: string;
  fallback?: (err: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
};

type State = { error: Error | null };

class BaseBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.section ? `:${this.props.section}` : ""}]`, error, info);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div className="my-6 panel p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="overline mb-1">{this.props.section ?? "Section error"}</p>
            <p className="text-sm text-[var(--color-fg)] mb-1">Something stopped rendering here.</p>
            <p className="text-xs text-[var(--color-fg-muted)] mb-3 break-words">
              {this.state.error.message}
            </p>
            <Button size="sm" variant="outline" onClick={this.reset}>
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <BaseBoundary
      fallback={(err) => {
        // A stale-deploy chunk failure can't be cleared by resetting
        // React state — the module is gone from the server. Show
        // tailored copy and make the button do a real cache-busting
        // reload so the browser pulls the current build. (lazyWithReload
        // already attempts one automatic reload; if we're here that
        // first attempt was used up, so this button is the manual cure.)
        const isChunk = isChunkLoadError(err);
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
            <div className="max-w-md w-full panel p-6">
              <p className="overline mb-3">The Desk · App error</p>
              <h2 className="text-lg font-serif mb-2">
                {isChunk
                  ? "A new version is available."
                  : "Something broke at the top of the stack."}
              </h2>
              <p className="text-sm text-[var(--color-fg-muted)] mb-4 break-words">
                {isChunk
                  ? "This tab is running an older build. Reload to pick up the latest version of The Desk."
                  : err.message}
              </p>
              <Button onClick={() => void hardReload()}>Reload</Button>
            </div>
          </div>
        );
      }}
    >
      {children}
    </BaseBoundary>
  );
}

export function SectionErrorBoundary(props: Props) {
  return <BaseBoundary {...props} />;
}
