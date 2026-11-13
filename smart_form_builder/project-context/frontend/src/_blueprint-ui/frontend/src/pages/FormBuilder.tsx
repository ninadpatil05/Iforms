import { useCallback, useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertCircle, ArrowLeft, PlusCircle, RefreshCw, Wand2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { createField, deleteField, getCurrentVersion, listFields, reorderFields, updateField } from '@/api/fields';
import { getFormById } from '@/api/forms';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FieldCard } from '@/components/FieldCard';
import { FieldEditorDrawer } from '@/components/FieldEditorDrawer';
import { FieldTypeIcon, fieldTypeLabel } from '@/components/FieldTypeIcon';
import { Navbar } from '@/components/Navbar';
import type { Field, FieldCreatePayload, FieldType, FormVersion } from '@/types/field';
import type { Form } from '@/types/form';

// Mirrors the landing page's field-types section, so the marketing site and
// the real editor visually match.
const FIELD_TYPE_STRIP: FieldType[] = ['text', 'number', 'email', 'date', 'dropdown', 'checkbox', 'file_upload', 'rating'];

export const FormBuilder = () => {
  const { formId } = useParams<{ formId: string }>(); const id = Number(formId);
  const [form, setForm] = useState<Form | null>(null); const [version, setVersion] = useState<FormVersion | null>(null); const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [editing, setEditing] = useState<Field | undefined>(); const [drawer, setDrawer] = useState(false); const [deleting, setDeleting] = useState<Field | null>(null);
  const load = useCallback(async () => { if (!id) { setError('Invalid form.'); setLoading(false); return; } setLoading(true); setError(''); try { const [loadedForm, loadedVersion] = await Promise.all([getFormById(id), getCurrentVersion(id)]); setForm(loadedForm); setVersion(loadedVersion); setFields(await listFields(loadedVersion.id)); } catch { setError('Could not load the form builder. Please try again.'); } finally { setLoading(false); } }, [id]);
  useEffect(() => { load(); }, [load]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const save = async (payload: FieldCreatePayload | Partial<FieldCreatePayload>) => { if (editing) { const next = await updateField(editing.id, payload); setFields(items => items.map(item => item.id === next.id ? next : item)); } else if (version) { const next = await createField({ ...payload as FieldCreatePayload, form_version_id: version.id, display_order: fields.length }); setFields(items => [...items, next]); } };
  const dragEnd = async ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) => { if (!over || active.id === over.id || !version) return; const oldIndex = fields.findIndex(f => f.id === active.id); const newIndex = fields.findIndex(f => f.id === over.id); const previous = fields; const reordered = arrayMove(fields, oldIndex, newIndex).map((item, index) => ({ ...item, display_order: index })); setFields(reordered); try { await reorderFields(version.id, reordered.map(f => f.id)); } catch { setFields(previous); setError('Could not save the new field order.'); } };

  if (loading) return (
    <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-12">
        {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded border border-paper-muted" />)}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper-base dark:bg-paper-base-dark transition-colors duration-160 ease-out">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to={`/forms/${id}`} className="inline-flex items-center font-mono text-[10px] uppercase tracking-wide text-paper-muted hover:text-paper-ink dark:hover:text-paper-text-dark transition-colors duration-160 ease-out">
          <ArrowLeft className="mr-1 w-3.5 h-3.5" />Form details
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-paper-muted">Draft builder</p>
            <h1 className="text-3xl font-semibold tracking-tight text-paper-text dark:text-paper-text-dark">{form?.title ?? 'Form builder'}</h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-paper-muted">{fields.length} field{fields.length === 1 ? '' : 's'} · drag to reorder</p>
          </div>
          <Button onClick={() => { setEditing(undefined); setDrawer(true); }}><PlusCircle className="mr-2 w-4 h-4" />Add field</Button>
        </div>

        {/* Field-type chip strip — mirrors the landing page's field-types section */}
        <div className="mt-6 flex flex-wrap gap-2">
          {FIELD_TYPE_STRIP.map(type => (
            <span key={type} className="inline-flex items-center gap-2 rounded border border-paper-muted px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-paper-muted">
              <FieldTypeIcon type={type} className="w-5 h-5" />
              {fieldTypeLabel(type)}
            </span>
          ))}
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded border border-paper-text dark:border-paper-text-dark p-4 text-sm text-paper-text dark:text-paper-text-dark">
            <AlertCircle className="w-4 h-4" />{error}
            <button onClick={load} className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide">
              <RefreshCw className="w-3.5 h-3.5" />Retry
            </button>
          </div>
        )}

        {fields.length === 0 && !error ? (
          <div className="mt-10 rounded border border-dashed border-paper-muted p-12 text-center">
            <Wand2 className="mx-auto mb-4 h-8 w-8 text-paper-muted" />
            <h2 className="text-lg font-semibold text-paper-text dark:text-paper-text-dark">Start building your form</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-paper-muted">Add your first question, then drag fields into the order your respondents should see.</p>
            <Button className="mt-6" onClick={() => setDrawer(true)}><PlusCircle className="mr-2 w-4 h-4" />Add a field</Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="mt-8 space-y-3">
                {fields.map(field => (
                  <FieldCard key={field.id} field={field} onEdit={() => { setEditing(field); setDrawer(true); }} onDelete={() => setDeleting(field)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {drawer && version && <FieldEditorDrawer field={editing} versionId={version.id} onClose={() => setDrawer(false)} onSave={save} />}

      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete field"
        message={`Delete "${deleting?.label ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting) { await deleteField(deleting.id); setFields(items => items.filter(item => item.id !== deleting.id)); setDeleting(null); } }}
      />
    </div>
  );
};
