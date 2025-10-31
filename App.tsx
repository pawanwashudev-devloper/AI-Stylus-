
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { analyzeIdea, generateImage, validateApiKey } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { UploadIcon, SparklesIcon, XIcon, ImagePlusIcon, WandIcon, DownloadIcon, CopyIcon, KeyIcon, CheckCircleIcon } from './components/Icons';

type AppState = 'IDLE' | 'GENERATING' | 'RESULT_READY' | 'ERROR';

// A reusable Image Uploader component to reduce duplication
const ImageUploader: React.FC<{
    title: string;
    description: string;
    image: string | null;
    onImageRemove: () => void;
    onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    id: string;
}> = ({ title, description, image, onImageRemove, onFileChange, id }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-400 mb-2">
            {title}
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-indigo-500 transition-colors">
            <div className="space-y-1 text-center">
                {image ? (
                    <div className="relative group">
                        <img src={image} alt="Upload preview" className="mx-auto h-32 w-auto rounded-md" />
                        <button onClick={onImageRemove} className="absolute top-1 right-1 bg-gray-800 bg-opacity-70 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <UploadIcon className="mx-auto h-12 w-12 text-gray-500" />
                        <div className="flex text-sm text-gray-500">
                            <label htmlFor={id} className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-indigo-400 hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 focus-within:ring-indigo-500 px-1">
                                <span>Upload a file</span>
                                <input id={id} name={id} type="file" className="sr-only" onChange={onFileChange} accept="image/*" />
                            </label>
                        </div>
                        <p className="text-xs text-gray-600">{description}</p>
                    </>
                )}
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [isKeyValid, setIsKeyValid] = useState<boolean>(false);
    const [isKeyLoading, setIsKeyLoading] = useState<boolean>(false);
    const [keyError, setKeyError] = useState<string>('');

    const [rawImage, setRawImage] = useState<string | null>(null);
    const [styleImage, setStyleImage] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string>('');
    const [editSuggestion, setEditSuggestion] = useState<string>('');
    const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appState, setAppState] = useState<AppState>('IDLE');
    const [showPrompt, setShowPrompt] = useState<boolean>(false);
    const [isCopied, setIsCopied] = useState<boolean>(false);

    useEffect(() => {
        const storedKey = localStorage.getItem('gemini-api-key');
        if (storedKey) {
            handleKeyValidation(storedKey, true);
        }
    }, []);

    const handleKeyValidation = async (keyToValidate: string, isAuto: boolean = false) => {
        if (!keyToValidate) {
            setKeyError('Please enter an API key.');
            return;
        }
        setIsKeyLoading(true);
        setKeyError('');
        setApiKey(keyToValidate);

        const isValid = await validateApiKey(keyToValidate);
        if (isValid) {
            setIsKeyValid(true);
            localStorage.setItem('gemini-api-key', keyToValidate);
        } else {
            setIsKeyValid(false);
            if (!isAuto) {
                setKeyError('The API key is invalid. Please check it and try again.');
            }
            localStorage.removeItem('gemini-api-key');
        }
        setIsKeyLoading(false);
    };

    const handleKeyChange = () => {
        setIsKeyValid(false);
        setApiKey('');
        setKeyError('');
        localStorage.removeItem('gemini-api-key');
    };

    const handleFileChange = (setter: React.Dispatch<React.SetStateAction<string | null>>) => async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                setter(base64);
            } catch (err) {
                setError('Failed to read image file.');
                setAppState('ERROR');
            }
        }
    };

    const processGeneration = async (isEnhancement: boolean) => {
        if (!isKeyValid) {
            setError('Please provide and validate your Gemini API key to start.');
            setAppState('ERROR');
            return;
        }

        if (!rawImage && !styleImage && !userPrompt) {
            setError('Please provide a raw image, a style image, or a text description to start.');
            setAppState('ERROR');
            return;
        }
        setError(null);
        setAppState('GENERATING');
        setGeneratedImage(null);
        
        try {
            const previousPrompt = isEnhancement ? generatedPrompt : undefined;
            const suggestion = isEnhancement ? editSuggestion : undefined;
            
            const newPrompt = await analyzeIdea(apiKey, rawImage, styleImage, userPrompt, previousPrompt, suggestion);
            setGeneratedPrompt(newPrompt);

            const imageB64 = await generateImage(apiKey, newPrompt, rawImage);
            setGeneratedImage(`data:image/png;base64,${imageB64}`);
            setAppState('RESULT_READY');
            setEditSuggestion('');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(`Failed during image creation: ${errorMessage}`);
            setAppState('ERROR');
            console.error(err);
        }
    };

    const handleGenerate = () => processGeneration(false);
    const handleEnhance = () => processGeneration(true);

    const handleReset = () => {
        setRawImage(null);
        setStyleImage(null);
        setUserPrompt('');
        setGeneratedPrompt('');
        setGeneratedImage(null);
        setError(null);
        setAppState('IDLE');
        setShowPrompt(false);
        setEditSuggestion('');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedPrompt).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const isGenerateDisabled = appState === 'GENERATING' || !isKeyValid || (!rawImage && !styleImage && !userPrompt);

    const apiKeySection = useMemo(() => {
        if (isKeyValid) {
            return (
                <div className="bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <CheckCircleIcon className="w-6 h-6 mr-3 text-green-400" />
                            <p className="font-medium text-gray-200">API Key is set and validated.</p>
                        </div>
                        <button 
                            onClick={handleKeyChange}
                            className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                            Change Key
                        </button>
                    </div>
                </div>
            );
        }

        return (
             <div className="bg-gray-800 p-4 rounded-xl shadow-md border border-gray-700">
                <label htmlFor="api-key" className="flex items-center text-sm font-medium text-gray-300 mb-2">
                    <KeyIcon className="w-5 h-5 mr-2 text-indigo-400" />
                    Enter your Gemini API Key
                </label>
                <div className="flex items-center space-x-2">
                    <input
                        type="password"
                        id="api-key"
                        name="api-key"
                        value={apiKey}
                        onChange={(e) => {
                            setApiKey(e.target.value);
                            if (keyError) setKeyError('');
                        }}
                        className="block w-full bg-gray-900 border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-100 placeholder-gray-500"
                        placeholder="Paste your API key here"
                        aria-required="true"
                        disabled={isKeyLoading}
                        onKeyDown={(e) => e.key === 'Enter' && handleKeyValidation(apiKey)}
                    />
                    <button 
                        onClick={() => handleKeyValidation(apiKey)}
                        disabled={!apiKey || isKeyLoading}
                        className="px-4 py-2 flex-shrink-0 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isKeyLoading ? (
                            <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                        ) : 'Save'}
                    </button>
                </div>
                {keyError && <p className="mt-2 text-sm text-red-400">{keyError}</p>}
                {!keyError && (
                    <p className="mt-2 text-xs text-gray-500">
                        Get your key from{' '}
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                            Google AI Studio
                        </a>. Your key is stored locally in your browser.
                    </p>
                )}
            </div>
        );
    }, [apiKey, isKeyValid, isKeyLoading, keyError]);

    const inputPanelContent = useMemo(() => (
        <div className="flex flex-col space-y-6">
            <ImageUploader 
                title="Raw Image (Subject)"
                description="The main image to be edited or transformed."
                image={rawImage}
                onImageRemove={() => setRawImage(null)}
                onFileChange={handleFileChange(setRawImage)}
                id="raw-image-upload"
            />
            <ImageUploader 
                title="Style Image (Reference)"
                description="An image providing style, color, or mood."
                image={styleImage}
                onImageRemove={() => setStyleImage(null)}
                onFileChange={handleFileChange(setStyleImage)}
                id="style-image-upload"
            />
            <div>
                <label htmlFor="user-prompt" className="block text-sm font-medium text-gray-400">
                    Describe Your Goal (Optional)
                </label>
                <div className="mt-1">
                    <textarea
                        id="user-prompt"
                        name="user-prompt"
                        rows={3}
                        className="block w-full shadow-sm sm:text-sm bg-gray-800 border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., 'make this a fantasy scene' or 'background futuristic city'. Simple phrases are okay!"
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerateDisabled}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
            >
                <SparklesIcon className="w-5 h-5 mr-2" />
                Generate Image
            </button>
        </div>
    ), [rawImage, styleImage, userPrompt, isGenerateDisabled]);

    const outputPanelContent = useMemo(() => {
        if (appState === 'GENERATING') {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-800/50 rounded-lg">
                    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
                    <p className="mt-4 text-lg font-semibold">Creating your image...</p>
                    <p className="text-gray-400">This may take a moment. The AI is analyzing, prompting, and generating.</p>
                </div>
            );
        }

        if (appState === 'ERROR' && error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-red-900/20 border border-red-500 rounded-lg">
                     <p className="text-lg font-semibold text-red-400">An Error Occurred</p>
                    <p className="mt-2 text-red-300">{error}</p>
                    <button onClick={handleReset} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md">Try Again</button>
                </div>
            );
        }

        if (appState === 'IDLE') {
             return (
                 <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-800/50 rounded-lg">
                    <ImagePlusIcon className="w-16 h-16 text-gray-600" />
                    <h3 className="mt-2 text-lg font-medium text-gray-300">Your results will appear here</h3>
                    <p className="mt-1 text-sm text-gray-500">Provide an API Key and images or a description to get started.</p>
                </div>
             );
        }

        if (appState === 'RESULT_READY' && generatedImage) {
            return (
                <div className="flex flex-col space-y-4 h-full">
                    <div className="flex-grow flex items-center justify-center bg-black/20 rounded-lg min-h-[250px] relative">
                        <img src={generatedImage} alt="Generated result" className="max-h-full max-w-full object-contain rounded-md" />
                        <a href={generatedImage} download="ai-generated-image.png" className="absolute top-2 right-2 bg-gray-800/70 text-white p-2 rounded-full hover:bg-indigo-600 transition-colors" title="Download Image">
                            <DownloadIcon className="w-5 h-5" />
                        </a>
                    </div>

                    <div className="space-y-2">
                        <button onClick={() => setShowPrompt(!showPrompt)} className="text-sm text-indigo-400 hover:text-indigo-300">
                           {showPrompt ? 'Hide' : 'Show'} Prompt
                        </button>
                        {showPrompt && (
                            <div className="p-3 bg-gray-900/50 rounded-md relative">
                                <p className="text-sm text-gray-300 font-mono whitespace-pre-wrap">{generatedPrompt}</p>
                                <button onClick={handleCopy} className="absolute top-2 right-2 bg-gray-700 text-white p-1.5 rounded-md hover:bg-gray-600 transition-colors" title="Copy Prompt">
                                    {isCopied ? <span className="text-xs">Copied!</span> : <CopyIcon className="w-4 h-4" />}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-gray-700">
                        <label htmlFor="edit-suggestion" className="block text-sm font-medium text-gray-400">
                           Suggest an Edit or Enhancement
                        </label>
                        <div className="mt-1 flex items-center space-x-2">
                             <textarea
                                id="edit-suggestion"
                                name="edit-suggestion"
                                rows={2}
                                className="block w-full shadow-sm sm:text-sm bg-gray-800 border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="e.g., 'Make the sky purple' or 'Add a castle in the background'"
                                value={editSuggestion}
                                onChange={(e) => setEditSuggestion(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={handleEnhance}
                                disabled={appState === 'GENERATING' || !editSuggestion}
                                className="px-4 py-2 flex items-center border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                            >
                                <WandIcon className="w-5 h-5 mr-1" />
                                Enhance
                            </button>
                        </div>
                    </div>
                     <button
                        onClick={handleReset}
                        className="w-full mt-2 px-4 py-2 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                        Start Over
                    </button>
                </div>
            );
        }
        
        return null;

    }, [appState, error, generatedPrompt, generatedImage, editSuggestion, showPrompt, isCopied]);


    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
            <main className="container mx-auto px-4 py-8 md:py-12">
                <header className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                        AI Image Idea Studio
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-400">
                        Transform your concepts into stunning visuals. Provide images, describe your goal, and enhance your creation iteratively.
                    </p>
                </header>

                <div className="max-w-2xl mx-auto mb-8">
                    {apiKeySection}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-2xl border border-gray-700">
                       {inputPanelContent}
                    </div>
                    <div className="bg-gray-800 p-6 md:p-8 rounded-xl shadow-2xl border border-gray-700 min-h-[500px] flex flex-col">
                       {outputPanelContent}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
