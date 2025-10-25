import { NavLink } from "react-router-dom";
import { LogOut, Server, Cpu, Box, MessageSquare, Activity, FileText, Settings, FolderOpen, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";

function Layout({ children, onLogout, currentPage }) {
  const username = localStorage.getItem("username");

  const navItems = [
    { name: "Dashboard", path: "/", icon: Server, key: "dashboard" },
    { name: "Devices", path: "/devices", icon: Cpu, key: "devices" },
    { name: "VMs & CTs", path: "/vms", icon: Box, key: "vms" },
    { name: "AI Assistant", path: "/assistant", icon: MessageSquare, key: "assistant" },
    { name: "File Browser", path: "/files", icon: FolderOpen, key: "files" },
    { name: "Backups", path: "/backups", icon: Archive, key: "backups" },
    { name: "Actions", path: "/actions", icon: Activity, key: "actions" },
    { name: "Audit Log", path: "/audit", icon: FileText, key: "audit" },
    { name: "Settings", path: "/settings", icon: Settings, key: "settings" }
  ];

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside className="flex flex-col border-r h-screen sticky top-0 overflow-y-auto" style={{ 
        width: 'var(--sidebar-width)', 
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--bg-border)'
      }}>
        <div className="border-b" style={{ 
          padding: 'calc(1.5rem * var(--layout-density))',
          borderColor: 'var(--bg-border)'
        }}>
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav" style={{ 
          padding: 'calc(0.75rem * var(--layout-density))'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 transition-colors ${
                    isActive || currentPage === item.key
                      ? "theme-text"
                      : "text-slate-400 hover:text-slate-200"
                  }`
                }
                style={({ isActive }) => ({
                  padding: `calc(0.75rem * var(--layout-density)) calc(1rem * var(--layout-density))`,
                  borderRadius: 'var(--border-radius)',
                  backgroundColor: (isActive || currentPage === item.key) 
                    ? 'rgba(var(--theme-primary-rgb), 0.1)' 
                    : 'transparent'
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.classList.contains('theme-text')) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.classList.contains('theme-text')) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                data-testid={`nav-${item.key}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t" style={{ 
          padding: 'calc(1rem * var(--layout-density))',
          borderColor: 'var(--bg-border)'
        }}>
          <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(var(--theme-primary-rgb), 0.1)' }}>
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-semibold truncate theme-text">{username}</p>
            <p className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-700">Version 2.0</p>
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
        <div className="max-w-7xl mx-auto" style={{ 
          padding: 'calc(2rem * var(--layout-density))'
        }}>{children}</div>
      </main>
    </div>
  );
}

export default Layout;
