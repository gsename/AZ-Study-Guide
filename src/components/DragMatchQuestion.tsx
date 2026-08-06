import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMemo } from 'react'
import type { QuizQuestion } from '../types'
import { seededShuffle } from '../lib/examBuilder'
import { renderInline } from './RichText'

interface DragMatchQuestionProps {
  question: QuizQuestion
  values: Record<string, string>
  onChange: (targetId: string, value: string) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

function DraggableSource({ source, disabled }: { source: string; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: source,
    disabled,
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`match-source${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      {source}
    </button>
  )
}

function DropTarget({
  id,
  label,
  assigned,
  revealed,
  isRight,
  expected,
  onClear,
}: {
  id: string
  label: string
  assigned: string | undefined
  revealed: boolean
  isRight: boolean
  expected: string
  onClear: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  let cls = 'match-target'
  if (isOver && !revealed) cls += ' over'
  if (revealed) cls += isRight ? ' correct' : ' incorrect'

  return (
    <div ref={setNodeRef} className={cls}>
      <span className="match-label">{renderInline(label)}</span>
      <span className="match-slot">
        {assigned ? (
          <button
            type="button"
            className="match-assigned"
            disabled={revealed}
            onClick={onClear}
            title="Retirer"
          >
            {assigned}
          </button>
        ) : (
          <span className="muted match-empty">déposer ici</span>
        )}
      </span>
      {revealed && !isRight && <span className="muted match-expected">attendu : {expected}</span>}
    </div>
  )
}

/**
 * Drag each source onto its target. `sources` deliberately contains more
 * entries than there are targets: the distractors are most of the difficulty,
 * and an item whose pool exactly matches its targets degenerates into a
 * permutation puzzle.
 *
 * A source stays in the pool after being assigned, because Microsoft's own
 * drag-and-drop items allow one source to answer several targets.
 */
export default function DragMatchQuestion({
  question,
  values,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: DragMatchQuestionProps) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const targets = question.targets ?? []
  // Shuffled deterministically per item: authored pool order otherwise pairs
  // source i with target i, which is a free tell no amount of distractors fixes.
  const sources = useMemo(
    () => seededShuffle(question.sources ?? [], `${question.id}:sources`),
    [question.sources, question.id],
  )

  function handleDragEnd(event: DragEndEvent) {
    if (revealed) return
    const { active, over } = event
    if (!over) return
    onChange(String(over.id), String(active.id))
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
        <span className="chip warn">Glisser chaque élément sur sa cible</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="match-pool">
          {sources.map((source) => (
            <DraggableSource key={source} source={source} disabled={revealed} />
          ))}
        </div>

        <div className="match-targets">
          {targets.map((target) => (
            <DropTarget
              key={target.id}
              id={target.id}
              label={target.label}
              assigned={values[target.id]}
              revealed={revealed}
              isRight={values[target.id] === target.correctSource}
              expected={target.correctSource}
              onClear={() => onChange(target.id, '')}
            />
          ))}
        </div>
      </DndContext>

      {revealed && (
        <div className="explanation-box">
          <strong>💡 Explication</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{renderInline(question.explanation)}</p>
        </div>
      )}
    </div>
  )
}
