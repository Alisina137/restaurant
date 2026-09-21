import { MapPinned } from "lucide-react";
import { pageUser } from "@/lib/session";
import { runtime } from "@/lib/runtime";
import { listAddresses } from "@/features/customers/service";
import { Title } from "@/components/ui";
import { AddressManager } from "@/components/address-manager";

export default async function AddressesPage() {
  const actor = await pageUser();
  const addresses = await listAddresses(runtime().db, actor);
  return (
    <>
      <Title eyebrow="DELIVERY DETAILS" title="Your saved addresses.">
        <p>
          Keep trusted locations ready for checkout. Addresses are private and
          are shared only with the restaurant handling your delivery.
        </p>
      </Title>
      <div className="privacy-note">
        <MapPinned size={20} />
        <span>No address is shown on your public profile.</span>
      </div>
      <AddressManager addresses={addresses} />
    </>
  );
}
