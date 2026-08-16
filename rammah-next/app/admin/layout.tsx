import { privateMetadata } from "@/lib/seo/metadata";

export const metadata = privateMetadata("Administration");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
