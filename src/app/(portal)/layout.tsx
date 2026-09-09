import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalFrame } from "@/components/PortalFrame";

export const dynamic = 'force-dynamic';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session = null;
  try {
    session = await auth();
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('Dynamic server usage')) {
      throw error;
    }
    console.error("[PortalLayout] Błąd weryfikacji sesji użytkownika:", error);
  }

  if (!session?.user) {
    redirect("/login");
  }

  if ((session.user as any).mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <PortalFrame user={session.user}>
      {children}
    </PortalFrame>
  );
}

