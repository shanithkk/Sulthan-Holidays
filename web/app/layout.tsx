import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WayanadMap from "@/components/WayanadMap";
import WhatsAppButton from "@/components/WhatsAppButton";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sulthan Holidays | Wayanad tour packages and vehicle hire",
  description:
    "Book Wayanad tour packages and hire Tempo Traveller, Tavera or auto with Sulthan Holidays. Honeymoon, family and adventure trips.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so there is no flash. Dark is the default; only a visitor who chose light gets light. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("sh_theme")!=="light")document.documentElement.classList.add("dark")}catch(e){document.documentElement.classList.add("dark")}`,
          }}
        />
      </head>
      <body className="font-sans min-h-full flex flex-col">
        {/* Wayanad district: green border, dark-green dots for the tourist spots */}
        <div className="wayanad-bg" aria-hidden="true">
          <WayanadMap className="h-full w-full" />
        </div>
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsAppButton />
        </AuthProvider>
      </body>
    </html>
  );
}
