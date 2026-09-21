import { notFound } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { membership, user } from "@/db/schema";
import { Title } from "@/components/ui";

export default async function AdminUsersPage() {
  const actor = await pageUser();
  const { db } = runtime();
  if (
    !(await admin(db, actor)
      .then(() => true)
      .catch(() => false))
  )
    notFound();
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.emailVerified,
      isAdmin: user.isAdmin,
      joined: user.createdAt,
      memberships: count(membership.id),
    })
    .from(user)
    .leftJoin(membership, eq(membership.userId, user.id))
    .groupBy(user.id)
    .orderBy(desc(user.createdAt));
  return (
    <>
      <Title eyebrow="PLATFORM USERS" title="Accounts and restaurant access.">
        <p>Admin status never creates restaurant membership or ownership.</p>
      </Title>
      <div className="admin-table">
        {rows.map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <p>{item.email}</p>
            </div>
            <span>{item.verified ? "Verified" : "Unverified"}</span>
            <span>{Number(item.memberships)} restaurant roles</span>
            <span>{item.isAdmin ? "Admin" : "Customer"}</span>
          </article>
        ))}
      </div>
    </>
  );
}
