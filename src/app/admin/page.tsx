import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, inArray } from "drizzle-orm";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { admin } from "@/features/restaurants/service";
import { listReports } from "@/features/posts/service";
import { restaurant, restaurantRevision } from "@/db/schema";
import { Title, Status, Empty } from "@/components/ui";
import { ReportReview } from "@/components/report-review";
import { Flag, ShieldCheck, Store } from "lucide-react";
export default async function Admin() {
  const actor = await pageUser();
  const { db } = runtime();
  try {
    await admin(db, actor);
  } catch {
    notFound();
  }
  const [restaurants, revisions, reports] = await Promise.all([
    db
      .select()
      .from(restaurant)
      .where(
        inArray(restaurant.status, ["pending_review", "approved", "suspended"]),
      )
      .orderBy(desc(restaurant.updatedAt)),
    db
      .select()
      .from(restaurantRevision)
      .where(inArray(restaurantRevision.status, ["pending_review"]))
      .orderBy(desc(restaurantRevision.updatedAt)),
    listReports(db, actor),
  ]);
  const revisionMap = new Map(
    revisions.map((item) => [item.restaurantId, item]),
  );
  const rows = restaurants.map((item) => {
    const revision = revisionMap.get(item.id);
    return revision
      ? {
          ...item,
          name: revision.name,
          area: revision.area,
          city: revision.city,
          status: revision.status,
        }
      : item;
  });
  const openReports = reports.filter((item) => item.status === "open");
  return (
    <>
      <Title eyebrow="TRUST & OPERATIONS" title="Keep the marketplace healthy.">
        <p>
          Review restaurant applications and community reports with an audit
          trail.
        </p>
      </Title>
      <div className="admin-summary-grid">
        <div>
          <Store size={21} />
          <span>
            <strong>
              {rows.filter((item) => item.status === "pending_review").length}
            </strong>
            <small>Pending restaurants</small>
          </span>
        </div>
        <div>
          <Flag size={21} />
          <span>
            <strong>{openReports.length}</strong>
            <small>Open reports</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={21} />
          <span>
            <strong>
              {rows.filter((item) => item.status === "approved").length}
            </strong>
            <small>Approved pages</small>
          </span>
        </div>
      </div>

      <section className="admin-section">
        <div className="section-title-line">
          <div>
            <p className="eyebrow">RESTAURANTS</p>
            <h2>Page review queue</h2>
          </div>
        </div>
        {rows.length ? (
          <div className="admin-list">
            {rows.map((r) => (
              <Link
                className="admin-list-item"
                href={`/admin/restaurants/${r.id}`}
                key={r.id}
              >
                <div>
                  <h2>{r.name}</h2>
                  <p className="muted">
                    {r.area}, {r.city}
                  </p>
                </div>
                <Status value={r.status} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="You’re all caught up.">
            <p>Submitted restaurants will appear here for review.</p>
          </Empty>
        )}
      </section>

      <section className="admin-section">
        <div className="section-title-line">
          <div>
            <p className="eyebrow">COMMUNITY REPORTS</p>
            <h2>Content moderation</h2>
          </div>
          <span className="status pending_review">
            {openReports.length} open
          </span>
        </div>
        {openReports.length ? (
          <div className="report-grid">
            {openReports.map((item) => (
              <article className="report-card" key={item.id}>
                <div className="row spread wrap">
                  <span className="report-reason">{item.reason}</span>
                  <span className="small muted">
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(item.createdAt)}
                  </span>
                </div>
                <h3>{item.restaurantName}</h3>
                <blockquote>{item.caption}</blockquote>
                {item.detail && (
                  <p>
                    <strong>Reporter’s note:</strong> {item.detail}
                  </p>
                )}
                <p className="small muted">
                  Reported by {item.reporterName} · {item.reporterEmail}
                </p>
                <ReportReview id={item.id} />
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-inline">
            <ShieldCheck size={27} />
            <div>
              <h3>No open reports</h3>
              <p className="muted">New community reports will appear here.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
