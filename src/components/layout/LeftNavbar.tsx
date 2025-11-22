import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Settings, Database, BarChart3, ChevronLeft, ChevronRight, FolderUp, MessageSquare, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

const navItems: NavItem[] = [
  {
    title: "Ask AI",
    icon: MessageSquare,
    path: "/dashboard/ask-ai",
  },
  {
    title: "Dashboards",
    icon: LayoutDashboard,
    path: "/dashboard/dashboards",
  },
  {
    title: "Project Config",
    icon: Settings,
    path: "/dashboard/project-config",
  },
  {
    title: "Add Data",
    icon: Database,
    path: "/dashboard/add-data",
  },
  {
    title: "Batch Process",
    icon: FolderUp,
    path: "/dashboard/batch-process",
  },
  {
    title: "Consolidated Data",
    icon: BarChart3,
    path: "/dashboard/consolidated-data",
  },
];

const LeftNavbar = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                  "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                  collapsed && "justify-center"
                )
              }
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">{item.title}</span>}
            </NavLink>
          ))}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default LeftNavbar;
