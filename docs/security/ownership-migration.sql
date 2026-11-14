-- DRAFT ONLY. Do not apply until the complete authorization rollout is ready.
-- Existing records remain unowned; no automatic association by email.
ALTER TABLE public."Agent" ADD COLUMN "authUserId" uuid;
CREATE UNIQUE INDEX "Agent_authUserId_key" ON public."Agent" ("authUserId");
ALTER TABLE public."Agent" ADD CONSTRAINT "Agent_authUserId_fkey"
  FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE SET NULL;
