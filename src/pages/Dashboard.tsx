import { Outlet } from "react-router-dom";
import TopNavbar from "@/components/layout/TopNavbar";
import LeftNavbar from "@/components/layout/LeftNavbar";

const Dashboard = () => {
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      <TopNavbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftNavbar />
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
