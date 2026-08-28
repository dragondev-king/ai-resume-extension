# AI Resume Generator — Chrome Extension

Chrome extension for the AI Resume Hub web app. Open it on a job application page, generate a tailored resume, edit the result, then save to Supabase and download PDF or DOCX.

## What it reuses from the web app

| Carried over | Left in the web app |
|---|---|
| Email/password login (same Supabase project) | User management |
| Assigned-profile picker | Profile create/edit |
| Page-text scrape as the job description | Profile assignments |
| `POST /api/generate-resume` (OpenAI or Claude) | Full application history |
| Inline edit of summary, skills, experience | Admin/manager dashboards |
| Save via `create_job_application` | |
| PDF / DOCX download + templates | |
| Cover letter + application answers | |
| Duplicate-company check | |

## How it works

1. Click the extension icon. The **popup** is compact: login, profile, Generate.
2. Click **Generate**. The extension reads **that tab’s** text and opens the **side panel**.
3. Each tab has its own generation. You can start a resume on tab 1, switch to tab 2, and generate another without waiting.
4. The side panel follows the active tab, so you see that tab’s loading state or resume.
5. **Save PDF/DOCX** writes the application to the same Supabase database, then downloads the file.

## Setup

```bash
cd ai-resume-extension
cp .env.example .env
```

Fill `.env` with the **same** values as the web app:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_BASE_URL=https://your-web-app.vercel.app
```

`VITE_API_BASE_URL` must be the deployed web app origin (no trailing slash). The extension calls:

- `/api/generate-resume`
- `/api/generate-cover-letter`
- `/api/generate-answer`

```bash
npm install
npm run build
```

Load unpacked in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `ai-resume-extension/dist`

For live reload during development:

```bash
npm run dev
```

Then load `ai-resume-extension/dist` the same way. Keep the Vite process running.

## Local API (optional)

If the web app is running with `vercel dev`, set:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Notes

- Do **not** put the Supabase service role key in the extension. Admin user creation stays in the web app.
- Generation can take up to a few minutes (same pipeline as the web app).
- Chrome pages (`chrome://`, the Web Store, etc.) cannot be scraped — open a real job posting first.
