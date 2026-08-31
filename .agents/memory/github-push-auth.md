---
name: GitHub push authentication
description: Limits of the Replit GitHub connector for pushing a local repository.
---

The GitHub connector authorizes REST API operations but does not authenticate native `git push` or the GitHub CLI in the workspace shell. Do not assume an attached connector supplies a Git credential helper or SSH key.

**Why:** Native HTTPS push remained unauthenticated after connector authorization, SSH had no GitHub key, and bulk Git Data API uploads through the connector were blocked by rate limits and Cloudflare.

**How to apply:** Create/select repositories through the connector if useful, but use Replit's Git pane or an interactive `gh auth login` flow for the actual Git push. Avoid bulk per-blob migration through the connector.