import { Navigate, createBrowserRouter } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { ProjectLayout } from "./components/layout/ProjectLayout";
import { ActionEditor } from "./features/actions/ActionEditor";
import { ActionList } from "./features/actions/ActionList";
import { ActionNew } from "./features/actions/ActionNew";
import { ComponentEditor } from "./features/components/ComponentEditor";
import { ComponentList } from "./features/components/ComponentList";
import { ComponentNew } from "./features/components/ComponentNew";
import { ScreenEditor } from "./features/editor/ScreenEditor";
import { ExperimentDetail } from "./features/experiments/ExperimentDetail";
import { ExperimentList } from "./features/experiments/ExperimentList";
import { ExperimentNew } from "./features/experiments/ExperimentNew";
import { InvitePage } from "./features/invites/InvitePage";
import { ScreenPreview } from "./features/preview/ScreenPreview";
import { ProjectList } from "./features/projects/ProjectList";
import { ProjectNew } from "./features/projects/ProjectNew";
import { ProjectSettings } from "./features/projects/ProjectSettings";
import { ScreenList } from "./features/screens/ScreenList";
import { ScreenNew } from "./features/screens/ScreenNew";
import { WorkspaceSettings } from "./features/workspaces/WorkspaceSettings";

export const router = createBrowserRouter([
  // Public: invite links must work without a session (signup flow).
  { path: "/invite/:token", element: <InvitePage /> },
  {
    // Everything else requires a session; AuthGate renders setup/login/Outlet.
    element: <AuthGate />,
    children: [
      { path: "/", element: <Navigate to="/projects" replace /> },
      { path: "/projects", element: <ProjectList /> },
      { path: "/projects/new", element: <ProjectNew /> },
      { path: "/workspaces/:workspaceId/settings", element: <WorkspaceSettings /> },
      {
        path: "/:projectId",
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="screens" replace /> },
          { path: "screens", element: <ScreenList /> },
          { path: "screens/new", element: <ScreenNew /> },
          { path: "screens/:screenId", element: <ScreenEditor /> },
          { path: "screens/:screenId/preview", element: <ScreenPreview /> },
          { path: "components", element: <ComponentList /> },
          { path: "components/new", element: <ComponentNew /> },
          { path: "components/:componentId", element: <ComponentEditor /> },
          { path: "actions", element: <ActionList /> },
          { path: "actions/new", element: <ActionNew /> },
          { path: "actions/:actionId", element: <ActionEditor /> },
          { path: "experiments", element: <ExperimentList /> },
          { path: "experiments/new", element: <ExperimentNew /> },
          { path: "experiments/:experimentId", element: <ExperimentDetail /> },
          { path: "settings", element: <ProjectSettings /> },
        ],
      },
      { path: "*", element: <Navigate to="/projects" replace /> },
    ],
  },
]);
