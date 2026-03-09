import { Suspense } from "react";
import { connection } from "next/server";
import Dashboard from "./dashboard";

async function DashboardWithDate() {
  await connection();
  const defaultStartDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  return <Dashboard defaultStartDate={defaultStartDate} />;
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400">
          Loading...
        </div>
      }
    >
      <DashboardWithDate />
    </Suspense>
  );
}
