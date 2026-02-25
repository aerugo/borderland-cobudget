import { verify } from "server/utils/jwt";
import { handleExpenseChange } from "server/webhooks/ochandlers";

async function handleOCExpense(req, res) {
  const payload = verify(req.query["webhook-token"]);
  if (payload.rid) {
    req.roundId = payload.rid;
    await handleExpenseChange(req, res);
  } else {
    res.send({ status: "error" });
  }
}

export default handleOCExpense;
