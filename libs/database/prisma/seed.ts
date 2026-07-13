/**
 * Seed: creates a default admin user + default workspace + owner membership.
 * Idempotent (upserts) — safe to run repeatedly.
 * Run: `npm run db:seed --workspace @reachflow/database`
 */
import { PrismaClient, UserRole, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'niteshpawar97@gmail.com';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? 'Nitesh';
const WORKSPACE_SLUG = process.env.SEED_WORKSPACE_SLUG ?? 'default';
const WORKSPACE_NAME = process.env.SEED_WORKSPACE_NAME ?? 'ReachFlow Workspace';

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, roleGlobal: UserRole.ADMIN },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      roleGlobal: UserRole.ADMIN,
      // No password yet — auth (hashing/login) lands in Milestone 6.
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: WORKSPACE_SLUG },
    update: { name: WORKSPACE_NAME, ownerUserId: admin.id },
    create: { name: WORKSPACE_NAME, slug: WORKSPACE_SLUG, ownerUserId: admin.id },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: admin.id } },
    update: { role: WorkspaceRole.ADMIN, joinedAt: new Date() },
    create: {
      workspaceId: workspace.id,
      userId: admin.id,
      role: WorkspaceRole.ADMIN,
      joinedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete:\n  user=${admin.email} (${admin.id})\n  workspace=${workspace.slug} (${workspace.id})`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
