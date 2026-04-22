import { useState } from "react";
import { useForm } from "react-hook-form";
import { gql, useMutation, useQuery } from "urql";
import { TextField } from "@mui/material";
import toast from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import Button from "components/Button";
import { TOKEN_STATUS } from "../../../constants";
import { globalBurnConnectionErrorMessage } from "utils/globalBurnStatus";

const GLOBAL_BURN_ROUND = gql`
  query GlobalBurnRound($roundSlug: String!, $groupSlug: String!) {
    round(roundSlug: $roundSlug, groupSlug: $groupSlug) {
      id
      globalBurnInstanceUrl
      globalBurnEventId
      globalBurnApiKeyStatus
      globalBurnVerified
    }
  }
`;

const EDIT_GLOBAL_BURN_SETTINGS = gql`
  mutation EditGlobalBurnSettings(
    $roundId: ID!
    $instanceUrl: String
    $eventId: String
    $apiKey: String
  ) {
    editGlobalBurnSettings(
      roundId: $roundId
      instanceUrl: $instanceUrl
      eventId: $eventId
      apiKey: $apiKey
    ) {
      id
      globalBurnInstanceUrl
      globalBurnEventId
      globalBurnApiKeyStatus
      globalBurnVerified
    }
  }
`;

const TEST_GLOBAL_BURN_CONNECTION = gql`
  mutation TestGlobalBurnConnection($roundId: ID!) {
    testGlobalBurnConnection(roundId: $roundId) {
      status
      memberCount
      detail
      round {
        id
        globalBurnVerified
      }
    }
  }
`;

const SYNC_GLOBAL_BURN_MEMBERS = gql`
  mutation SyncGlobalBurnMembers($roundId: ID!, $dryRun: Boolean!) {
    syncGlobalBurnMembers(roundId: $roundId, dryRun: $dryRun) {
      status
      totalInEvent
      alreadyMembers
      toInvite
      detail
      round {
        id
        globalBurnVerified
      }
    }
  }
`;

type FormValues = {
  instanceUrl: string;
  eventId: string;
  apiKey: string;
};

type SyncCounts = {
  totalInEvent: number;
  alreadyMembers: number;
  toInvite: number;
};

const GlobalBurnSection = ({
  round,
  currentGroup,
}: {
  round: { id: string; slug: string };
  currentGroup: any;
  currentUser: any;
}) => {
  const intl = useIntl();

  const [{ data, fetching: loadingRound }] = useQuery({
    query: GLOBAL_BURN_ROUND,
    variables: {
      roundSlug: round.slug,
      groupSlug: currentGroup?.slug ?? "c",
    },
  });

  const config = data?.round;

  const [{ fetching: saving }, editSettings] = useMutation(
    EDIT_GLOBAL_BURN_SETTINGS
  );
  const [{ fetching: testing }, testConnection] = useMutation(
    TEST_GLOBAL_BURN_CONNECTION
  );
  const [{ fetching: syncing }, syncMembers] = useMutation(
    SYNC_GLOBAL_BURN_MEMBERS
  );

  const { handleSubmit, register } = useForm<FormValues>();
  const [preview, setPreview] = useState<SyncCounts | null>(null);

  const keyIsSet = config?.globalBurnApiKeyStatus === TOKEN_STATUS.PROVIDED;
  const verified = Boolean(config?.globalBurnVerified);

  const onSave = async (values: FormValues) => {
    // Send null for the API key if the admin didn't type anything, so the
    // existing saved key is preserved. Empty + existing key would clear it,
    // which we don't want on a settings-field-only edit.
    const apiKey =
      values.apiKey && values.apiKey.length > 0 ? values.apiKey : null;
    const { error } = await editSettings({
      roundId: round.id,
      instanceUrl: values.instanceUrl ?? null,
      eventId: values.eventId ?? null,
      apiKey,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    setPreview(null);
    toast.success(
      intl.formatMessage({ defaultMessage: "Global Burn settings saved" })
    );
  };

  const onTest = async () => {
    const { data: testData, error } = await testConnection({
      roundId: round.id,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    const result = testData?.testGlobalBurnConnection;
    if (result?.status === "OK") {
      toast.success(
        intl.formatMessage(
          {
            defaultMessage:
              "Connection OK — {count, plural, one {# member} other {# members}} on the event",
          },
          { count: result.memberCount ?? 0 }
        )
      );
    } else {
      toast.error(globalBurnConnectionErrorMessage(result?.status, result?.detail, intl));
    }
  };

  const onFetchPreview = async () => {
    setPreview(null);
    const { data: syncData, error } = await syncMembers({
      roundId: round.id,
      dryRun: true,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    const result = syncData?.syncGlobalBurnMembers;
    if (result?.status !== "OK") {
      toast.error(globalBurnConnectionErrorMessage(result?.status, result?.detail, intl));
      return;
    }
    setPreview({
      totalInEvent: result.totalInEvent ?? 0,
      alreadyMembers: result.alreadyMembers ?? 0,
      toInvite: result.toInvite ?? 0,
    });
  };

  const onSendInvites = async () => {
    const { data: syncData, error } = await syncMembers({
      roundId: round.id,
      dryRun: false,
    });
    if (error) {
      toast.error(error.message.replace("[GraphQL]", ""));
      return;
    }
    const result = syncData?.syncGlobalBurnMembers;
    if (result?.status !== "OK") {
      toast.error(globalBurnConnectionErrorMessage(result?.status, result?.detail, intl));
      return;
    }
    toast.success(
      intl.formatMessage(
        {
          defaultMessage:
            "Invited {count, plural, one {# new member} other {# new members}}",
        },
        { count: result.toInvite ?? 0 }
      )
    );
    setPreview(null);
  };

  if (loadingRound && !config) {
    return (
      <div className="mt-6 text-sm text-gray-500">
        <FormattedMessage defaultMessage="Loading…" />
      </div>
    );
  }

  return (
    <section className="mt-6">
      <h3 className="text-xl font-semibold mb-1">
        <FormattedMessage defaultMessage="Invite from Global Burn instance" />
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        <FormattedMessage defaultMessage="Pull the current member list from a Global Burn event and invite everyone who is not already a participant in this round." />
      </p>

      <form onSubmit={handleSubmit(onSave)} className="space-y-4">
        <TextField
          label={intl.formatMessage({ defaultMessage: "Instance URL" })}
          placeholder="https://members.theborderland.se"
          defaultValue={config?.globalBurnInstanceUrl ?? ""}
          fullWidth
          variant="outlined"
          size="small"
          {...register("instanceUrl")}
        />
        <TextField
          label={intl.formatMessage({ defaultMessage: "Event ID" })}
          placeholder="2026"
          defaultValue={config?.globalBurnEventId ?? ""}
          fullWidth
          variant="outlined"
          size="small"
          {...register("eventId")}
        />
        <TextField
          label={
            keyIsSet
              ? intl.formatMessage({
                  defaultMessage:
                    "API Key (already set — enter to replace, leave blank to keep)",
                })
              : intl.formatMessage({ defaultMessage: "API Key" })
          }
          type="password"
          autoComplete="new-password"
          fullWidth
          variant="outlined"
          size="small"
          {...register("apiKey")}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" loading={saving}>
            <FormattedMessage defaultMessage="Save" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={testing}
            disabled={!keyIsSet}
            onClick={onTest}
          >
            <FormattedMessage defaultMessage="Test connection" />
          </Button>
          {verified && (
            <span className="text-sm text-green-700">
              <FormattedMessage defaultMessage="Connection verified" />
            </span>
          )}
        </div>
      </form>

      {verified && (
        <div className="mt-8 border-t pt-6">
          <h4 className="text-lg font-semibold mb-2">
            <FormattedMessage defaultMessage="Sync members" />
          </h4>

          {preview ? (
            <>
              <p className="text-sm text-gray-700 mb-3">
                <FormattedMessage
                  defaultMessage="{total, plural, one {# member} other {# members}} on the Global Burn event. {already} already participate in this round. {toInvite} will be invited."
                  values={{
                    total: preview.totalInEvent,
                    already: preview.alreadyMembers,
                    toInvite: preview.toInvite,
                  }}
                />
              </p>
              <p className="text-xs text-gray-500 mb-3">
                <FormattedMessage defaultMessage="Email addresses are not shown here — they are fetched straight from the Global Burn instance." />
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onSendInvites}
                  loading={syncing}
                  disabled={preview.toInvite === 0}
                >
                  <FormattedMessage
                    defaultMessage="Send invites to {count, plural, one {# member} other {# members}}"
                    values={{ count: preview.toInvite }}
                  />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPreview(null)}
                  disabled={syncing}
                >
                  <FormattedMessage defaultMessage="Cancel" />
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={onFetchPreview} loading={syncing}>
              <FormattedMessage defaultMessage="Fetch members from Global Burn" />
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export default GlobalBurnSection;
