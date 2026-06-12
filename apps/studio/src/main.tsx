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
        toast.error(`${error.code}: ${error.message}`);
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
