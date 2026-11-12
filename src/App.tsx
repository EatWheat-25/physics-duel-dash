import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CharacterProvider } from "@/hooks/useCharacter";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ElevatorShutterProvider } from "@/components/transitions/ElevatorShutterTransition";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedAdminRoute } from "./components/ProtectedAdminRoute";
import Home from "./routes/Home";

// Every screen except Home is loaded on demand, so a player never downloads
// the admin tools (or any screen they do not open).
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const LobbyNew = lazy(() => import("./pages/LobbyNew"));
const BattleConnected = lazy(() => import("./pages/BattleConnected"));
const MatchResults = lazy(() => import("./pages/MatchResults"));
const CampaignMode = lazy(() => import("./pages/CampaignMode"));
const SoloChallenge = lazy(() => import("./pages/SoloChallenge"));
const Practice = lazy(() => import("./pages/Practice"));
const Profile = lazy(() => import("./pages/Profile"));
const Career = lazy(() => import("./pages/Career"));
const DailyChallenge = lazy(() => import("./routes/DailyChallenge"));
const Study = lazy(() => import("./routes/Study"));
const Modules = lazy(() => import("./routes/Modules"));
const Challenges = lazy(() => import("./routes/Challenges"));
const Progression = lazy(() => import("./routes/Progression"));
const Shop = lazy(() => import("./routes/Shop"));
const Customize = lazy(() => import("./routes/Customize"));
const Loadout = lazy(() => import("./routes/Loadout"));
const NotFound = lazy(() => import("./pages/NotFound"));

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminQuestions = lazy(() => import("./pages/AdminQuestions"));
const AdminDiagrams = lazy(() => import("./pages/AdminDiagrams"));
const AdminEndgamePreview = lazy(() => import("./pages/AdminEndgamePreview"));
const AdminChemPreview = lazy(() => import("./pages/AdminChemPreview"));

// Dev/debug tooling: routed only on a local dev server.
const DebugQuestions = lazy(() => import("./pages/DebugQuestions"));
const MatchSandbox = lazy(() => import("./pages/MatchSandbox"));
const SupabaseDebug = lazy(() => import("./pages/SupabaseDebug"));
const DevContractTest = lazy(() => import("./pages/DevContractTest").then((m) => ({ default: m.DevContractTest })));
const DevDatabaseTest = lazy(() => import("./pages/DevDatabaseTest").then((m) => ({ default: m.DevDatabaseTest })));
const DevMapperTest = lazy(() => import("./pages/DevMapperTest").then((m) => ({ default: m.DevMapperTest })));

const queryClient = new QueryClient();

const ScreenLoading = () => (
  <div className="h-full min-h-screen flex items-center justify-center bg-slate-950" role="status" aria-label="Loading">
    <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
  </div>
);

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
                    <Suspense fallback={<ScreenLoading />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="/onboarding" element={<Onboarding />} />

                        {/* Online 1v1 */}
                        <Route path="/matchmaking-new" element={<LobbyNew />} />
                        <Route path="/battle/:matchId" element={<BattleConnected />} />
                        <Route path="/online-battle-new/:matchId" element={<BattleConnected />} />
                        <Route path="/match-results/:matchId" element={<MatchResults />} />

                        {/* Solo modes */}
                        <Route path="/campaign" element={<CampaignMode />} />
                        <Route path="/campaign/play" element={<SoloChallenge />} />
                        <Route path="/solo-challenge" element={<SoloChallenge />} />
                        <Route path="/practice" element={<Practice />} />

                        {/* Player hub */}
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/career" element={<Career />} />
                        <Route path="/daily-challenge" element={<DailyChallenge />} />
                        <Route path="/study" element={<Study />} />
                        <Route path="/modules" element={<Modules />} />
                        <Route path="/challenges" element={<Challenges />} />
                        <Route path="/progression" element={<Progression />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/customize" element={<Customize />} />
                        <Route path="/loadout" element={<Loadout />} />

                        {/* Old screens were removed; their addresses lead to the current ones. */}
                        <Route path="/lobby" element={<Navigate to="/matchmaking-new" replace />} />
                        <Route path="/battle/queue" element={<Navigate to="/matchmaking-new" replace />} />
                        <Route path="/battle" element={<Navigate to="/matchmaking-new" replace />} />
                        <Route path="/battle-simple/:matchId" element={<Navigate to="/matchmaking-new" replace />} />
                        <Route path="/physics-battle" element={<Navigate to="/" replace />} />
                        <Route path="/old-home" element={<Navigate to="/" replace />} />
                        <Route path="/game-modes" element={<Navigate to="/campaign" replace />} />
                        <Route path="/modes" element={<Navigate to="/campaign" replace />} />
                        <Route path="/offline" element={<Navigate to="/campaign" replace />} />

                        {/* Admin */}
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
                          path="/admin/diagrams"
                          element={
                            <ProtectedAdminRoute>
                              <AdminDiagrams />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route
                          path="/admin/preview/endgame"
                          element={
                            <ProtectedAdminRoute>
                              <AdminEndgamePreview />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route
                          path="/admin/preview/chem"
                          element={
                            // Static drawings only, so it is open on a local dev server for quick checking.
                            import.meta.env.DEV ? (
                              <AdminChemPreview />
                            ) : (
                              <ProtectedAdminRoute>
                                <AdminChemPreview />
                              </ProtectedAdminRoute>
                            )
                          }
                        />

                        {import.meta.env.DEV && (
                          <>
                            <Route path="/debug/questions" element={<DebugQuestions />} />
                            <Route path="/dev/match-sandbox" element={<MatchSandbox />} />
                            <Route path="/dev/contract-test" element={<DevContractTest />} />
                            <Route path="/dev/db-test" element={<DevDatabaseTest />} />
                            <Route path="/dev/mapper-test" element={<DevMapperTest />} />
                            <Route path="/supabase-debug" element={<SupabaseDebug />} />
                          </>
                        )}

                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
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
