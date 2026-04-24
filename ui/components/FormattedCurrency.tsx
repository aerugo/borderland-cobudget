import React from "react";
import { FormattedNumber } from "react-intl";

/**
 * Formatted currency props
 *
 * @typedef     {object}    Props
 * @property    {number}    value       -Amount in cents
 * @property    {string}    currency    -Currency
 *
 */

/**
 * @type    {React.FC<Props>}
 * @returns { React.ReactElement }
 */

function FormattedCurrency({ value, currency, maximumFractionDigits }: { value: number; currency: string; maximumFractionDigits?: number }) {
  return (
    <FormattedNumber
      value={value / 100}
      style="currency"
      currencyDisplay={"symbol"}
      currency={currency}
      {...(maximumFractionDigits !== undefined
        ? {
            maximumFractionDigits,
            minimumFractionDigits: maximumFractionDigits,
          }
        : {})}
    />
  );
}

export default FormattedCurrency;
