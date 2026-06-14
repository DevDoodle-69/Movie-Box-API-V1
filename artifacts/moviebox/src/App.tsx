import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import Home from "@/pages/Home";
import SearchPage from "@/pages/Search";
import DetailPage from "@/pages/Detail";
import WatchPage from "@/pages/Watch";
import TestLive from "@/pages/TestLive";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchPage} />
      <Route path="/detail/:id" component={DetailPage} />
      <Route path="/watch/:id" component={WatchPage} />
      <Route path="/test-live" component={TestLive} />
      <Route>
        <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-4">
          <h1 className="text-5xl font-black text-[#e50914]">404</h1>
          <p className="text-gray-400 text-lg">Page not found</p>
          <a href="/" className="px-6 py-2.5 bg-[#e50914] text-white rounded-lg font-semibold hover:bg-red-700 transition-colors">
            Go Home
          </a>
        </div>
      </Route>
    </Switch>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen bg-[#141414]">
      <Switch>
        <Route path="/watch/:id">
          <WatchPage />
        </Route>
        <Route>
          <Navbar />
          <Router />
        </Route>
      </Switch>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppShell />
      </WouterRouter>
    </QueryClientProvider>
  );
}
