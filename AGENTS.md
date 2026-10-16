<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context

Before making project changes, read `plans/development.md`. It is the current reference for the
application architecture, conventions, workflows, and known implementation details. Treat the
repository code and Supabase migrations as the source of truth if the plan and implementation differ,
and update the relevant plan section in the same change when a convention changes.

For a new session, first inspect the requested area and relevant existing code before editing. Follow
the documented checks (`npm run typecheck`, `npm run lint`, and `npm run build`) when the change is
ready to be considered complete. Read the relevant guide under `node_modules/next/dist/docs/` before
using or changing Next.js APIs.
