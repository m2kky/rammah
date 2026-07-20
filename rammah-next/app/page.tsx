import HomeClient from "@/components/HomeClient";
import Footer from "@/components/Footer";
import { fetchPublicPage } from "@/lib/api/cms";

export default async function Home() {
  const page = await fetchPublicPage("home").catch(() => null);

  return <HomeClient page={page} footer={<Footer />} />;
}
