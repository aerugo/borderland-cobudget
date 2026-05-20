import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mock object is available when vi.mock factories run
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    expense: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    expenseReceipt: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("server/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../../../constants", () => ({
  GRAPHQL_SUPERADMIN_ONLY: "Only super admins can perform this action",
  GRAPHQL_EXPENSE_NOT_FOUND: "Expense not found",
  GRAPHQL_EXPENSE_RECEIPT_NOT_FOUND: "Expense receipt not found",
  GRAPHQL_NOT_LOGGED_IN: "You need to login to continue",
  GRAPHQL_ROUND_NOT_FOUND: "Round not found",
  GRAPHQL_ADMIN_AND_MODERATOR_ONLY:
    "Only admins and moderators can perform this action",
  GRAPHQL_EXPENSE_COCREATOR_ONLY: "Only cocreators can add expense",
  GRAPHQL_EXPENSE_NOT_SUBMITTED_BY_CURRENT_USER:
    "Expense not submitted by current user",
  FavoriteBucketReason: {},
}));

vi.mock("server/controller", () => ({
  contribute: vi.fn(),
}));

vi.mock("server/lib/discourse", () => ({
  default: {},
}));

vi.mock("server/services/eventHub.service", () => ({
  default: { publish: vi.fn() },
}));

vi.mock("../../../subscribers/discourse.subscriber", () => ({
  default: {},
}));

vi.mock("graphql-resolvers", () => ({
  combineResolvers: (...fns) => fns[fns.length - 1],
  skip: "skip",
}));

vi.mock("server/stripe", () => ({
  default: {},
}));

import {
  deleteExpense,
  deleteExpenseReceipt,
} from "server/graphql/resolvers/mutations/bucket";

describe("deleteExpense", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete an expense and its receipts when called by superadmin", async () => {
    const mockExpense = {
      id: "expense-1",
      title: "Test Expense",
      bucketId: "bucket-1",
    };

    mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
    mockPrisma.expenseReceipt.deleteMany.mockResolvedValue({ count: 2 });
    mockPrisma.expense.delete.mockResolvedValue(mockExpense);

    const result = await deleteExpense(
      null,
      { id: "expense-1" },
      { ss: { id: "session-1" } }
    );

    expect(mockPrisma.expense.findUnique).toHaveBeenCalledWith({
      where: { id: "expense-1" },
    });
    expect(mockPrisma.expenseReceipt.deleteMany).toHaveBeenCalledWith({
      where: { expenseId: "expense-1" },
    });
    expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
      where: { id: "expense-1" },
    });
    expect(result).toEqual(mockExpense);
  });

  it("should throw error when called without superadmin session", async () => {
    await expect(
      deleteExpense(null, { id: "expense-1" }, { ss: null })
    ).rejects.toThrow("Only super admins can perform this action");

    expect(mockPrisma.expense.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.expense.delete).not.toHaveBeenCalled();
  });

  it("should throw error when called with undefined ss", async () => {
    await expect(
      deleteExpense(null, { id: "expense-1" }, {})
    ).rejects.toThrow("Only super admins can perform this action");
  });

  it("should throw error when expense does not exist", async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null);

    await expect(
      deleteExpense(
        null,
        { id: "nonexistent" },
        { ss: { id: "session-1" } }
      )
    ).rejects.toThrow("Expense not found");

    expect(mockPrisma.expenseReceipt.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.expense.delete).not.toHaveBeenCalled();
  });

  it("should delete expense even when it has no receipts", async () => {
    const mockExpense = { id: "expense-1", title: "No Receipts" };

    mockPrisma.expense.findUnique.mockResolvedValue(mockExpense);
    mockPrisma.expenseReceipt.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.expense.delete.mockResolvedValue(mockExpense);

    const result = await deleteExpense(
      null,
      { id: "expense-1" },
      { ss: { id: "session-1" } }
    );

    expect(mockPrisma.expenseReceipt.deleteMany).toHaveBeenCalledWith({
      where: { expenseId: "expense-1" },
    });
    expect(result).toEqual(mockExpense);
  });
});

describe("deleteExpenseReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a receipt when called by superadmin", async () => {
    const mockReceipt = {
      id: "receipt-1",
      description: "Test Receipt",
      expenseId: "expense-1",
    };

    mockPrisma.expenseReceipt.findFirst.mockResolvedValue(mockReceipt);
    mockPrisma.expenseReceipt.delete.mockResolvedValue(mockReceipt);

    const result = await deleteExpenseReceipt(
      null,
      { id: "receipt-1" },
      { ss: { id: "session-1" } }
    );

    expect(mockPrisma.expenseReceipt.findFirst).toHaveBeenCalledWith({
      where: { id: "receipt-1" },
    });
    expect(mockPrisma.expenseReceipt.delete).toHaveBeenCalledWith({
      where: { id: "receipt-1" },
    });
    expect(result).toEqual(mockReceipt);
  });

  it("should throw error when called without superadmin session", async () => {
    await expect(
      deleteExpenseReceipt(null, { id: "receipt-1" }, { ss: null })
    ).rejects.toThrow("Only super admins can perform this action");

    expect(mockPrisma.expenseReceipt.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.expenseReceipt.delete).not.toHaveBeenCalled();
  });

  it("should throw error when receipt does not exist", async () => {
    mockPrisma.expenseReceipt.findFirst.mockResolvedValue(null);

    await expect(
      deleteExpenseReceipt(
        null,
        { id: "nonexistent" },
        { ss: { id: "session-1" } }
      )
    ).rejects.toThrow("Expense receipt not found");

    expect(mockPrisma.expenseReceipt.delete).not.toHaveBeenCalled();
  });
});
