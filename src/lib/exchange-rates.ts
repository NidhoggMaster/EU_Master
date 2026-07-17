export function parseEcbEurCny(xml: string) {
  const effectiveDate = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const rate = Number(xml.match(/currency=['"]CNY['"]\s+rate=['"]([\d.]+)['"]/)?.[1]);
  if (!effectiveDate || !Number.isFinite(rate) || rate <= 0) throw new Error("ECB 响应缺少有效的 CNY 参考价。");
  return { effectiveDate, rate };
}

export function eurToCny(eur: number, rate: number) {
  return Math.round(eur * rate * 100) / 100;
}
