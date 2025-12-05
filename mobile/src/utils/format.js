const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '$0.00'
  const abs = Math.abs(num)
  if (abs > 0 && abs < 0.01) {
    return `${num < 0 ? '-' : ''}$${abs.toFixed(4)}`
  }
  return currencyFormatter.format(num)
}

export function formatNumber(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(digits)
}
