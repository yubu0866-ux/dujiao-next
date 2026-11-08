import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { productRequiresMemberLogin } from '../src/utils/purchaseAccess.ts'

test('guest shoppers see a login requirement only on member-only products', () => {
  assert.equal(productRequiresMemberLogin({ purchase_type: 'member' }, false), true)
  assert.equal(productRequiresMemberLogin({ purchase_type: 'guest' }, false), false)
  assert.equal(productRequiresMemberLogin({}, false), true)
  assert.equal(productRequiresMemberLogin({ purchase_type: 'member' }, true), false)
  assert.equal(productRequiresMemberLogin({ purchase_type: 'guest' }, true), false)
})

test('product cards surface login copy without replacing guest or member quick buy', () => {
  const cards = [
    '../src/components/ProductCard.vue',
    '../src/components/ProductListItem.vue',
    '../src/templates/vault/components/VaultProductCard.vue',
    '../src/templates/vault/components/VaultProductListItem.vue',
  ]

  for (const card of cards) {
    const source = readFileSync(new URL(card, import.meta.url), 'utf8')
    assert.match(source, /productRequiresMemberLogin\(/, card)
    assert.match(source, /quickBuy\.loginToBuy/, card)
    assert.match(source, /products\.quickBuyAria/, card)
    assert.match(source, /quickBuy/, card)
  }
})
