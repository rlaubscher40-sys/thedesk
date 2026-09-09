/** Spell integer counts for the ear; the screen retains the exact numeric form. */
export function spokenCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999)
    throw new Error("Approval count is outside the narration range.");
  const small = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const underThousand = (n: number): string => {
    if (n < 20) return small[n]!;
    if (n < 100) return tens[Math.floor(n / 10)]! + (n % 10 ? `-${small[n % 10]}` : "");
    return `${small[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${underThousand(n % 100)}` : ""}`;
  };
  return value < 1000
    ? underThousand(value)
    : `${underThousand(Math.floor(value / 1000))} thousand${value % 1000 ? `${value % 1000 < 100 ? " and" : ","} ${underThousand(value % 1000)}` : ""}`;
}
