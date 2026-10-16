# AI Image Caption & Analyzer — Frontend Only

A React + Vite app that analyzes images using the Google Gemini API, with model selection directly from the browser. There is **no backend server** in this project.

## Requirements
- Node.js 18 or newer
- npm
- Internet connection
- Google AI Studio API key: https://aistudio.google.com/apikey

## Run on Windows
1. Extract this ZIP.
2. Open the `Frontend` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL Vite prints, usually `http://localhost:5173`.

## Model
- Choose a model when entering your API key: Gemini 3.8 Flash (default) or Gemini 3.6 Flash. The app sends requests using the selected model ID (`gemini-3.8-flash` or `gemini-3.6-flash`). Availability can vary by API key and region.

## Use the app
1. Upload a JPG, PNG, or WEBP image (maximum 8 MB).
2. Click **Analyze image**.
3. Paste your Google AI Studio API key into the field that appears.
4. Click **Analyze image** again to send the image to your selected Gemini model.
5. Switch between the generated caption and the list of visible objects. Export results as a text file if desired.

## API key and privacy
- The API key is requested only when you click Analyze and no key is currently in memory.
- The key is held in React component memory only. It is not written to localStorage, a `.env` file, or project files; refreshing the page clears it.
- The browser sends the image and key directly to Google's Gemini API. Images are therefore **not processed locally**.
- Never commit or share your API key. Do not deploy this frontend publicly with unrestricted use of a personal key. Anyone who can use a public client can inspect browser requests and potentially misuse an exposed key. For a public production app, use a backend or a managed identity/security solution.
- Gemini quotas, rate limits, and possible billing depend on your Google AI Studio / Google Cloud account and current terms.

## Included
- Responsive React interface
- Drag-and-drop and file-picker image upload
- Image preview, file metadata, remove/reset
- Selectable Gemini models for caption and object-list analysis
- API-key input shown on demand
- Clear API errors for invalid keys and quota/rate limits
- Export results to a `.txt` file

## Build for production
```bash
npm run build
npm run preview
```

This is frontend-only; no `Backend` folder or Express server is required.
