import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharacterProvider } from "@/hooks/useCharacter";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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
import BattleLoader from "./components/BattleLoader";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AdminQuestions from "./pages/AdminQuestions";
import AdminLogin from "./pages/AdminLogin";
import { getRandomQuestions } from "./data/questions";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CharacterProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Index />} />
              <Route path="/subject-selection" element={<SubjectSelection />} />
              <Route path="/math-modes" element={<MathModes />} />
              <Route path="/physics-modes" element={<PhysicsModes />} />
              <Route path="/modes" element={<ModeSelection />} />
              <Route path="/game-modes" element={<GameModes />} />
              <Route path="/matchmaking" element={<MatchmakingScreen />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
              <Route path="/battle" element={<BattleLoader />} />
              <Route path="/physics-battle" element={<BattlePageNew questions={getRandomQuestions(5)} onBattleEnd={() => {}} onGoBack={() => window.location.href = '/'} />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </CharacterProvider>
    </QueryClientProvider>
  );
};

export default App;
