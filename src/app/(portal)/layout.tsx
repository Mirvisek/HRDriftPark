import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navigation } from "@/components/Navigation";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as any).mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0f0f0f] text-[#e0e0e0] font-sans">
      {/* Nawigacja (Desktop sidebar oraz Mobile header & drawer) */}
      <Navigation user={session.user} />

      {/* Główna treść */}
      <main className="flex-1 bg-[#121212] p-6 md:p-10 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  );
}

