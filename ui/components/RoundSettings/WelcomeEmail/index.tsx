import { useRef, useState } from "react";
import { useMutation, useQuery } from "urql";
import { gql } from "graphql-tag";
import { FormattedMessage, useIntl } from "react-intl";
import { useRouter } from "next/router";
import toast from "react-hot-toast";

import Button from "components/Button";
import TextField from "components/TextField";
import Spinner from "components/Spinner";

export const GET_ROUND_WELCOME_EMAIL = gql`
  query GetRoundWelcomeEmail($roundSlug: String!, $groupSlug: String!) {
    round(roundSlug: $roundSlug, groupSlug: $groupSlug) {
      id
      color
      welcomeEmailSubject
      welcomeEmailBody
    }
  }
`;

export const EDIT_WELCOME_EMAIL = gql`
  mutation EditWelcomeEmail(
    $roundId: ID!
    $welcomeEmailSubject: String
    $welcomeEmailBody: String
  ) {
    editRound(
      roundId: $roundId
      welcomeEmailSubject: $welcomeEmailSubject
      welcomeEmailBody: $welcomeEmailBody
    ) {
      id
      welcomeEmailSubject
      welcomeEmailBody
    }
  }
`;

const WelcomeEmail = ({
  round: roundProp,
  currentGroup,
  currentUser,
}: {
  round: any;
  currentGroup: any;
  currentUser: any;
}) => {
  const intl = useIntl();
  const router = useRouter();
  const [, editRound] = useMutation(EDIT_WELCOME_EMAIL);

  const [{ data, fetching }] = useQuery({
    query: GET_ROUND_WELCOME_EMAIL,
    variables: {
      roundSlug: router.query.round as string,
      groupSlug: router.query.group as string,
    },
  });

  const round = data?.round ?? roundProp;

  const [subject, setSubject] = useState<string>(() => roundProp?.welcomeEmailSubject || "");
  const [body, setBody] = useState<string>(() => roundProp?.welcomeEmailBody || "");

  // Sync from server once loaded
  const synced = useRef(false);
  if (!synced.current && data?.round) {
    setSubject(data.round.welcomeEmailSubject || "");
    setBody(data.round.welcomeEmailBody || "");
    synced.current = true;
  }

  const handleSave = () => {
    editRound({
      roundId: round.id,
      welcomeEmailSubject: subject || null,
      welcomeEmailBody: body || null,
    }).then(({ error }) => {
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(intl.formatMessage({ defaultMessage: "Welcome email saved!" }));
      }
    });
  };

  const handleClear = () => {
    if (!confirm(intl.formatMessage({ defaultMessage: "Disable welcome email for this round?" }))) return;
    editRound({
      roundId: round.id,
      welcomeEmailSubject: null,
      welcomeEmailBody: null,
    }).then(({ error }) => {
      if (error) {
        toast.error(error.message);
      } else {
        setSubject("");
        setBody("");
        toast.success(intl.formatMessage({ defaultMessage: "Welcome email disabled." }));
      }
    });
  };

  if (fetching && !round) return <Spinner />;

  return (
    <div className="px-6">
      <h1 className="text-2xl font-semibold mb-2">
        <FormattedMessage defaultMessage="Welcome Email" />
      </h1>
      <p className="text-gray-700 mb-6">
        <FormattedMessage defaultMessage="Configure an email sent to members when they create their first dream in this round. Leave empty to disable." />
      </p>

      <div className="grid gap-4">
        <TextField
          label={intl.formatMessage({ defaultMessage: "Subject" })}
          placeholder={intl.formatMessage({ defaultMessage: "Welcome to the round!" })}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          color={round?.color}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FormattedMessage defaultMessage="Body" />
          </label>
          <TextField
            placeholder={intl.formatMessage({ defaultMessage: "Write your welcome message here..." })}
            defaultValue={body}
            multiline
            rows={10}
            onChange={(e) => setBody(e.target.value)}
            color={round?.color}
            wysiwyg
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button
          onClick={handleSave}
          color={round?.color}
        >
          <FormattedMessage defaultMessage="Save" />
        </Button>

        {(round?.welcomeEmailSubject || round?.welcomeEmailBody) && (
          <Button
            variant="secondary"
            onClick={handleClear}
            color={round?.color}
          >
            <FormattedMessage defaultMessage="Disable" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default WelcomeEmail;
