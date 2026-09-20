import Link from "next/link";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { owned } from "@/features/restaurants/service";
import { Title, Empty, Status } from "@/components/ui";
export default async function Owner() {
  const actor = await pageUser();
  const rows = await owned(runtime().db, actor);
  return (
    <>
      <Title
        eyebrow="RESTAURANT WORKSPACE"
        title="Your kitchens, in one place."
      >
        <p>Manage your restaurant page and see where it stands.</p>
      </Title>
      <div className="row spread section-heading">
        <h2>My restaurants</h2>
        <Link className="button" href="/owner/onboarding">
          Add restaurant
        </Link>
      </div>
      {!rows.length ? (
        <Empty title="Let’s introduce your restaurant.">
          <p>Create a page with your story, address and opening hours.</p>
          <Link className="button" href="/owner/onboarding">
            Create my first page
          </Link>
        </Empty>
      ) : (
        <div className="restaurant-grid">
          {rows.map(({ restaurant: r, role, revision }) => (
            <Link
              key={r.id}
              href={`/owner/${r.id}`}
              className="card content-card stack restaurant-card"
            >
              <div className="row spread">
                <h2>{r.name}</h2>
                <Status value={revision?.status || r.status} />
              </div>
              <p className="muted">
                {r.area}, {r.city}
              </p>
              <span className="small">
                {revision
                  ? "Public page live · update in review workflow"
                  : role === "owner"
                    ? "Owner access · Manage page →"
                    : "Staff access · Manage page →"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
