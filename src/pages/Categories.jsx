import { useState } from 'react'
import { useLang } from '../context/LangContext'
import { deleteCategory, loadStarterCategories, saveCategory, swapOrder, useCatalog } from '../lib/catalog'
import { Button, Card, EmptyState, Field, IconButton, Notice, Page, Sheet, Spinner } from '../components/ui'
import Icon from '../components/Icon'

function NameForm({ initial, onSave }) {
  const { t } = useLang()
  const [en, setEn] = useState(initial?.en || '')
  const [ur, setUr] = useState(initial?.ur || '')
  const [error, setError] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!en.trim()) return setError(t('fillRequired'))
        onSave({ en, ur })
      }}
      className="space-y-4"
    >
      <Field label={t('nameEn')}>
        <input className="field latin" dir="ltr" value={en} onChange={(e) => setEn(e.target.value)} autoFocus />
      </Field>
      <Field label={t('nameUr')}>
        <input className="field font-urdu" dir="rtl" value={ur} onChange={(e) => setUr(e.target.value)} />
      </Field>
      <Notice>{error}</Notice>
      <Button type="submit" size="lg" className="w-full">
        {t('save')}
      </Button>
    </form>
  )
}

export default function Categories() {
  const { t, pick } = useLang()
  const { ready, categories, subsOf, items } = useCatalog()
  // sheet: null | { mode: 'cat'|'sub', parentId?, initial? }
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState('')

  const countIn = (id) => items.filter((i) => i.catId === id || i.subId === id).length

  function onSave({ en, ur }) {
    const s = sheet
    if (s.initial) saveCategory({ id: s.initial.id, en, ur })
    else {
      const siblings = s.parentId ? subsOf(s.parentId) : categories
      const order = (siblings.at(-1)?.order ?? 0) + 10
      saveCategory({ en, ur, parentId: s.parentId || null, order })
    }
    setSheet(null)
  }

  function remove(c) {
    setError('')
    if (countIn(c.id) > 0) return setError(t('categoryHasItems'))
    if (!c.parentId && subsOf(c.id).length > 0) return setError(t('categoryHasSubs'))
    if (!window.confirm(t('confirmDelete'))) return
    deleteCategory(c.id)
  }

  const moveBtn = (list, i, dir) => {
    const other = list[i + dir]
    return (
      <IconButton
        icon="chevron"
        label={dir < 0 ? t('moveUp') : t('moveDown')}
        iconClass={dir < 0 ? '-rotate-90' : 'rotate-90'}
        onClick={() => other && swapOrder(list[i], other)}
        className={`text-muted ${other ? '' : 'pointer-events-none opacity-30'}`}
        size={18}
      />
    )
  }

  return (
    <Page
      title={t('categories')}
      right={
        <Button size="sm" className="me-1" onClick={() => setSheet({ mode: 'cat' })}>
          <Icon name="plus" size={18} /> {t('addCategory')}
        </Button>
      }
    >
      {!ready && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {ready && categories.length === 0 && (
        <EmptyState
          icon="grid"
          title={t('noCategories')}
          body={t('noCategoriesBody')}
          action={
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => setSheet({ mode: 'cat' })}>
                <Icon name="plus" size={18} /> {t('addCategory')}
              </Button>
              <Button variant="secondary" onClick={loadStarterCategories}>
                {t('loadStarter')}
              </Button>
            </div>
          }
        />
      )}

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="space-y-4">
        {categories.map((c, i) => {
          const subs = subsOf(c.id)
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex items-center gap-1 border-b border-line bg-paper/60 py-1 ps-4 pe-1">
                <div className="min-w-0 flex-1 py-2">
                  <div className="truncate text-lg font-bold text-charcoal">{pick(c)}</div>
                  <div className="truncate text-sm text-muted">
                    {pick({ en: c.ur, ur: c.en })} · <span className="latin">{countIn(c.id)}</span> {t('itemsWord')}
                  </div>
                </div>
                {moveBtn(categories, i, -1)}
                {moveBtn(categories, i, 1)}
                <IconButton icon="pencil" label={t('edit')} onClick={() => setSheet({ mode: 'cat', initial: c })} size={18} />
                <IconButton icon="trash" label={t('delete')} onClick={() => remove(c)} size={18} className="text-danger" />
              </div>
              <ul>
                {subs.map((s, j) => (
                  <li key={s.id} className="flex min-h-14 items-center gap-1 border-b border-line/70 ps-4 pe-1 last:border-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-lime" aria-hidden="true" />
                    <div className="min-w-0 flex-1 px-2">
                      <span className="font-semibold">{pick(s)}</span>
                      <span className="ms-2 text-sm text-muted">
                        <span className="latin">{countIn(s.id)}</span> {t('itemsWord')}
                      </span>
                    </div>
                    {moveBtn(subs, j, -1)}
                    {moveBtn(subs, j, 1)}
                    <IconButton icon="pencil" label={t('edit')} onClick={() => setSheet({ mode: 'sub', initial: s })} size={18} />
                    <IconButton icon="trash" label={t('delete')} onClick={() => remove(s)} size={18} className="text-danger" />
                  </li>
                ))}
              </ul>
              <div className="p-2">
                <Button variant="ghost" size="sm" onClick={() => setSheet({ mode: 'sub', parentId: c.id })}>
                  <Icon name="plus" size={16} /> {t('addSubCategory')}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Sheet
        open={!!sheet}
        title={
          sheet?.initial ? t('edit') : sheet?.mode === 'sub' ? `${t('addSubCategory')} — ${pick(categories.find((c) => c.id === sheet.parentId))}` : t('addCategory')
        }
        onClose={() => setSheet(null)}
      >
        {sheet && <NameForm key={sheet.initial?.id || sheet.parentId || 'new'} initial={sheet.initial} onSave={onSave} />}
      </Sheet>
    </Page>
  )
}
