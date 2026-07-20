import AdminOfferingEditor from "@/components/admin/AdminOfferingEditor";

export default async function EditAdminOfferingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminOfferingEditor offeringId={id} />;
}
