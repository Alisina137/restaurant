export function formatMoney(value: number, currency = "AFN") {
  return new Intl.NumberFormat("en-AF", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value / 100);
}
