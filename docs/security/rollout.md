# Supabase Auth rollout — not yet production-ready

The `/login` page uses Supabase Auth, and `/secure-account` verifies identity through `getUser()`.
This account is intentionally not linked to the current dashboard or legacy APIs. The
existing public event and booking routes are not protected by this preview.
Do not use the current deployment for real customer data.

Next stages before switching login:
1. Apply a reviewed additive ownership migration. Existing agents/events remain
   unowned; never claim a record solely by matching an email address. Decide on
   a separately authorized ownership transfer for existing records.
2. Implement verified server-side user-to-agent mapping and scope *every* query
   and mutation, including nested resources and server-rendered pages. Prisma
   connects with elevated DB credentials and bypasses Supabase RLS, so RLS alone
   does not protect these endpoints.
3. Replace guest UUID-as-secret links with revocable, scoped tokens; add CSRF,
   rate limiting, session refresh and safe account recovery; keep demo synthetic.
4. Test unauthenticated, cross-user, demo, expired-session and guest access;
   audit all endpoints and file exports. Only then replace the legacy login.
5. Configure the Supabase site and redirect URLs for the final production host,
   verify email confirmation and recovery end-to-end, and test the live rollout.
