import { pageUser } from "@/lib/session";
import { Title } from "@/components/ui";
import { RestaurantForm } from "@/components/restaurant-form";
export default async function Onboarding() {
  await pageUser();
  return (
    <div className="narrow">
      <Title
        eyebrow="WELCOME, RESTAURANT OWNER"
        title="Give your kitchen a home."
      >
        <p>A few details today. A place for your community tomorrow.</p>
      </Title>
      <RestaurantForm />
    </div>
  );
}
