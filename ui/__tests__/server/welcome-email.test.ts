import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock stripe (throws in browser/jsdom)
vi.mock("server/stripe", () => ({ default: {} }));

// Mock controller (depends on stripe)
vi.mock("server/controller", () => ({
  contribute: vi.fn(),
}));

// Mock graphql helpers (depends on stripe)
vi.mock("server/graphql/resolvers/helpers", () => ({
  bucketTotalContributions: vi.fn(),
  bucketMinGoal: vi.fn(),
}));

// Mock prisma
const mockPrisma = {
  bucket: {
    count: vi.fn(),
  },
  round: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};
vi.mock("server/prisma", () => ({ default: mockPrisma }));

// Mock send-email
const mockSendEmail = vi.fn();
vi.mock("server/send-email", () => ({
  sendEmail: mockSendEmail,
  sendEmails: vi.fn(),
}));

// Mock internalLinks
vi.mock("utils/internalLinks", () => ({
  appLink: (path: string) => `https://test.cobudget.com${path}`,
}));

// Mock get-request-origin
vi.mock("server/get-request-origin", () => ({
  getRequestOrigin: () => "https://test.cobudget.com",
}));

// Mock discourse subscriber
vi.mock("server/subscribers/discourse.subscriber", () => ({
  default: { groupHasDiscourse: () => false },
}));

// Mock colors util
vi.mock("utils/colors", () => ({
  tailwindHsl: { anthracit: { 200: "#e5e5e5" } },
}));

// Mock user meta
vi.mock("server/utils/user.meta", () => ({
  shouldSendMagicLink: vi.fn().mockResolvedValue(true),
  updateLastMagicLinkTime: vi.fn(),
}));

// Mock validator
vi.mock("validator/lib/escape", () => ({
  default: (s: string) => s,
}));

describe("Welcome Email Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendBucketCreationWelcomeEmail", () => {
    let emailService: any;

    beforeEach(async () => {
      // Dynamic import to pick up mocks
      const mod = await import(
        "server/services/EmailService/email.service"
      );
      emailService = mod.default;
    });

    it("should send welcome email when round has welcomeEmailBody and it is user's first bucket", async () => {
      mockPrisma.bucket.count.mockResolvedValue(0); // no other buckets

      await emailService.sendBucketCreationWelcomeEmail({
        round: {
          id: "round-1",
          title: "Borderland Dreams 2026",
          slug: "borderland-dreams-2026",
          welcomeEmailSubject: "Welcome dreamer!",
          welcomeEmailBody: "You just created a dream. **Congrats!**",
          group: { slug: "borderland" },
        },
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        bucket: { id: "bucket-1", title: "My Cool Dream" },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const emailArg = mockSendEmail.mock.calls[0][0];
      expect(emailArg.to).toBe("alice@example.com");
      expect(emailArg.subject).toBe("Welcome dreamer!");
      expect(emailArg.html).toContain("Alice");
      expect(emailArg.html).toContain("My Cool Dream");
    });

    it("should NOT send welcome email when round has no welcomeEmailBody", async () => {
      await emailService.sendBucketCreationWelcomeEmail({
        round: {
          id: "round-1",
          title: "Borderland Dreams 2026",
          slug: "borderland-dreams-2026",
          welcomeEmailBody: null,
          welcomeEmailSubject: null,
          group: { slug: "borderland" },
        },
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        bucket: { id: "bucket-1", title: "My Cool Dream" },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should NOT send welcome email when user already has buckets in the round", async () => {
      mockPrisma.bucket.count.mockResolvedValue(1); // has another bucket

      await emailService.sendBucketCreationWelcomeEmail({
        round: {
          id: "round-1",
          title: "Borderland Dreams 2026",
          slug: "borderland-dreams-2026",
          welcomeEmailSubject: "Welcome!",
          welcomeEmailBody: "Hello there!",
          group: { slug: "borderland" },
        },
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        bucket: { id: "bucket-1", title: "My Cool Dream" },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should use default subject when welcomeEmailSubject is null", async () => {
      mockPrisma.bucket.count.mockResolvedValue(0);

      await emailService.sendBucketCreationWelcomeEmail({
        round: {
          id: "round-1",
          title: "Borderland Dreams 2026",
          slug: "borderland-dreams-2026",
          welcomeEmailSubject: null,
          welcomeEmailBody: "Welcome to the round!",
          group: { slug: "borderland" },
        },
        user: { id: "user-1", name: "Alice", email: "alice@example.com" },
        bucket: { id: "bucket-1", title: "My Cool Dream" },
      });

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      const emailArg = mockSendEmail.mock.calls[0][0];
      expect(emailArg.subject).toBe("Welcome to Borderland Dreams 2026!");
    });

    it("should convert markdown body to HTML", async () => {
      mockPrisma.bucket.count.mockResolvedValue(0);

      await emailService.sendBucketCreationWelcomeEmail({
        round: {
          id: "round-1",
          title: "Test Round",
          slug: "test-round",
          welcomeEmailSubject: "Welcome",
          welcomeEmailBody: "This is **bold** text",
          group: { slug: "test-group" },
        },
        user: { id: "user-1", name: "Bob", email: "bob@example.com" },
        bucket: { id: "bucket-1", title: "Bob's Bucket" },
      });

      const emailArg = mockSendEmail.mock.calls[0][0];
      expect(emailArg.html).toContain("<strong>bold</strong>");
    });
  });
});
