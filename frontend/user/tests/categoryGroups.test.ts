import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildCategoryGroups, type PublicCategory } from '../src/utils/category.ts'

const category = (id: number, name: string, parentId = 0): PublicCategory => ({
  id,
  parent_id: parentId,
  slug: name,
  name: { 'zh-CN': name },
})

test('category filters keep every api category, including a nested one', () => {
  const groups = buildCategoryGroups([
    category(1, 'GPT'),
    category(2, 'Claude'),
    category(3, 'Grok'),
    category(4, 'Muse'),
    category(5, '短信接码'),
    category(6, '代理', 1),
  ])

  const names = groups.map((group) => (group.name as { 'zh-CN': string })['zh-CN'])
  assert.deepEqual(names, ['GPT', 'Claude', 'Grok', 'Muse', '短信接码'])
  assert.deepEqual(
    groups[0]?.children.map((child) => (child.name as { 'zh-CN': string })['zh-CN']),
    ['代理'],
  )
})

test('a category whose parent is absent stays selectable as its own filter', () => {
  const groups = buildCategoryGroups([
    category(5, '短信接码'),
    category(6, '代理', 99),
  ])

  assert.deepEqual(
    groups.map((group) => (group.name as { 'zh-CN': string })['zh-CN']),
    ['短信接码', '代理'],
  )
})

test('storefront filters render the category payload and query that category id', () => {
  const list = readFileSync(new URL('../src/composables/useProductList.ts', import.meta.url), 'utf8')
  const classic = readFileSync(new URL('../src/components/CategorySidebar.vue', import.meta.url), 'utf8')
  const vault = readFileSync(new URL('../src/templates/vault/components/VaultCategorySidebar.vue', import.meta.url), 'utf8')

  assert.match(list, /categoryAPI\.list\(/)
  assert.match(list, /params\.category_id = selectedCategory\.value/)
  assert.match(classic, /v-for="group in categories"/)
  assert.match(vault, /v-for="grp in categoryGroups"/)
  assert.match(vault, /v-for="child in grp\.children"/)
  assert.doesNotMatch(vault, /hidden lg:grid/)
  assert.doesNotMatch(vault, /lg:block/)
  assert.doesNotMatch(`${classic}\n${vault}\n${list}`, /['"]GPT['"]|['"]Claude['"]|短信接码/)
})

test('category filters stay mounted while the product grid shows its skeleton', () => {
  const pages = [
    ['../src/views/Products.vue', '<CategorySidebar'],
    ['../src/templates/vault/Products.vue', '<VaultCategorySidebar'],
  ] as const

  for (const [file, marker] of pages) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    const filterAt = source.indexOf(marker)
    const skeletonAt = source.indexOf('v-if="loading"')
    assert.ok(filterAt > 0 && skeletonAt > filterAt, file)
  }
})
