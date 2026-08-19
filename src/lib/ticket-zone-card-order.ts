import { getMatchTicketZoneButtonLabel } from "@/lib/match-ticket-zone-label";

export type TicketZoneOrderItem =
  | {
      kind: "standard";
      zone: { code: string };
      sourceOrder: number;
    }
  | {
      kind: "dynamic";
      zone: {
        buttonLabel?: string | null;
        code: string;
        name: string;
      };
      sourceOrder: number;
    };

export function sortTicketZoneCards<T extends TicketZoneOrderItem>(
  items: T[],
  standardZoneCodes: readonly string[],
) {
  const standardZoneOrder = new Map(
    standardZoneCodes.map((code, index) => [code, index]),
  );

  return items.sort((left, right) => {
    const getPosition = (item: TicketZoneOrderItem): [number, number, number] => {
      if (item.kind === "standard") {
        const standardOrder = standardZoneOrder.get(item.zone.code) ?? item.sourceOrder;
        return [standardOrder + 1, 1, item.sourceOrder];
      }

      const buttonLabel = getMatchTicketZoneButtonLabel(item.zone);
      const identity = `${buttonLabel} ${item.zone.code} ${item.zone.name}`.toUpperCase();
      if (identity.includes("VVIP")) return [0, 0, item.sourceOrder];

      const matchingStandardOrder = standardZoneOrder.get(buttonLabel);
      if (matchingStandardOrder != null) {
        return [matchingStandardOrder + 1, 0, item.sourceOrder];
      }

      // Keep other back-office-defined special zones near the front while
      // preserving the configured order from the match.
      return [0, 1, item.sourceOrder];
    };

    const leftPosition = getPosition(left);
    const rightPosition = getPosition(right);
    return leftPosition[0] - rightPosition[0]
      || leftPosition[1] - rightPosition[1]
      || leftPosition[2] - rightPosition[2];
  });
}
