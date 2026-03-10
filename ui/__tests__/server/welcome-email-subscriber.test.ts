import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock stripe
vi.mock("server/stripe", () => ({ default: {} }));
vi.mock("server/controller", () => ({ contribute: vi.fn() }));
vi.mock("server/graphql/resolvers/helpers", () => ({}));

// Mock email service
const mockSendBucketCreationWelcomeEmail = vi.fn();
vi.mock("server/services/EmailService/email.service", () => ({
  default: {
    sendBucketCreationWelcomeEmail: mockSendBucketCreationWelcomeEmail,
    sendCommentNotification: vi.fn(),
    allocateToMemberNotification: vi.fn(),
    bulkAllocateNotification: vi.fn(),
    cancelFundingNotification: vi.fn(),
    bucketPublishedNotification: vi.fn(),
    contributionToBucketNotification: vi.fn(),
  },
}));

describe("Email Subscriber - Welcome Email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should subscribe to create-bucket event and call sendBucketCreationWelcomeEmail", async () => {
    const subscriptions: Record<string, Function> = {};
    const mockEventHub = {
      subscribe: vi.fn((event: string, name: string, handler: Function) => {
        subscriptions[`${event}:${name}`] = handler;
      }),
    };

    const emailSubscriber = await import(
      "server/subscribers/email.subscriber"
    );
    emailSubscriber.default.initialize(mockEventHub);

    // Verify the subscription was registered
    expect(mockEventHub.subscribe).toHaveBeenCalledWith(
      "create-bucket",
      "welcome-email",
      expect.any(Function)
    );

    // Verify calling the handler invokes the email service
    const testArgs = {
      round: { id: "r1", welcomeEmailBody: "Hello!" },
      user: { id: "u1" },
      bucket: { id: "b1" },
    };
    await subscriptions["create-bucket:welcome-email"](testArgs);
    expect(mockSendBucketCreationWelcomeEmail).toHaveBeenCalledWith(testArgs);
  });
});
