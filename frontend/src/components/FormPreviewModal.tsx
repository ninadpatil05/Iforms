import React, { useState } from 'react';
import { Form } from '@/types/form';
import { Field } from '@/types/field';
import { Section } from '@/types/section';
import { Button } from './Button';
import {
  Monitor,
  Smartphone,
  X,
  CheckCircle2,
  AlertCircle,
  Star,
  Share2,
  Send,
} from 'lucide-react';

export interface FormPreviewModalProps {
  isOpen: boolean;
  form: Form;
  sections: Section[];
  fields: Field[];
  onClose: () => void;
  onPublish?: () => void;
  onShare?: () => void;
}

export const FormPreviewModal: React.FC<FormPreviewModalProps> = ({
  isOpen,
  form,
  sections,
  fields,
  onClose,
  onPublish,
  onShare,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper-base text-ink font-sans overflow-hidden">
      {/* Top Header Controls Bar matching screenshots */}
      <header className="h-14 bg-paper-lowest border-b border-paper-border px-6 flex items-center justify-between shadow-warm-sm shrink-0 z-20">
        <div className="flex items-center gap-4">
          <span className="font-serif font-bold text-xl tracking-tight text-terracotta">
            IForms
          </span>
          <div className="h-4 w-px bg-paper-border" />
          <span className="text-xs font-mono text-ink-muted flex items-center gap-1.5">
            👁 Preview Mode
          </span>
        </div>

        {/* Device View Mode Toggle Tabs */}
        <div className="flex items-center bg-paper-high/60 border border-paper-border rounded-md p-1">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              deviceMode === 'desktop'
                ? 'bg-paper-lowest text-ink shadow-warm-sm font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Monitor size={14} />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              deviceMode === 'mobile'
                ? 'bg-paper-lowest text-ink shadow-warm-sm font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Smartphone size={14} />
            <span>Mobile</span>
          </button>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 size={14} /> Share
            </Button>
          )}
          {onPublish && (
            <Button variant="primary" size="sm" onClick={onPublish}>
              Publish
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink p-1 rounded-sm cursor-pointer ml-2"
          >
            <X size={18} />
            <span>Exit Preview</span>
          </button>
        </div>
      </header>

      {/* Main Preview Container Area */}
      <div className="flex-1 overflow-y-auto bg-paper-base p-6 sm:p-10 flex justify-center">
        {deviceMode === 'desktop' ? (
          /* Desktop View Mode matching form_preview_desktop screenshot */
          <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
            {/* Left Area: Desktop Form Layout */}
            <div className="space-y-6">
              {/* Form Title Card */}
              <div className="bg-paper-lowest border border-paper-border rounded-md p-8 shadow-warm-sm space-y-3 relative">
                <h1 className="font-serif text-3xl font-bold text-ink tracking-tight">
                  {form.title || 'Annual Symposium Registration'}
                </h1>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {form.description ||
                    'Please complete the form below to secure your attendance for the 2026 Design & Logic Symposium. All fields marked with an asterisk (*) are required.'}
                </p>
              </div>

              {/* Form Sections */}
              {sections.length === 0 ? (
                /* Fallback preview cards matching reference screenshot */
                <>
                  <div className="bg-paper-lowest border border-paper-border rounded-md p-6 shadow-warm-sm space-y-4">
                    <h2 className="font-serif text-xl font-bold text-ink border-b border-paper-border pb-3 flex items-center gap-2">
                      <span>Personal Information</span>
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-ink uppercase mb-1">
                          First Name <span className="text-terracotta">*</span>
                        </label>
                        <input
                          type="text"
                          defaultValue="Jane"
                          className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink uppercase mb-1">
                          Last Name <span className="text-terracotta">*</span>
                        </label>
                        <input
                          type="text"
                          defaultValue="Doe"
                          className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink uppercase mb-1">
                        Email Address <span className="text-terracotta">*</span>
                      </label>
                      <input
                        type="email"
                        defaultValue="jane.doe@example.com"
                        className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink"
                      />
                    </div>
                  </div>

                  {/* Required Validation Error State Preview Box matching screenshot */}
                  <div className="bg-paper-lowest border-2 border-brick rounded-md p-6 shadow-warm-sm space-y-4 relative">
                    <div className="flex items-center justify-between border-b border-brick/20 pb-3">
                      <h2 className="font-serif text-xl font-bold text-brick flex items-center gap-2">
                        <span>Event Preferences</span>
                      </h2>
                      <AlertCircle size={18} className="text-brick" />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-ink uppercase">
                        Attendance Mode <span className="text-brick">*</span>
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-ink">
                          <input type="radio" name="attendance" className="accent-terracotta" />
                          <span>In-Person (San Francisco HQ)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-ink">
                          <input type="radio" name="attendance" className="accent-terracotta" />
                          <span>Virtual (Live Stream)</span>
                        </label>
                      </div>
                      <p className="text-xs font-semibold text-brick flex items-center gap-1 mt-1">
                        ⚠ This field is required
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                sections.map((section) => {
                  const sectionFields = fields.filter((f) => f.section_id === section.id);
                  return (
                    <div
                      key={section.id}
                      className="bg-paper-lowest border border-paper-border rounded-md p-6 shadow-warm-sm space-y-4"
                    >
                      <h2 className="font-serif text-xl font-bold text-ink border-b border-paper-border pb-3">
                        {section.title}
                      </h2>
                      <div className="space-y-4">
                        {sectionFields.map((field) => (
                          <div key={field.id} className="space-y-1.5">
                            <label className="block text-xs font-semibold text-ink uppercase">
                              {field.label}
                              {field.required && <span className="text-terracotta ml-0.5">*</span>}
                            </label>
                            <input
                              type="text"
                              placeholder={field.placeholder || `Enter ${field.label}...`}
                              className="w-full px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs text-ink"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-4 flex justify-end">
                <Button variant="primary" size="md" onClick={() => setSubmitted(true)}>
                  <Send size={15} /> Submit Response
                </Button>
              </div>
            </div>

            {/* Right Area: Post-Submit Thank You Card / State matching form_preview_desktop screenshot */}
            <div className="bg-paper-lowest border border-paper-border rounded-md p-8 shadow-warm-md text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-forest-fixed text-forest-hover mx-auto flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">
                Thank you for registering!
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed max-w-xs mx-auto">
                We've received your responses. A confirmation email has been sent to your provided address.
              </p>
              <Button variant="outline" size="sm" fullWidth>
                View Submission
              </Button>
              <p className="text-[10px] font-mono text-ink-subtle uppercase tracking-wider pt-4 border-t border-paper-border">
                PREVIEW STATE ACTIVE
              </p>
            </div>
          </div>
        ) : (
          /* Mobile Frame View Mode matching form_preview_mobile_frame screenshot */
          <div className="flex flex-col items-center">
            {/* Phone Bezel Frame */}
            <div className="w-[360px] h-[720px] bg-paper-lowest border-[10px] border-ink rounded-[40px] shadow-warm-lift overflow-hidden flex flex-col relative border-t-[14px]">
              {/* Phone Dynamic Island / Notch Notch Top Bar */}
              <div className="h-6 bg-ink text-white px-6 flex items-center justify-between text-[10px] font-mono select-none">
                <span>9:41</span>
                <div className="w-16 h-3 bg-paper-base/20 rounded-full mx-auto" />
                <span>5G 🔋</span>
              </div>

              {/* Mobile Screen Content Body (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-paper-base scrollbar-thin">
                {/* Form Header */}
                <div className="space-y-2">
                  <h2 className="font-serif text-2xl font-bold text-ink">
                    {form.title || 'Annual Symposium Registration'}
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Please complete the form below to secure your spot. Fields marked with * are required.
                  </p>
                </div>

                {/* Mobile Question Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink uppercase mb-1">
                      Full Name <span className="text-terracotta">*</span>
                    </label>
                    <input
                      type="text"
                      defaultValue="Eleanor Abernathy"
                      className="w-full px-3 py-2 bg-paper-lowest border border-paper-border rounded-sm text-xs text-ink"
                    />
                  </div>

                  {/* Inline Required Validation Error Simulation */}
                  <div>
                    <label className="block text-xs font-semibold text-ink uppercase mb-1">
                      Email Address <span className="text-brick">*</span>
                    </label>
                    <input
                      type="email"
                      defaultValue="you@company.com"
                      className="w-full px-3 py-2 bg-paper-lowest border border-brick rounded-sm text-xs text-ink"
                    />
                    <p className="text-[11px] font-semibold text-brick mt-1">
                      ⚠ A valid institutional email is required.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink uppercase mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      placeholder="University or Company"
                      className="w-full px-3 py-2 bg-paper-lowest border border-paper-border rounded-sm text-xs text-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink uppercase mb-1">
                      Ticket Type <span className="text-terracotta">*</span>
                    </label>
                    <div className="p-3 bg-paper-lowest border border-paper-border rounded-sm flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-terracotta bg-terracotta" />
                      <div>
                        <span className="block text-xs font-bold text-ink">Standard Admission</span>
                        <span className="text-[11px] text-ink-muted">$250.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <Button variant="primary" size="md" fullWidth>
                    Submit Response
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
