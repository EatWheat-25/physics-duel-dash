import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), toast: vi.fn(), refreshProfile: vi.fn(),
  getUser: vi.fn(), from: vi.fn(), upsert: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ refreshProfile: mocks.refreshProfile }) }));
vi.mock("@/components/Starfield", () => ({ Starfield: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "guest-id", is_anonymous: true } } });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    upsert: mocks.upsert,
  });
});

it("creates a profile and refreshes it for an anonymous user without an email", async () => {
  render(<Onboarding />);
  await waitFor(() => expect(mocks.getUser).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: " Guest Player " } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByLabelText("Age"), { target: { value: "18" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Complete" }));
  await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith({
    id: "guest-id", username: "Guest Player", age: 18,
    subjects: [{ subject: "math", level: "A1" }], onboarding_completed: true,
  }, { onConflict: "id", ignoreDuplicates: false }));
  expect(mocks.refreshProfile).toHaveBeenCalledOnce();
  expect(mocks.navigate).toHaveBeenCalledWith("/");
});
