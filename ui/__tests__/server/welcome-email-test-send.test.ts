import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server/stripe", () => ({ default: {} }));
vi.mock("server/controller", () => ({ contribute: vi.fn() }));
vi.mock("server/graphql/resolvers/helpers", () => ({
  isCollOrGroupAdmin: () => undefined,
  bucketTotalContributions: vi.fn(),
  bucketMinGoal: vi.fn(),
}));

const mockSendBucketCreationWelcomeEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("server/services/EmailService/email.service", () => ({
  default: {
    sendBucketCreationWelcomeEmail: mockSendBucketCreationWelcomeEmail,
  },
}));

const mockPrisma = {
  round: { findFirst: vi.fn(), findUnique: vi.fn() },
  roundMember: { findFirst: vi.fn() },
  groupMember: { findFirst: vi.fn() },
};
vi.mock("server/prisma", () => ({ default: mockPrisma }));

vi.mock("server/graphql/resolvers/auth", () => ({
  isCollOrGroupAdmin: () => undefined,
  isCollMember: () => undefined,
  isCollModOrAdmin: () => undefined,
  isBucketCocreatorOrCollAdminOrMod: () => undefined,
}));
vi.mock("server/utils/jwt", () => ({ verify: vi.fn() }));
vi.mock("server/graphql/resolvers/helpers/isGroupSubscriptionActive", () => ({
  default: vi.fn(),
}));
vi.mock("server/graphql/resolvers/types/Round", () => ({
  membersLimit: vi.fn(),
}));
vi.mock("utils/slugify", () => ({ default: (s: string) => s }));
vi.mock("utils/activity-log", () => ({ default: vi.fn() }));

describe("sendTestWelcomeEmail mutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends welcome email to current user bypassing first-bucket guard", async () => {
    const { sendTestWelcomeEmail } = await import(
      "server/graphql/resolvers/mutations/round"
    );

    const mockRound = {
      id: "round-1",
      title: "Dreams 2026",
      slug: "dreams-2026",
      welcomeEmailSubject: "Welcome!",
      welcomeEmailBody: "Hello dreamer",
      group: { slug: "borderland" },
    };
    mockPrisma.round.findFirst.mockResolvedValue(mockRound);

    const mockUser = { id: "user-1", name: "Hugi", email: "hugi@test.com" };

    await sendTestWelcomeEmail(
      null,
      { roundId: "round-1" },
      { user: mockUser }
    );

    // Should call sendBucketCreationWelcomeEmail with a fake bucket
    // and skipFirstBucketCheck: true
    expect(mockSendBucketCreationWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        round: expect.objectContaining({ id: "round-1" }),
        user: expect.objectContaining({ email: "hugi@test.com" }),
        skipFirstBucketCheck: true,
      })
    );
  });

  it("throws if round has no welcome email configured", async () => {
    const { sendTestWelcomeEmail } = await import(
      "server/graphql/resolvers/mutations/round"
    );

    mockPrisma.round.findFirst.mockResolvedValue({
      id: "round-1",
      welcomeEmailBody: null,
      welcomeEmailSubject: null,
      group: { slug: "borderland" },
    });

    await expect(
      sendTestWelcomeEmail(null, { roundId: "round-1" }, { user: { id: "u1", email: "a@b.com" } })
    ).rejects.toThrow("No welcome email configured");
  });
});
