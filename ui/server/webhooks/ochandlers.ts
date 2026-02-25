import { EXPENSE_PAID, OC_STATUS_MAP } from "../../constants";
import { getExpense } from "server/graphql/resolvers/helpers";
import {
  convertAmount,
  getExchangeRates,
} from "server/graphql/resolvers/helpers/getExchangeRate";
import prisma from "server/prisma";
import { getOCToken } from "server/utils/roundUtils";

const getPaidExpenseFields = ({ expense, exchangeRate }) => {
  const paidExpenseFields: {
    paidAt?: Date;
    exchangeRate?: number;
  } = { paidAt: null, exchangeRate: null };
  if (OC_STATUS_MAP[expense.status] === EXPENSE_PAID) {
    paidExpenseFields.paidAt = new Date();
    paidExpenseFields.exchangeRate = exchangeRate;
  }
  return paidExpenseFields;
};

// helper
export const ocExpenseToCobudget = (
  expense,
  roundId,
  isEditing,
  exchangeRate?: number,
  dbExpense?
) => {
  const paidExpenseFields = getPaidExpenseFields({ expense, exchangeRate });

  return [
    {
      // If editing expense, then dont include bucketId
      ...(!isEditing && { bucketId: expense.customData?.b }),
      title: expense.description,
      status: OC_STATUS_MAP[expense.status],
      submittedBy: expense.customData?.u,
      currency: expense.amountV2?.currency,
      ocMeta: JSON.stringify({ legacyId: expense.legacyId }),
      createdAt: expense.createdAt,

      recipientName: expense.payoutMethod?.data?.accountHolderName,
      recipientEmail: expense.payoutMethod?.data?.details?.email,

      ocId: expense.id,
      roundId,

      ...(dbExpense?.status !== EXPENSE_PAID && paidExpenseFields),
    },
    isEditing,
    expense.items,
  ];
};

// helper
export const ocItemToCobudgetReceipt = (item, expense) => {
  return {
    description: item.description,
    amount: item.amount,
    date: item.createdAt,
    attachment: item.file?.url,
    expenseId: expense.id,
    ocExpenseReceiptId: item.id,
  };
};

export const handleExpenseChange = async (req, res) => {
  try {
    console.log(
      "[OC Webhook] Received:",
      JSON.stringify({
        roundId: req.roundId,
        type: req.body?.type,
        expenseId: req.body?.data?.expense?.id,
      })
    );

    const round = await prisma.round.findFirst({ where: { id: req.roundId } });
    if (!round) {
      console.log("[OC Webhook] Round not found:", req.roundId);
      return res.status(404).send({ status: "error", message: "Round not found" });
    }

    const expenseId = req.body?.data?.expense?.id;
    if (!expenseId) {
      console.log("[OC Webhook] No expense id in payload. Body:", JSON.stringify(req.body));
      return res.status(400).send({ status: "error", message: "Expense id missing" });
    }

    const token = getOCToken(round);
    console.log("[OC Webhook] Fetching expense", expenseId, "with token:", token ? "present" : "MISSING");

    const expense = await getExpense(expenseId, token);
    if (!expense) {
      console.log("[OC Webhook] Failed to fetch expense from OC API. ID:", expenseId);
      return res.status(502).send({ status: "error", message: "Failed to fetch expense from OC" });
    }

    console.log("[OC Webhook] Fetched expense:", expense.id, expense.description, "status:", expense.status);

    let dbExpense;
    const rates =
      round.currency !== expense.amountV2?.currency
        ? (await getExchangeRates())?.rates
        : null;
    const exchangeRate = rates
      ? convertAmount({
          rates,
          from: expense.amountV2?.currency,
          to: round?.currency,
        })
      : undefined;
    const paidExpenseFields = getPaidExpenseFields({
      expense,
      exchangeRate: exchangeRate,
    });

    const existingExpense = await prisma.expense.findFirst({
      where: { ocId: expense.id },
    });

    // Update expense paid expense fields and set them to null when:
    // expense was paid and new paid expense fields are null
    // Update expense paid expense fields and save non-null values when:
    // expense was not paid and new expense fields are non-null
    // In the other two cases, don't update paid expense fields.
    const updatePaidExpenseFields =
      (existingExpense?.status === EXPENSE_PAID &&
        paidExpenseFields.paidAt === null) ||
      (existingExpense?.status !== EXPENSE_PAID &&
        paidExpenseFields.paidAt !== null);

    const expenseData = {
      bucketId: expense.customData?.b,
      title: expense.description,
      status: OC_STATUS_MAP[expense.status],
      submittedBy: expense.customData?.u,
      currency: expense.amountV2?.currency,
      ocMeta: JSON.stringify({ legacyId: expense.legacyId }),
      createdAt: expense.createdAt,

      recipientName: expense.payoutMethod?.data?.accountHolderName,
      recipientEmail: expense.payoutMethod?.data?.details?.email,
      swiftCode: "",
      iban: "",
      country: expense.payoutMethod?.data?.details?.address?.country,
      city: expense.payoutMethod?.data?.details?.address?.city,
      recipientAddress:
        expense.payoutMethod?.data?.details?.address?.firstLine,
      recipientPostalCode:
        expense.payoutMethod?.data?.details?.address?.recipientPostCode,

      ocId: expense.id,
      roundId: req.roundId,

      ...(updatePaidExpenseFields && paidExpenseFields),
    };

    if (existingExpense) {
      delete expenseData.bucketId;
      dbExpense = await prisma.expense.update({
        where: { id: existingExpense.id },
        data: expenseData,
      });
      console.log("[OC Webhook] Updated expense:", dbExpense.id);
    } else {
      dbExpense = await prisma.expense.create({ data: expenseData });
      console.log("[OC Webhook] Created expense:", dbExpense.id);
    }

    await Promise.all(
      (expense.items || []).map(async (item) => {
        const receiptData = {
          description: item.description,
          amount: item.amount,
          date: item.createdAt,
          attachment: item.file?.url,
          expenseId: dbExpense.id as string,
          ocExpenseReceiptId: item.id,
        };

        await prisma.expenseReceipt.upsert({
          where: { ocExpenseReceiptId: item.id },
          create: receiptData,
          update: receiptData,
        });
      })
    );

    console.log("[OC Webhook] Success for expense:", expense.id);
    res.send({ status: "success" });
  } catch (err) {
    console.error("[OC Webhook] Error:", err?.message || err, err?.stack);
    res.status(500).send({ status: "fail", message: err?.message });
  }
};
