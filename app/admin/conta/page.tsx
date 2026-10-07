import { AccountSettings } from "@/components/account/account-settings";
import { requireAdmin } from "@/lib/guards";

export default async function AdminAccountPage({
  searchParams
}: {
  searchParams?: { saved?: string; error?: string; force?: string };
}) {
  const user = await requireAdmin();
  return (
    <AccountSettings
      name={user.name ?? "-"}
      email={user.email ?? "-"}
      saved={searchParams?.saved}
      error={searchParams?.error}
      force={searchParams?.force === "1" || user.mustChangePassword}
    />
  );
}
