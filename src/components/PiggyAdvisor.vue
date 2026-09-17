<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { boldParts, type Insight, type Topic } from '../lib/insights'
import Sheet from './Sheet.vue'
import UiIcon from './UiIcon.vue'

// Ventana del cerdito: conversación con preguntas preparadas. Las respuestas
// son los consejos ya calculados (lib/insights.ts), agrupados por tema.
const props = defineProps<{ insights: Insight[]; name?: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

interface Message {
  from: 'pig' | 'me'
  text: string
  tone?: Insight['tone']
}

const questions: Array<{ topic: Topic; label: string; intro: string }> = [
  { topic: 'mes', label: '¿Cómo voy este mes?', intro: 'A ver cómo va el mes…' },
  { topic: 'categorias', label: '¿En qué gasto más?', intro: 'Mirando tus categorías:' },
  { topic: 'ahorro', label: '¿Dónde puedo ahorrar?', intro: 'Algunas ideas:' },
]

function opening(): Message[] {
  const hello: Message = { from: 'pig', text: `¡Hola${props.name ? `, ${props.name}` : ''}! Soy el cerdito de GasTitos.` }
  const important = props.insights.filter((i) => i.important)
  if (important.length) {
    return [hello, { from: 'pig', text: 'Hay cosas que conviene que mires:' }, ...important.map(toMessage)]
  }
  const month = props.insights.filter((i) => i.topic === 'mes').slice(0, 2)
  return [hello, ...month.map(toMessage), { from: 'pig', text: 'Nada preocupante por ahora. ¿Qué quieres saber?' }]
}

function toMessage(i: Insight): Message {
  return { from: 'pig', text: i.text, tone: i.tone }
}

const messages = ref<Message[]>(opening())
const typing = ref(false)
const scroller = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

async function scrollDown() {
  await nextTick()
  const el = scroller.value?.closest('.sheet')
  el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

function ask(q: (typeof questions)[number]) {
  if (typing.value) return
  messages.value.push({ from: 'me', text: q.label })
  typing.value = true
  scrollDown()
  // Pequeña pausa de "pensando" para que se lea como una conversación.
  timer = setTimeout(() => {
    typing.value = false
    const answers = props.insights.filter((i) => i.topic === q.topic)
    messages.value.push({ from: 'pig', text: q.intro }, ...answers.map(toMessage))
    scrollDown()
  }, 450)
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Sheet title="El cerdito" @close="emit('close')">
    <div ref="scroller" class="piggy">
      <template v-for="(m, i) in messages" :key="i">
        <div v-if="m.from === 'pig'" class="piggy-row">
          <span class="piggy-avatar" :class="{ hidden: messages[i - 1]?.from === 'pig' }"><UiIcon name="pig" :size="18" /></span>
          <p class="bubble" :class="m.tone">
            <template v-for="(p, j) in boldParts(m.text)" :key="j"><strong v-if="p.bold">{{ p.text }}</strong><template v-else>{{ p.text }}</template></template>
          </p>
        </div>
        <div v-else class="piggy-row me">
          <p class="bubble me">{{ m.text }}</p>
        </div>
      </template>
      <div v-if="typing" class="piggy-row">
        <span class="piggy-avatar"><UiIcon name="pig" :size="18" /></span>
        <p class="bubble typing" aria-label="Pensando"><span /><span /><span /></p>
      </div>
    </div>

    <div class="piggy-questions">
      <button v-for="q in questions" :key="q.topic" type="button" class="chip" :disabled="typing" @click="ask(q)">{{ q.label }}</button>
    </div>
    <p class="tiny" style="margin: 0.6rem 0 0">Cuentas hechas con tus gastos: lo personal, tu parte de lo repartido y de la cuenta conjunta. Solo lo ves tú.</p>
  </Sheet>
</template>

<style>
.piggy { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.8rem; }
.piggy-row { display: flex; align-items: flex-end; gap: 0.45rem; }
.piggy-row.me { justify-content: flex-end; }
.piggy-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex: none; display: grid; place-items: center;
  background: var(--yo-soft); color: var(--yo);
}
.piggy-avatar.hidden { visibility: hidden; }
.bubble {
  margin: 0; padding: 0.55rem 0.8rem; border-radius: 16px 16px 16px 4px; max-width: 85%;
  background: var(--surface-2); color: var(--ink); font-size: 0.93rem; line-height: 1.4;
  border-left: 3px solid transparent;
}
.bubble.warn { background: var(--warn-soft); border-left-color: var(--warn); }
.bubble.good { background: var(--yo-soft); border-left-color: var(--yo); }
.bubble.me { background: var(--yo); color: #fff; border-radius: 16px 16px 4px 16px; font-weight: 600; }
.bubble.typing { display: inline-flex; gap: 4px; padding: 0.75rem 0.9rem; }
.bubble.typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); animation: piggy-dot 1s infinite ease-in-out; }
.bubble.typing span:nth-child(2) { animation-delay: 0.15s; }
.bubble.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes piggy-dot { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
.piggy-questions {
  position: sticky; bottom: calc(-1rem - env(safe-area-inset-bottom)); display: flex; flex-wrap: wrap; gap: 0.4rem;
  background: var(--surface); padding: 0.6rem 0; border-top: 1px solid var(--line);
}
</style>
