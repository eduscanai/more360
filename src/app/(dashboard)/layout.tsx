import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div
      className="dashboard-root"
      style={{ background: "var(--bg-gradient)", overflow: "hidden", position: "relative" }}
    >
      <div
        style={{
          position: "fixed",
          top: "-120px",
          right: "-60px",
          width: "450px",
          height: "450px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(100,80,200,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "-100px",
          left: "180px",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(60,180,160,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        className="dashboard-root"
        style={{ position: "relative", display: "flex" }}
      >
        <Sidebar userName={session.name} role={session.role} />
        <main
          className="dashboard-main"
          style={{ flex: 1, overflow: "auto", position: "relative", height: "100%" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
