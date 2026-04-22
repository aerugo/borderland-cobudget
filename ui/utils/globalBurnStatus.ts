import type { IntlShape } from "react-intl";

export const globalBurnConnectionErrorMessage = (
  status: string | null | undefined,
  detail: string | null | undefined,
  intl: IntlShape
): string => {
  switch (status) {
    case "INVALID_KEY":
      return intl.formatMessage({
        defaultMessage:
          "API key is invalid. Double-check the key and save again.",
      });
    case "EVENT_NOT_FOUND":
      return intl.formatMessage({
        defaultMessage:
          "The event does not exist on that instance. Check the Event ID.",
      });
    case "UNREACHABLE":
      return (
        intl.formatMessage({
          defaultMessage:
            "Could not reach the instance. Check the Instance URL.",
        }) + (detail ? ` (${detail})` : "")
      );
    default:
      return intl.formatMessage({ defaultMessage: "Unknown error" });
  }
};
