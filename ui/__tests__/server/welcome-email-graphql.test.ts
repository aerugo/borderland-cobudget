import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock stripe and transitive deps
vi.mock("server/stripe", () => ({ default: {} }));
vi.mock("server/controller", () => ({ contribute: vi.fn() }));

// Mock prisma
const mockPrisma = {
  round: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  roundMember: {
    findFirst: vi.fn(),
  },
  groupMember: {
    findFirst: vi.fn(),
  },
};
vi.mock("server/prisma", () => ({ default: mockPrisma }));

// Mock auth resolvers
vi.mock("server/graphql/resolvers/auth", () => ({
  isCollOrGroupAdmin: (_parent: any, _args: any, ctx: any) => {
    if (!ctx.user) throw new Error("Not authenticated");
    return undefined; // skip = pass
  },
  isCollMember: vi.fn(),
  isCollModOrAdmin: vi.fn(),
  isBucketCocreatorOrCollAdminOrMod: vi.fn(),
}));

// Mock helpers
vi.mock("server/graphql/resolvers/helpers", () => ({
  getCollective: vi.fn(),
  getProject: vi.fn(),
  getRoundFundingStatuses: vi.fn(),
  getRoundMember: vi.fn(),
  isCollAdmin: vi.fn(),
  isCollOrGroupAdmin: vi.fn(),
  isAndGetCollMember: vi.fn(),
  roundMemberBalance: vi.fn(),
  statusTypeToQuery: vi.fn(),
  stripeIsConnected: vi.fn(),
  bucketTotalContributions: vi.fn(),
  bucketMinGoal: vi.fn(),
  updateFundedPercentage: vi.fn(),
  getCollectiveOrProject: vi.fn(),
}));

vi.mock("server/utils/jwt", () => ({ verify: vi.fn() }));
vi.mock("server/services/EmailService/email.service", () => ({ default: {} }));
vi.mock("server/services/eventHub.service", () => ({
  default: { publish: vi.fn(), subscribe: vi.fn() },
}));
vi.mock("server/subscribers/discourse.subscriber", () => ({
  default: { groupHasDiscourse: () => false },
}));
vi.mock("server/utils/roundUtils", () => ({
  getOCToken: () => null,
}));
vi.mock("server/graphql/resolvers/helpers/isGroupSubscriptionActive", () => ({
  default: vi.fn(),
}));
vi.mock("utils/internalLinks", () => ({
  appLink: (path: string) => `https://test.cobudget.com${path}`,
}));
vi.mock("utils/slugify", () => ({
  default: (s: string) => s.toLowerCase().replace(/\s+/g, "-"),
}));
vi.mock("utils/activity-log", () => ({
  default: vi.fn(),
}));
vi.mock("server/graphql/resolvers/types/Round", () => ({
  membersLimit: vi.fn(),
}));

describe("editRound mutation - welcome email fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should save welcomeEmailSubject and welcomeEmailBody", async () => {
    const { editRound } = await import(
      "server/graphql/resolvers/mutations/round"
    );

    mockPrisma.round.findFirst.mockResolvedValue({
      id: "round-1",
      groupId: "group-1",
    });
    mockPrisma.round.update.mockResolvedValue({
      id: "round-1",
      welcomeEmailSubject: "Welcome!",
      welcomeEmailBody: "Hello **world**",
    });

    // editRound is wrapped in combineResolvers with isCollOrGroupAdmin
    // We need to call the resolved function - combineResolvers returns a function
    const result = await editRound(
      null,
      {
        roundId: "round-1",
        welcomeEmailSubject: "Welcome!",
        welcomeEmailBody: "Hello **world**",
      },
      { user: { id: "user-1" } },
      {}
    );

    expect(mockPrisma.round.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "round-1" },
        data: expect.objectContaining({
          welcomeEmailSubject: "Welcome!",
          welcomeEmailBody: "Hello **world**",
        }),
      })
    );
  });

  it("should allow clearing welcome email by passing null", async () => {
    const { editRound } = await import(
      "server/graphql/resolvers/mutations/round"
    );

    mockPrisma.round.findFirst.mockResolvedValue({
      id: "round-1",
      groupId: "group-1",
    });
    mockPrisma.round.update.mockResolvedValue({
      id: "round-1",
      welcomeEmailSubject: null,
      welcomeEmailBody: null,
    });

    await editRound(
      null,
      {
        roundId: "round-1",
        welcomeEmailSubject: null,
        welcomeEmailBody: null,
      },
      { user: { id: "user-1" } },
      {}
    );

    expect(mockPrisma.round.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          welcomeEmailSubject: null,
          welcomeEmailBody: null,
        }),
      })
    );
  });
});
