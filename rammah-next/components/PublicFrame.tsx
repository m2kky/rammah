import Link from "next/link";
import Navbar from "./Navbar";
import {
  fetchPublicNavigation,
  fetchPublicSiteSettings,
  type PublicNavigationItem,
  type PublicSiteSettings,
} from "@/lib/api/cms";

const fallbackNavigation: PublicNavigationItem[] = [
  { id: "home", label: "Home", url: "/", location: "footer", sortOrder: 10 },
  { id: "about", label: "About", url: "/about", location: "footer", sortOrder: 20 },
  { id: "services", label: "Services", url: "/services", location: "footer", sortOrder: 30 },
  { id: "booking", label: "Booking", url: "/booking", location: "footer", sortOrder: 40 },
  { id: "blog", label: "Blog", url: "/blog", location: "footer", sortOrder: 50 },
  { id: "contact", label: "Contact", url: "/contact", location: "footer", sortOrder: 60 },
];

const fallbackSettings: PublicSiteSettings = {
  siteName: "Ahmed Rammah",
  contactEmail: "hello@rammah.local",
  contactPhone: null,
  socialLinks: {},
  bookingDefaultTimezone: "Africa/Cairo",
};

const getFooterData = async () => {
  const [settings, navigation] = await Promise.all([
    fetchPublicSiteSettings().catch(() => null),
    fetchPublicNavigation("footer").catch(() => []),
  ]);

  return {
    settings: settings ?? fallbackSettings,
    navigation: navigation.length ? navigation : fallbackNavigation,
  };
};

export default async function PublicFrame({ children }: { children: React.ReactNode }) {
  const { settings, navigation } = await getFooterData();

  return (
    <main className="min-h-[100dvh] overflow-x-clip bg-black text-white">
      <Navbar entryReady />
      {children}
      <footer className="border-t border-white/10 bg-[#02040A] pt-24 pb-0 px-5 md:px-8 overflow-hidden relative">
        <div className="mx-auto max-w-[1440px]">
          {/* Top Row: Links and Info */}
          <div className="flex flex-col md:flex-row justify-between gap-16 md:gap-8 mb-24">
            {/* Left Info */}
            <div className="max-w-[340px]">
              <h3 className="text-2xl md:text-3xl font-bold mb-6 tracking-tight">{settings.siteName.toUpperCase()}</h3>
              <p className="font-inter text-[15px] text-white/60 leading-relaxed">
                {settings.siteName} is a behavioral systems consultancy specializing in human performance, training, and corporate alignment.
              </p>
            </div>
            
            {/* Right Columns */}
            <div className="flex flex-wrap md:flex-nowrap gap-12 md:gap-20 lg:gap-28 font-inter">
              {/* Column 1 */}
              <div>
                <h4 className="text-white font-medium mb-6">Quick link</h4>
                <ul className="flex flex-col gap-4 text-[15px] text-white/50">
                  <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                  <li><Link href="/about" className="hover:text-white transition-colors">About us</Link></li>
                  <li><Link href="/contact" className="hover:text-white transition-colors">Contact us</Link></li>
                  <li><Link href="/booking" className="hover:text-white transition-colors">Booking</Link></li>
                </ul>
              </div>

              {/* Column 2 */}
              <div>
                <h4 className="text-white font-medium mb-6">Company</h4>
                <ul className="flex flex-col gap-4 text-[15px] text-white/50">
                  <li><Link href="/services" className="hover:text-white transition-colors">Service</Link></li>
                  <li><Link href="/services/corporate-training" className="hover:text-white transition-colors">Corporate Training</Link></li>
                  <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                </ul>
              </div>

              {/* Column 3 */}
              <div>
                <h4 className="text-white font-medium mb-6">Others</h4>
                <ul className="flex flex-col gap-4 text-[15px] text-white/50">
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
                </ul>
              </div>

              {/* Column 4 */}
              <div>
                <h4 className="text-white font-medium mb-6">Social</h4>
                <ul className="flex flex-col gap-4 text-[15px] text-white/50">
                  <li><a href={settings.socialLinks?.facebook || "#"} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Facebook</a></li>
                  <li><a href={settings.socialLinks?.linkedin || "#"} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">LinkedIn</a></li>
                  <li><a href={settings.socialLinks?.instagram || "#"} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Instagram</a></li>
                  <li><a href={settings.socialLinks?.twitter || "#"} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Twitter</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Middle Row */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] font-inter text-white/40 mb-12">
            <p>©{new Date().getFullYear()} {settings.siteName} All rights reserved.</p>
            <p>
              Design by <a href="https://muhammedmekky.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Muhammed Mekky</a> - Powered by Next.js
            </p>
          </div>
          
        </div>
        
        {/* Massive Text Background */}
        <div className="relative w-full flex justify-center overflow-hidden select-none pointer-events-none">
          <h1 className="text-[19vw] font-bold leading-[0.75] tracking-tighter" style={{
            background: "linear-gradient(180deg, #7df2c7 0%, rgba(125, 242, 199, 0.05) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            opacity: 0.9,
            marginBottom: "-4vw" // Push the text slightly down to crop it
          }}>
            RAMMAH
          </h1>
        </div>
      </footer>
    </main>
  );
}
