export const removeCurrencySymbols = (value: string): string => {
    return value.replace(/[^\d.]/g, '');
  };
  