import React, { useState, useCallback, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { ResultViewer } from './components/ResultViewer';
import { generateVector } from './services/geminiService';
import type { VectorStyle, Palette } from './types';
import { VectorStyleEnum } from './types';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini-api-key') || '');
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [vectorStyle, setVectorStyle] = useState<VectorStyle>(VectorStyleEnum.Detailed);
  const [customPalette, setCustomPalette] = useState<string>('');
  const [activePalette, setActivePalette] = useState<Palette | null>(null);
  
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('gemini-api-key', apiKey);
  }, [apiKey]);

  const handleImageUpload = useCallback((file: File) => {
    setOriginalImage(file);
    setGeneratedSvg(null);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setOriginalImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);
  
  const handleActivePaletteChange = useCallback((palette: Palette | null) => {
    setActivePalette(palette);
    if (palette) {
        setCustomPalette('');
    }
  }, []);

  const handleVectorize = useCallback(async () => {
    if (!originalImage) {
      setError('Please upload an image first.');
      return;
    }
    if (!apiKey) {
      setError('Please enter your Google API Key in the control panel.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedSvg(null);

    try {
      const base64Image = await fileToBase64(originalImage);

      const paletteToUse = activePalette 
        ? activePalette.colors 
        : customPalette.split(',').map(c => c.trim()).filter(c => /^#[0-9a-f]{3,6}$/i.test(c));

      const svgOutput = await generateVector(
          apiKey,
          base64Image, 
          originalImage.type, // Pass the dynamic MIME type
          vectorStyle, 
          paletteToUse.length > 0 ? paletteToUse : undefined
      );
      
      const sanitizedSvg = svgOutput.replace(/```svg/g, '').replace(/```/g, '').trim();
      setGeneratedSvg(sanitizedSvg);

    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred during vectorization.';
      setError(`Failed to vectorize: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, vectorStyle, customPalette, activePalette, apiKey]);

  return (
    <div className="min-h-screen bg-base-100 font-sans">
      <header className="py-4 px-8 border-b border-base-300">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">
          Vectorize AI
        </h1>
        <p className="text-sm text-slate-400">AI-Powered Image to Vector Converter</p>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 max-w-screen-2xl mx-auto">
        <div className="lg:col-span-4">
          <ControlPanel
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onImageUpload={handleImageUpload}
            originalImagePreview={originalImagePreview}
            vectorStyle={vectorStyle}
            onVectorStyleChange={setVectorStyle}
            customPalette={customPalette}
            onCustomPaletteChange={setCustomPalette}
            activePalette={activePalette}
            onActivePaletteChange={handleActivePaletteChange}
            onVectorize={handleVectorize}
            isLoading={isLoading}
            isImageUploaded={!!originalImage}
          />
        </div>
        <div className="lg:col-span-8">
          <ResultViewer
            originalImagePreview={originalImagePreview}
            generatedSvg={generatedSvg}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </main>
    </div>
  );
};

export default App;