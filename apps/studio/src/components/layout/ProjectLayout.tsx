import { ArrowLeft, FlaskConical, Monitor, Puzzle, Settings, Zap } from "lucide-react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { cx } from "../../lib/cx";
import { useProject } from "../../lib/hooks";
import { SidebarUserCard } from "../UserMenu";

const navItems = [
  { to: "screens", label: "Screens", icon: Monitor },
  { to: "components", label: "Components", icon: Puzzle },
  { to: "actions", label: "Actions", icon: Zap },
  { to: "experiments", label: "Experiments", icon: FlaskConical },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cx(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "bg-slate-100 font-medium text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
  );
}

export function ProjectLayout() {
  const { projectId = "" } = useParams();
  const { data: project } = useProject(projectId);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <Link
            to="/projects"
            className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-600"
          >
            <ArrowLeft size={12} />
            Projects
          </Link>
          <div className="mt-1.5 truncate text-sm font-semibold" title={project?.name}>
            {project?.name ?? "Loading…"}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {navItems.map((item) => (
            <NavLink key={item.to} to={`/${projectId}/${item.to}`} className={navLinkClass}>
              <item.icon size={15} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-2">
          <NavLink to={`/${projectId}/settings`} className={navLinkClass}>
            <Settings size={15} className="shrink-0" />
            Settings
          </NavLink>
        </div>
        <SidebarUserCard />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
