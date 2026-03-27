import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ApiError } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import CreateOrderPage from "@/pages/CreateOrderPage";
import NotFound from "@/pages/NotFound";
import OrderDetailPage from "@/pages/OrderDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import RiderGuidancePage from "@/pages/RiderGuidancePage";
import RoutesPage from "@/pages/RoutesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) {
          return false;
        }

        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/create" element={<CreateOrderPage />} />
            <Route path="/orders/:orderId" element={<OrderDetailPage />} />
            <Route path="/order/:orderId" element={<OrderDetailPage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/guidance" element={<RiderGuidancePage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
