import { verify } from "server/utils/jwt";
import { handleExpenseChange } from "server/webhooks/ochandlers";

async function handleOCExpense(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send({ status: "error", message: "Method not allowed" });
  }

  const token = req.query["webhook-token"];
  const payload = verify(token);
  if (!payload || !payload.rid) {
    return res.status(401).send({ status: "error", message: "Invalid webhook token" });
  }

  req.roundId = payload.rid;
  await handleExpenseChange(req, res);
}

export default handleOCExpense;
