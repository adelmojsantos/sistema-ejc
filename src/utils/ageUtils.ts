export interface AgeParts {
  years: number;
  months: number;
  totalMonths: number;
}

export const MAX_RECREACAO_AGE_MONTHS = 6 * 12 + 11;

const parseLocalDate = (dateString: string): Date | null => {
  const [year, month, day] = dateString.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const calculateAgeParts = (
  dateString?: string | null,
  referenceDate = new Date()
): AgeParts | null => {
  if (!dateString) {
    return null;
  }

  const birthDate = parseLocalDate(dateString);

  if (!birthDate || birthDate > referenceDate) {
    return null;
  }

  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  let months = referenceDate.getMonth() - birthDate.getMonth();

  if (referenceDate.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  return { years, months, totalMonths };
};

export const formatAgeParts = (age: AgeParts): string => {
  const yearsText = age.years === 1 ? '1 ano' : `${age.years} anos`;
  const monthsText = age.months === 1 ? '1 mês' : `${age.months} meses`;

  if (age.years <= 0) {
    return monthsText;
  }

  if (age.months <= 0) {
    return yearsText;
  }

  return `${yearsText} e ${monthsText}`;
};

export const formatChildAge = (
  dataNascimento?: string | null,
  idade?: number | null
): string => {
  const age = calculateAgeParts(dataNascimento);

  if (age) {
    return formatAgeParts(age);
  }

  const years = Number(idade ?? 0);
  return years === 1 ? '1 ano' : `${years} anos`;
};
