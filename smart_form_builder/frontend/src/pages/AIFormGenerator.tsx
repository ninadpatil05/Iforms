import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/Button';
import { GeneratedFormPreview } from '@/components/ai/GeneratedFormPreview';
import { AiFormDraft, AiFormGenerationResult } from '@/types/aiForm';
import { generateForm, regenerateDraft, acceptDraft, discardDraft } from '@/api/aiForms';
import { Sparkles, RefreshCw, Trash2, ArrowRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export const AIFormGenerator: React.FC = () => {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<AiFormDraft | null>(null);
  const [editedResult, setEditedResult] = useState<AiFormGenerationResult | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (err: any): string => {
    if (err.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (typeof detail === 'string') return detail;
      if (typeof detail === 'object' && detail.message) return detail.message;
    }
    const status = err.response?.status;
    if (status === 503) return 'AI is temporarily unavailable, please try again.';
    if (status === 502) return "Couldn't understand the AI's response, please try again.";
    if (status === 429) return 'Rate limit exceeded for AI form generation. Please wait a while before trying again.';
    if (status === 401) return 'Session expired. Please log in again.';
    return 'Failed to generate form. Please check your backend server and try again.';
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateForm(prompt.trim());
      setDraft(result);
      setEditedResult(result.generated_json);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!draft) return;
    setIsGenerating(true);
    setError(null);

    try {
      const result = await regenerateDraft(draft.id, prompt.trim() || undefined);
      setDraft(result);
      setEditedResult(result.generated_json);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDiscard = async () => {
    if (!draft) return;
    setIsDiscarding(true);
    try {
      await discardDraft(draft.id);
    } catch {
      // Ignore error on discard cleanup
    } finally {
      setDraft(null);
      setEditedResult(null);
      setIsDiscarding(false);
    }
  };

  const handleAccept = async () => {
    if (!draft || !editedResult) return;
    setIsAccepting(true);
    setError(null);

    try {
      const form = await acceptDraft(draft.id, editedResult);
      navigate(`/forms/${form.id}/build`);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 400) {
        setError('Validation error in form structure. Please review field labels and options.');
      } else {
        setError('Failed to accept draft and create form. Please try again.');
      }
      setIsAccepting(false);
    }
  };

  // Compute summary stats
  const totalSections = editedResult?.sections.length || 0;
  const totalFields =
    editedResult?.sections.reduce((acc, sec) => acc + sec.fields.length, 0) || 0;

  return (
    <div className="min-h-screen bg-paper-base text-ink flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Navigation back link & Page Header */}
        <div className="space-y-4">
          <Link
            to="/forms"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} /> Back to Forms
          </Link>

          <div className="border-b border-paper-border pb-6">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-ink flex items-center gap-3">
              <Sparkles className="text-accent shrink-0" size={32} />
              AI Form Generator
            </h1>
            <p className="text-sm text-ink-muted mt-1.5 leading-relaxed max-w-2xl">
              Describe your form in plain language, and AI will generate structured sections,
              fields, options, and validations ready to customize.
            </p>
          </div>
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-xl flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">{error}</div>
          </div>
        )}

        {/* Prompt Input Area */}
        <div className="bg-paper-surface border border-paper-border rounded-xl p-6 shadow-sm space-y-4">
          <label className="block text-sm font-semibold text-ink">
            What kind of form do you want to create?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
            rows={3}
            placeholder="Describe the form you want, e.g. 'Create a customer feedback form for a restaurant with rating fields, food quality questions, and contact details.'"
            className="w-full px-4 py-3 text-sm text-ink bg-paper-base border border-paper-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none disabled:opacity-60"
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-ink-muted">
              {prompt.length > 0 ? `${prompt.length} characters` : 'Minimum 3 characters'}
            </span>

            <Button
              variant="primary"
              size="md"
              disabled={isGenerating || prompt.trim().length < 3}
              onClick={handleGenerate}
              leftIcon={
                isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />
              }
            >
              {isGenerating ? 'Designing your form…' : draft ? 'Regenerate Draft' : 'Generate Form'}
            </Button>
          </div>
        </div>

        {/* Loading Spinner Overlay */}
        {isGenerating && !editedResult && (
          <div className="p-12 text-center bg-paper-surface border border-paper-border rounded-xl space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-accent/10 text-accent rounded-full animate-bounce">
              <Sparkles size={32} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-semibold text-ink">Designing your form…</h3>
              <p className="text-sm text-ink-muted mt-1">
                AI is generating structured sections, field types, options, and rules.
              </p>
            </div>
          </div>
        )}

        {/* Generated Form Preview & Action Bar */}
        {editedResult && !isGenerating && (
          <div className="space-y-6">
            {/* Preview Banner Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-paper-base border border-paper-border rounded-xl">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                  Draft Preview
                </span>
                <p className="text-sm text-ink font-medium">
                  Review and customize the generated fields below before creating your form.
                </p>
              </div>

              <div className="text-xs text-ink-muted bg-paper-surface px-3 py-1.5 rounded-lg border border-paper-border shrink-0">
                Summary: <strong className="text-ink">{totalFields} fields</strong> across{' '}
                <strong className="text-ink">{totalSections} sections</strong>
              </div>
            </div>

            {/* Form Layout Preview & Inline Editor */}
            <GeneratedFormPreview draft={editedResult} onChange={setEditedResult} />

            {/* Bottom Actions Bar */}
            <div className="sticky bottom-4 p-4 bg-paper-surface/95 backdrop-blur-md border border-paper-border rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleRegenerate}
                  disabled={isGenerating || isAccepting || isDiscarding}
                  leftIcon={<RefreshCw size={16} />}
                >
                  Regenerate
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleDiscard}
                  disabled={isGenerating || isAccepting || isDiscarding}
                  leftIcon={<Trash2 size={16} />}
                >
                  Discard
                </Button>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleAccept}
                disabled={isGenerating || isAccepting || isDiscarding || totalFields === 0}
                leftIcon={
                  isAccepting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />
                }
              >
                {isAccepting ? 'Creating Form…' : 'Accept & Continue to Editor'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
