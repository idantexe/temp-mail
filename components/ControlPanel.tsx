import React from 'react';
import { ImageUploader } from './ImageUploader';
import type { VectorStyle, Palette } from '../types';
import { VectorStyleEnum } from '../types';

interface ControlPanelProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onImageUpload: (file: File) => void;
  originalImagePreview: string | null;
  vectorStyle: VectorStyle;
  onVectorStyleChange: (style: VectorStyle) => void;
  customPalette: string;
  onCustomPaletteChange: (palette: string) => void;
  activePalette: Palette | null;
  onActivePaletteChange: (palette: Palette | null) => void;
  onVectorize: () => void;
  isLoading: boolean;
  isImageUploaded: boolean;
}

const vectorStyles: VectorStyle[] = Object.values(VectorStyleEnum);

const presetPalettes: Palette[] = [
  { name: 'Sunset', colors: ['#f97316', '#f59e0b', '#ef4444', '#d946ef', '#1e293b'] },
  { name: 'Ocean', colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#f0f9ff'] },
  { name: 'Forest', colors: ['#22c55e', '#16a34a', '#4d7c0f', '#a3e635', '#f7fee7'] },
  { name: 'Retro', colors: ['#f59e0b', '#d97706', '#9a3412', '#4ade80', '#eab308'] },
];

export const ControlPanel: React.FC<ControlPanelProps> = ({
  apiKey,
  onApiKeyChange,
  onImageUpload,
  originalImagePreview,
  vectorStyle,
  onVectorStyleChange,
  customPalette,
  onCustomPaletteChange,
  activePalette,
  onActivePaletteChange,
  onVectorize,
  isLoading,
  isImageUploaded,
}) => {
  return (
    <div className="bg-base-200 p-6 rounded-lg shadow-lg space-y-6 sticky top-8">
      <div>
        <h2 className="text-lg font-semibold mb-2 text-slate-200">Google API Key</h2>
         <p className="text-xs text-slate-400 mb-2">
          Your key is stored in your browser. Get one from{' '}
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-brand-primary hover:text-brand-secondary">
            Google AI Studio
          </a>.
        </p>
        <input
            type="password"
            placeholder="Enter your Google API Key"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            className="w-full bg-base-300 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-brand-primary focus:border-brand-primary"
            aria-label="Google API Key"
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2 text-slate-200">1. Upload Image</h2>
        <ImageUploader onImageUpload={onImageUpload} previewUrl={originalImagePreview} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">2. Select Style</h2>
        <div className="grid grid-cols-2 gap-2">
          {vectorStyles.map((style) => (
            <button
              key={style}
              onClick={() => onVectorStyleChange(style)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 focus:ring-brand-primary ${
                vectorStyle === style
                  ? 'bg-brand-primary text-white shadow-md'
                  : 'bg-base-300 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-semibold mb-3 text-slate-200">3. Choose Colors (Optional)</h2>
        <div className="space-y-4">
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-slate-400">Preset Palettes</label>
                    {activePalette && (
                         <button onClick={() => onActivePaletteChange(null)} className="text-xs text-slate-400 hover:text-white transition-colors">Clear</button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {presetPalettes.map(p => (
                        <button key={p.name} onClick={() => onActivePaletteChange(p)} className={`px-3 py-1.5 text-xs rounded-full border-2 ${activePalette?.name === p.name ? 'border-brand-primary bg-brand-primary/10' : 'border-transparent'}`}>
                            <div className="flex items-center gap-2">
                                <div className="flex -space-x-1">
                                    {p.colors.map(c => <div key={c} className="w-4 h-4 rounded-full border-2 border-base-200" style={{backgroundColor: c}}></div>)}
                                </div>
                                <span className={activePalette?.name === p.name ? 'text-white' : 'text-slate-300'}>{p.name}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            <div>
                 <label htmlFor="custom-palette" className="text-sm font-medium text-slate-400 block mb-2">Custom Palette</label>
                 <input
                    id="custom-palette"
                    type="text"
                    placeholder="e.g., #ff0000,#00ff00,..."
                    value={customPalette}
                    onChange={(e) => {
                      onCustomPaletteChange(e.target.value);
                      if (activePalette) {
                        onActivePaletteChange(null);
                      }
                    }}
                    className="w-full bg-base-300 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-brand-primary focus:border-brand-primary"
                 />
            </div>
        </div>
      </div>

      <button
        onClick={onVectorize}
        disabled={isLoading || !isImageUploaded || !apiKey}
        className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Vectorizing...
          </div>
        ) : (
          'Vectorize Image'
        )}
      </button>
    </div>
  );
};