import { Home, ListChecks, ShoppingBag, BarChart3, User, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Activity Log", url: "/activities", icon: ListChecks },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuthContext();
  const collapsed = state === "collapsed";
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      collapsible="icon"
      className={`flex flex-col h-full transition-all duration-300 ease-in-out
        ${collapsed ? "w-16" : "w-64"} bg-card border-r border-border shadow-sm`}
      aria-label="Main navigation"
    >
      <SidebarHeader className="flex items-center h-16 px-3 border-b">
        <div className="flex items-center gap-3 w-full">
          <SidebarTrigger className="mr-" />
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-black">KrishiLog</h1>
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm" title="KrishiLog">
              <svg className="h-5 w-5 text-black" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2v20" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-y-auto py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Active = isActive(item.url);
                const itemClasses = `flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors duration-150
                  ${Active ? "bg-sidebar-accent text-black font-medium" : "text-black hover:bg-hover/60"}
                  focus:outline-none focus:ring-2 focus:ring-primary/50`;

                return (
                  <SidebarMenuItem key={item.title} className="px-2">
                    <SidebarMenuButton asChild>
                      {/* When collapsed, show a title tooltip for accessibility */}
                      <NavLink
                        to={item.url}
                        end
                        className={({ isActive: navIsActive }: { isActive: boolean }) =>
                          `${itemClasses} ${navIsActive ? "bg-sidebar-accent text-black font-medium" : ""}`
                        }
                        title={collapsed ? item.title : undefined}
                        aria-current={Active ? "page" : undefined}
                      >
                        <item.icon
                          className="h-5 w-5 shrink-0 text-black"
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.title}</span>}
                        {/* active indicator dot on the right when expanded */}
                        {!collapsed && Active && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-4 border-t">
        <div className="w-full">
          <Button
            variant="ghost"
            onClick={signOut}
            className={`w-full justify-start gap-3 rounded-md transition-colors text-black ${collapsed ? "px-2 py-2" : "px-3 py-2"}`}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 text-black" />
            {!collapsed && <span className="ml-1 text-black">Logout</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
