import React, { useState, useRef, useEffect } from 'react';
import { CodeViewer } from './CodeViewer';

interface ResultViewerProps {
  originalImagePreview: string | null;
  generatedSvg: string | null;
  isLoading: boolean;
  error: string | null;
}

const loadingMessages = [
    "Analyzing image features...",
    "Generating vector shapes...",
    "Applying style and colors...",
    "Finalizing the SVG...",
    "This can take a moment...",
];

const LoadingIndicator: React.FC = () => {
    const [message, setMessage] = useState(loadingMessages[0]);

    useEffect(() => {
        let index = 0;
        const intervalId = setInterval(() => {
            index = (index + 1) % loadingMessages.length;
            setMessage(loadingMessages[index]);
        }, 2500);

        return () => clearInterval(intervalId);
    }, []);


    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-primary"></div>
            <h3 className="text-xl font-semibold mt-6 text-slate-200">AI is working its magic...</h3>
            <p className="text-slate-400 mt-2 min-h-[2em]">{message}</p>
        </div>
    );
};

const Placeholder: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-base-200 rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="text-xl font-semibold mt-4 text-slate-300">Your results will appear here</h3>
        <p className="text-slate-500 mt-1">Upload an image and click "Vectorize" to start.</p>
    </div>
);


export const ResultViewer: React.FC<ResultViewerProps> = ({
  originalImagePreview,
  generatedSvg,
  isLoading,
  error,
}) => {

  const downloadSvg = () => {
    if (!generatedSvg) return;
    const blob = new Blob([generatedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vectorized-image.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadPng = () => {
    if (!generatedSvg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([generatedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
        // To get a higher resolution PNG, we can scale the canvas
        const scaleFactor = 2;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;
        
        if (ctx) {
            ctx.scale(scaleFactor, scaleFactor);
            ctx.drawImage(img, 0, 0);
        }
        
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'vectorized-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(pngUrl);
    };
    img.onerror = () => {
        console.error("Failed to load SVG into image for PNG conversion.");
        URL.revokeObjectURL(url);
    }
    img.src = url;
  };
  
  const svgDataUrl = generatedSvg ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(generatedSvg)))}` : '';


  const renderContent = () => {
    if (isLoading) return <LoadingIndicator />;
    if (error) return <div className="p-8 text-center text-red-400 bg-red-900/20 rounded-lg"><h3 className="font-bold mb-2">Vectorization Failed</h3><p className="text-sm">{error}</p></div>;
    if (!originalImagePreview) return <Placeholder />;

    if (generatedSvg) {
      return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h3 className="font-semibold mb-2 text-slate-300">Original</h3>
                    <div className="aspect-square bg-base-300 rounded-lg p-2 flex items-center justify-center">
                        <img src={originalImagePreview} alt="Original" className="rounded-lg max-w-full max-h-full object-contain" />
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold mb-2 text-slate-300">Vectorized Result</h3>
                    <div className="aspect-square bg-white rounded-lg p-2 flex items-center justify-center" style={{ backgroundImage: `url("data:image/svg+xml,%3csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='10' height='10' fill='%23f1f5f9'/%3e%3crect x='10' y='10' width='10' height='10' fill='%23f1f5f9'/%3e%3c/svg%3e")`}}>
                         <img src={svgDataUrl} alt="Generated Vector" className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            </div>
            <div>
                <h3 className="font-semibold mb-3 text-slate-300">Export</h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={downloadSvg} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Download SVG</button>
                    <button onClick={downloadPng} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">Download PNG</button>
                </div>
            </div>
            <div>
                <h3 className="font-semibold mb-3 text-slate-300">SVG Code</h3>
                <CodeViewer code={generatedSvg} />
            </div>
        </div>
      );
    }
    
    return (
        <div className="text-center p-8 bg-base-200 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Image Ready</h3>
            <img src={originalImagePreview} alt="Awaiting vectorization" className="max-w-xs mx-auto rounded-lg shadow-lg" />
            <p className="text-slate-400 mt-4">Press "Vectorize Image" to begin the AI conversion.</p>
        </div>
    );
  };

  return <div className="bg-base-200 p-6 rounded-lg shadow-lg min-h-[500px] flex flex-col justify-center">{renderContent()}</div>;
};
