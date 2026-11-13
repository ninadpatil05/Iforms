import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createForm } from '@/api/forms';
import { getCurrentVersion, createField } from '@/api/fields';
import { createSection } from '@/api/sections';
import { Form } from '@/types/form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { X, ArrowRight, FileText, Briefcase, MessageSquare, Calendar, Sparkles, LayoutTemplate } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

import type { FieldType, FieldOption } from '@/types/field';

export interface CreateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (form: Form) => void;
}

interface TemplatePreset {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  sections: Array<{
    title: string;
    fields: Array<{
      label: string;
      field_type: FieldType;
      placeholder?: string;
      required?: boolean;
      options?: FieldOption[];
    }>;
  }>;
}

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: 'blank',
    title: 'Blank Form',
    description: 'Start with an empty canvas and build custom questions.',
    icon: <FileText className="text-slate" size={20} />,
    sections: [],
  },
  {
    id: 'job_app',
    title: 'Job Application',
    description: 'Collect candidate details, experience, skills, and resume upload.',
    icon: <Briefcase className="text-accent" size={20} />,
    sections: [
      {
        title: 'Personal Details',
        fields: [
          { label: 'Full Name', field_type: 'text', placeholder: 'Jane Doe', required: true },
          { label: 'Email Address', field_type: 'email', placeholder: 'jane@example.com', required: true },
          { label: 'Phone Number', field_type: 'text', placeholder: '+1 (555) 000-0000', required: true },
        ],
      },
      {
        title: 'Professional Experience',
        fields: [
          { label: 'Current Job Title', field_type: 'text', placeholder: 'Senior Software Engineer' },
          { label: 'Years of Experience', field_type: 'number', placeholder: '5' },
          { label: 'Resume Upload', field_type: 'file', required: true },
          { label: 'Why do you want to join our team?', field_type: 'textarea', placeholder: 'Share your background...' },
        ],
      },
    ],
  },
  {
    id: 'customer_feedback',
    title: 'Customer Feedback',
    description: 'Measure customer satisfaction, ratings, and open feedback.',
    icon: <MessageSquare className="text-emerald-600" size={20} />,
    sections: [
      {
        title: 'Experience Rating',
        fields: [
          { label: 'Overall Satisfaction', field_type: 'rating', required: true },
          { label: 'How would you rate product quality?', field_type: 'rating' },
          { label: 'Would you recommend us to others?', field_type: 'radio', options: [{ label: 'Yes, definitely', value: 'Yes, definitely' }, { label: 'Maybe', value: 'Maybe' }, { label: 'No', value: 'No' }], required: true },
          { label: 'What can we improve?', field_type: 'textarea', placeholder: 'Tell us your thoughts...' },
        ],
      },
    ],
  },
  {
    id: 'event_registration',
    title: 'Event Registration',
    description: 'Participant registration, ticket type, and meal preferences.',
    icon: <Calendar className="text-indigo-600" size={20} />,
    sections: [
      {
        title: 'Participant Info',
        fields: [
          { label: 'Full Name', field_type: 'text', required: true },
          { label: 'Email Address', field_type: 'email', required: true },
          { label: 'Ticket Type', field_type: 'dropdown', options: [{ label: 'General Admission', value: 'General Admission' }, { label: 'VIP Pass', value: 'VIP Pass' }, { label: 'Student Pass', value: 'Student Pass' }], required: true },
          { label: 'Dietary Preference', field_type: 'radio', options: [{ label: 'Standard', value: 'Standard' }, { label: 'Vegetarian', value: 'Vegetarian' }, { label: 'Vegan', value: 'Vegan' }, { label: 'Gluten-Free', value: 'Gluten-Free' }] },
        ],
      },
    ],
  },
];

export const CreateFormModal: React.FC<CreateFormModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('blank');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedTemplateId('blank');
      setTitle('');
      setDescription('');
      setError('');
    }
  }, [isOpen]);

  const handleSelectTemplate = (tpl: TemplatePreset) => {
    setSelectedTemplateId(tpl.id);
    if (tpl.id !== 'blank') {
      setTitle(tpl.title);
      setDescription(tpl.description);
    } else {
      setTitle('');
      setDescription('');
    }
    if (error) setError('');
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Form title is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const newForm = await createForm({
        title: title.trim(),
        description: description.trim() || null,
        access_mode: 'public',
        allow_resubmission: true,
      });

      const template = TEMPLATE_PRESETS.find((t) => t.id === selectedTemplateId);
      if (template && template.sections.length > 0) {
        try {
          const draft = await getCurrentVersion(newForm.id);
          for (let sIdx = 0; sIdx < template.sections.length; sIdx++) {
            const secData = template.sections[sIdx];
            const createdSec = await createSection({
              form_version_id: draft.id,
              title: secData.title,
              display_order: sIdx,
            });

            for (let fIdx = 0; fIdx < secData.fields.length; fIdx++) {
              const fData = secData.fields[fIdx];
              await createField({
                form_version_id: draft.id,
                section_id: createdSec.id,
                label: fData.label,
                field_type: fData.field_type,
                placeholder: fData.placeholder,
                required: fData.required ?? false,
                options: fData.options,
                display_order: fIdx,
              });
            }
          }
        } catch {
          // Gracefully continue even if field seeding has minor delay
        }
      }

      toast.success('Form created', `"${newForm.title}" has been created.`);
      if (onCreated) onCreated(newForm);
      onClose();
      navigate(`/forms/${newForm.id}/build`);
    } catch {
      setError('Failed to create form. Please check backend connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-paper-lowest rounded-lg border border-paper-border shadow-warm-lift overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-paper-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={20} className="text-terracotta" />
            <h3 className="font-serif text-xl font-bold text-ink tracking-tight">Create New Form / Choose Template</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded-sm transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6" noValidate>
          {error && (
            <div className="p-3 rounded-sm bg-brick-container border border-brick-border text-brick text-xs font-medium">
              {error}
            </div>
          )}

          {/* Template Gallery Selector Grid */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Select Starting Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATE_PRESETS.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-3.5 rounded-md border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-terracotta bg-terracotta/5 shadow-sm ring-1 ring-terracotta'
                        : 'border-paper-border bg-paper-surface hover:border-ink/30 hover:bg-paper-base'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      {tpl.icon}
                      <h4 className="font-serif font-bold text-sm text-ink">{tpl.title}</h4>
                    </div>
                    <p className="text-xs text-ink-muted leading-snug">{tpl.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Generator Banner Shortcut */}
          <div className="p-3.5 bg-accent/10 border border-accent/20 rounded-md flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="text-accent shrink-0" size={18} />
              <div>
                <h5 className="text-xs font-bold text-ink">Want AI to generate the entire form?</h5>
                <p className="text-[11px] text-ink-muted">Describe your prompt in plain language and AI creates all sections & fields.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                navigate('/ai/generate');
              }}
              className="shrink-0 text-xs"
            >
              Use AI Generator
            </Button>
          </div>

          {/* Inputs */}
          <div className="space-y-4 pt-1">
            <Input
              label="Form Title"
              required
              placeholder="e.g., Software Engineer Job Application"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              autoFocus
            />

            <Textarea
              label="Description (Optional)"
              placeholder="Briefly describe the purpose of this form..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-paper-border">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight size={16} />}
            >
              Create Form
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
