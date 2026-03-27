const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(value?: string): string {
  if (!value) {
    return "Unavailable";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatTime(value?: string): string {
  if (!value) {
    return "--";
  }

  return timeFormatter.format(new Date(value));
}

export function formatPercent(value?: number): string {
  if (typeof value !== "number") {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function titleCase(value: string): string {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function minutesUntil(value?: string): string {
  if (!value) {
    return "--";
  }

  const delta = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (delta === 0) {
    return "now";
  }

  if (delta < 0) {
    return `${Math.abs(delta)} min ago`;
  }

  return `in ${delta} min`;
}
