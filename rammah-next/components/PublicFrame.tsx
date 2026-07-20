import Navbar from "./Navbar";
import Footer from "./Footer";
import { fetchPublicNavigation } from "@/lib/api/cms";

export default async function PublicFrame({ children }: { children: React.ReactNode }) {
  const headerNavigation = await fetchPublicNavigation("header").catch(() => []);

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-black text-white">
      <Navbar entryReady navigation={headerNavigation} />
      {children}
      <Footer />
    </main>
  );
}
