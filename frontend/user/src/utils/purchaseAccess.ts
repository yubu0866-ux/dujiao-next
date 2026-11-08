/**
 * 与快速购买弹层一致：未标明购买身份时按会员商品处理。
 * 只决定前台按钮文案，不替代服务端下单校验。
 */
export const productRequiresMemberLogin = (
  product: { purchase_type?: string | null } | null | undefined,
  isAuthenticated: boolean,
): boolean => {
  const purchaseType = String(product?.purchase_type || 'member')
  return purchaseType === 'member' && !isAuthenticated
}
