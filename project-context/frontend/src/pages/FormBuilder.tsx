import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getFormById,
  publishForm,
  checkFormGraph,
  GraphCheckResult,
} from '@/api/forms';
import {
  getCurrentVersion,
  listFields,
  createField,
  updateField,
  deleteField,
  reorderFields,
} from '@/api/fields';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from '@/api/sections';
import { Form } from '@/types/form';
import {
  Field,
  FieldType,
  FormVersion,
  FieldOption,
  FormulaTerm,
  FormulaOp,
} from '@/types/field';
import { Section } from '@/types/section';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { Select } from '@/components/Select';
import { Checkbox } from '@/components/Checkbox';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ConditionGroupDrawer } from '@/components/ConditionGroupDrawer';
import { BranchRuleDrawer } from '@/components/BranchRuleDrawer';
import { FormPreviewModal } from '@/components/FormPreviewModal';
import { PublishShareModal } from '@/components/PublishShareModal';
import {
  Undo,
  Redo,
  Search,
  GripVertical,
  Type,
  AlignLeft,
  Mail,
  Hash,
  Calendar,
  ListFilter,
  CheckSquare,
  CircleDot,
  UploadCloud,
  Star,
  Lock,
  Calculator,
  Plus,
  Pencil,
  Copy,
  Trash2,
  GitBranch,
  LayoutGrid,
  FileText,
  BarChart2,
  Settings,
  X,
  SlidersHorizontal,
  Bell,
} from 'lucide-react';

const PALETTE_FIELD_TYPES: { type: FieldType; label: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Short Text', icon: Type },
  { type: 'textarea', label: 'Long Text', icon: AlignLeft },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'dropdown', label: 'Dropdown', icon: ListFilter },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'radio', label: 'Radio', icon: CircleDot },
  { type: 'file_upload', label: 'File Upload', icon: UploadCloud },
  { type: 'rating', label: 'Rating', icon: Star },
  { type: 'password', label: 'Password', icon: Lock },
  { type: 'computed', label: 'Computed', icon: Calculator },
];

interface SortableFieldCardProps {
  field: Field;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const SortableFieldCard: React.FC<SortableFieldCardProps> = ({
  field,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-4 bg-paper-lowest border rounded-md transition-all duration-150 relative group cursor-pointer ${
        isSelected
          ? 'border-terracotta ring-2 ring-terracotta/20 shadow-warm-md'
          : 'border-paper-border hover:border-ink-subtle shadow-warm-sm'
      }`}
    >
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-paper-lowest/90 backdrop-blur-xs p-1 border border-paper-border rounded-sm shadow-warm-sm">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className="p-1 text-ink-muted hover:text-ink rounded-sm"
          title="Edit Properties"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="p-1 text-ink-muted hover:text-ink rounded-sm"
          title="Duplicate Field"
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-ink-muted hover:text-brick rounded-sm"
          title="Delete Field"
        >
          <Trash2 size={13} />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="p-1 text-ink-subtle hover:text-ink cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical size={13} />
        </div>
      </div>

      <div className="pr-20">
        <label className="block text-xs font-semibold text-ink uppercase tracking-wider">
          {field.label || 'Untitled Field'}
          {field.required && <span className="text-terracotta ml-0.5">*</span>}
        </label>

        <div className="mt-2">
          {field.field_type === 'textarea' ? (
            <div className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink-subtle font-sans min-h-[50px]">
              {field.placeholder || 'Long text input...'}
            </div>
          ) : field.field_type === 'dropdown' ? (
            <div className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink-subtle font-sans">
              {field.placeholder || 'Select option...'}
            </div>
          ) : field.field_type === 'checkbox' || field.field_type === 'radio' ? (
            <div className="space-y-1.5 pt-1">
              {(field.options || [{ label: 'Option 1', value: 'opt1' }]).slice(0, 3).map((opt, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-ink-muted">
                  <div
                    className={`w-3.5 h-3.5 border border-paper-border bg-paper-high ${
                      field.field_type === 'radio' ? 'rounded-full' : 'rounded-sm'
                    }`}
                  />
                  <span>{opt.label}</span>
                </div>
              ))}
            </div>
          ) : field.field_type === 'rating' ? (
            <div className="flex items-center gap-1 text-amber pt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={16} className="fill-amber-container text-amber" />
              ))}
            </div>
          ) : field.field_type === 'computed' ? (
            <div className="w-full px-3 py-2 bg-terracotta-fixed border border-terracotta/30 rounded-sm text-xs text-terracotta font-mono font-semibold">
              [Calculated Formula Result]
            </div>
          ) : (
            <div className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink-subtle font-sans">
              {field.placeholder || `${field.field_type} input`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const FormBuilder: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const id = Number(formId);

  const [form, setForm] = useState<Form | null>(null);
  const [version, setVersion] = useState<FormVersion | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [graphCheck, setGraphCheck] = useState<GraphCheckResult | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Currently selected field & active section
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'settings' | 'logic' | 'theme'>('settings');

  // Branch Rule Drawer state for section routing
  const [branchSection, setBranchSection] = useState<Section | null>(null);

  // Drag State
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // Search filter for Left Palette
  const [paletteSearch, setPaletteSearch] = useState('');

  // Modals state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPublishShareOpen, setIsPublishShareOpen] = useState(false);

  // Dismissible Graph Check Warning Banner
  const [isGraphBannerDismissed, setIsGraphBannerDismissed] = useState(false);

  // Confirmation modal state for field deletion
  const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);

  const loadBuilderData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [loadedForm, loadedVersion] = await Promise.all([
        getFormById(id),
        getCurrentVersion(id),
      ]);
      setForm(loadedForm);
      setVersion(loadedVersion);

      const [loadedSections, loadedFields] = await Promise.all([
        listSections(loadedVersion.id),
        listFields(loadedVersion.id),
      ]);

      setSections(loadedSections);
      setFields(loadedFields);
      if (loadedSections.length > 0) {
        setActiveSectionId((prev) =>
          prev && loadedSections.some((s) => s.id === prev) ? prev : loadedSections[0].id
        );
      }

      // Check graph validity
      try {
        const graphRes = await checkFormGraph(id);
        setGraphCheck(graphRes);
      } catch {
        // Silent fallback
      }
    } catch {
      toast.error('Failed to load form', 'Could not retrieve form structure from backend.');
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadBuilderData();
  }, [loadBuilderData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  const handleAddFieldFromPalette = async (type: FieldType, targetSectionId?: number | null) => {
    if (!version) return;
    setSaveStatus('saving');
    const destinationSection =
      targetSectionId || activeSectionId || selectedField?.section_id || (sections[0]?.id || null);

    const defaultLabels: Record<string, string> = {
      text: 'Short Text Field',
      textarea: 'Long Text Field',
      email: 'Email Address',
      number: 'Number Input',
      date: 'Date Field',
      dropdown: 'Dropdown Select',
      checkbox: 'Checkbox Options',
      radio: 'Radio Group',
      file_upload: 'File Upload',
      rating: 'Rating Scale',
      password: 'Password Input',
      computed: 'Computed Total',
    };

    try {
      const newField = await createField({
        form_version_id: version.id,
        label: defaultLabels[type] || 'New Question',
        field_type: type,
        placeholder: type === 'text' ? 'Enter answer...' : null,
        required: false,
        section_id: destinationSection,
        display_order: fields.length,
        options: ['dropdown', 'checkbox', 'radio'].includes(type)
          ? [
              { label: 'Option 1', value: 'option_1' },
              { label: 'Option 2', value: 'option_2' },
            ]
          : null,
      });

      setFields((prev) => [...prev, newField]);
      setSelectedFieldId(newField.id);
      if (destinationSection) {
        setActiveSectionId(destinationSection);
      }
      setSaveStatus('saved');
      toast.success('Field added', `Added ${defaultLabels[type]} to active section.`);
    } catch {
      setSaveStatus('error');
      toast.error('Add field failed', 'Could not create field.');
    }
  };

  const handleUpdateSelectedField = async (updates: Partial<Field>) => {
    if (!selectedFieldId || !version) return;
    setSaveStatus('saving');

    setFields((prev) =>
      prev.map((f) => (f.id === selectedFieldId ? { ...f, ...updates } : f))
    );

    try {
      const updated = await updateField(selectedFieldId, updates);
      setFields((prev) => prev.map((f) => (f.id === selectedFieldId ? updated : f)));
      if (updated.section_id) {
        setActiveSectionId(updated.section_id);
      }
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
      toast.error('Save failed', 'Could not update field settings.');
    }
  };

  const handleDuplicateField = async (fieldToDup: Field) => {
    if (!version) return;
    setSaveStatus('saving');
    try {
      const duplicated = await createField({
        form_version_id: version.id,
        label: `${fieldToDup.label} (Copy)`,
        field_type: fieldToDup.field_type,
        placeholder: fieldToDup.placeholder,
        required: fieldToDup.required,
        options: fieldToDup.options,
        validation_config: fieldToDup.validation_config,
        section_id: fieldToDup.section_id,
        display_order: fields.length,
      });
      setFields((prev) => [...prev, duplicated]);
      setSelectedFieldId(duplicated.id);
      if (fieldToDup.section_id) {
        setActiveSectionId(fieldToDup.section_id);
      }
      setSaveStatus('saved');
      toast.success('Field duplicated', `Copied "${fieldToDup.label}".`);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return;
    setSaveStatus('saving');
    try {
      await deleteField(fieldToDelete.id);
      setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
      if (selectedFieldId === fieldToDelete.id) {
        setSelectedFieldId(null);
      }
      setSaveStatus('saved');
      toast.info('Field deleted', `Removed "${fieldToDelete.label}".`);
    } catch {
      setSaveStatus('error');
    } finally {
      setFieldToDelete(null);
    }
  };

  const handleAddSection = async () => {
    if (!version) return;
    setSaveStatus('saving');
    try {
      const newSec = await createSection({
        form_version_id: version.id,
        title: `Section ${sections.length + 1}`,
        description: 'Add instructions for this section...',
        display_order: sections.length,
      });
      setSections((prev) => [...prev, newSec]);
      setActiveSectionId(newSec.id);
      setSaveStatus('saved');
      toast.success('Section created', `Added "${newSec.title}".`);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleRenameSection = async (secId: number, title: string) => {
    try {
      const updated = await updateSection(secId, { title });
      setSections((prev) => prev.map((s) => (s.id === secId ? updated : s)));
    } catch {
      toast.error('Rename failed', 'Could not rename section.');
    }
  };

  const handleDeleteSection = async (secId: number) => {
    try {
      await deleteSection(secId);
      setSections((prev) => prev.filter((s) => s.id !== secId));
      setFields((prev) =>
        prev.map((f) => (f.section_id === secId ? { ...f, section_id: null } : f))
      );
      toast.info('Section deleted', 'Fields moved to default section.');
    } catch {
      toast.error('Delete section failed', 'Could not delete section.');
    }
  };

  const handleDragEnd = async (event: any) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !version) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    const newFields = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      display_order: i,
    }));

    setFields(newFields);
    setSaveStatus('saving');

    try {
      await reorderFields(
        version.id,
        newFields.map((f) => f.id)
      );
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      const pubRes = await publishForm(id);
      toast.success('Form published!', 'Form is live and ready for public responses.');
      await loadBuilderData();
      if (pubRes.public_url) {
        window.open(pubRes.public_url, '_blank');
      }
    } catch {
      toast.error('Publish failed', 'Please verify all required field configurations.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPalette = PALETTE_FIELD_TYPES.filter((pt) =>
    pt.label.toLowerCase().includes(paletteSearch.toLowerCase())
  );

  return (
    <div className="h-screen w-screen bg-paper-base text-ink flex flex-col font-sans overflow-hidden">
      {/* 1. Top Navbar matching reference screenshot (Dashboard / My Forms ONLY) */}
      <header className="h-14 bg-paper-lowest border-b border-paper-border px-4 sm:px-8 flex items-center justify-between shadow-warm-sm shrink-0 z-30">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-1 no-underline">
            <span className="font-serif font-bold text-2xl tracking-tight text-terracotta">
              IForms
            </span>
          </Link>

          {/* Navigation Items (Dashboard / My Forms ONLY as specified in screenshot) */}
          <nav className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="text-xs font-medium text-ink-muted hover:text-ink no-underline"
            >
              Dashboard
            </Link>
            <Link
              to="/forms"
              className="text-xs font-medium text-ink-muted hover:text-ink no-underline"
            >
              My Forms
            </Link>
          </nav>
        </div>

        {/* Right utility icons & action buttons */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)}>
            Preview
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsPublishShareOpen(true)}>
            Publish & Share
          </Button>

          <div className="h-4 w-px bg-paper-border mx-1" />

          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink rounded-full cursor-pointer"
            title="Notifications"
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            className="p-1.5 text-ink-muted hover:text-ink rounded-full cursor-pointer"
            title="Settings"
          >
            <Settings size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-terracotta text-white font-serif font-bold text-xs flex items-center justify-center shadow-warm-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      {/* 2. Main 3-Pane Work Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANE 1: Left Elements & Palette Panel */}
        <div className="w-64 bg-paper-lowest border-r border-paper-border p-4 flex flex-col shrink-0 overflow-y-auto space-y-5">
          <div>
            <h3 className="font-serif text-lg font-bold text-ink tracking-tight">Elements</h3>
            <div className="mt-2">
              <Input
                placeholder="Search fields..."
                value={paletteSearch}
                onChange={(e) => setPaletteSearch(e.target.value)}
                leftIcon={<Search size={14} />}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              LAYOUT
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleAddSection}
                className="p-3 bg-paper-high/60 hover:bg-paper-high border border-paper-border rounded-sm flex flex-col items-center gap-1.5 text-xs font-medium text-ink cursor-pointer transition-colors"
              >
                <LayoutGrid size={18} className="text-terracotta" />
                <span>Section</span>
              </button>
              <button
                type="button"
                className="p-3 bg-paper-high/40 border border-paper-border rounded-sm flex flex-col items-center gap-1.5 text-xs font-medium text-ink-subtle cursor-not-allowed opacity-60"
              >
                <LayoutGrid size={18} />
                <span>Columns</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              BASIC INPUT
            </p>

            <div className="space-y-2">
              {filteredPalette.map((pt) => {
                const Icon = pt.icon;
                return (
                  <div
                    key={pt.type}
                    onClick={() => handleAddFieldFromPalette(pt.type)}
                    className="p-2.5 bg-paper-high/60 hover:bg-paper-high border border-paper-border rounded-sm flex items-center gap-3 cursor-pointer transition-all hover:border-terracotta/40 shadow-warm-sm group"
                  >
                    <GripVertical size={14} className="text-ink-subtle shrink-0" />
                    <Icon size={16} className="text-terracotta shrink-0" />
                    <span className="text-xs font-medium text-ink group-hover:text-terracotta">
                      {pt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PANE 2: Center Canvas (Work Area) */}
        <div className="flex-1 bg-paper-base p-6 overflow-y-auto space-y-6">
          {/* Graph Check Warning Banner */}
          {graphCheck && !graphCheck.valid && !isGraphBannerDismissed && (
            <InlineBanner
              variant="warning"
              title="Graph Check Warning"
              message="Unreachable sections detected in form logic graph. Please verify section default next paths."
              onDismiss={() => setIsGraphBannerDismissed(true)}
            />
          )}

          {/* Form Header Title */}
          <div className="max-w-2xl mx-auto space-y-2">
            <h1 className="font-serif text-3xl font-bold text-ink tracking-tight">
              {form?.title || 'Contact Information'}
            </h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              {form?.description || 'Please provide your details below. Fields marked with * are required.'}
            </p>
          </div>

          {/* DnD Context for Section and Question Cards */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveDragId(Number(e.active.id))}
            onDragEnd={handleDragEnd}
          >
            <div className="max-w-2xl mx-auto space-y-6">
              {sections.length === 0 ? (
                <div className="p-8 bg-paper-lowest border border-paper-border rounded-md text-center space-y-4">
                  <h3 className="font-serif text-lg font-bold text-ink">Main Section</h3>
                  <p className="text-xs text-ink-muted">
                    No fields added yet. Click an element on the left panel to insert it.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddFieldFromPalette('text')}
                  >
                    + Add First Field
                  </Button>
                </div>
              ) : (
                sections.map((section) => {
                  const sectionFields = fields.filter(
                    (f) => (f.section_id ?? null) === section.id
                  );
                  const isActiveSection = activeSectionId === section.id;

                  return (
                    <div key={section.id} className="space-y-3">
                      <div
                        onClick={() => setActiveSectionId(section.id)}
                        className={`bg-paper-lowest border rounded-md p-6 shadow-warm-sm space-y-4 transition-all ${
                          isActiveSection
                            ? 'border-terracotta/60 ring-1 ring-terracotta/20'
                            : 'border-paper-border hover:border-ink-subtle'
                        }`}
                      >
                        {/* Section Header */}
                        <div className="flex items-center justify-between border-b border-paper-border pb-3">
                          <div className="flex items-center gap-2">
                            <h2 className="font-serif text-xl font-bold text-ink">
                              {section.title}
                            </h2>
                            {isActiveSection && (
                              <span className="px-2 py-0.5 rounded-full bg-terracotta-fixed text-terracotta font-mono text-[10px] font-bold">
                                ACTIVE SECTION
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Branching rules button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSectionId(section.id);
                                setBranchSection(section);
                              }}
                              className="px-2.5 py-1 bg-paper-high border border-paper-border rounded-sm text-xs font-semibold text-terracotta hover:bg-terracotta-fixed flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <GitBranch size={13} />
                              <span>Branching</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameSection(
                                  section.id,
                                  prompt('Rename Section', section.title) || section.title
                                );
                              }}
                              className="p-1 text-ink-muted hover:text-ink cursor-pointer"
                              title="Rename Section"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSection(section.id);
                              }}
                              className="p-1 text-ink-muted hover:text-brick cursor-pointer"
                              title="Delete Section"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Section Fields Sortable List */}
                        <SortableContext
                          items={sectionFields.map((f) => f.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-3">
                            {sectionFields.length === 0 ? (
                              <div className="p-4 border border-dashed border-paper-border rounded-sm text-center text-xs text-ink-subtle">
                                No questions in this section yet. Click below or pick an element from the left palette.
                              </div>
                            ) : (
                              sectionFields.map((field) => (
                                <SortableFieldCard
                                  key={field.id}
                                  field={field}
                                  isSelected={selectedFieldId === field.id}
                                  onSelect={() => {
                                    setSelectedFieldId(field.id);
                                    setActiveSectionId(section.id);
                                  }}
                                  onDuplicate={() => handleDuplicateField(field)}
                                  onDelete={() => setFieldToDelete(field)}
                                />
                              ))
                            )}
                          </div>
                        </SortableContext>

                        {/* Per-Section Add Question CTA Button */}
                        <div className="pt-2 flex justify-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSectionId(section.id);
                              handleAddFieldFromPalette('text', section.id);
                            }}
                            className="px-4 py-2 bg-paper-high/60 hover:bg-paper-high border border-paper-border rounded-sm text-xs font-semibold text-ink hover:text-terracotta flex items-center gap-1.5 cursor-pointer transition-colors shadow-warm-sm"
                          >
                            <Plus size={14} className="text-terracotta" />
                            <span>Add Field to {section.title}</span>
                          </button>
                        </div>
                      </div>

                      {/* Branch Logic Active Indicator Banner on Section matching screenshot */}
                      {section.default_next_section_id && (
                        <div className="p-4 bg-terracotta-fixed/60 border border-terracotta/20 rounded-md flex items-start gap-3">
                          <GitBranch size={18} className="text-terracotta shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-bold text-xs text-ink font-sans">
                              Branch Logic Active
                            </h5>
                            <p className="text-xs text-ink-muted mt-0.5">
                              This section contains rules that direct users to different paths based on their selection.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Bottom Add Section CTA */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-6 py-2.5 bg-paper-lowest border border-dashed border-paper-border hover:border-terracotta rounded-full text-xs font-semibold text-ink hover:text-terracotta transition-colors shadow-warm-sm cursor-pointer"
                >
                  + Add Section
                </button>
              </div>
            </div>

            <DragOverlay>
              {activeDragId ? (
                <div className="p-4 bg-paper-lowest border-2 border-terracotta rounded-md shadow-warm-lift text-xs font-bold text-ink">
                  Dragging Field Card...
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* PANE 3: Right Slide-Over Drawer / Field Settings Panel */}
        {selectedField && rightPanelTab === 'logic' && version ? (
          <ConditionGroupDrawer
            targetField={selectedField}
            versionId={version.id}
            fields={fields}
            activeTab={rightPanelTab}
            onTabChange={(tab) => setRightPanelTab(tab)}
            onClose={() => setSelectedFieldId(null)}
          />
        ) : (
          <div className="w-80 bg-paper-lowest border-l border-paper-border p-5 flex flex-col shrink-0 overflow-y-auto space-y-6">
            {/* Header Badge */}
            <div className="flex items-center gap-3 border-b border-paper-border pb-4">
              <div className="w-9 h-9 rounded-full bg-terracotta text-white font-serif font-bold text-sm flex items-center justify-center shadow-warm-sm">
                UW
              </div>
              <div>
                <h4 className="font-serif font-bold text-sm text-ink">Form Editor</h4>
                <p className="text-[11px] text-ink-muted">Drafting Contact Form</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-paper-border text-xs font-medium">
              <button
                type="button"
                onClick={() => setRightPanelTab('logic')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
                  rightPanelTab === 'logic'
                    ? 'border-terracotta text-terracotta font-semibold'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Logic
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('settings')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
                  rightPanelTab === 'settings'
                    ? 'border-terracotta text-terracotta font-semibold'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('theme')}
                className={`flex-1 py-2 text-center border-b-2 transition-colors cursor-pointer ${
                  rightPanelTab === 'theme'
                    ? 'border-terracotta text-terracotta font-semibold'
                    : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                Theme
              </button>
            </div>

            {selectedField ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-paper-border pb-3">
                  <h3 className="font-serif text-lg font-bold text-ink">Field Properties</h3>
                  <span className="text-[11px] font-mono text-ink-muted uppercase">
                    {selectedField.field_type}
                  </span>
                </div>

                <Input
                  label="LABEL"
                  value={selectedField.label}
                  onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                />

                <Select
                  label="FIELD TYPE"
                  options={PALETTE_FIELD_TYPES.map((pt) => ({
                    value: pt.type,
                    label: pt.label,
                  }))}
                  value={selectedField.field_type}
                  onChange={(val) => handleUpdateSelectedField({ field_type: val as FieldType })}
                  searchable={false}
                  clearable={false}
                />

                <Input
                  label="PLACEHOLDER TEXT"
                  placeholder="e.g. Jane Doe"
                  value={selectedField.placeholder || ''}
                  onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                />

                <Textarea
                  label="HELP TEXT"
                  placeholder="Add instructions..."
                  rows={3}
                  value={(selectedField as any).help_text || ''}
                  onChange={(e) => handleUpdateSelectedField({ help_text: e.target.value } as any)}
                />

                <div className="border-t border-paper-border pt-4 space-y-3">
                  <p className="text-xs font-semibold text-ink uppercase tracking-wider">
                    VALIDATION
                  </p>

                  <Checkbox
                    label="Required Field"
                    checked={selectedField.required}
                    onChange={(e) => handleUpdateSelectedField({ required: e.target.checked })}
                  />


                  {selectedField.field_type === 'computed' && (
                    <div className="pt-3 border-t border-paper-border space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink uppercase tracking-wider flex items-center gap-1">
                          <Calculator size={14} className="text-terracotta" /> FORMULA LOGIC BUILDER
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const cfg = selectedField.validation_config || {};
                            const currentTerms: FormulaTerm[] = cfg.terms || [];
                            const eligible = fields.filter((f) => f.id !== selectedField.id && ['number', 'rating', 'computed'].includes(f.field_type));
                            const defaultFieldId = eligible[0]?.id;
                            const newTerm: FormulaTerm = defaultFieldId ? { field_id: defaultFieldId } : { constant_value: 0 };
                            const newTerms = currentTerms.length === 0 ? [newTerm] : [...currentTerms, { op: 'add' as FormulaOp }, newTerm];
                            handleUpdateSelectedField({
                              validation_config: { ...cfg, terms: newTerms, decimal_places: cfg.decimal_places ?? 2 },
                            });
                          }}
                          className="text-xs text-terracotta hover:underline font-semibold"
                        >
                          + Add Term
                        </button>
                      </div>

                      <div className="space-y-2">
                        {((selectedField.validation_config?.terms as FormulaTerm[]) || []).map((term, index) => {
                          const isOp = index % 2 === 1;
                          const isConst = 'constant_value' in term;
                          const currentTerms = [...((selectedField.validation_config?.terms as FormulaTerm[]) || [])];
                          const cfg = selectedField.validation_config || {};
                          const eligible = fields.filter((f) => f.id !== selectedField.id && ['number', 'rating', 'computed'].includes(f.field_type));

                          if (isOp) {
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <select
                                  value={('op' in term) ? term.op : 'add'}
                                  onChange={(e) => {
                                    currentTerms[index] = { op: e.target.value as FormulaOp };
                                    handleUpdateSelectedField({
                                      validation_config: { ...cfg, terms: currentTerms },
                                    });
                                  }}
                                  className="w-full px-2 py-1.5 bg-paper-high border border-paper-border rounded-sm text-xs font-semibold text-ink"
                                >
                                  <option value="add">+ Add</option>
                                  <option value="subtract">- Subtract</option>
                                  <option value="multiply">× Multiply</option>
                                  <option value="divide">÷ Divide</option>
                                </select>
                              </div>
                            );
                          }

                          return (
                            <div key={index} className="flex items-center gap-2">
                              <select
                                value={isConst ? 'constant' : 'field'}
                                onChange={(e) => {
                                  const isConstant = e.target.value === 'constant';
                                  if (isConstant) {
                                    currentTerms[index] = { constant_value: 0 };
                                  } else {
                                    const defaultId = eligible[0]?.id || 0;
                                    currentTerms[index] = { field_id: defaultId };
                                  }
                                  handleUpdateSelectedField({
                                    validation_config: { ...cfg, terms: currentTerms },
                                  });
                                }}
                                className="w-24 px-1.5 py-1.5 bg-paper-high border border-paper-border rounded-sm text-xs font-mono text-ink"
                              >
                                <option value="field">Field</option>
                                <option value="constant">Constant</option>
                              </select>

                              <div className="flex-1">
                                {isConst ? (
                                  <input
                                    type="number"
                                    value={String(('constant_value' in term) ? term.constant_value : 0)}
                                    onChange={(e) => {
                                      currentTerms[index] = { constant_value: Number(e.target.value) };
                                      handleUpdateSelectedField({
                                        validation_config: { ...cfg, terms: currentTerms },
                                      });
                                    }}
                                    placeholder="e.g. 250"
                                    className="w-full px-2 py-1.5 bg-paper-high border border-paper-border rounded-sm text-xs font-mono text-ink"
                                  />
                                ) : (
                                  <select
                                    value={('field_id' in term) ? term.field_id : ''}
                                    onChange={(e) => {
                                      currentTerms[index] = { field_id: Number(e.target.value) };
                                      handleUpdateSelectedField({
                                        validation_config: { ...cfg, terms: currentTerms },
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 bg-paper-high border border-paper-border rounded-sm text-xs text-ink"
                                  >
                                    <option value="">Select field...</option>
                                    {eligible.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.label}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (currentTerms.length <= 1) return;
                                  if (index === 0) {
                                    currentTerms.splice(0, 2);
                                  } else if (index % 2 === 0) {
                                    currentTerms.splice(index - 1, 2);
                                  } else {
                                    currentTerms.splice(index, 2);
                                  }
                                  handleUpdateSelectedField({
                                    validation_config: { ...cfg, terms: currentTerms },
                                  });
                                }}
                                className="p-1 text-ink-muted hover:text-brick"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <Input
                        label="DECIMAL PLACES (0-10)"
                        type="number"
                        min="0"
                        max="10"
                        value={String(selectedField.validation_config?.decimal_places ?? 2)}
                        onChange={(e) => {
                          const cfg = selectedField.validation_config || {};
                          handleUpdateSelectedField({
                            validation_config: { ...cfg, decimal_places: Math.min(10, Math.max(0, Number(e.target.value))) },
                          });
                        }}
                      />
                    </div>
                  )}

                  {['dropdown', 'checkbox', 'radio'].includes(selectedField.field_type) && (
                    <div className="pt-3 border-t border-paper-border space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink uppercase tracking-wider">
                          OPTIONS
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const opts = selectedField.options || [];
                            const newOpts: FieldOption[] = [
                              ...opts,
                              {
                                label: `Option ${opts.length + 1}`,
                                value: `option_${opts.length + 1}`,
                              },
                            ];
                            handleUpdateSelectedField({ options: newOpts });
                          }}
                          className="text-xs text-terracotta hover:underline font-semibold"
                        >
                          + Add Option
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(selectedField.options || []).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              value={opt.label}
                              onChange={(e) => {
                                const opts = [...(selectedField.options || [])];
                                opts[i] = {
                                  label: e.target.value,
                                  value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                                };
                                handleUpdateSelectedField({ options: opts });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const opts = (selectedField.options || []).filter(
                                  (_, idx) => idx !== i
                                );
                                handleUpdateSelectedField({ options: opts });
                              }}
                              className="p-1 text-ink-muted hover:text-brick"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-ink-muted space-y-2">
                <SlidersHorizontal size={32} className="text-ink-subtle mb-2" />
                <p className="font-serif text-base font-bold text-ink">No Field Selected</p>
                <p className="text-xs max-w-xs leading-relaxed">
                  Click any question card on the center canvas to configure its label, validation, and logic.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Branch Rule Drawer Panel */}
      {branchSection && (
        <BranchRuleDrawer
          section={branchSection}
          sections={sections}
          fields={fields}
          onClose={() => setBranchSection(null)}
          onUpdateDefaultNext={async (nextSecId) => {
            if (!branchSection) return;
            await updateSection(branchSection.id, {
              default_next_section_id: nextSecId,
            });
            setSections((prev) =>
              prev.map((s) =>
                s.id === branchSection.id ? { ...s, default_next_section_id: nextSecId } : s
              )
            );
          }}
        />
      )}

      {/* Delete Field Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!fieldToDelete}
        title="Delete Field"
        message={`Are you sure you want to delete "${fieldToDelete?.label}"? This action cannot be undone.`}
        confirmLabel="Delete Field"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteField}
        onCancel={() => setFieldToDelete(null)}
      />

      {/* Form Preview Modal */}
      {form && (
        <FormPreviewModal
          isOpen={isPreviewOpen}
          form={form}
          sections={sections}
          fields={fields}
          onClose={() => setIsPreviewOpen(false)}
          onPublish={() => {
            setIsPreviewOpen(false);
            setIsPublishShareOpen(true);
          }}
          onShare={() => {
            setIsPreviewOpen(false);
            setIsPublishShareOpen(true);
          }}
        />
      )}

      {/* Publish & Share Modal */}
      {form && (
        <PublishShareModal
          isOpen={isPublishShareOpen}
          form={form}
          onClose={() => setIsPublishShareOpen(false)}
          onFormUpdated={(updated) => {
            setForm(updated);
            loadBuilderData();
          }}
        />
      )}
    </div>
  );
};
