# AutoQuiz AI

A Chrome Manifest V3 extension and local Node.js backend for Moodle quiz question recognition, answer research assistance, local answer management, and progress review.

**Important:** This project is an assistance tool. It does not bypass Moodle controls or submit attempts. Review all suggestions and apply them only where permitted by your course rules.

## Requirements
- Google Chrome
- Node.js 18+
- A Gemini API key from Google AI Studio for AI suggestions (optional; local verified answer lookup works without it)

## 1. Start the backend (Windows PowerShell)

```powershell
cd server
npm install
Copy-Item .env.example .env
notepad .env
```

Add your Gemini API key to `.env`:
```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=3030
HOST=127.0.0.1
```

Then start:
```powershell
npm start
```

Check `http://127.0.0.1:3030/api/health`.

## 2. Install the Chrome extension
1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `extension` folder.
5. Open a Moodle quiz attempt page and click the AutoQuiz AI extension icon.

## 3. Use
- Choose **Scan Moodle Page** to inspect visible question containers.
- Open a question to request an AI suggestion or search the local answer database.
- Review the source and uncertainty before applying a suggestion.
- The extension distinguishes detected, suggested, applied, verified, and unanswered states.
- Use the review view to inspect progress. Navigate Moodle pages yourself.

## 4. Local answer database
The extension uses IndexedDB in the browser. Answers can be added, edited, deleted, exported, and imported as JSON from the dashboard/database view. AI suggestions are not marked verified automatically.

## 5. Tests
From the project root:
```powershell
npm install
npm test
```

## Architecture
- `extension/content/`: Moodle detection, extraction, classification, answer application, progress.
- `extension/database/`: IndexedDB storage and matching.
- `extension/ai/`: backend client and response validation.
- `extension/ui/`: dashboard, review, and settings pages.
- `server/`: localhost Express API and Gemini integration.
- `tests/`: unit tests and Moodle HTML fixtures.

## Current limitations
- Moodle themes and plugins can change the DOM. Test against your institution's Moodle page and adjust selectors based on its actual HTML.
- Matching, drag-and-drop, calculated and Cloze formats can require course-specific markup. Unknown structures are flagged instead of guessed.
- GPT answers can be wrong. Verify them against course material.
- The extension does not auto-navigate through pages or submit a quiz.
- Gemini API access requires a valid key and is subject to Google AI Studio quotas and any applicable billing.


## Hybrid AI configuration (Ollama + Gemini)

The backend uses Ollama locally first and falls back to Gemini if Ollama is unavailable or returns an unusable response.

1. Install Ollama and download a model: `ollama pull qwen2.5:3b`.
2. Copy `server/.env.example` to `server/.env`.
3. Keep `AUTOQUIZ_AI_PROVIDER=ollama_first` and `OLLAMA_MODEL=qwen2.5:3b`.
4. Add your Gemini API key to `GEMINI_API_KEY` for cloud fallback. Ollama works without this key.
5. Start the backend from the `server` directory with `npm start`.

The backend health endpoint is `http://127.0.0.1:3030/api/health`. It reports the configured provider and model names. The backend caches identical requests briefly and shares concurrent identical requests to avoid duplicate model calls.

To prefer Gemini first, set `AUTOQUIZ_AI_PROVIDER=gemini_first` in `server/.env`.

AI suggestions are not verified answers. Review explanations and uncertainty, and follow your course's assessment rules.
