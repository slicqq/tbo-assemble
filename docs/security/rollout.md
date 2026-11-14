# Supabase Auth rollout — not yet production-ready

The `/login` page uses Supabase Auth, and `/secure-account` verifies identity through `getUser()`.
The account can create and list basic private drafts in `public.private_event_drafts` using
a user-token Supabase client and owner-scoped RLS. Drafts are separate from the old
dashboard and cannot yet have rooms, guests or bookings. The existing public event and
booking routes are not protected by this preview.
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


## Private draft rollout

`docs/security/private-event-drafts.sql` creates a new, separate table with RLS, owner derived from `auth.uid()`, and column-level insert permissions; clients cannot supply the owner or ID. Authenticated users can select and insert their own rows, but cannot update or delete them in this first slice. Account deletion cascades to that user's drafts. Legacy records are not migrated or claimed. The server verifies `getUser()` and queries using the caller's token and an explicit owner filter, rather than the elevated Prisma connection.

Local tests exercise two synthetic user identities against PostgreSQL RLS, column grants and anonymous denial. The browser create/list path was exercised using a mock auth service, not real Supabase Auth. Real email confirmation and live authenticated cross-user tests remain pending. Any service-role or database owner connection can bypass RLS. This feature does not secure legacy APIs, guest links, booking data, or provide rate limiting; it is not a complete private event workspace.
