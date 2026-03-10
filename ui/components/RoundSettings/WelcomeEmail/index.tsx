import { useState } from "react";
import { useMutation, useQuery } from "urql";
import { gql } from "graphql-tag";
import { Box, Button } from "@mui/material";
import { FormattedMessage, useIntl } from "react-intl";
import { useRouter } from "next/router";

import Wysiwyg from "components/Wysiwyg";
import Card from "components/styled/Card";
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

  const [subject, setSubject] = useState<string>(
    () => round?.welcomeEmailSubject || ""
  );
  const [body, setBody] = useState<string>(
    () => round?.welcomeEmailBody || ""
  );

  // Sync state when round data loads from server
  const [initialized, setInitialized] = useState(false);
  if (!initialized && data?.round) {
    setSubject(data.round.welcomeEmailSubject || "");
    setBody(data.round.welcomeEmailBody || "");
    setInitialized(true);
  }

  if (fetching && !round) return <Spinner />;

  const handleSave = () => {
    editRound({
      roundId: round.id,
      welcomeEmailSubject: subject || null,
      welcomeEmailBody: body || null,
    }).then(({ error }) => {
      if (error) {
        console.error({ error });
        alert(error.message);
      }
    });
  };

  const handleClear = () => {
    editRound({
      roundId: round.id,
      welcomeEmailSubject: null,
      welcomeEmailBody: null,
    }).then(({ error }) => {
      if (error) {
        console.error({ error });
        alert(error.message);
      } else {
        setSubject("");
        setBody("");
      }
    });
  };

  return (
    <Card>
      <Box p={3}>
        <h1 className="text-3xl">
          <FormattedMessage defaultMessage="Welcome Email" />
        </h1>
        <p className="my-3 text-gray-600">
          <FormattedMessage defaultMessage="Configure an email that will be sent to members when they create their first dream in this round. Leave empty to disable." />
        </p>

        <div className="my-4">
          <label htmlFor="welcome-email-subject" className="font-bold block mb-1">
            <FormattedMessage defaultMessage="Subject" />
          </label>
          <input
            id="welcome-email-subject"
            type="text"
            className="w-full border rounded p-2"
            placeholder={intl.formatMessage({
              defaultMessage: "Welcome to the round!",
            })}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="my-4">
          <label className="font-bold block mb-1">
            <FormattedMessage defaultMessage="Body" />
          </label>
          <Wysiwyg
            defaultValue={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            highlightColor={round.color}
          />
        </div>

        <div className="flex gap-3">
          <Button
            type="button"
            size="large"
            variant="contained"
            color="primary"
            onClick={handleSave}
          >
            <FormattedMessage defaultMessage="Save" />
          </Button>

          {(round.welcomeEmailSubject || round.welcomeEmailBody) && (
            <Button
              type="button"
              size="large"
              variant="outlined"
              color="error"
              onClick={handleClear}
            >
              <FormattedMessage defaultMessage="Disable" />
            </Button>
          )}
        </div>
      </Box>
    </Card>
  );
};

export default WelcomeEmail;
