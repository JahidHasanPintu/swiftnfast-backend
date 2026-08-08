import { DatePreset } from '../transactions/dto/transaction.dto';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Resolves a DatePreset (or custom start/end strings) to a {startDate, endDate} pair.
 * All ranges are inclusive, with times set to start/end of day (UTC+6 Bangladesh time).
 */
export function resolveDateRange(
  preset?: DatePreset,
  startDate?: string,
  endDate?: string,
): DateRange | null {
  const now = new Date();

  // Helper: start of day (00:00:00.000)
  const startOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  // Helper: end of day (23:59:59.999)
  const endOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  switch (preset) {
    case 'today':
      return { startDate: startOfDay(now), endDate: endOfDay(now) };

    case 'this_week': {
      const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: startOfDay(monday), endDate: endOfDay(sunday) };
    }

    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay) };
    }

    case 'this_year': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      return { startDate: startOfDay(firstDay), endDate: endOfDay(lastDay) };
    }

    case 'custom':
      if (!startDate || !endDate) return null;
      return {
        startDate: startOfDay(new Date(startDate)),
        endDate: endOfDay(new Date(endDate)),
      };

    default:
      if (startDate && endDate) {
        return {
          startDate: startOfDay(new Date(startDate)),
          endDate: endOfDay(new Date(endDate)),
        };
      }
      return null;
  }
}