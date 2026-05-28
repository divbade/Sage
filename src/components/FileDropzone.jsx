import { useState, useRef, useCallback } from 'react';
import { parseFile, countWords, ACCEPTED_EXTENSIONS } from '../services/fileParser';

export default function FileDropzone({ onFileProcessed, maxFiles = 3, existingFiles = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(async (file) => {
    if (existingFiles.length >= maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const text = await parseFile(file);
      const wordCount = countWords(text);
      onFileProcessed({
        name: file.name,
        wordCount,
        text,
      });
    } catch {
      setError("Couldn't read that file — try copying the text directly into the notes field above.");
    } finally {
      setProcessing(false);
    }
  }, [existingFiles.length, maxFiles, onFileProcessed]);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await processFile(file);
      }
    },
    [processFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      await processFile(file);
    }
    e.target.value = '';
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed py-12 px-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-accent-amber bg-accent-amber-tint scale-[1.01]'
            : 'border-navy-700 bg-white hover:border-navy-600 hover:bg-cream'
          }
          ${processing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-200 ${isDragging ? 'bg-accent-amber/15' : 'bg-navy-900'}`}>
            {processing ? (
              <svg className="w-5 h-5 text-accent-amber animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-navy-300">
              {processing ? 'Processing...' : isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-navy-500 mt-1 font-normal">
              PDF, TXT, MD, DOCX — up to 5MB each, {maxFiles} files max
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-confidence-low animate-fade-in font-normal">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {existingFiles.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm text-confidence-high animate-fade-in font-normal"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                Got it — {file.name} ({file.wordCount.toLocaleString()} words)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
