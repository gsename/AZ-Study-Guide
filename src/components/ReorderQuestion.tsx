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
import { renderInline } from './RichText'

interface ReorderQuestionProps {
  question: QuizQuestion
  order: string[]
  onChange: (order: string[]) => void
  revealed: boolean
  questionNumber: number
  totalQuestions: number
}

function SortableItem({
  id,
  label,
  revealed,
  correctPosition,
  actualPosition,
}: {
  id: string
  label: string
  revealed: boolean
  correctPosition: number
  actualPosition: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled: revealed })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const isRight = correctPosition === actualPosition

  let cls = 'choice'
  if (revealed) cls += isRight ? ' correct' : ' incorrect'

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={cls}
      type="button"
      {...attributes}
      {...listeners}
    >
      <span className="choice-marker">{actualPosition + 1}</span>
      <span>{label}</span>
      {revealed && !isRight && (
        <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
          position correcte : {correctPosition + 1}
        </span>
      )}
    </button>
  )
}

export default function ReorderQuestion({
  question,
  order,
  onChange,
  revealed,
  questionNumber,
  totalQuestions,
}: ReorderQuestionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const correctOrder = question.reorderItems ?? []
  const correctPositionOf = new Map(correctOrder.map((item, i) => [item, i]))

  function handleDragEnd(event: DragEndEvent) {
    if (revealed) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = order.indexOf(String(active.id))
    const newIndex = order.indexOf(String(over.id))
    onChange(arrayMove(order, oldIndex, newIndex))
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
        <span className="chip warn">Glisser-déposer pour ordonner</span>
      </div>

      <h3 style={{ marginTop: 0 }}>{renderInline(question.prompt)}</h3>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((item, i) => (
            <SortableItem
              key={item}
              id={item}
              label={item}
              revealed={revealed}
              correctPosition={correctPositionOf.get(item) ?? -1}
              actualPosition={i}
            />
          ))}
        </SortableContext>
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
