'use client';

import { createClient } from '@supabase/supabase-js';
import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, FileAudio, CheckCircle, Clock, Play, Pause, 
  Plus, Headphones, ChevronLeft, Loader2, AlertCircle, Trash2,
  Edit2, Check, X, Download, FileText, CheckSquare, LogOut
} from 'lucide-react';

// Supabase initialized server-side with env vars
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

// ── Shared Download Helpers ──────────────────────────────────────────────────
const downloadPDFHelper = (transcript) => {
  if (!window.jspdf) {
    alert("PDF library is still loading. Please try again in a moment.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Format Title
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(transcript.title, 15, 25);
  
  // Format Metadata Line
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  const dateStr = new Date(transcript.created_at).toLocaleDateString();
  doc.text(`Transcribed on: ${dateStr}  |  Words: ${transcript.transcript_text ? transcript.transcript_text.split(/\s+/).length : 0}`, 15, 33);
  
  // Draw Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(15, 38, 195, 38);
  
  // Format Transcript Text
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85); // slate-700
  
  const textToSplit = transcript.transcript_text || 'No text detected.';
  const lines = doc.splitTextToSize(textToSplit, 180);
  let yPos = 48;
  const pageHeight = doc.internal.pageSize.height;
  
  lines.forEach(line => {
    if (yPos > pageHeight - 20) { 
      doc.addPage(); 
      yPos = 25; 
    }
    doc.text(line, 15, yPos);
    yPos += 7;
  });
  
  doc.save(`${transcript.title.replace(/\s+/g, '_')}_Transcript.pdf`);
};

const downloadDOCHelper = (transcript) => {
  const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #334155; } h1 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; } .meta { color: #64748b; font-size: 0.9em; margin-bottom: 24px; }</style></head><body>";
  const footer = "</body></html>";
  const dateStr = new Date(transcript.created_at).toLocaleDateString();
  const wordCount = transcript.transcript_text ? transcript.transcript_text.split(/\s+/).length : 0;
  const textHtml = (transcript.transcript_text || '').replace(/\n/g, '<br><br>');
  const html = `${header}<h1>${transcript.title}</h1><div class='meta'>Transcribed on: ${dateStr} | Words: ${wordCount}</div><p>${textHtml}</p>${footer}`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${transcript.title.replace(/\s+/g, '_')}_Transcript.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function App() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [transcriptions, setTranscriptions] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeTranscript, setActiveTranscript] = useState(null);

  // Load jsPDF script globally
  useEffect(() => {
    if (!window.jspdf) {
      const pdfScript = document.createElement('script');
      pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      pdfScript.async = true;
      document.head.appendChild(pdfScript);
    }
  }, []);

  // Handle Auth
  useEffect(() => {
    setIsLoading(true);

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchTranscriptions();
      setIsLoading(false);
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchTranscriptions();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchTranscriptions = async () => {
    const { data, error } = await supabaseClient
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setTranscriptions(data);
    if (error) console.error("Error fetching transcriptions:", error);
  };

  const handleLogout = async () => {
    await supabaseClient.auth.signOut();
    setTranscriptions([]);
    setCurrentView('dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen supabase={supabaseClient} />;
  }

  const navigateTo = (view, transcript = null) => {
    setCurrentView(view);
    if (transcript) setActiveTranscript(transcript);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <Headphones className="text-indigo-600 mr-2" size={24} />
            <span className="font-bold text-lg tracking-tight">TranscribeAI</span>
          </div>
          <nav className="p-4 space-y-2">
            <button 
              onClick={() => navigateTo('dashboard')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileAudio className="mr-3" size={18} /> My Transcripts
            </button>
            <button 
              onClick={() => navigateTo('upload')}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === 'upload' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <UploadCloud className="mr-3" size={18} /> New Upload
            </button>
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mr-3">
              {session.user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden text-sm">
              <p className="font-medium text-slate-900 truncate">{session.user.email}</p>
              <p className="text-slate-500 text-xs truncate">Authenticated</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <LogOut className="mr-3" size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          {currentView === 'dashboard' && (
            <Dashboard 
              supabase={supabaseClient}
              transcriptions={transcriptions} 
              onNew={() => navigateTo('upload')}
              onSelect={(t) => navigateTo('detail', t)}
              fetchTranscriptions={fetchTranscriptions}
            />
          )}
          {currentView === 'upload' && (
            <UploadScreen 
              supabase={supabaseClient}
              user={session?.user}
              onUploadComplete={() => {
                fetchTranscriptions();
                navigateTo('dashboard');
              }}
              onCancel={() => navigateTo('dashboard')}
            />
          )}
          {currentView === 'detail' && activeTranscript && (
            <TranscriptDetail 
              supabase={supabaseClient}
              transcript={activeTranscript} 
              onBack={() => {
                fetchTranscriptions();
                navigateTo('dashboard');
              }} 
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ── DASHBOARD COMPONENT ──────────────────────────────────────────────────────
function Dashboard({ supabase, transcriptions, onNew, onSelect, fetchTranscriptions }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Checkbox functions
  const toggleSelect = (e, id) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === transcriptions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transcriptions.map(t => t.id));
    }
  };

  const deleteTranscript = async (e, id) => {
    e.stopPropagation(); 
    if (!window.confirm("Are you sure you want to delete this transcription?")) return;
    setIsDeleting(true);
    await supabase.from('transcriptions').delete().eq('id', id);
    await fetchTranscriptions();
    setSelectedIds(prev => prev.filter(item => item !== id));
    setIsDeleting(false);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected transcriptions?`)) return;
    setIsDeleting(true);
    const { error } = await supabase.from('transcriptions').delete().in('id', selectedIds);
    if (error) console.error("Error bulk deleting:", error);
    await fetchTranscriptions();
    setSelectedIds([]);
    setIsDeleting(false);
  };

  const handleBulkDownloadPDF = () => {
    const selectedList = transcriptions.filter(t => selectedIds.includes(t.id));
    selectedList.forEach(t => downloadPDFHelper(t));
  };

  const handleBulkDownloadDOC = () => {
    const selectedList = transcriptions.filter(t => selectedIds.includes(t.id));
    selectedList.forEach(t => downloadDOCHelper(t));
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Transcripts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage and search your converted audio files.</p>
        </div>
        <button onClick={onNew} className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
          <Plus size={18} className="mr-2" /> New Upload
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-3 mb-6 gap-3 animate-in slide-in-from-top duration-200">
          <span className="text-sm font-semibold text-indigo-900">
            {selectedIds.length} transcription{selectedIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={handleBulkDownloadPDF} 
              className="flex items-center px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <Download size={14} className="mr-1.5 text-red-500" /> Download PDF
            </button>
            <button 
              onClick={handleBulkDownloadDOC} 
              className="flex items-center px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
            >
              <FileText size={14} className="mr-1.5 text-blue-600" /> Download DOC
            </button>
            <button 
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} className="mr-1.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {transcriptions.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><FileAudio className="text-slate-400" size={32} /></div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No transcripts yet</h3>
          <p className="text-slate-500 mb-6 max-w-sm">Upload your first audio or video files to generate AI-powered text transcripts.</p>
          <button onClick={onNew} className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg">Upload files</button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  <th className="px-6 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={transcriptions.length > 0 && selectedIds.length === transcriptions.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transcriptions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelect(t)}>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={selectedIds.includes(t.id)}
                        onChange={(e) => toggleSelect(e, t.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center min-w-0">
                        <FileAudio className="text-indigo-500 mr-3 shrink-0" size={20} />
                        <span className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">{t.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 hidden sm:table-cell">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        t.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        t.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status === 'completed' && <CheckCircle size={12} className="mr-1" />}
                        {t.status === 'processing' && <Loader2 size={12} className="mr-1 animate-spin" />}
                        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onSelect(t)} className="text-indigo-600 hover:text-indigo-900 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">View</button>
                      <button disabled={isDeleting} onClick={(e) => deleteTranscript(e, t.id)} className="text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPLOAD SCREEN COMPONENT ──────────────────────────────────────────────────
function UploadScreen({ supabase, user, onUploadComplete, onCancel }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validQueueItems = [];
    let rejectedCount = 0;

    selectedFiles.forEach(file => {
      if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
        validQueueItems.push({
          id: `${file.name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          file: file,
          name: file.name,
          size: file.size,
          status: 'queued', // 'queued', 'processing', 'completed', 'failed'
          progress: 'Waiting in queue...',
          error: ''
        });
      } else {
        rejectedCount++;
      }
    });

    if (rejectedCount > 0) {
      setErrorMsg(`${rejectedCount} file(s) skipped. Please select valid audio or video files.`);
    } else {
      setErrorMsg('');
    }

    if (validQueueItems.length > 0) {
      setFiles(prev => [...prev, ...validQueueItems]);
    }
  };

  const removeFileFromQueue = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const startTranscribeProcess = async () => {
    if (files.length === 0 || !user) return;
    setIsUploading(true);
    setErrorMsg('');

    // Mark all files as processing/queued to start
    setFiles(prev => prev.map(f => ({ ...f, status: 'processing', progress: 'Connecting...' })));

    // Upload & Transcribe each file concurrently
    const promises = files.map(async (fileItem) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // Custom status feedback for > 50MB files
        const FIFTY_MB = 50 * 1024 * 1024;
        let activeMsg = 'Uploading & transcribing...';
        if (fileItem.size > FIFTY_MB) {
          activeMsg = 'Large file detected. Compressing on server...';
        }

        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, progress: activeMsg } : f));

        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': fileItem.file.type || 'application/octet-stream',
            'x-file-name': encodeURIComponent(fileItem.name),
            'x-user-id': user.id
          },
          body: fileItem.file
        });

        if (!response.ok) {
          const errBody = await response.json();
          throw new Error(errBody.error || 'Failed to process transcription');
        }

        const data = await response.json();

        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: 'completed', 
          progress: 'Completed',
          completedRecord: data
        } : f));

      } catch (err) {
        console.error(`Error processing ${fileItem.name}:`, err);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { 
          ...f, 
          status: 'failed', 
          progress: 'Failed', 
          error: err.message 
        } : f));
      }
    });

    await Promise.all(promises);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center mb-8">
        <button onClick={onCancel} className="mr-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-full"><ChevronLeft size={24} /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Upload Media</h1>
          <p className="text-slate-500 text-sm mt-1">Upload multiple audio/video files. Files larger than 50MB will be auto-compressed.</p>
        </div>
      </div>

      {!isUploading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8">
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start">
                <AlertCircle size={18} className="mr-2 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            
            <div 
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileChange({ target: { files: e.dataTransfer.files } }); }}
              onClick={() => fileInputRef.current.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-slate-50 rounded-xl p-10 text-center cursor-pointer transition-colors"
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*,video/*" className="hidden" multiple />
              
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4"><UploadCloud className="text-indigo-600" size={32} /></div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">Click or drag files to this area</h3>
                <p className="text-slate-500 text-sm">Select audio and video files. Multiple files supported.</p>
              </div>
            </div>

            {/* Selected Queue List */}
            {files.length > 0 && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Files to Transcribe ({files.length})</h3>
                  <button onClick={() => setFiles([])} className="text-xs text-red-600 hover:underline font-semibold">Clear Queue</button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {files.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <FileAudio className="text-indigo-500 shrink-0" size={20} />
                        <div className="overflow-hidden">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFileFromQueue(item.id)} 
                        className="text-slate-400 hover:text-red-500 p-1 hover:bg-slate-200/50 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg">Cancel</button>
            <button 
              onClick={startTranscribeProcess} 
              disabled={files.length === 0} 
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${files.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              Transcribe {files.length > 0 ? `${files.length} File${files.length > 1 ? 's' : ''}` : 'Media'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Processing Media Files</h3>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto mb-8 pr-1">
            {files.map(item => (
              <div key={item.id} className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  {item.status === 'processing' && <Loader2 className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />}
                  {item.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />}
                  {item.status === 'failed' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
                  {item.status === 'queued' && <Clock className="w-5 h-5 text-slate-400 shrink-0" />}
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 font-medium">{(item.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    item.status === 'completed' ? 'bg-green-100 text-green-800' :
                    item.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-indigo-100 text-indigo-800'
                  }`}>
                    {item.progress}
                  </span>
                </div>
                {item.status === 'failed' && item.error && (
                  <p className="text-xs text-red-600 w-full font-medium mt-1 pl-8">{item.error}</p>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex justify-center gap-3 border-t border-slate-100 pt-6">
            {files.every(f => f.status === 'completed' || f.status === 'failed') ? (
              <button 
                onClick={onUploadComplete}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
              >
                Return to Dashboard
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-slate-500 font-semibold animate-pulse">Transcribing in progress. Please do not navigate away.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DETAIL SCREEN COMPONENT ──────────────────────────────────────────────────
function TranscriptDetail({ supabase, transcript: initialTranscript, onBack }) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copyStatus, setCopyStatus] = useState('Copy Text');
  
  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(initialTranscript.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const audioRef = useRef(null);

  const togglePlay = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      audio.addEventListener('ended', handleEnded);
      return () => audio.removeEventListener('ended', handleEnded);
    }
  }, []);

  const copyText = () => {
    navigator.clipboard.writeText(transcript.transcript_text || '');
    setCopyStatus('Copied!');
    setTimeout(() => setCopyStatus('Copy Text'), 2000);
  };

  const handleSaveTitle = async () => {
    if (!editTitleValue.trim() || editTitleValue === transcript.title || !supabase) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    const { error } = await supabase
      .from('transcriptions')
      .update({ title: editTitleValue })
      .eq('id', transcript.id);
    if (!error) {
      setTranscript({ ...transcript, title: editTitleValue });
    }
    setIsSavingTitle(false);
    setIsEditingTitle(false);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center min-w-0">
          <button onClick={onBack} className="mr-4 text-slate-400 hover:text-slate-600 p-2 -ml-2 rounded-full hover:bg-slate-100 shrink-0"><ChevronLeft size={24} /></button>
          <div className="min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center max-w-md">
                <input 
                  autoFocus
                  type="text" 
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  className="text-2xl font-bold text-slate-900 border-b-2 border-indigo-500 focus:outline-none bg-transparent w-full py-1"
                />
                <button disabled={isSavingTitle} onClick={handleSaveTitle} className="ml-2 text-green-600 hover:bg-green-50 p-1.5 rounded-lg"><Check size={20} /></button>
                <button disabled={isSavingTitle} onClick={() => { setIsEditingTitle(false); setEditTitleValue(transcript.title); }} className="ml-1 text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg"><X size={20} /></button>
              </div>
            ) : (
              <div className="flex items-center group min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 truncate mr-3">{transcript.title}</h1>
                <button onClick={() => setIsEditingTitle(true)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 shrink-0">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center text-sm text-slate-500 mt-1">
              <Clock size={14} className="mr-1.5" />
              Transcribed on {new Date(transcript.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {/* Export Buttons */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => downloadDOCHelper(transcript)} className="flex items-center px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg shadow-2xs transition-colors">
            <FileText size={16} className="mr-2 text-blue-600" /> .DOC
          </button>
          <button onClick={() => downloadPDFHelper(transcript)} className="flex items-center px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg shadow-2xs transition-colors">
            <Download size={16} className="mr-2 text-red-500" /> .PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-semibold text-slate-800">Transcript Text</h3>
            <button onClick={copyText} className={`text-sm font-semibold flex items-center transition-colors ${copyStatus === 'Copied!' ? 'text-green-600' : 'text-indigo-600 hover:text-indigo-800'}`}>
              {copyStatus === 'Copied!' && <CheckSquare size={14} className="mr-1.5" />}
              {copyStatus}
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 prose prose-slate max-w-none">
            {transcript.transcript_text ? (
              transcript.transcript_text.split('\n').map((paragraph, idx) => (
                paragraph.trim() && <p key={idx} className="text-slate-700 leading-relaxed mb-4">{paragraph}</p>
              ))
            ) : (
              <p className="text-slate-400 italic">No text was extracted. The file might be empty or processing failed.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Original Audio</h3>
            <audio ref={audioRef} src={transcript.audio_url} className="hidden" />
            <div className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-slate-100">
              <button onClick={togglePlay} className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 mb-4">
                {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>
              <div className="w-full text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {isPlaying ? 'Playing Audio...' : 'Ready to play'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Details</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-500">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${transcript.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {transcript.status.charAt(0).toUpperCase() + transcript.status.slice(1)}
                </span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-slate-500">Words</span>
                <span className="font-semibold text-slate-800">{transcript.transcript_text ? transcript.transcript_text.split(/\s+/).length : 0}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AUTH SCREEN COMPONENT ────────────────────────────────────────────────────
function AuthScreen({ supabase }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Headphones className="text-white" size={28} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Welcome to TranscribeAI</h1>
        <p className="text-center text-slate-500 mb-8">Sign in to access the platform.</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start">
            <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2 flex justify-center items-center">
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}