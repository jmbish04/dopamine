import { DateTime } from "luxon";

export const PST_TIMEZONE = "America/Los_Angeles";

export const getCurrentPSTMillis = (): number => {
  return DateTime.now().setZone(PST_TIMEZONE).toMillis();
};

export const getPSTDateTime = (): DateTime => {
  return DateTime.now().setZone(PST_TIMEZONE);
};

export const parsePSTDateToMillis = (dateStr: string): number => {
  return DateTime.fromISO(dateStr).setZone(PST_TIMEZONE).toMillis();
};

export const formatMillisToPSTISO = (millis: number): string => {
  return DateTime.fromMillis(millis).setZone(PST_TIMEZONE).toISO() as string;
};


export const getPSTDateTimeFromMillis = (millis: number): DateTime => {
  return DateTime.fromMillis(millis).setZone(PST_TIMEZONE);
};



export type AnalyticsSeries = Record<
  string, 
  { date: string; completed: number; xpEarned: number; added: number }
>;

export const getAnalyticsLookbackSeries = (days: number = 7): AnalyticsSeries => {
  const now = getPSTDateTime().startOf("day");
  const series: AnalyticsSeries = {};
  
  for (let i = days - 1; i >= 0; i--) {
    const d = now.minus({ days: i });
    const isoDate = d.toISODate();
    if (isoDate) {
      series[isoDate] = {
        date: d.toFormat("MMM d"),
        completed: 0,
        xpEarned: 0,
        added: 0
      };
    }
  }

  return series;
};
