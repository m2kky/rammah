import Navbar from "./Navbar";
import Footer from "./Footer";

export default function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-black text-white">
      <Navbar entryReady />
      {children}
      <Footer />
    </main>
  );
}
