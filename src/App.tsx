import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SubjectSelection from "./pages/SubjectSelection";
import MathModes from "./pages/MathModes";
import PhysicsModes from "./pages/PhysicsModes";
import ModeSelection from "./pages/ModeSelection";
import MatchmakingScreen from "./components/MatchmakingScreen";
import GameModes from "./components/GameModes";
import StepBattlePage from "./components/StepBattlePage";
import BattlePageNew from "./components/BattlePageNew";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/subject-selection" element={<SubjectSelection />} />
          <Route path="/math-modes" element={<MathModes />} />
          <Route path="/physics-modes" element={<PhysicsModes />} />
          <Route path="/modes" element={<ModeSelection />} />
          <Route path="/game-modes" element={<GameModes />} />
          <Route path="/matchmaking" element={<MatchmakingScreen />} />
          <Route path="/battle" element={<StepBattlePage questions={[]} onBattleEnd={() => {}} onGoBack={() => window.location.href = '/'} />} />
          <Route path="/physics-battle" element={<BattlePageNew questions={[]} onBattleEnd={() => {}} onGoBack={() => window.location.href = '/'} />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
