import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalFrame } from "@/components/PortalFrame";

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
    <PortalFrame user={session.user}>
      {children}
    </PortalFrame>
  );
}

