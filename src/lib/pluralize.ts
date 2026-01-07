/**
 * Возвращает правильную форму слова в зависимости от числа
 * @param count - число
 * @param one - форма для 1 (например: "упражнение", "подход", "повторение")
 * @param few - форма для 2-4 (например: "упражнения", "подхода", "повторения")
 * @param many - форма для 5+ и 0 (например: "упражнений", "подходов", "повторений")
 * @returns правильная форма слова
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

/**
 * Возвращает число с правильной формой слова
 * @param count - число
 * @param one - форма для 1
 * @param few - форма для 2-4
 * @param many - форма для 5+ и 0
 * @returns строка вида "5 подходов"
 */
export function pluralizeWithCount(count: number, one: string, few: string, many: string): string {
  return `${count} ${pluralize(count, one, few, many)}`;
}
