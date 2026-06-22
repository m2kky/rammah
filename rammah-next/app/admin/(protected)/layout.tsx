import AdminAuthGate from "@/components/admin/AdminAuthGate";
import AdminShell from "@/components/admin/AdminShell";

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGate>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGate>
  );
}
