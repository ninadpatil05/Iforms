import React, { useState, useEffect } from 'react';
import { Form } from '@/types/form';
import { Button } from './Button';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Switch } from './Switch';
import {
  X,
  Copy,
  Mail,
  CalendarClock,
  Lock,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { updateForm, publishForm, unpublishForm, getPublishedFormLink, getFormById } from '@/api/forms';
import { FormScheduleDuplicateSettings } from './FormScheduleDuplicateSettings';
import { listInvites, createInvites, deleteInvite, FormInvite } from '@/api/invites';
import { shareFormViaEmail } from '@/api/shareEmail';
import { listScheduledEmails, cancelScheduledEmail, ScheduledEmailShare } from '@/api/scheduledEmails';
import { useToast } from '@/context/ToastContext';

export interface PublishShareModalProps {
  isOpen: boolean;
  form: Form;
  onClose: () => void;
  onFormUpdated?: (updatedForm: Form) => void;
}

export const PublishShareModal: React.FC<PublishShareModalProps> = ({
  isOpen,
  form,
  onClose,
  onFormUpdated,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'public' | 'email' | 'scheduled' | 'access'>('public');

  const [currentForm, setCurrentForm] = useState<Form>(form);
  const [publicUrl, setPublicUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Invite states
  const [invites, setInvites] = useState<FormInvite[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // Email Share states
  const [recipientEmails, setRecipientEmails] = useState<string[]>(['sarah.j@example.com']);
  const [emailInput, setEmailInput] = useState('');
  const [emailSubject, setEmailSubject] = useState(`Please complete ${form.title}`);
  const [emailBody, setEmailBody] = useState(`Hello,\n\nWe are currently gathering feedback for "${form.title}" and would appreciate your input.\n\nPlease click the link below to access the form:\n{Form Public Link}`);
  const [isScheduleSend, setIsScheduleSend] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Scheduled Sends list
  const [scheduledList, setScheduledList] = useState<ScheduledEmailShare[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  useEffect(() => {
    setCurrentForm(form);
  }, [form]);

  useEffect(() => {
    if (publicUrl) {
      setEmailBody(`Hello,\n\nWe are currently gathering feedback for "${currentForm.title}" and would appreciate your input.\n\nPlease click the link below to access the form:\n${publicUrl}`);
    }
  }, [publicUrl, currentForm.title]);

  useEffect(() => {
    if (!isOpen) return;
    loadShareData();
  }, [isOpen, currentForm.id]);

  const loadShareData = async () => {
    try {
      const pub = await getPublishedFormLink(currentForm.id);
      const url = pub.public_url || `${window.location.origin}/f/${pub.public_link}`;
      setPublicUrl(url);
    } catch {
      // If not published yet, publish automatically to generate public link
      try {
        const pub = await publishForm(currentForm.id);
        const url = pub.public_url || `${window.location.origin}/f/${pub.public_link}`;
        setPublicUrl(url);
        const updated = await getFormById(currentForm.id);
        setCurrentForm(updated);
        onFormUpdated?.(updated);
      } catch {
        setPublicUrl('');
      }
    }

    try {
      const invList = await listInvites(currentForm.id);
      setInvites(invList);
    } catch {
      setInvites([]);
    }

    try {
      setIsLoadingScheduled(true);
      const sched = await listScheduledEmails(currentForm.id);
      setScheduledList(sched);
    } catch {
      setScheduledList([]);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  if (!isOpen) return null;

  const handleTogglePublicAccess = async (checked: boolean) => {
    try {
      if (checked) {
        const pub = await publishForm(currentForm.id);
        const url = pub.public_url || `${window.location.origin}/f/${pub.public_link}`;
        setPublicUrl(url);
        const updated = await updateForm(currentForm.id, { access_mode: 'public' });
        setCurrentForm(updated);
        onFormUpdated?.(updated);
        toast.success('Form Published', 'Public access enabled and link generated.');
      } else {
        await unpublishForm(currentForm.id);
        const updated = await updateForm(currentForm.id, { access_mode: 'invite_only' });
        setCurrentForm(updated);
        setPublicUrl('');
        onFormUpdated?.(updated);
        toast.info('Access Updated', 'Form set to invite only access mode.');
      }
    } catch {
      toast.error('Update failed', 'Could not change access mode.');
    }
  };

  const handleToggleResubmission = async (checked: boolean) => {
    try {
      const updated = await updateForm(currentForm.id, { allow_resubmission: checked });
      setCurrentForm(updated);
      onFormUpdated?.(updated);
      toast.success('Settings updated', `Allow resubmission set to ${checked}.`);
    } catch {
      toast.error('Update failed', 'Could not update resubmission setting.');
    }
  };

  const handleCopyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    toast.success('Link copied', 'Copied public form link to clipboard.');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRegenerateLink = async () => {
    try {
      const pub = await publishForm(currentForm.id, true);
      const url = pub.public_url || `${window.location.origin}/f/${pub.public_link}`;
      setPublicUrl(url);
      const updated = await getFormById(currentForm.id);
      setCurrentForm(updated);
      onFormUpdated?.(updated);
      toast.success('New Link Generated', 'Created a fresh public share link for your updated form.');
    } catch {
      toast.error('Regeneration failed', 'Could not generate a new share link.');
    }
  };

  const handleCreateInvite = async () => {
    if (!inviteEmailInput.trim()) return;
    setIsInviting(true);
    try {
      const emails = inviteEmailInput
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      await createInvites(currentForm.id, emails, 1);
      setInviteEmailInput('');
      loadShareData();
      toast.success('Invites sent', `Created ${emails.length} invite tokens.`);
    } catch {
      toast.error('Invite failed', 'Could not create invite tokens.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteInvite = async (inviteId: number) => {
    try {
      await deleteInvite(currentForm.id, inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast.info('Invite revoked', 'Removed invite token.');
    } catch {
      toast.error('Revoke failed', 'Could not remove invite.');
    }
  };

  const handleSendEmailShare = async () => {
    if (recipientEmails.length === 0) {
      return toast.error('Recipient required', 'Please add at least one recipient email.');
    }
    setIsSendingEmail(true);
    try {
      await shareFormViaEmail(currentForm.id, {
        recipient_emails: recipientEmails,
        subject: emailSubject,
        message: emailBody,
        scheduled_at: isScheduleSend && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      toast.success(
        isScheduleSend ? 'Email scheduled!' : 'Emails sent!',
        isScheduleSend ? `Scheduled delivery for ${scheduledAt}` : `Sent to ${recipientEmails.length} recipients.`
      );
      loadShareData();
    } catch {
      toast.error('Send failed', 'Could not process email distribution.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCancelScheduled = async (scheduleId: number) => {
    try {
      await cancelScheduledEmail(currentForm.id, scheduleId);
      setScheduledList((prev) => prev.filter((s) => s.id !== scheduleId));
      toast.info('Schedule cancelled', 'Cancelled pending email send.');
    } catch {
      toast.error('Cancel failed', 'Could not cancel scheduled email.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs" onClick={onClose} />

      {/* Modal Container matching publish_share & advanced_share_settings screenshots */}
      <div className="relative z-10 w-full max-w-3xl bg-paper-lowest border border-paper-border rounded-md shadow-warm-lift overflow-hidden flex flex-col md:flex-row min-h-[500px] text-ink font-sans">
        {/* Left Navigation Sidebar matching advanced_share_settings screenshot */}
        <div className="w-full md:w-64 bg-paper-base border-r border-paper-border p-6 flex flex-col justify-between shrink-0 select-none">
          <div className="space-y-6">
            <div>
              <h2 className="font-serif text-xl font-bold text-terracotta tracking-tight">
                Publish & Share
              </h2>
              <p className="text-xs text-ink-muted mt-1 truncate">
                Form: {currentForm.title}
              </p>
            </div>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setActiveTab('public')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'public'
                    ? 'bg-paper-lowest text-terracotta shadow-warm-sm border border-paper-border'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Globe size={15} />
                <span>Public Link & QR</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'email'
                    ? 'bg-paper-lowest text-terracotta shadow-warm-sm border border-paper-border'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Mail size={15} />
                <span>Email Share</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scheduled')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'scheduled'
                    ? 'bg-paper-lowest text-terracotta shadow-warm-sm border border-paper-border'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CalendarClock size={15} />
                  <span>Scheduled Sends</span>
                </div>
                {scheduledList.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-paper-high text-[10px] font-mono font-bold text-ink">
                    {scheduledList.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('access')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  activeTab === 'access'
                    ? 'bg-paper-lowest text-terracotta shadow-warm-sm border border-paper-border'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Lock size={15} />
                <span>Access Settings</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Right Content View Area */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          {/* Close X Button top right */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink p-1 rounded-sm cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* TAB 1: Public Link & QR matching publish_share screenshot */}
          {activeTab === 'public' && (
            <div className="space-y-6 flex-1">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Public Access & Share Link</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Generate a shareable public URL or QR code for respondent access.
                </p>
              </div>

              <div className="p-4 bg-paper-high/40 border border-paper-border rounded-md flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-ink">Public Access</h4>
                  <p className="text-xs text-ink-muted">Anyone with the link can respond</p>
                </div>
                <Switch
                  checked={currentForm.access_mode === 'public'}
                  onChange={handleTogglePublicAccess}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4 items-center">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-ink uppercase">SHARE LINK</label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      readOnly
                      value={publicUrl || 'Publish form to generate link...'}
                      className="flex-1 min-w-[200px] px-3 py-2 bg-paper-high/60 border border-paper-border rounded-sm text-xs font-mono text-ink select-all"
                    />
                    <Button variant="outline" size="sm" onClick={handleCopyLink}>
                      <Copy size={13} /> {copiedLink ? 'Copied' : 'Copy'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRegenerateLink} title="Generate a fresh public share link">
                      <RefreshCw size={13} /> New Link
                    </Button>
                    {publicUrl && (
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-paper-border rounded-sm text-ink-muted hover:text-ink hover:bg-paper-high flex items-center justify-center"
                        title="Open form in new tab"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-paper-lowest border border-paper-border rounded-sm text-center">
                  <span className="block text-[10px] font-mono font-bold text-ink-muted mb-1">
                    QR CODE
                  </span>
                  {publicUrl ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicUrl)}`}
                      alt="Form QR Code"
                      className="w-16 h-16 mx-auto rounded-sm border border-paper-border bg-white p-1"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-paper-high text-ink-muted mx-auto flex items-center justify-center font-mono text-[9px] rounded-sm">
                      [QR Code]
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-paper-border">
                <label className="block text-xs font-semibold text-ink uppercase">INVITE VIA EMAIL</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email addresses..."
                    value={inviteEmailInput}
                    onChange={(e) => setInviteEmailInput(e.target.value)}
                  />
                  <Button variant="primary" size="sm" isLoading={isInviting} onClick={handleCreateInvite}>
                    Invite
                  </Button>
                </div>

                {invites.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {invites.slice(0, 3).map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 bg-paper-high/40 border border-paper-border rounded-sm flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-ink">{inv.email}</span>
                        <span className="px-2 py-0.5 rounded-full bg-forest-fixed text-forest-hover font-mono text-[10px] font-bold">
                          Invited
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Email Share matching advanced_share_settings screenshot */}
          {activeTab === 'email' && (
            <div className="space-y-5 flex-1">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Compose Email</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Send direct invitations to respondents via email.
                </p>
              </div>

              {/* Recipients Pills */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-ink-muted uppercase">TO</label>
                <div className="p-2 bg-paper-high/40 border border-paper-border rounded-sm flex flex-wrap items-center gap-1.5 min-h-[40px]">
                  {recipientEmails.map((email, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-paper-lowest border border-paper-border rounded-full text-xs font-mono font-medium flex items-center gap-1"
                    >
                      <span>{email}</span>
                      <button
                        onClick={() => setRecipientEmails(recipientEmails.filter((_, i) => i !== idx))}
                        className="hover:text-brick"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="Add recipients..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && emailInput.trim()) {
                        e.preventDefault();
                        setRecipientEmails([...recipientEmails, emailInput.trim()]);
                        setEmailInput('');
                      }
                    }}
                    className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-xs text-ink p-1"
                  />
                </div>
              </div>

              {/* Subject */}
              <Input
                label="SUBJECT"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-ink-muted uppercase">
                    MESSAGE
                  </label>
                  <div className="flex items-center gap-2 font-mono text-xs text-ink-subtle">
                    <span className="font-bold cursor-pointer">B</span>
                    <span className="italic cursor-pointer">I</span>
                    <span className="underline cursor-pointer">🔗</span>
                  </div>
                </div>
                <Textarea
                  rows={4}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>

              {/* Form Card Embedded Preview */}
              <div className="p-3 bg-paper-high/40 border border-paper-border rounded-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-terracotta text-white flex items-center justify-center font-bold">
                  F
                </div>
                <div>
                  <h5 className="text-xs font-bold text-ink">{currentForm.title}</h5>
                  <p className="text-[11px] font-mono text-ink-muted">{publicUrl || 'Publish form to generate link...'}</p>
                </div>
              </div>

              {/* Schedule Send Controls */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={isScheduleSend} onChange={setIsScheduleSend} />
                  <span className="text-xs font-medium text-ink">Schedule Send</span>
                </div>
                {isScheduleSend && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="px-2 py-1 bg-paper-high border border-paper-border rounded-sm text-xs font-mono text-ink"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Scheduled Sends List */}
          {activeTab === 'scheduled' && (
            <div className="space-y-5 flex-1">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Scheduled Email Deliveries</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  View and manage pending scheduled email campaigns.
                </p>
              </div>

              {isLoadingScheduled ? (
                <div className="py-8 text-center text-xs text-ink-muted italic">Loading schedules...</div>
              ) : scheduledList.length === 0 ? (
                <div className="p-8 bg-paper-high/40 border border-dashed border-paper-border rounded-md text-center text-xs text-ink-muted">
                  No pending scheduled emails for this form.
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledList.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-paper-lowest border border-paper-border rounded-md flex items-center justify-between shadow-warm-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink">{item.subject}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-container text-amber font-mono text-[10px] font-bold uppercase">
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-ink-muted">
                          Recipients: {item.recipient_emails.join(', ')}
                        </p>
                        <p className="text-[11px] font-mono text-terracotta">
                          Scheduled for: {new Date(item.scheduled_at).toLocaleString()}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelScheduled(item.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Access Settings */}
          {activeTab === 'access' && (
            <div className="space-y-5 flex-1">
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Access Control & Tokens</h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Configure form permissions and token authentication.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-paper-high/40 border border-paper-border rounded-md flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-ink">Public Access Mode</h4>
                    <p className="text-xs text-ink-muted">Allow anyone with link to respond</p>
                  </div>
                  <Switch
                    checked={currentForm.access_mode === 'public'}
                    onChange={handleTogglePublicAccess}
                  />
                </div>

                <div className="p-4 bg-paper-high/40 border border-paper-border rounded-md flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-ink">Allow Resubmissions</h4>
                    <p className="text-xs text-ink-muted">Respondents can submit multiple responses</p>
                  </div>
                  <Switch
                    checked={currentForm.allow_resubmission}
                    onChange={handleToggleResubmission}
                  />
                </div>
              </div>

              {/* Schedule & Duplicate Response Settings */}
              <div className="pt-2">
                <FormScheduleDuplicateSettings
                  form={currentForm}
                  onUpdate={setCurrentForm}
                />
              </div>

              {/* Tokens Table */}
              <div className="space-y-3 pt-4 border-t border-paper-border">
                <h4 className="text-xs font-semibold text-ink uppercase">INVITE TOKENS</h4>
                {invites.length === 0 ? (
                  <p className="text-xs text-ink-muted italic">No active invite tokens.</p>
                ) : (
                  <div className="border border-paper-border rounded-sm overflow-hidden">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead className="bg-paper-high text-ink-muted">
                        <tr>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Uses</th>
                          <th className="p-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((inv) => (
                          <tr key={inv.id} className="border-t border-paper-border">
                            <td className="p-2.5 text-ink">{inv.email}</td>
                            <td className="p-2.5 text-ink-muted">{inv.use_count} / {inv.max_uses}</td>
                            <td className="p-2.5">
                              <button
                                onClick={() => handleDeleteInvite(inv.id)}
                                className="text-brick hover:underline font-semibold"
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-paper-border flex items-center justify-end gap-3">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            {activeTab === 'email' ? (
              <Button
                variant="primary"
                size="md"
                isLoading={isSendingEmail}
                onClick={handleSendEmailShare}
              >
                <Send size={15} /> Send Now
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={onClose}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublishShareModal;
