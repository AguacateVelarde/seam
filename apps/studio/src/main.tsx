import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toasts } from "./components/ui/Toasts";
import { ApiError } from "./lib/api";
import { router } from "./router";
import { toast } from "./store/toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof ApiError) {
        // e.g. EXPERIMENT_CONFLICT (409) ships meta.problems with the list of
        // invalid patches — surface them so the toast is actionable.
        const problems = (error.meta as { problems?: unknown } | null)?.problems;
        const detail =
          Array.isArray(problems) && problems.length > 0
            ? ` — ${problems.map(String).join("; ")}`
            : "";
        toast.error(`${error.code}: ${error.message}${detail}`);
      } else {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    },
  }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toasts />
    </QueryClientProvider>
  </React.StrictMode>,
);
