import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock urql
const mockMutate = vi.fn().mockResolvedValue({ data: {}, error: null });
vi.mock("urql", () => ({
  useMutation: () => [{ fetching: false }, mockMutate],
  useQuery: () => [{ data: null, fetching: false }],
  gql: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), ""),
}));

// Mock react-hot-toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// Mock TextField to capture wysiwyg onChange
vi.mock("components/TextField", () => ({
  default: ({ label, placeholder, value, defaultValue, onChange, wysiwyg, multiline, rows, ...props }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input
        aria-label={label || placeholder}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        data-wysiwyg={wysiwyg ? "true" : undefined}
      />
    </div>
  ),
}));

// Mock Button
vi.mock("components/Button", () => ({
  default: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>{children}</button>
  ),
}));

// Mock Spinner
vi.mock("components/Spinner", () => ({
  default: () => <div>Loading...</div>,
}));

describe("WelcomeEmail Settings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders with empty state when no welcome email is configured", async () => {
    const WelcomeEmail = (await import("components/RoundSettings/WelcomeEmail")).default;
    render(
      <WelcomeEmail
        round={{ id: "round-1", color: "#000", welcomeEmailSubject: null, welcomeEmailBody: null }}
        currentGroup={{}} currentUser={{}}
      />
    );
    expect(screen.getByText("Welcome Email")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /disable/i })).not.toBeInTheDocument();
  });

  it("renders with existing welcome email data and shows Disable button", async () => {
    const WelcomeEmail = (await import("components/RoundSettings/WelcomeEmail")).default;
    render(
      <WelcomeEmail
        round={{ id: "round-1", color: "#000", welcomeEmailSubject: "Welcome!", welcomeEmailBody: "Hello world" }}
        currentGroup={{}} currentUser={{}}
      />
    );
    expect(screen.getByRole("button", { name: /disable/i })).toBeInTheDocument();
  });

  it("calls editRound mutation and shows toast on save", async () => {
    const WelcomeEmail = (await import("components/RoundSettings/WelcomeEmail")).default;
    render(
      <WelcomeEmail
        round={{ id: "round-1", color: "#000", welcomeEmailSubject: "Old subject", welcomeEmailBody: "Old body" }}
        currentGroup={{}} currentUser={{}}
      />
    );

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ roundId: "round-1" })
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("saved"));
    });
  });

  it("calls editRound with null fields and shows toast on disable", async () => {
    const WelcomeEmail = (await import("components/RoundSettings/WelcomeEmail")).default;
    render(
      <WelcomeEmail
        round={{ id: "round-1", color: "#000", welcomeEmailSubject: "Welcome!", welcomeEmailBody: "Some content" }}
        currentGroup={{}} currentUser={{}}
      />
    );

    const clearButton = screen.getByRole("button", { name: /disable/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ roundId: "round-1", welcomeEmailSubject: null, welcomeEmailBody: null })
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("disabled"));
    });
  });
});
