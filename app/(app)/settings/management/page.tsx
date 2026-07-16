import { redirect } from "next/navigation";

// Org creation/deletion moved to the super-admin control tower. Member
// management for orgs you administer now lives under Organisations.
export default function ManagementPage() {
  redirect("/settings/organisations");
}
