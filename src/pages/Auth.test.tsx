import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), toast: vi.fn(),
  auth: { signInAnonymously: vi.fn(), signUp: vi.fn(), signInWithPassword: vi.fn() },
  context: { user: null, profile: null } as {
    user: { id: string; is_anonymous: boolean } | null;
    profile: { onboarding_completed: boolean } | null;
  },
  from: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.context }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: mocks.auth, from: mocks.from },
}));
vi.mock("@/components/Starfield", () => ({ Starfield: () => null }));
vi.mock("@/components/LoadingScreen", () => ({ LoadingScreen: () => <div>Loading session</div> }));

const guest = { id: "guest-id", is_anonymous: true };
const success = { data: { user: guest, session: { user: guest } }, error: null };
const clickGuest = () => fireEvent.click(screen.getByRole("button", { name: "Continue as Guest" }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.user = null;
  mocks.context.profile = null;
  mocks.auth.signInAnonymously.mockResolvedValue(success);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) });
});

describe("guest authentication", () => {
  it("uses anonymous auth without email credentials and sends a new guest to onboarding", async () => {
    const view = render(<Auth />);
    clickGuest();
    await waitFor(() => expect(mocks.auth.signInAnonymously).toHaveBeenCalledExactlyOnceWith());
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
    expect(mocks.auth.signInWithPassword).not.toHaveBeenCalled();
    // Mirror the SIGNED_IN event delivered by Supabase to AuthContext.
    mocks.context.user = guest;
    view.rerender(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/onboarding", { replace: true }));
  });

  it.each([true, false])("resumes an existing guest with onboarding_completed=%s", async (completed) => {
    mocks.context.user = guest;
    mocks.context.profile = { onboarding_completed: completed };
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(completed ? "/" : "/onboarding", { replace: true }));
    expect(mocks.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("checks an existing profile before routing when context has not loaded it", async () => {
    mocks.context.user = guest;
    mocks.maybeSingle.mockResolvedValue({ data: { onboarding_completed: true }, error: null });
    render(<Auth />);
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true }));
  });

  it.each(["anonymous_provider_disabled", "signup_disabled"])("offers other methods when %s", async (code) => {
    mocks.auth.signInAnonymously.mockResolvedValue({ data: {}, error: { code } });
    render(<Auth />);
    clickGuest();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining("Please sign in or create an account"), variant: "destructive",
    })));
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it.each([
    { data: {}, error: { code: "over_request_rate_limit" } },
    { data: {}, error: { code: "captcha_failed" } },
    { data: { user: guest, session: null }, error: null },
    { data: { user: null, session: {} }, error: null },
  ])("does not navigate on an unsuccessful anonymous response: %j", async (result) => {
    mocks.auth.signInAnonymously.mockResolvedValue(result);
    render(<Auth />);
    clickGuest();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue as Guest" })).toBeEnabled();
  });

  it("recovers from a thrown network error and allows retry", async () => {
    mocks.auth.signInAnonymously.mockRejectedValueOnce(new Error("Network failed"));
    render(<Auth />);
    clickGuest();
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    clickGuest();
    await waitFor(() => expect(mocks.auth.signInAnonymously).toHaveBeenCalledTimes(2));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate guest requests and competing logins while pending", async () => {
    let finish!: (value: typeof success) => void;
    mocks.auth.signInAnonymously.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<Auth />);
    clickGuest();
    clickGuest();
    expect(mocks.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Continue as Guest" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    finish(success);
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue as Guest" })).toBeEnabled());
  });
});
