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

// Mock Wysiwyg (complex remirror dependency)
vi.mock("components/Wysiwyg", () => ({
  default: ({
    defaultValue,
    onChange,
    ...props
  }: {
    defaultValue: string;
    onChange: (e: { target: { value: string } }) => void;
  }) => (
    <textarea
      data-testid="wysiwyg"
      defaultValue={defaultValue}
      onChange={(e) => onChange({ target: { value: e.target.value } })}
    />
  ),
}));

// Mock MUI
vi.mock("@mui/material", async () => {
  const actual = await vi.importActual("@mui/material");
  return {
    ...actual,
    Button: ({ children, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  };
});

// Mock styled Card
vi.mock("components/styled/Card", () => ({
  default: ({ children }: any) => <div data-testid="card">{children}</div>,
}));

describe("WelcomeEmail Settings Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with empty state when no welcome email is configured", async () => {
    const WelcomeEmail = (
      await import("components/RoundSettings/WelcomeEmail")
    ).default;

    render(
      <WelcomeEmail
        round={{
          id: "round-1",
          color: "#000",
          welcomeEmailSubject: null,
          welcomeEmailBody: null,
        }}
        currentGroup={{}}
        currentUser={{}}
      />
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    expect(subjectInput).toHaveValue("");
  });

  it("renders with existing welcome email data", async () => {
    const WelcomeEmail = (
      await import("components/RoundSettings/WelcomeEmail")
    ).default;

    render(
      <WelcomeEmail
        round={{
          id: "round-1",
          color: "#000",
          welcomeEmailSubject: "Welcome dreamer!",
          welcomeEmailBody: "Hello **world**",
        }}
        currentGroup={{}}
        currentUser={{}}
      />
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    expect(subjectInput).toHaveValue("Welcome dreamer!");

    const wysiwyg = screen.getByTestId("wysiwyg");
    expect(wysiwyg).toHaveValue("Hello **world**");
  });

  it("calls editRound mutation with welcome email fields on save", async () => {
    const WelcomeEmail = (
      await import("components/RoundSettings/WelcomeEmail")
    ).default;

    render(
      <WelcomeEmail
        round={{
          id: "round-1",
          color: "#000",
          welcomeEmailSubject: "Old subject",
          welcomeEmailBody: "Old body",
        }}
        currentGroup={{}}
        currentUser={{}}
      />
    );

    const subjectInput = screen.getByLabelText(/subject/i);
    fireEvent.change(subjectInput, { target: { value: "New subject" } });

    const saveButton = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          roundId: "round-1",
          welcomeEmailSubject: "New subject",
        })
      );
    });
  });

  it("calls editRound mutation with null fields on clear", async () => {
    const WelcomeEmail = (
      await import("components/RoundSettings/WelcomeEmail")
    ).default;

    render(
      <WelcomeEmail
        round={{
          id: "round-1",
          color: "#000",
          welcomeEmailSubject: "Welcome!",
          welcomeEmailBody: "Some content",
        }}
        currentGroup={{}}
        currentUser={{}}
      />
    );

    const clearButton = screen.getByRole("button", { name: /clear|disable/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          roundId: "round-1",
          welcomeEmailSubject: null,
          welcomeEmailBody: null,
        })
      );
    });
  });
});
