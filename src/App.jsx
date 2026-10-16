import { useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, BrainCircuit,
  Check, ChevronDown, CircleHelp, Cpu, FileImage, Focus, ImagePlus,
  Layers3, LoaderCircle, Menu, RotateCcw, ScanSearch, ShieldCheck,
  Sparkles, Upload, X, Zap
} from 'lucide-react';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const demoObjects = [
  { name: 'Person', confidence: 98, color: 'violet' },
  { name: 'Backpack', confidence: 94, color: 'blue' },
  { name: 'Bicycle', confidence: 91, color: 'green' },
  { name: 'Street', confidence: 87, color: 'orange' }
];

function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle');
  const [activeTab, setActiveTab] = useState('caption');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [result, setResult] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');
  const [showKeyEntry, setShowKeyEntry] = useState(false);

  const GEMINI_MODELS = [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (latest)' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' }
  ];

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const reset = () => {
    setFile(null);
    setPreview('');
    setError('');
    setStatus('idle');
    setResult(null);
    setDemoMode(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const selectFile = (picked) => {
    if (!picked) return;
    setError('');
    setResult(null);
    setStatus('idle');
    setDemoMode(false);

    if (!ACCEPTED_TYPES.includes(picked.type)) {
      setError('Please choose a JPG, PNG, or WEBP image.');
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError('This image is larger than 8 MB. Choose a smaller file.');
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // The key is entered only when the user chooses to run analysis. It is kept
  // in component memory and is never written to localStorage or a project file.
  const analyzeImage = async () => {
    if (!file) {
      setError('Upload an image first to continue.');
      return;
    }
    if (!apiKey.trim()) {
      setShowKeyEntry(true);
      setError('Enter your Google AI Studio API key to run the analysis.');
      return;
    }

    setError('');
    setStatus('loading');
    setResult(null);
    setDemoMode(false);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });

      const requestBody = JSON.stringify({
        contents: [{
          parts: [
            { text: 'Analyze this image carefully. Return only valid JSON with this exact structure: {"caption":"A clear, accurate 2-3 sentence description of the image","objects":[{"name":"object label","confidence":90}]}. List up to 12 clearly visible objects. Confidence is an estimated visual confidence from 0 to 100, not a calibrated detector score. Do not invent objects or details. Do not use markdown fences.' },
            { inline_data: { mime_type: file.type, data: base64 } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      });

      // Capacity errors (HTTP 500/502/503) can be temporary. Retry twice with
      // a short backoff before showing a useful message to the user.
      let response;
      let payload;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey.trim()
            },
            body: requestBody
          }
        );
        payload = await response.json().catch(() => ({}));
        const temporaryFailure = [500, 502, 503, 504].includes(response.status);
        if (response.ok || !temporaryFailure || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }

      if (!response.ok) {
        const message = payload?.error?.message || 'Google AI request failed.';
        if (response.status === 400 || response.status === 403) {
          throw new Error(`${message} Check that your API key is valid and Gemini API is enabled in Google AI Studio.`);
        }
        if (response.status === 429) throw new Error('Gemini API quota or rate limit reached. Check your Google AI Studio usage limits, then try again later or select another available model.');
        if ([500, 502, 503, 504].includes(response.status)) {
          throw new Error(`Google Gemini is temporarily overloaded or unavailable for ${selectedModel}. The app retried automatically. Please wait a minute and try again, or select the other available model. If this continues, check model availability and service status in Google AI Studio. Details: ${message}`);
        }
        throw new Error(message);
      }

      const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
      if (!text) throw new Error('The AI returned an empty response. Please try again.');
      let parsed;
      try {
        parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      } catch {
        throw new Error('The AI response could not be read. Please try again.');
      }

      const objects = Array.isArray(parsed.objects) ? parsed.objects.slice(0, 12).map((obj, i) => ({
        name: String(obj.name || 'Unknown object'),
        confidence: Math.max(0, Math.min(100, Number(obj.confidence) || 0)),
        color: ['violet', 'blue', 'green', 'orange'][i % 4]
      })) : [];

      setResult({
        caption: String(parsed.caption || 'No caption was returned.'),
        objects,
        time: GEMINI_MODELS.find((model) => model.id === selectedModel)?.label || selectedModel
      });
      setActiveTab('caption');
      setShowKeyEntry(false);
    } catch (err) {
      setError(err.message || 'Analysis failed. Check your internet connection and API key.');
    } finally {
      setStatus('idle');
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const content = [
      'AI Image Caption & Analyzer',
      `Image: ${file?.name || 'uploaded image'}`,
      '',
      'Caption:',
      result.caption,
      '',
      'Detected objects:',
      ...(result.objects || []).map((item) => `${item.name} — ${item.confidence}%`)
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'image-analysis.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Visionary home">
          <img className="brand-logo" src="/logo.png" alt="AI Image Caption & Analyzer logo" />
          <span className="brand-copy">visionary<span>AI IMAGE LAB</span></span>
        </a>
        <nav className={`nav-links ${mobileMenu ? 'nav-open' : ''}`}>
          <a className="nav-active" href="#workspace" onClick={() => setMobileMenu(false)}>Workspace</a>
          <a href="#how-it-works" onClick={() => setMobileMenu(false)}>How it works</a>
          <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
        </nav>
        <div className="topbar-right">
          <span className="local-pill"><span className="status-dot" /> Google Gemini AI</span>
          <button className="icon-button menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu">
            {mobileMenu ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      <main id="home">
        <section className="hero">
          <div className="hero-kicker"><Sparkles size={14} /> YOUR PRIVATE AI IMAGE WORKSPACE</div>
          <h1>See the image.<br /><span>Understand the story.</span></h1>
          <p>Turn any picture into a clear caption and discover visible objects — powered by Gemini, directly from this frontend.</p>
          <div className="hero-features">
            <span><ShieldCheck size={15} /> Private by design</span>
            <span><Cpu size={15} /> Gemini vision model</span>
            <span><Zap size={15} /> Add your API key when needed</span>
          </div>
        </section>

        <section className="workspace-grid" id="workspace">
          <div className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <div className="step-label"><span>01</span> INPUT</div>
                <h2>Upload an image</h2>
                <p>Choose a photo to start your analysis.</p>
              </div>
              <span className="heading-icon"><ImagePlus size={19} /></span>
            </div>

            {!preview ? (
              <button
                className={`dropzone ${dragging ? 'dropzone-active' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  selectFile(e.dataTransfer.files?.[0]);
                }}
                type="button"
              >
                <span className="upload-symbol"><Upload size={24} /></span>
                <strong>Drop your image here</strong>
                <span className="dropzone-sub">or <span className="browse-link">browse files</span> on your device</span>
                <span className="file-rules"><FileImage size={14} /> JPG, PNG, WEBP <i /> Max 8 MB</span>
              </button>
            ) : (
              <div className="preview-wrap">
                <img className="image-preview" src={preview} alt="Selected image preview" />
                <div className="preview-overlay">
                  <span className="preview-type"><Check size={13} /> Image selected</span>
                  <button className="remove-image" onClick={reset} aria-label="Remove selected image"><X size={16} /></button>
                </div>
                <div className="file-meta">
                  <span className="file-meta-icon"><FileImage size={17} /></span>
                  <span className="file-name-wrap"><strong title={file?.name}>{file?.name}</strong><small>{formatBytes(file?.size || 0)} · Ready to analyze</small></span>
                  <BadgeCheck className="file-check" size={18} />
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => selectFile(e.target.files?.[0])}
            />

            {error && <div className="error-message"><CircleHelp size={16} /> {error}</div>}

            <div className="privacy-note"><ShieldCheck size={16} /><span><strong>Your key is not saved.</strong> The image and API key are sent directly from your browser to Google Gemini when you analyze. Do not use this frontend-only setup for a public production website.</span></div>
            {showKeyEntry && (
              <div className="api-key-panel">
                <label htmlFor="gemini-model">Select Gemini model</label>
                <select id="gemini-model" className="model-select" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                  {GEMINI_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <label htmlFor="gemini-api-key" style={{ marginTop: 14 }}>Google AI Studio API key</label>
                <input id="gemini-api-key" type="password" autoComplete="off" placeholder="Paste your API key for this analysis" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                <div className="api-key-help">Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a>. It stays in memory only and is cleared when you refresh or close this page.</div>
              </div>
            )}
            <button className="primary-button" disabled={!file || status === 'loading'} onClick={analyzeImage}>
              {status === 'loading' ? <><LoaderCircle className="spin" size={17} /> Analyzing with Gemini...</> : <><Sparkles size={17} /> Analyze image <ArrowRight size={17} /></>}
            </button>
            <div className="panel-footnote"><span className="tiny-lock"><ShieldCheck size={12} /></span> Uses Google Gemini API only when you click Analyze.</div>
          </div>

          <div className="panel results-panel">
            <div className="panel-heading">
              <div>
                <div className="step-label"><span>02</span> INSIGHTS</div>
                <h2>Image insights</h2>
                <p>Your AI-generated results will appear here.</p>
              </div>
              <span className="heading-icon purple"><BrainCircuit size={20} /></span>
            </div>

            {!result ? (
              <div className="empty-results">
                <div className="empty-illustration">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="empty-image-card"><ScanSearch size={31} /></div>
                  <span className="float-chip chip-one"><Sparkles size={14} /></span>
                  <span className="float-chip chip-two"><Layers3 size={14} /></span>
                  <span className="float-chip chip-three"><Focus size={14} /></span>
                </div>
                <h3>Waiting for your image</h3>
                <p>Upload a picture and run an analysis to see its caption and detected objects.</p>
                <div className="result-placeholder-row">
                  <span><span className="placeholder-dot" /> Image caption</span>
                  <span><span className="placeholder-dot violet-dot" /> Object detection</span>
                </div>
              </div>
            ) : (
              <div className="result-content">
                {demoMode && <div className="demo-banner"><Sparkles size={14} /> DEMO OUTPUT</div>}
                <div className="result-tabs">
                  <button className={activeTab === 'caption' ? 'tab-active' : ''} onClick={() => setActiveTab('caption')}><Sparkles size={15} /> Caption</button>
                  <button className={activeTab === 'objects' ? 'tab-active' : ''} onClick={() => setActiveTab('objects')}><ScanSearch size={15} /> Objects <span className="tab-count">{result.objects.length}</span></button>
                </div>
                {activeTab === 'caption' ? (
                  <div className="caption-card">
                    <div className="caption-card-head"><span className="mini-ai-icon"><BrainCircuit size={16} /></span><span>GENERATED DESCRIPTION</span><span className="caption-language">EN</span></div>
                    <p>{result.caption}</p>
                    <div className="caption-meta"><span><Sparkles size={13} /> Vision-language model</span><span>{result.time}</span></div>
                  </div>
                ) : (
                  <div className="object-list">
                    <div className="object-list-header"><span>DETECTED LABEL</span><span>CONFIDENCE</span></div>
                    {result.objects.map((obj) => (
                      <div className="object-row" key={obj.name}>
                        <span className={`object-bullet ${obj.color}`} />
                        <strong>{obj.name}</strong>
                        <div className="confidence-wrap"><div className="confidence-track"><span style={{ width: `${obj.confidence}%` }} /></div><span>{obj.confidence}%</span></div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="result-actions">
                  <button className="secondary-button" onClick={downloadResult}><ArrowDownToLine size={15} /> Export results</button>
                  <button className="text-button" onClick={reset}><RotateCcw size={14} /> Start over</button>
                </div>
              </div>
            )}
            <div className="results-footer">
              <span><span className="status-dot muted" /> {result ? 'Preview complete' : 'Awaiting input'}</span>
              <span>CAPTION + OBJECTS</span>
            </div>
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-heading">
            <div className="hero-kicker"><Activity size={14} /> SIMPLE BY DESIGN</div>
            <h2>From pixels to <span>perspective.</span></h2>
            <p>Three steps. No backend required.</p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <span className="step-number">01</span><div className="step-card-icon"><Upload size={20} /></div>
              <h3>Choose your image</h3><p>Drop in a photo or browse your device. Preview it before analysis.</p>
            </article>
            <article className="step-card">
              <span className="step-number">02</span><div className="step-card-icon"><BrainCircuit size={20} /></div>
              <h3>Add your API key</h3><p>Enter your Google AI Studio key only when you are ready to analyze an image.</p>
            </article>
            <article className="step-card">
              <span className="step-number">03</span><div className="step-card-icon"><ScanSearch size={20} /></div>
              <h3>Explore the results</h3><p>Read the caption, review object confidence scores, and export the result.</p>
            </article>
          </div>
        </section>

        <section className="local-banner" id="about">
          <div className="local-banner-icon"><Cpu size={23} /></div>
          <div><strong>Built for local AI.</strong><p>A frontend-only image analysis app using the Google Gemini API. API usage may be subject to Google quotas or charges.</p></div>
          <div className="local-banner-badge"><span className="status-dot" /> FRONTEND ONLY</div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#home"><img className="brand-logo" src="/logo.png" alt="AI Image Caption & Analyzer logo" /><span className="brand-copy">visionary<span>AI IMAGE LAB</span></span></a>
        <span>AI Image Caption &amp; Analyzer <i /> MCA Major Project</span>
        <span className="footer-right">Designed for privacy <ShieldCheck size={14} /></span>
      </footer>
    </div>
  );
}

export default App;