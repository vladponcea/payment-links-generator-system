import { cookies } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { UserProvider } from "@/lib/user-context";
import { verifyToken, decodeTokenPayload, type AuthUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  let user: AuthUser | null = null;
  if (token) {
    const secret = process.env.APP_PASSWORD || "";
    const isValid = await verifyToken(token, secret);
    if (isValid) {
      const payload = decodeTokenPayload(token);
      if (payload) {
        user = {
          userId: payload.userId,
          email: payload.email,
          name: payload.name,
          role: payload.role,
        };
      }
    }
  }

  return (
    <UserProvider user={user}>
      <div className="flex h-screen overflow-hidden scanlines">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-grid p-6">{children}</main>
        </div>
      </div>
    </UserProvider>
  );
}
