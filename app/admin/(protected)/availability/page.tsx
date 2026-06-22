import AdminAvailabilityCalendarOverview from "@/components/admin/AdminAvailabilityCalendarOverview";
import AdminAvailabilityOverrides from "@/components/admin/AdminAvailabilityOverrides";
import AdminAvailabilityRules from "@/components/admin/AdminAvailabilityRules";

export default function AdminAvailabilityPage() {
  return (
    <div className="space-y-10">
      <AdminAvailabilityRules />
      <AdminAvailabilityCalendarOverview />
      <AdminAvailabilityOverrides />
    </div>
  );
}
