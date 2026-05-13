# Codespaces

This branch is set up to run in [GitHub Codespaces](https://docs.github.com/en/codespaces/overview) with no local install.

## How to open

1. On the [repo page](https://github.com/rubenlaubscher-beep/thedesk/tree/claude/rebuild-the-desk-Wy1Gp), click **Code → Codespaces → Create codespace on `claude/rebuild-the-desk-Wy1Gp`**.
2. Wait ~60-90 seconds for the container to build. The `postCreateCommand` runs `pnpm install`.
3. In the integrated terminal, run:
   ```
   pnpm dev
   ```
4. A toast appears in the bottom right of the VS Code interface: **"Your application running on port 3000 is available."** Click **Open in Browser**.

Or pick **Tasks: Run Task → dev** from the command palette and skip the terminal step.

## What you'll see

Because there's no `DATABASE_URL` set, the server boots into **demo mode**:
- Three weekly editions are seeded with full content (topics, signals, key metrics, Ruben's Take, Substack drafts)
- Three days of daily feed items, each with the 4-persona partnerTag block
- You're auto-signed-in as admin "Ruben (demo)" — the edition admin panel is visible
- A small amber ribbon at the top of every page reads **DEMO MODE · SEED DATA, NO LIVE DATABASE**
- Admin actions (regenerate Take, generate Substack draft, regenerate image) call the canned LLM/image stubs and update the in-memory store

Reload the page or restart `pnpm dev` to reset the demo state.

## Port visibility

The forwarded URL is private to your GitHub account by default. To share it (e.g. for someone else to review):
- VS Code: open the **Ports** panel, right-click port 3000, **Port Visibility → Public**.
- The URL then works for anyone with the link until you stop the codespace.

## Stopping

Codespaces auto-suspend after 30 minutes of inactivity and free-tier hours are 60/month. Stop or delete the codespace from <https://github.com/codespaces> when done.
