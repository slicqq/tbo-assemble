# Supabase Auth rollout — not yet production-ready

The `/login` page uses Supabase Auth, and `/secure-account` verifies identity through `getUser()`.
The account can create, edit and delete private event drafts and room blocks using
a user-token Supabase client and owner-scoped RLS. Private events remain separate from the old
dashboard and do not yet support guests or bookings. The existing public event and
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

`docs/security/private-event-drafts.sql` creates a new, separate table with RLS, owner derived from `auth.uid()`, and column-level insert permissions; clients cannot supply the owner or ID. The subsequent workspace migration adds owner-only updates and deletes. Account deletion cascades to that user's drafts. Legacy records are not migrated or claimed. The server verifies `getUser()` and queries using the caller's token and an explicit owner filter, rather than the elevated Prisma connection.

Local PostgreSQL RLS tests and real Supabase synthetic-account browser/API tests exercise owner operations, cross-user denial and anonymous denial. Real email confirmation remains disabled. Any service-role or database owner connection can bypass RLS. This feature does not secure legacy APIs, guest links, booking data, or provide rate limiting; it is not a complete private event workspace.

## Private events and room blocks

`private-event-workspace.sql` extends the existing owner-scoped drafts with owner-only edit and delete, and creates a separate private room-block table. The composite `(event_id, owner_id)` foreign key ensures a child cannot attach to another owner's event; owner and parent columns cannot be supplied or changed except for choosing a parent at insertion. RLS and restricted column grants enforce access even for direct API calls. Deleting a draft cascades its room blocks. The workspace uses the caller's Supabase session and revalidates identity, never privileged Prisma. Existing shared events, bookings and guest links are untouched. Room blocks are planning records, not live inventory, guest bookings or supplier commitments. Email ownership is unverified: do not enter sensitive information. This does not secure legacy endpoints.
