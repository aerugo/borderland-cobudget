import { useState } from "react";
import { Modal, Tabs, Tab } from "@mui/material";
import { useMutation, gql } from "urql";

import Button from "components/Button";
import TextField from "components/TextField";
import Switch from "components/Switch";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl, FormattedNumber } from "react-intl";
import { globalBurnConnectionErrorMessage } from "utils/globalBurnStatus";

const BULK_ALLOCATE_MUTATION = gql`
  mutation BulkAllocate($roundId: ID!, $amount: Int!, $type: AllocationType!) {
    bulkAllocate(roundId: $roundId, amount: $amount, type: $type) {
      id
    }
  }
`;

const BULK_ALLOCATE_GLOBAL_BURN_MUTATION = gql`
  mutation BulkAllocateToGlobalBurnMembers(
    $roundId: ID!
    $amount: Int!
    $type: AllocationType!
    $dryRun: Boolean!
  ) {
    bulkAllocateToGlobalBurnMembers(
      roundId: $roundId
      amount: $amount
      type: $type
      dryRun: $dryRun
    ) {
      status
      matchedMembers
      totalApproved
      totalAmount
      detail
      round {
        id
        globalBurnVerified
      }
    }
  }
`;

type RoundProp = {
  id: string;
  currency: string;
  numberOfApprovedMembers: number;
  globalBurnVerified?: boolean | null;
};

const AllMembersForm = ({
  round,
  handleClose,
}: {
  round: RoundProp;
  handleClose: () => void;
}) => {
  const [inputValue, setInputValue] = useState("");
  const [type, setSelectedType] = useState("Add");
  const amount = Math.round(Number(inputValue) * 100);
  const intl = useIntl();

  const [{ fetching: loading }, bulkAllocate] = useMutation(
    BULK_ALLOCATE_MUTATION
  );

  const disabled = inputValue === "" || (!amount && type === "Add");

  return (
    <>
      <Switch
        options={[
          intl.formatMessage({ defaultMessage: "Add" }),
          intl.formatMessage({ defaultMessage: "Set" }),
        ]}
        setSelected={setSelectedType}
        selected={type}
        className="mx-auto"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          bulkAllocate({
            roundId: round.id,
            amount,
            type: type.toUpperCase(),
          }).then(({ error }) => {
            if (error) {
              toast.error(error.message);
            } else {
              handleClose();
              toast.success(
                intl.formatMessage({
                  defaultMessage: "Allocated funds successfully",
                })
              );
            }
          });
        }}
      >
        <TextField
          inputProps={{
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            type: "number",
          }}
          placeholder="0"
          autoFocus
          endAdornment={round.currency}
          className="w-36 mx-auto mt-4 mb-2"
        />
        {type === "Add" ? (
          <p className="text-center mb-4 text-gray-700 text-sm">
            <FormattedMessage defaultMessage="Adding" />{" "}
            <FormattedNumber
              value={amount / 100}
              style="currency"
              currencyDisplay={"symbol"}
              currency={round.currency}
            />{" "}
            <FormattedMessage
              defaultMessage=" to {count} {count, plural, one {member} other {members}}"
              values={{
                count: round.numberOfApprovedMembers,
              }}
            />
          </p>
        ) : (
          <p className="text-center mb-4 text-gray-700 text-sm">
            <FormattedMessage
              defaultMessage="Setting {count} {count, plural, one {member} other {members}} {count, plural, one {balance} other {balances}} to"
              values={{
                count: round.numberOfApprovedMembers,
              }}
            />{" "}
            <FormattedNumber
              value={amount / 100}
              style="currency"
              currencyDisplay={"symbol"}
              currency={round.currency}
            />
          </p>
        )}

        <div className="flex space-x-3 justify-end">
          <Button onClick={handleClose} variant="secondary">
            <FormattedMessage defaultMessage="Cancel" />
          </Button>
          <Button type="submit" loading={loading} disabled={disabled}>
            <FormattedMessage defaultMessage="Done" />
          </Button>
        </div>
      </form>
    </>
  );
};

type Preview = {
  matchedMembers: number;
  totalApproved: number;
  totalAmount: number;
};

const GlobalBurnForm = ({
  round,
  handleClose,
}: {
  round: RoundProp;
  handleClose: () => void;
}) => {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState("");
  const [type, setSelectedType] = useState("Add");
  const [preview, setPreview] = useState<Preview | null>(null);

  const amount = Math.round(Number(inputValue) * 100);
  const [{ fetching }, runMutation] = useMutation(
    BULK_ALLOCATE_GLOBAL_BURN_MUTATION
  );

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreview(null);
    const { data, error } = await runMutation({
      roundId: round.id,
      amount,
      type: type.toUpperCase(),
      dryRun: true,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    const result = data?.bulkAllocateToGlobalBurnMembers;
    if (result?.status !== "OK") {
      toast.error(
        globalBurnConnectionErrorMessage(result?.status, result?.detail, intl)
      );
      return;
    }
    setPreview({
      matchedMembers: result.matchedMembers ?? 0,
      totalApproved: result.totalApproved ?? 0,
      totalAmount: result.totalAmount ?? 0,
    });
  };

  const handleConfirm = async () => {
    const { data, error } = await runMutation({
      roundId: round.id,
      amount,
      type: type.toUpperCase(),
      dryRun: false,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    const result = data?.bulkAllocateToGlobalBurnMembers;
    if (result?.status !== "OK") {
      toast.error(
        globalBurnConnectionErrorMessage(result?.status, result?.detail, intl)
      );
      return;
    }
    handleClose();
    toast.success(
      intl.formatMessage(
        {
          defaultMessage:
            "Allocated funds to {count, plural, one {# member} other {# members}}",
        },
        { count: result.matchedMembers ?? 0 }
      )
    );
  };

  const disabledPreview = inputValue === "" || (!amount && type === "Add");

  if (preview) {
    return (
      <>
        <p className="text-sm text-gray-700 mb-3">
          <FormattedMessage
            defaultMessage="{matched} of {total} approved {total, plural, one {member matches} other {members match}} the Global Burn list."
            values={{
              matched: preview.matchedMembers,
              total: preview.totalApproved,
            }}
          />
        </p>
        {preview.matchedMembers > 0 ? (
          <p className="text-sm text-gray-700 mb-4">
            {type === "Add" ? (
              <FormattedMessage defaultMessage="Adding" />
            ) : (
              <FormattedMessage defaultMessage="Setting balances to" />
            )}{" "}
            <FormattedNumber
              value={amount / 100}
              style="currency"
              currencyDisplay="symbol"
              currency={round.currency}
            />{" "}
            <FormattedMessage defaultMessage="each —" />{" "}
            <strong>
              <FormattedNumber
                value={preview.totalAmount / 100}
                style="currency"
                currencyDisplay="symbol"
                currency={round.currency}
              />
            </strong>{" "}
            <FormattedMessage defaultMessage="will be allocated in total." />
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-4">
            <FormattedMessage defaultMessage="Nothing to allocate." />
          </p>
        )}
        <div className="flex space-x-3 justify-end">
          <Button
            variant="secondary"
            onClick={() => setPreview(null)}
            disabled={fetching}
          >
            <FormattedMessage defaultMessage="Back" />
          </Button>
          <Button
            onClick={handleConfirm}
            loading={fetching}
            disabled={preview.matchedMembers === 0}
          >
            <FormattedMessage defaultMessage="Confirm" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Switch
        options={[
          intl.formatMessage({ defaultMessage: "Add" }),
          intl.formatMessage({ defaultMessage: "Set" }),
        ]}
        setSelected={setSelectedType}
        selected={type}
        className="mx-auto"
      />
      <form onSubmit={handlePreview}>
        <TextField
          inputProps={{
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            type: "number",
          }}
          placeholder="0"
          autoFocus
          endAdornment={round.currency}
          className="w-36 mx-auto mt-4 mb-2"
        />
        <p className="text-center mb-4 text-gray-700 text-sm">
          <FormattedMessage defaultMessage="Only members on the active Global Burn list will receive funds." />
        </p>
        <div className="flex space-x-3 justify-end">
          <Button onClick={handleClose} variant="secondary" type="button">
            <FormattedMessage defaultMessage="Cancel" />
          </Button>
          <Button type="submit" loading={fetching} disabled={disabledPreview}>
            <FormattedMessage defaultMessage="Preview" />
          </Button>
        </div>
      </form>
    </>
  );
};

const BulkAllocateModal = ({
  round,
  handleClose,
}: {
  round: RoundProp;
  handleClose: () => void;
}) => {
  const intl = useIntl();
  const showGlobalBurnTab = Boolean(round.globalBurnVerified);
  const [tab, setTab] = useState(0);

  return (
    <Modal
      open={true}
      onClose={handleClose}
      className="flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-lg shadow p-6 focus:outline-none flex-1 max-w-sm">
        <h1 className="text-xl font-semibold mb-4 break-words">
          <FormattedMessage defaultMessage="Manage all members balance" />
        </h1>
        {showGlobalBurnTab && (
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v)}
            className="mb-4"
            variant="fullWidth"
          >
            <Tab
              label={intl.formatMessage({ defaultMessage: "All members" })}
            />
            <Tab
              label={intl.formatMessage({
                defaultMessage: "Global Burn members",
              })}
            />
          </Tabs>
        )}
        {tab === 0 || !showGlobalBurnTab ? (
          <AllMembersForm round={round} handleClose={handleClose} />
        ) : (
          <GlobalBurnForm round={round} handleClose={handleClose} />
        )}
      </div>
    </Modal>
  );
};

export default BulkAllocateModal;
