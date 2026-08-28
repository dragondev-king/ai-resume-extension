import React, { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  Edit,
  FileText,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useProfiles } from '../contexts/ProfilesContext';
import { useGenerationState } from '../lib/useGenerationState';
import { setGenerationState } from '../lib/generationStore';
import { queueGeneration } from '../lib/runGeneration';
import { generateResumePdf } from '../utils/pdfResumeGenerator';
import { generateDocx, resolveResumeExperience } from '../utils/docxGenerator';
import { getUseAiEnhancedJobTitleForProfile } from '../utils/profileMetadata';
import { buildResumeFileName, type ResumeDownloadFormat } from '../utils/resumeFileName';
import { generateAnswer, generateCoverLetter } from '../utils/coverLetterGenerator';
import { getResumeTemplate, listResumeTemplates, pickRandomResumeTemplate } from '../resumeTemplates';
import { formatDate } from '../utils/helpers';
import type { GeneratedResume } from '../utils/resumeGenerator';
import { BoldMarkupText } from './BoldMarkupText';
import ResumeTemplatePreview from './ResumeTemplatePreview';
import {
  canApplyToCompany,
  duplicateApplicationMessage,
  shouldCheckDuplicateApplications,
} from '../lib/duplicateCheck';

function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (typeof next === 'number') setWidth(next);
    });
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, [el]);

  return { ref: setEl, width };
}

const ResumeEditor: React.FC = () => {
  const generation = useGenerationState();
  const tabId = generation.tabId;
  const { user } = useUser();
  const { profiles } = useProfiles();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<GeneratedResume | null>(null);
  const [newSkill, setNewSkill] = useState('');
  const [includeLinkedIn, setIncludeLinkedIn] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [coverDraft, setCoverDraft] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [answerBusyId, setAnswerBusyId] = useState<string | null>(null);
  const [copiedAnswers, setCopiedAnswers] = useState<Record<string, boolean>>({});
  const { ref: templateSectionRef, width: templateSectionWidth } = useElementWidth<HTMLDivElement>();

  const profile = profiles.find((p) => p.id === generation.profileId);
  const resume = generation.generatedResume;
  const templates = listResumeTemplates();
  const current = isEditing ? draft : resume;
  const useAiTitle = getUseAiEnhancedJobTitleForProfile(profile);

  const displayExperience = useMemo(() => {
    if (!current) return [];
    if (isEditing) return current.experience;
    return resolveResumeExperience(profile?.experience ?? [], current.experience, useAiTitle);
  }, [current, isEditing, profile, useAiTitle]);

  if (!resume || !current || tabId == null) return null;

  const persist = (patch: Parameters<typeof setGenerationState>[1]) => setGenerationState(tabId, patch);
  const alreadySaved = Boolean(generation.savedApplicationId);

  const startEditing = () => {
    setDraft({ ...resume, experience: resume.experience.map((exp) => ({ ...exp, descriptions: [...(exp.descriptions || [])] })) });
    setIsEditing(true);
  };

  const saveEdits = async () => {
    if (!draft) return;
    await persist({ generatedResume: draft });
    setIsEditing(false);
    toast.success('Changes saved');
  };

  const cancelEdits = () => {
    setDraft(null);
    setIsEditing(false);
  };

  const resolveTemplate = () =>
    (selectedTemplateId && getResumeTemplate(selectedTemplateId)) || pickRandomResumeTemplate();

  const exportFile = async (format: ResumeDownloadFormat, templateId: string) => {
    if (!profile) throw new Error('Profile not found');
    const opts = {
      useAiEnhancedJobTitle: useAiTitle,
      includeLinkedIn,
      templateId,
    };
    const fileName = buildResumeFileName(profile, resume.jobTitle, resume.companyName, format);
    if (format === 'docx') {
      await generateDocx(resume, fileName, profile, opts);
    } else {
      await generateResumePdf(resume, fileName, profile, opts);
    }
  };

  const handleSaveAndDownload = async (format: ResumeDownloadFormat) => {
    if (!profile || !user) {
      toast.error('Profile or user not found');
      return;
    }

    if (generation.savedApplicationId) {
      toast.error('This application is already saved. Use DOCX only / PDF only to download again.');
      return;
    }

    setSaving(true);
    try {
      const template = resolveTemplate();
      const companyName = (resume.companyName || '').trim();
      if (shouldCheckDuplicateApplications(profile) && companyName) {
        const canApply = await canApplyToCompany(profile.id, companyName);
        if (!canApply) {
          toast.error(duplicateApplicationMessage(companyName));
          return;
        }
      }

      const storedFileName = buildResumeFileName(profile, resume.jobTitle, resume.companyName, format);
      const { data: applicationId, error } = await supabase.rpc('create_job_application', {
        p_profile_id: profile.id,
        p_bidder_id: user.id,
        p_job_title: resume.jobTitle || '',
        p_job_description: generation.jobDescription,
        p_company_name: resume.companyName || '',
        p_job_description_link: generation.jobDescriptionLink,
        p_resume_file_name: storedFileName,
        p_generated_summary: resume.summary,
        p_generated_experience: resume.experience,
        p_generated_skills: resume.skills,
        p_metadata: { resumeTemplateId: template.id },
      });
      if (error) {
        toast.error(error.message || 'Error saving job application');
        return;
      }

      const savedId =
        typeof applicationId === 'string'
          ? applicationId
          : Array.isArray(applicationId) && typeof applicationId[0] === 'string'
            ? applicationId[0]
            : 'saved';
      await persist({ savedApplicationId: savedId });

      await exportFile(format, template.id);
      toast.success(`Saved and downloaded · ${template.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!profile || tabId == null) return;
    setRegenerating(true);
    try {
      await queueGeneration({
        profile,
        provider: generation.provider,
        tabId,
        pageTitle: generation.pageTitle,
        pageUrl: generation.jobDescriptionLink,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate resume');
      setRegenerating(false);
    }
  };

  const handleDownloadOnly = async (format: ResumeDownloadFormat) => {
    if (!profile) {
      toast.error('Profile not found');
      return;
    }
    setSaving(true);
    try {
      const template = resolveTemplate();
      await exportFile(format, template.id);
      toast.success(`Downloaded · ${template.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverLetter = async () => {
    if (!profile) return;
    setCoverBusy(true);
    try {
      const cover = await generateCoverLetter(profile, generation.jobDescription, resume);
      await persist({ coverLetter: cover });
      toast.success('Cover letter generated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cover letter failed');
    } finally {
      setCoverBusy(false);
    }
  };

  const handleAddQuestion = async () => {
    const question = newQuestion.trim();
    if (!question || !profile) return;
    const id = Date.now().toString();
    const next = [...generation.questions, { id, question }];
    await persist({ questions: next });
    setNewQuestion('');
    setAnswerBusyId(id);
    try {
      const result = await generateAnswer(profile, question, generation.jobDescription, resume);
      await persist({
        questions: next.map((q) => (q.id === id ? { ...q, answer: result.content } : q)),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate answer');
    } finally {
      setAnswerBusyId(null);
    }
  };

  const handleCopyAnswer = async (questionId: string) => {
    const question = generation.questions.find((item) => item.id === questionId);
    if (!question?.answer) {
      toast.error('No answer to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(question.answer);
      setCopiedAnswers((prev) => ({ ...prev, [questionId]: true }));
      toast.success('Answer copied to clipboard');
      window.setTimeout(() => {
        setCopiedAnswers((prev) => ({ ...prev, [questionId]: false }));
      }, 2000);
    } catch {
      toast.error('Failed to copy answer');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Generated Resume</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[240px]">{generation.pageTitle}</p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1 rounded-md border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={saveEdits}
                className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdits}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={templateSectionRef} className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3">
        <fieldset>
          <legend className="text-sm font-medium text-gray-800 mb-2">Resume template</legend>
          {templateSectionWidth >= 420 ? (
            <div
              className={`grid gap-3 ${
                templateSectionWidth >= 840
                  ? 'grid-cols-5'
                  : templateSectionWidth >= 680
                    ? 'grid-cols-4'
                    : templateSectionWidth >= 540
                      ? 'grid-cols-3'
                      : 'grid-cols-2'
              }`}
            >
              <label
                className={`relative flex cursor-pointer flex-col gap-2 rounded-md border bg-white p-2 transition-colors ${
                  selectedTemplateId === ''
                    ? 'border-primary-500 ring-2 ring-primary-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="resume-template"
                  value=""
                  checked={selectedTemplateId === ''}
                  onChange={() => setSelectedTemplateId('')}
                  className="sr-only"
                />
                <div
                  className="flex aspect-[8.5/11] w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-center"
                  aria-hidden
                >
                  <span className="px-2 text-xs font-medium text-gray-600">Random</span>
                </div>
                <span className="text-center text-sm font-medium text-gray-900">Random</span>
              </label>
              {templates.map((template) => (
                <label
                  key={template.id}
                  className={`relative flex cursor-pointer flex-col gap-2 rounded-md border bg-white p-2 transition-colors ${
                    selectedTemplateId === template.id
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="resume-template"
                    value={template.id}
                    checked={selectedTemplateId === template.id}
                    onChange={() => setSelectedTemplateId(template.id)}
                    className="sr-only"
                  />
                  <ResumeTemplatePreview template={template} className="w-full" />
                  <span className="text-center text-sm font-medium text-gray-900">{template.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Random</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          )}
        </fieldset>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeLinkedIn}
            onChange={(e) => setIncludeLinkedIn(e.target.checked)}
          />
          Include LinkedIn link
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={saving || isEditing || regenerating || alreadySaved}
            onClick={() => handleSaveAndDownload('docx')}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-green-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Save DOCX
          </button>
          <button
            type="button"
            disabled={saving || isEditing || regenerating || alreadySaved}
            onClick={() => handleSaveAndDownload('pdf')}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-green-700 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Save PDF
          </button>
          <button
            type="button"
            disabled={saving || isEditing || regenerating}
            onClick={() => handleDownloadOnly('docx')}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 disabled:opacity-50"
          >
            DOCX only
          </button>
          <button
            type="button"
            disabled={saving || isEditing || regenerating}
            onClick={() => handleDownloadOnly('pdf')}
            className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700 disabled:opacity-50"
          >
            PDF only
          </button>
        </div>
        <button
          type="button"
          disabled={saving || isEditing || regenerating}
          onClick={handleRegenerate}
          className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-primary-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Regenerate
        </button>
        <p className="text-[11px] text-gray-500">
          {alreadySaved
            ? 'This application is already saved. Use DOCX only / PDF only to download again.'
            : 'Save writes the application to Supabase, then downloads the file.'}
        </p>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
        <h3 className="text-sm font-medium text-blue-900">Job details</h3>
        {isEditing && draft ? (
          <div className="space-y-2">
            <input
              value={draft.jobTitle || ''}
              onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })}
              className="w-full rounded border border-blue-300 px-2 py-1 text-sm"
              placeholder="Job title"
            />
            <input
              value={draft.companyName || ''}
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
              className="w-full rounded border border-blue-300 px-2 py-1 text-sm"
              placeholder="Company"
            />
          </div>
        ) : (
          <div className="text-sm text-blue-900">
            <div>{resume.jobTitle || 'Untitled role'}</div>
            <div className="text-blue-800">{resume.companyName || 'Company not extracted'}</div>
          </div>
        )}
      </div>

      <section>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Summary</h3>
        {isEditing && draft ? (
          <textarea
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            rows={5}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        ) : (
          <p className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 leading-relaxed">
            <BoldMarkupText text={current.summary} />
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Skills</h3>
        {isEditing && draft ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!newSkill.trim()) return;
                    setDraft({ ...draft, skills: [...draft.skills, newSkill.trim()] });
                    setNewSkill('');
                  }
                }}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Add a skill"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newSkill.trim()) return;
                  setDraft({ ...draft, skills: [...draft.skills, newSkill.trim()] });
                  setNewSkill('');
                }}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draft.skills.map((skill, index) => (
                <span key={`${skill}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-800">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, skills: draft.skills.filter((_, i) => i !== index) })}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {current.skills.map((skill, index) => (
              <span key={`${skill}-${index}`} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-800">
                {skill}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-gray-900">Experience</h3>
        {displayExperience.map((exp, index) => (
          <div key={`${exp.company}-${index}`} className="rounded-md bg-gray-50 p-3 space-y-2">
            {isEditing && draft ? (
              <>
                <input
                  value={exp.position || ''}
                  onChange={(e) => {
                    const experience = [...draft.experience];
                    experience[index] = { ...experience[index], position: e.target.value };
                    setDraft({ ...draft, experience });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Position"
                />
                <input
                  value={exp.company || ''}
                  onChange={(e) => {
                    const experience = [...draft.experience];
                    experience[index] = { ...experience[index], company: e.target.value };
                    setDraft({ ...draft, experience });
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  placeholder="Company"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={exp.start_date || ''}
                    onChange={(e) => {
                      const experience = [...draft.experience];
                      experience[index] = { ...experience[index], start_date: e.target.value };
                      setDraft({ ...draft, experience });
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Start"
                  />
                  <input
                    value={exp.end_date || ''}
                    onChange={(e) => {
                      const experience = [...draft.experience];
                      experience[index] = { ...experience[index], end_date: e.target.value };
                      setDraft({ ...draft, experience });
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    placeholder="End"
                  />
                </div>
                {(exp.descriptions || []).map((desc, descIndex) => (
                  <div key={descIndex} className="flex gap-2">
                    <textarea
                      value={desc}
                      onChange={(e) => {
                        const experience = [...draft.experience];
                        const descriptions = [...(experience[index].descriptions || [])];
                        descriptions[descIndex] = e.target.value;
                        experience[index] = { ...experience[index], descriptions };
                        setDraft({ ...draft, experience });
                      }}
                      rows={3}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const experience = [...draft.experience];
                        experience[index] = {
                          ...experience[index],
                          descriptions: (experience[index].descriptions || []).filter((_, i) => i !== descIndex),
                        };
                        setDraft({ ...draft, experience });
                      }}
                      className="text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const experience = [...draft.experience];
                    experience[index] = {
                      ...experience[index],
                      descriptions: [...(experience[index].descriptions || []), ''],
                    };
                    setDraft({ ...draft, experience });
                  }}
                  className="text-xs text-primary-600"
                >
                  + Add bullet
                </button>
              </>
            ) : (
              <>
                <div className="text-sm font-medium text-gray-900">
                  {exp.position} at {exp.company}
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(exp.start_date || '')} – {exp.end_date ? formatDate(exp.end_date) : 'Present'}
                </div>
                <ul className="space-y-1">
                  {(exp.descriptions || []).map((desc, descIndex) => (
                    <li key={descIndex} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-primary-600">•</span>
                      <span>
                        <BoldMarkupText text={desc} />
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 p-3 space-y-3">
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Cover letter
        </h3>
        {!generation.coverLetter ? (
          <button
            type="button"
            onClick={handleCoverLetter}
            disabled={coverBusy}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {coverBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate cover letter
          </button>
        ) : coverEditing ? (
          <>
            <textarea
              value={coverDraft}
              onChange={(e) => setCoverDraft(e.target.value)}
              rows={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCoverEditing(false)} className="text-xs text-gray-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await persist({
                    coverLetter: { ...generation.coverLetter!, content: coverDraft },
                  });
                  setCoverEditing(false);
                }}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 rounded-md p-3">
              {generation.coverLetter.content}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCoverDraft(generation.coverLetter!.content);
                  setCoverEditing(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary-700"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(generation.coverLetter!.content);
                  toast.success('Copied');
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-700"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 p-3 space-y-3">
        <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Application questions
        </h3>
        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (!newQuestion.trim() || Boolean(answerBusyId)) return;
              void handleAddQuestion();
            }}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="Paste a question from the application"
          />
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={!newQuestion.trim() || Boolean(answerBusyId)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            Answer
          </button>
        </div>
        {generation.questions.map((item) => (
          <div key={item.id} className="rounded-md bg-gray-50 p-3 space-y-2">
            <div className="flex justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{item.question}</p>
              <button
                type="button"
                onClick={() =>
                  persist({ questions: generation.questions.filter((q) => q.id !== item.id) })
                }
                className="text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {answerBusyId === item.id ? (
              <p className="text-xs text-gray-500">Generating…</p>
            ) : item.answer ? (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.answer}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleCopyAnswer(item.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    {copiedAnswers[item.id] ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
};

export default ResumeEditor;
