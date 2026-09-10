# Startup loop recovery

The former guard counted all page starts in shared localStorage. Four starts in
20 seconds, including ordinary navigation across different tabs, could show a
false crash warning, enable lite mode, and tear down the service worker/cache.
This was reproduced during the September 10, 2026 live evidence-link checks.

The guard now records pending starts in a versioned sessionStorage key. Tabs do
not contribute to each other's count, and the old shared counter is ignored.
Fresh navigation and back/forward entries reset the trail, including a new tab
that inherits its opener's sessionStorage. Normal pagehide events also reset it,
so rapid manual reloads do not count as crashes.

A React commit effect starts a five-second healthy-start timer. Its cleanup
cancels confirmation if the tree unmounts. Surviving that interval clears the
trail; four consecutive interrupted starts within 20 seconds still trigger the
lightweight recovery screen. Retry starts a new trail. Storage failures fail open.
The service-worker/cache recovery cooldown remains shared across tabs to avoid
repeated cleanup of shared browser resources.

This remains a startup heuristic: it cannot establish an OOM or diagnose the
cause, and it does not detect crashes after the healthy-start interval. A browser
that loses sessionStorage on a process crash also loses the recovery trail.
The UI and diagnostic report now describe possible interrupted startup without
blaming the visitor's device or claiming The Desk cannot be at fault.

Regression tests cover tab isolation, legacy counter immunity, orderly reloads,
fresh/back navigation, healthy confirmation, interruption before confirmation,
unmount cleanup, real recovery and retry, shared recovery cooldown, and blocked
storage. Live verification and release identifiers are recorded in the fix PR.
