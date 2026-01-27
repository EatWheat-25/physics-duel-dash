import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharacterProvider } from "@/hooks/useCharacter";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ElevatorShutterProvider } from "@/components/transitions/ElevatorShutterTransition";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Home from "./routes/Home";
import Lobby from "./routes/Lobby";
import LobbyNew from "./pages/LobbyNew";
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
import Career from "./pages/Career";
import NotFound from "./pages/NotFound";
import ModeSelection from "./pages/ModeSelection";
import GameModes from "./components/GameModes";
import StepBattlePage from "./components/StepBattlePage";
import BattlePageNew from "./components/BattlePageNew";
import BattleLoader from "./components/BattleLoader";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import AdminDashboard from "./pages/AdminDashboard";
import AdminQuestions from "./pages/AdminQuestions";
import AdminLogin from "./pages/AdminLogin";
import AdminEndgamePreview from "./pages/AdminEndgamePreview";
import OnlineBattlePage from "./pages/OnlineBattlePage";
import BattleConnected from "./pages/BattleConnected";
import MatchResults from "./pages/MatchResults";
import DebugQuestions from "./pages/DebugQuestions";
import Practice from "./pages/Practice";
import MatchSandbox from "./pages/MatchSandbox";
import { DevContractTest } from "./pages/DevContractTest";
import { DevDatabaseTest } from "./pages/DevDatabaseTest";
import { DevMapperTest } from "./pages/DevMapperTest";
import MatchmakingTest from "./pages/MatchmakingTest";
import BattleSimple from "./pages/BattleSimple";
import SupabaseDebug from "./pages/SupabaseDebug";
import { getRandomQuestions } from "./data/questions";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CharacterProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ElevatorShutterProvider>
              <AuthProvider>
                <div className="h-full overflow-hidden">
                  <div className="h-full overflow-auto">
                    <Routes>
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/" element={<Home />} />
                      <Route path="/lobby" element={<Lobby />} />
                      <Route path="/matchmaking-new" element={<LobbyNew />} />
                      <Route path="/daily-challenge" element={<DailyChallenge />} />
                      <Route path="/study" element={<Study />} />
                      <Route path="/practice" element={<Practice />} />
                      <Route path="/battle/queue" element={<BattleQueue />} />
                      <Route path="/modules" element={<Modules />} />
                      <Route path="/challenges" element={<Challenges />} />
                      <Route path="/progression" element={<Progression />} />
                      <Route path="/shop" element={<Shop />} />
                      <Route path="/customize" element={<Customize />} />
                      <Route path="/loadout" element={<Loadout />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/career" element={<Career />} />
                      <Route path="/old-home" element={<Index />} />
                      <Route path="/modes" element={<ModeSelection />} />
                      <Route path="/game-modes" element={<GameModes />} />
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                      <Route
                        path="/admin/dashboard"
                        element={
                          <ProtectedAdminRoute>
                            <AdminDashboard />
                          </ProtectedAdminRoute>
                        }
                      />
                      <Route path="/admin/questions" element={<AdminQuestions />} />
                      <Route
                        path="/admin/preview/endgame"
                        element={
                          <ProtectedAdminRoute>
                            <AdminEndgamePreview />
                          </ProtectedAdminRoute>
                        }
                      />
                      <Route path="/debug/questions" element={<DebugQuestions />} />
                      <Route path="/dev/match-sandbox" element={<MatchSandbox />} />
                      <Route path="/dev/contract-test" element={<DevContractTest />} />
                      <Route path="/dev/db-test" element={<DevDatabaseTest />} />
                      <Route path="/dev/mapper-test" element={<DevMapperTest />} />
                      <Route path="/supabase-debug" element={<SupabaseDebug />} />
                      <Route path="/matchmaking-test" element={<MatchmakingTest />} />
                      <Route path="/battle-simple/:matchId" element={<BattleSimple />} />
                      <Route path="/battle" element={<BattleLoader />} />
                      {/* Old route - using useGame hook (deprecated, use /online-battle-new instead) */}
                      {/* <Route path="/online-battle/:matchId" element={<OnlineBattlePage />} /> */}
                      <Route path="/online-battle-new/:matchId" element={<BattleConnected />} />
                      <Route path="/battle/:matchId" element={<BattleConnected />} />
                      <Route path="/match-results/:matchId" element={<MatchResults />} />
                      <Route
                        path="/physics-battle"
                        element={
                          <BattlePageNew
                            questions={getRandomQuestions(5)}
                            onBattleEnd={() => {}}
                            onGoBack={() => (window.location.href = '/')}
                          />
                        }
                      />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </div>
              </AuthProvider>
            </ElevatorShutterProvider>
          </BrowserRouter>
        </TooltipProvider>
      </CharacterProvider>
    </QueryClientProvider>
  );
};

export default App;
