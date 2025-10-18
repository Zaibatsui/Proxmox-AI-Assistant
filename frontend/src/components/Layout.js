import { NavLink } from "react-router-dom";
import { LogOut, Server, Cpu, Box, MessageSquare, Activity, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

function Layout({ children, onLogout, currentPage }) {
  const username = localStorage.getItem("username");

  const navItems = [
    { name: "Dashboard", path: "/", icon: Server, key: "dashboard" },
    { name: "Devices", path: "/devices", icon: Cpu, key: "devices" },
    { name: "VMs & CTs", path: "/vms", icon: Box, key: "vms" },
    { name: "AI Assistant", path: "/assistant", icon: MessageSquare, key: "assistant" },
    { name: "Actions", path: "/actions", icon: Activity, key: "actions" },
    { name: "Audit Log", path: "/audit", icon: FileText, key: "audit" },
    { name: "Settings", path: "/settings", icon: Settings, key: "settings" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Server className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Proxmox AI</h1>
              <p className="text-xs text-slate-500">Hardware Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1" data-testid="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive || currentPage === item.key
                      ? "bg-cyan-500/10 text-cyan-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`
                }
                data-testid={`nav-${item.key}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(var(--theme-primary-rgb), 0.1)' }}>
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-semibold truncate theme-text">{username}</p>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            className="w-full theme-btn-primary text-white border-0"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export default Layout;
