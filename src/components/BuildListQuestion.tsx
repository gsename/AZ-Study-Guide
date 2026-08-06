import { useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { QuizQuestion } from '../types'
import { seededShuffle } from '../lib/examBuilder'
import { renderInline } from './RichText'

interface BuildListQuestionProps {
  question: QuizQuestion
  order: string[]
  onChange: (order: string[]) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

function SortableChosen({
  id,
  position,
  revealed,
  correctPosition,
  onRemove,
}: {
  id: string
  position: number
  revealed: boolean
  correctPosition: number
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled: revealed,
  })
  // A chosen item is right only if it belongs AND sits in the right slot.
  const isRight = correctPosition === position

  let cls = 'choice build-chosen'
  if (revealed) cls += isRight ? ' correct' : ' incorrect'

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cls}>
      <span className="choice-marker">{position + 1}</span>
      <span className="build-grip" {...attributes} {...listeners} role="button" tabIndex={0}>
        {id}
      </span>
      {revealed ? (
        !isRight && (
          <span className="muted build-note">
            {correctPosition === -1 ? "ne fait pas partie de la réponse" : `attendu en ${correctPosition + 1}`}
          </span>
        )
      ) : (
        <button type="button" className="build-remove" onClick={onRemove} title="Retirer de la liste">
          ✕
        </button>
      )}
    </div>
  )
}

/**
 * Build an ordered list from a pool that is deliberately LARGER than the answer.
 * That is the whole difference from `reorder`, which shows exactly the correct
 * set and so only ever asks the learner to permute — never to exclude. Choosing
 * which items do not belong is most of the real format's difficulty.
 */
export default function BuildListQuestion({
  question,
  order,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: BuildListQuestionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const correctOrder = question.correctOrder ?? []
  const correctPositionOf = useMemo(
    () => new Map(correctOrder.map((item, i) => [item, i])),
    [correctOrder],
  )
  // Pool order must not betray the answer: an authored pool that lists the
  // correct items first, then the distractors, gives the item away entirely.
  const pool = useMemo(
    () => seededShuffle(question.poolItems ?? [], `${question.id}:pool`),
    [question.poolItems, question.id],
  )
  const available = pool.filter((item) => !order.includes(item))

  function handleDragEnd(event: DragEndEvent) {
    if (revealed) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onChange(arrayMove(order, from, to))
  }

  return (
    <div className="card">
      <div className="q-progress">
        <div style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
      </div>
      <div className="chip-row" style={{ marginBottom: '0.75rem' }}>
        <span className="chip">
          Question {questionNumber} / {totalQuestions}
        </span>
        <span className={`badge ${question.difficulty}`}>{question.difficulty}</span>
        <span className="chip warn">Construire la liste — tout le vivier ne sert pas</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <div className="build-columns">
        <div className="build-col">
          <div className="build-col-title">
            Actions disponibles <span className="muted">({available.length})</span>
          </div>
          {available.map((item) => (
            <button
              key={item}
              type="button"
              className="choice build-available"
              disabled={revealed}
              onClick={() => onChange([...order, item])}
            >
              <span className="choice-marker">+</span>
              <span>{item}</span>
            </button>
          ))}
          {available.length === 0 && <p className="muted">Vivier vide.</p>}
        </div>

        <div className="build-col">
          <div className="build-col-title">
            Réponse, dans l'ordre <span className="muted">({order.length})</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((item, i) => (
                <SortableChosen
                  key={item}
                  id={item}
                  position={i}
                  revealed={revealed}
                  correctPosition={correctPositionOf.get(item) ?? -1}
                  onRemove={() => onChange(order.filter((x) => x !== item))}
                />
              ))}
            </SortableContext>
          </DndContext>
          {order.length === 0 && (
            <p className="muted">Ajoute des actions depuis la colonne de gauche, puis ordonne-les.</p>
          )}
          {revealed && order.length !== correctOrder.length && (
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              La réponse attendue compte {correctOrder.length} actions.
            </p>
          )}
        </div>
      </div>

      {revealed && (
        <div className="explanation-box">
          <strong>💡 Explication</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
        </div>
      )}
    </div>
  )
}
