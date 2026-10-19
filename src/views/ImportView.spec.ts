import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

// Prueba de humo de la pantalla: se sube un CSV, salen los cargos (el repetido sin
// marcar), se rellena la categoría que falta y al apuntar se llama a importExpenses
// con los gastos bien formados.

const importExpenses = vi.fn(async (inputs: unknown[]) => inputs.length)
const push = vi.fn()
const toast = vi.fn()

const expenses = ref([
  { id: 'e1', spent_on: '2026-10-17', amount: 12.99, category_id: 'ocio', description: 'Netflix', is_shared: false, funding: 'personal', split_mode: 'household' },
])
const categories = ref([{ id: 'ocio', name: 'Ocio' }, { id: 'super', name: 'Súper' }])

vi.mock('vue-router', () => ({ useRouter: () => ({ push, back: vi.fn() }) }))
vi.mock('../composables/useSession', () => ({
  useSession: () => ({
    state: { user: { id: 'yo' }, members: [{ user_id: 'yo', share_pct: 50 }, { user_id: 'tu', share_pct: 50 }] },
  }),
}))
vi.mock('../composables/useData', () => ({
  useData: () => ({ expenses, categories, offline: ref(false), ensureLoaded: vi.fn(), importExpenses }),
}))
vi.mock('../composables/useEditor', () => ({ useEditor: () => ({ toast }) }))

import ImportView from './ImportView.vue'

const CSV = 'Fecha;Concepto;Importe\n19/10/2026;COMPRA EN MERCADONA;-45,30\n17/10/2026;RECIBO NETFLIX;-12,99\n16/10/2026;NOMINA;1.800,00'

async function upload(wrapper: ReturnType<typeof mount>, text: string) {
  const file = new File([text], 'extracto.csv', { type: 'text/csv' })
  // jsdom no trae File.arrayBuffer: se simula.
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode(text).buffer })
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
  await flushPromises()
}

describe('ImportView', () => {
  beforeEach(() => {
    importExpenses.mockClear()
    push.mockClear()
    toast.mockClear()
  })

  it('enseña los cargos, marca el repetido como ya apuntado y apunta el resto', async () => {
    const wrapper = mount(ImportView)
    await upload(wrapper, CSV)

    const items = wrapper.findAll('li.imp')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('2 cargos encontrados, 1 ingresos ignorados')
    // Netflix ya está apuntado (misma fecha e importe): sin marcar y con aviso.
    expect(items[1].text()).toContain('Parece apuntado')
    expect((items[1].find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
    // Mercadona no tiene categoría todavía: no se puede apuntar.
    const save = wrapper.find('button.block')
    expect(save.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Falta la categoría de un gasto marcado')

    await items[0].find('select').setValue('super')
    await items[0].findAll('.segmented button')[2].trigger('click') // Conjunta
    expect(save.attributes('disabled')).toBeUndefined()
    await save.trigger('click')
    await flushPromises()

    expect(importExpenses).toHaveBeenCalledTimes(1)
    const inputs = importExpenses.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(inputs).toEqual([
      { amount: 45.3, spent_on: '2026-10-19', category_id: 'super', description: 'Mercadona', is_shared: true, funding: 'pot', split_mode: 'household' },
    ])
    expect(toast).toHaveBeenCalledWith('Gasto apuntado')
    expect(push).toHaveBeenCalledWith({ name: 'personal' })
  })

  it('recuerda la categoría y el tipo de un gasto parecido, y reparte entre los dos', async () => {
    const wrapper = mount(ImportView)
    await upload(wrapper, 'Fecha;Concepto;Importe\n20/10/2026;NETFLIX;-15,99')
    const item = wrapper.find('li.imp')
    expect(item.text()).toContain('Como la última vez')
    expect((item.find('select').element as HTMLSelectElement).value).toBe('ocio')
    await item.findAll('.segmented button')[1].trigger('click') // Repartido
    await wrapper.find('button.block').trigger('click')
    await flushPromises()
    const [input] = importExpenses.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(input).toMatchObject({ is_shared: true, funding: 'personal', paid_by: 'yo', shares: [{ user_id: 'yo', amount: 8 }, { user_id: 'tu', amount: 7.99 }] })
  })

  it('archivo que no se entiende: mensaje y nada que apuntar', async () => {
    const wrapper = mount(ImportView)
    await upload(wrapper, 'hola\nque tal')
    expect(wrapper.text()).toContain('No he encontrado columnas de fecha e importe')
    expect(wrapper.findAll('li.imp')).toHaveLength(0)
  })
})
