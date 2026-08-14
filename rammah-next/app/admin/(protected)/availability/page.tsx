import AdminAvailabilityCalendarOverview from "@/components/admin/AdminAvailabilityCalendarOverview";
import AdminAvailabilityOverrides from "@/components/admin/AdminAvailabilityOverrides";
import AdminAvailabilityRules from "@/components/admin/AdminAvailabilityRules";
import AdminBookingPolicy from "@/components/admin/AdminBookingPolicy";

export default function AdminAvailabilityPage() {
  return (
    <div className="space-y-10">
      <AdminBookingPolicy />
      <AdminAvailabilityRules />
      <AdminAvailabilityOverrides />
      <AdminAvailabilityCalendarOverview />
    </div>
  );
}
