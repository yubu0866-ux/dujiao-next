import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptRichTextContrast } from '../src/utils/richTextContrast.ts'

test('dark theme keeps a light announcement color on the dark surface and drops a pale background', () => {
  const html = '<p style="color: #e0e7ff; background-color: #eef2ff; text-align: center">公告</p>'
  const adapted = adaptRichTextContrast(html, 'dark')

  assert.match(adapted, /color:\s*#e0e7ff/i)
  assert.match(adapted, /text-align:\s*center/)
  assert.doesNotMatch(adapted, /background-color/i)
})

test('light theme drops white announcement text so the theme color can show', () => {
  const html = '<p style="color: #ffffff">公告</p>'
  const adapted = adaptRichTextContrast(html, 'light')

  assert.equal(adapted, '<p>公告</p>')
})

test('dark theme keeps white announcement text on the dark surface', () => {
  const html = '<span style="color: white">公告</span>'
  const adapted = adaptRichTextContrast(html, 'dark')

  assert.match(adapted, /color:\s*white/i)
})

test('dark theme replaces dark text that disappears on the dark surface', () => {
  const html = '<p style="color: rgb(29, 29, 31)">公告</p>'
  const adapted = adaptRichTextContrast(html, 'dark')

  assert.equal(adapted, '<p>公告</p>')
})

test('dark theme removes a pale background that light theme text cannot sit on', () => {
  const html = '<p style="background-color: #eef2ff">公告</p>'
  assert.equal(adaptRichTextContrast(html, 'dark'), '<p>公告</p>')
  assert.match(adaptRichTextContrast(html, 'light'), /background-color:\s*#eef2ff/i)
})

test('a dark merchant color stays in light mode and yields in dark mode', () => {
  const html = '<p style="color: #b91c1c"><strong>注意</strong> <a href="/notice">详情</a></p>'
  const light = adaptRichTextContrast(html, 'light')
  const dark = adaptRichTextContrast(html, 'dark')

  assert.match(light, /color:\s*#b91c1c/i)
  assert.match(light, /href="\/notice"/)
  assert.doesNotMatch(dark, /color:/i)
  assert.match(dark, /<strong>注意<\/strong>/)
})

test('announcement modal adapts sanitized rich text for the active theme', () => {
  const source = readFileSync(new URL('../src/components/AnnouncementModal.vue', import.meta.url), 'utf8')

  assert.match(source, /adaptRichTextContrast\(/)
  assert.match(source, /announcement-rich/)
})
