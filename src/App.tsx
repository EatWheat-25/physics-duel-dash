import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharacterProvider } from "@/hooks/useCharacter";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Home from "./routes/Home";
import Lobby from "./routes/Lobby";
import DailyChallenge from "./routes/DailyChallenge";
import Study from "./routes/Study";
import BattleQueue from "./routes/BattleQueue";
import Modules from "./routes/Modules";
import Challenges from "./routes/Challenges";
import Progression from "./routes/Progression";
import Shop from "./routes/Shop";
import Customize from "./routes/Customize";
import Loadout from "./routes/Loadout";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import ModeSelection from "./pages/ModeSelection";
import GameModes from "./components/GameModes";
import StepBattlePage from "./components/StepBattlePage";
import BattlePageNew from "./components/BattlePageNew";
import BattleLoader from "./components/BattleLoader";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AdminQuestions from "./pages/AdminQuestions";
import AdminLogin from "./pages/AdminLogin";
import OnlineBattlePage from "./pages/OnlineBattlePage";
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
              <Route path="/" element={<Home />} />
              <Route path="/lobby" element={<Lobby />} />
              <Route path="/daily-challenge" element={<DailyChallenge />} />
              <Route path="/study" element={<Study />} />
              <Route path="/battle/queue" element={<BattleQueue />} />
              <Route path="/modules" element={<Modules />} />
              <Route path="/challenges" element={<Challenges />} />
              <Route path="/progression" element={<Progression />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/customize" element={<Customize />} />
              <Route path="/loadout" element={<Loadout />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/old-home" element={<Index />} />
              <Route path="/modes" element={<ModeSelection />} />
              <Route path="/game-modes" element={<GameModes />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
              <Route path="/battle" element={<BattleLoader />} />
              <Route path="/online-battle/:matchId" element={<OnlineBattlePage />} />
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
