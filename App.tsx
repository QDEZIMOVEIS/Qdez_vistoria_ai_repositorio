
import React, { useState, useEffect, useMemo } from 'react';
import localforage from 'localforage';
import { Inspection, Room, COMMON_ROOMS, Photo, Video, AppSettings, Audio } from './types';
import PhotoUploader from './components/PhotoUploader';
import VideoUploader from './components/VideoUploader';
import VoiceTranscription from './components/VoiceTranscription';
import InspectionReport from './components/InspectionReport';
import { performComparisonAI, analyzeRoomMediaAI, editImageAI } from './services/geminiService';

const DEFAULT_INSPECTOR = "David Oliveira - Creci 84926-F";
const MAX_PAYLOAD_MB = 20;

const getStatusColor = (status: Room['condition']) => {
  switch (status) {
    case 'Ótimo': return 'bg-emerald-500';
    case 'Bom': return 'bg-blue-500';
    case 'Regular': return 'bg-amber-500';
    case 'Ruim': return 'bg-red-500';
    default: return 'bg-slate-500';
  }
};

const App: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ detailLevel: 'Normal', defaultSeverity: 'Média', tone: 'Técnico' });
  const [current, setCurrent] = useState<Inspection | null>(null);
  const [view, setView] = useState<'list' | 'editor' | 'report' | 'comparison' | 'type_selector' | 'settings'>('list');
  const [isBusy, setIsBusy] = useState(false);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Estados para edição de imagem via IA
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [iaPrompt, setIaPrompt] = useState('');
  const [isEditingIA, setIsEditingIA] = useState(false);

  const [pdfEntry, setPdfEntry] = useState<{data: string, size: number} | null>(null);
  const [pdfExit, setPdfExit] = useState<{data: string, size: number} | null>(null);
  const [manualComparisonObs, setManualComparisonObs] = useState('');

  useEffect(() => {
    Promise.all([
      localforage.getItem<Inspection[]>('qdez_rascunhos'),
      localforage.getItem<AppSettings>('qdez_settings')
    ]).then(([stored, storedSettings]) => {
      if (stored) setInspections(stored);
      if (storedSettings) setSettings(storedSettings);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('qdez_rascunhos', inspections);
      localforage.setItem('qdez_settings', settings);
    }
  }, [inspections, settings, isLoaded]);

  const saveToGlobalList = (updatedIns: Inspection) => {
    setInspections(prev => {
      const filtered = prev.filter(i => i.id !== updatedIns.id);
      return [updatedIns, ...filtered];
    });
  };

  const handleSyncCloud = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ins = inspections.find(i => i.id === id);
    if (!ins) return;
    setIsBusy(true);
    await new Promise(r => setTimeout(r, 1500));
    const updated = { ...ins, isSynced: true };
    saveToGlobalList(updated);
    setIsBusy(false);
    alert("Vistoria sincronizada com Storage Qdez!");
  };

  const updateCurrent = (updates: Partial<Inspection>) => {
    if (!current) return;
    const updated = { ...current, ...updates };
    setCurrent(updated);
    saveToGlobalList(updated);
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    if (!current) return;
    const rooms = current.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
    updateCurrent({ rooms });
  };

  const deleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!current) return;
    if (!confirm("Tem certeza que deseja excluir este ambiente?")) return;
    const rooms = current.rooms.filter(r => r.id !== roomId);
    updateCurrent({ rooms });
    if (editingRoom === roomId) setEditingRoom(null);
  };

  const addRoom = (type: string) => {
    if (!current) return;
    const newRoom: Room = { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      description: '', 
      photos: [], 
      videos: [], 
      audios: [],
      condition: 'Bom',
      reparoStatus: current.subtipoConstatacao === 'Reparos' ? 'Não Executado' : undefined
    };
    updateCurrent({ rooms: [...current.rooms, newRoom] });
    setEditingRoom(newRoom.id);
  };

  const handleSaveDraft = () => {
    setView('list');
    setCurrent(null);
  };

  const handleCompleteInspection = () => {
    if (!current) return;
    updateCurrent({ status: 'completed', date: new Date().toISOString() });
    setView('report');
  };

  const handleManualRoomAnalysis = async (roomId: string, overrideVideos?: Video[], overridePhotos?: Photo[]) => {
    if (!current) return;
    const room = current.rooms.find(r => r.id === roomId);
    if (!room) return;

    const photos = overridePhotos || room.photos;
    const videos = overrideVideos || room.videos;

    if (photos.length === 0 && videos.length === 0) {
      alert("Por favor, adicione fotos ou vídeos para análise.");
      return;
    }

    setProcessingRoomId(roomId);
    setAnalysisError(null);
    try {
      const mediaItems = [
        ...photos.map(p => ({ data: p.data, mimeType: p.mimeType })),
        ...videos.map(v => ({ data: v.data, mimeType: v.mimeType }))
      ];

      const analysis = await analyzeRoomMediaAI(room.type, current.type, mediaItems, settings);
      
      let formattedText = `AMBIENTE: ${room.customName || room.type}\n\n`;
      formattedText += `DESCRIÇÃO TÉCNICA:\n${analysis.descricaoGeral}\n\n`;
      
      formattedText += `COMPONENTES E CONSERVAÇÃO:\n`;
      analysis.itensIdentificados.forEach((item: any) => {
        formattedText += `- ${item.item}: ${item.estado}. ${item.detalhes}\n`;
      });

      if (analysis.evidenciasDanos.length > 0) {
        formattedText += `\nAVARIAS E OBSERVACÕES:\n`;
        analysis.evidenciasDanos.forEach((dano: any) => {
          const ts = dano.timestamp ? ` [Vídeo: ${dano.timestamp}]` : "";
          formattedText += `- ${dano.local}: ${dano.descricao}${ts} (Gravidade: ${dano.gravidade})\n`;
        });
      }

      updateRoom(roomId, { 
        description: formattedText.trim(),
        condition: analysis.estadoConservacao
      });
    } catch (err: any) {
      console.error("Erro na análise técnica:", err);
      setAnalysisError(err.message || "Erro desconhecido na análise.");
    } finally {
      setProcessingRoomId(null);
    }
  };

  const handleEditImageIA = async (roomId: string, photoId: string) => {
    if (!current || !iaPrompt) return;
    const room = current.rooms.find(r => r.id === roomId);
    if (!room) return;
    const photo = room.photos.find(p => p.id === photoId);
    if (!photo) return;

    setIsEditingIA(true);
    try {
      const editedData = await editImageAI(photo.data, iaPrompt, settings);
      const updatedPhotos = room.photos.map(p => 
        p.id === photoId ? { ...p, data: editedData } : p
      );
      updateRoom(roomId, { photos: updatedPhotos });
      setEditingPhotoId(null);
      setIaPrompt('');
    } catch (err) {
      alert("Não foi possível editar a imagem. O modelo pode ter tido dificuldades com o prompt.");
    } finally {
      setIsEditingIA(false);
    }
  };

  const confirmNewInspection = (type: Inspection['type'], subtipo?: 'Padrão' | 'Reparos') => {
    const newIns: Inspection = {
      id: 'VST-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      clientName: '', 
      tenantName: '', 
      tenantNames: [''],
      inspectorName: DEFAULT_INSPECTOR,
      type, 
      subtipoConstatacao: subtipo,
      address: '', 
      date: new Date().toISOString(), 
      rooms: [], 
      status: 'draft', 
      isSynced: false,
      observacoesGerais: ''
    };
    setCurrent(newIns);
    saveToGlobalList(newIns);
    setView(type === 'Comparação' ? 'comparison' : 'editor');
  };

  const handleRunComparison = async () => {
    if (!pdfEntry || !pdfExit || !current) return;
    const totalSizeMB = (pdfEntry.size + pdfExit.size) / (1024 * 1024);
    if (totalSizeMB > MAX_PAYLOAD_MB) {
      alert(`Arquivos muito grandes para processamento direto.`);
      return;
    }
    setIsBusy(true);
    try {
      const res = await performComparisonAI(pdfEntry.data, pdfExit.data, settings, manualComparisonObs);
      const updated: Inspection = { 
        ...current, 
        comparisonResult: { analysis: res.analysis, sources: res.sources, budget: "", manualObservations: manualComparisonObs },
        status: 'completed', date: new Date().toISOString()
      };
      setCurrent(updated);
      saveToGlobalList(updated);
      setView('report');
    } catch (e: any) {
      alert("Erro na perícia.");
    } finally { setIsBusy(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: any) => void) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setter({ data: result.includes(',') ? result.split(',')[1] : result, size: file.size });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTranscription = (text: string, destination: 'general' | 'room' | 'comparison') => {
    if (!current) return;
    if (destination === 'general') {
      updateCurrent({ observacoesGerais: (current.observacoesGerais || '') + '\n' + text });
    } else if (destination === 'room' && editingRoom) {
      const room = current.rooms.find(r => r.id === editingRoom);
      if (room) {
        updateRoom(editingRoom, { description: (room.description + '\n' + text).trim() });
      }
    } else if (destination === 'comparison') {
      setManualComparisonObs(prev => (prev + '\n' + text).trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-lg no-print">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('list')}>
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center font-black">Q</div>
            <h1 className="font-black uppercase text-sm tracking-tighter">Qdez Vistoria AI</h1>
          </div>
          <button onClick={() => setView('type_selector')} className="bg-red-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition-all shadow-lg active:scale-95">+ Nova Vistoria</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 w-full flex-1">
        {view === 'list' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Histórico David Oliveira</h2>
            <div className="grid gap-4">
              {inspections.length === 0 ? (
                <div className="p-16 border-2 border-dashed border-slate-200 rounded-[3rem] text-center bg-white/50">
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sem registros.</p>
                </div>
              ) : (
                inspections.map(ins => (
                  <div key={ins.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex justify-between items-center hover:border-red-500 transition-all cursor-pointer group" onClick={() => { setCurrent(ins); setView(ins.type === 'Comparação' ? 'comparison' : 'editor'); }}>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center mb-1">
                        <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{ins.type}</span>
                        <span className="text-[9px] font-bold text-slate-400">#{ins.id}</span>
                        {ins.isSynced && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Cloud ✓</span>}
                      </div>
                      <h3 className="font-bold text-slate-800">{ins.address || 'Endereço Pendente'}</h3>
                      <p className="text-[10px] text-slate-500">Locatário: {ins.tenantName || 'N/A'}</p>
                    </div>
                    <div className="flex gap-2">
                      {!ins.isSynced && (
                        <button onClick={(e) => handleSyncCloud(ins.id, e)} className="w-9 h-9 rounded-full bg-slate-50 text-slate-400 hover:text-blue-600 transition-all flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </button>
                      )}
                      <button onClick={(e) => {e.stopPropagation(); if(confirm("Excluir?")) setInspections(p => p.filter(i => i.id !== ins.id)); }} className="w-9 h-9 rounded-full hover:bg-red-50 text-slate-200 hover:text-red-600 transition-all flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'type_selector' && (
          <div className="max-w-md mx-auto pt-20 animate-in zoom-in-95 duration-300">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8">Novo Relatório</h2>
              <div className="grid gap-3">
                <button onClick={() => confirmNewInspection('Entrada')} className="p-6 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Vistoria de Entrada</span>
                </button>
                <button onClick={() => confirmNewInspection('Saída')} className="p-6 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Vistoria de Saída</span>
                </button>
                <div className="space-y-2">
                  <button onClick={() => confirmNewInspection('Constatação', 'Padrão')} className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                    <span className="block font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Constatação Padrão</span>
                  </button>
                  <button onClick={() => confirmNewInspection('Constatação', 'Reparos')} className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                    <span className="block font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Constatação de Reparos</span>
                  </button>
                </div>
                <button onClick={() => confirmNewInspection('Comparação')} className="p-6 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 uppercase text-xs group-hover:text-red-700">Comparativo IA</span>
                </button>
              </div>
              <button onClick={() => setView('list')} className="mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">Voltar</button>
            </div>
          </div>
        )}

        {view === 'comparison' && current && (
          <div className="max-w-xl mx-auto space-y-6 pt-10 pb-40 animate-in fade-in duration-500">
             <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
               <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter">Comparativo IA</h2>
               <div className="space-y-6">
                 <div className={`p-8 rounded-[2rem] border-2 border-dashed ${pdfEntry ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                   <label className="text-[10px] font-black uppercase text-slate-400 block mb-4">Laudo de ENTRADA (PDF)</label>
                   {pdfEntry ? <span className="text-green-700 font-bold text-xs uppercase">Arquivo OK ✓</span> : <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, setPdfEntry)} />}
                 </div>
                 <div className={`p-8 rounded-[2rem] border-2 border-dashed ${pdfExit ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                   <label className="text-[10px] font-black uppercase text-slate-400 block mb-4">Laudo de SAÍDA (PDF)</label>
                   {pdfExit ? <span className="text-green-700 font-bold text-xs uppercase">Arquivo OK ✓</span> : <input type="file" accept=".pdf" onChange={(e) => handleFileUpload(e, setPdfExit)} />}
                 </div>
                 <div className="space-y-4 pt-6 border-t">
                    <input className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase border border-slate-100" placeholder="Locador / Proprietário" value={current.clientName} onChange={(e) => updateCurrent({ clientName: e.target.value })} />
                    <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-400 px-2">Locatários / Proponentes</label>
                       {(current.tenantNames || [current.tenantName]).map((name, idx) => (
                         <div key={idx} className="flex gap-2">
                           <input 
                             className="flex-1 bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase border border-slate-100" 
                             placeholder={`Locatário ${idx + 1}`} 
                             value={name} 
                             onChange={(e) => {
                               const names = [...(current.tenantNames || [current.tenantName])];
                               names[idx] = e.target.value;
                               updateCurrent({ tenantNames: names, tenantName: names[0] });
                             }} 
                           />
                           {idx > 0 && (
                             <button onClick={() => {
                               const names = (current.tenantNames || [current.tenantName]).filter((_, i) => i !== idx);
                               updateCurrent({ tenantNames: names, tenantName: names[0] });
                             }} className="p-4 text-red-500">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                           )}
                         </div>
                       ))}
                       <button onClick={() => updateCurrent({ tenantNames: [...(current.tenantNames || [current.tenantName]), ''] })} className="text-[9px] font-black text-red-600 uppercase px-2">+ Adicionar Locatário</button>
                    </div>
                    <input className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase border border-slate-100" placeholder="Endereço Completo" value={current.address} onChange={(e) => updateCurrent({ address: e.target.value })} />
                    <textarea className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-xs h-36" placeholder="Notas do perito para foco da análise..." value={manualComparisonObs} onChange={(e) => setManualComparisonObs(e.target.value)} />
                 </div>
               </div>
               <button onClick={handleRunComparison} disabled={isBusy || !pdfEntry || !pdfExit} className="w-full mt-10 bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-xs shadow-2xl disabled:opacity-50">
                 {isBusy ? "David Oliveira Periciando..." : "Gerar Perícia David Oliveira"}
               </button>
             </div>
          </div>
        )}

        {view === 'editor' && current && (
          <div className="space-y-6 pb-40 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
              <input className="w-full text-2xl font-black border-none focus:ring-0 p-0 uppercase tracking-tighter mb-8 bg-transparent" placeholder="Endereço do Imóvel" value={current.address} onChange={(e) => updateCurrent({ address: e.target.value })} />
              <div className="grid grid-cols-2 gap-6">
                <input className="w-full bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase border-none" placeholder="Locador" value={current.clientName} onChange={(e) => updateCurrent({ clientName: e.target.value })} />
                <div className="space-y-2">
                  {(current.tenantNames || [current.tenantName]).map((name, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        className="flex-1 bg-slate-50 p-4 rounded-2xl text-[10px] font-black uppercase border-none" 
                        placeholder={`Locatário ${idx + 1}`} 
                        value={name} 
                        onChange={(e) => {
                          const names = [...(current.tenantNames || [current.tenantName])];
                          names[idx] = e.target.value;
                          updateCurrent({ tenantNames: names, tenantName: names[0] });
                        }} 
                      />
                      {idx > 0 && (
                        <button onClick={() => {
                          const names = (current.tenantNames || [current.tenantName]).filter((_, i) => i !== idx);
                          updateCurrent({ tenantNames: names, tenantName: names[0] });
                        }} className="p-4 text-red-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => updateCurrent({ tenantNames: [...(current.tenantNames || [current.tenantName]), ''] })} className="text-[9px] font-black text-red-600 uppercase px-2">+ Adicionar Locatário</button>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-50">
                <label className="text-[9px] font-black uppercase text-slate-400 px-2 block mb-2">Observações Gerais</label>
                <VoiceTranscription settings={settings} onTranscriptionComplete={handleTranscription} mode="general" />
                <textarea className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-xs h-32 mt-2" placeholder="Observações gerais do laudo..." value={current.observacoesGerais || ''} onChange={(e) => updateCurrent({ observacoesGerais: e.target.value })} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ambientes e Checklist</h3>
                <select className="bg-slate-900 text-white text-[10px] font-black px-6 py-3 rounded-2xl shadow-xl border-none cursor-pointer" onChange={(e) => e.target.value && addRoom(e.target.value)} value="">
                  <option value="" disabled>+ ADICIONAR AMBIENTE</option>
                  {COMMON_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {current.rooms.map(room => (
                <div key={room.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm group hover:border-red-500 transition-all">
                  <div className="p-6 flex justify-between items-center cursor-pointer" onClick={() => setEditingRoom(editingRoom === room.id ? null : room.id)}>
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg ${getStatusColor(room.condition)}`}>
                        {room.condition.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase text-xs">{room.customName || room.type}</h4>
                        <div className="flex gap-2 items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{room.photos.length} Fotos • {room.condition}</span>
                          {current.subtipoConstatacao === 'Reparos' && (
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${room.reparoStatus === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : room.reparoStatus === 'Parcial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                              {room.reparoStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {processingRoomId === room.id ? <span className="text-[9px] font-black text-red-600 animate-pulse">Analisando...</span> : <svg className={`w-4 h-4 text-slate-300 transition-all ${editingRoom === room.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>}
                      <button onClick={(e) => deleteRoom(room.id, e)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {editingRoom === room.id && (
                    <div className="p-8 border-t border-slate-50 space-y-8 bg-slate-50/10">
                      {current.subtipoConstatacao === 'Reparos' && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-sm">
                          <label className="text-[10px] font-black uppercase text-slate-400 block">Status do Reparo</label>
                          <div className="flex gap-2">
                            {(['Concluído', 'Parcial', 'Não Executado'] as const).map(status => (
                              <button 
                                key={status} 
                                onClick={() => updateRoom(room.id, { reparoStatus: status })}
                                className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${room.reparoStatus === status ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                          <textarea 
                            className="w-full bg-slate-50 p-4 rounded-2xl text-xs border border-slate-100 h-24" 
                            placeholder="Descreva o reparo solicitado/identificado..." 
                            value={room.reparoDescricao || ''} 
                            onChange={(e) => updateRoom(room.id, { reparoDescricao: e.target.value })} 
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-6">
                        <input className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-slate-100" placeholder="Nome do Ambiente" value={room.customName || ''} onChange={(e) => updateRoom(room.id, { customName: e.target.value })} />
                        <div className="flex gap-1.5 p-1 bg-white rounded-2xl border border-slate-100">
                          {(['Ótimo', 'Bom', 'Regular', 'Ruim'] as const).map(s => (
                            <button key={s} onClick={() => updateRoom(room.id, { condition: s })} className={`flex-1 text-[8px] font-black py-2.5 rounded-xl uppercase transition-all ${room.condition === s ? getStatusColor(s) + ' text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{s}</button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <PhotoUploader
                          currentCount={room.photos.length}
                          maxPhotos={20}
                          onPhotosAdded={(newPhotos) =>
                            updateRoom(room.id, { photos: [...room.photos, ...newPhotos] })
                          }
                        />
                        <VideoUploader 
                          videos={room.videos}
                          onVideosAdded={(newVideos) => {
                            const updatedVideos = [...room.videos, ...newVideos];
                            updateRoom(room.id, { videos: updatedVideos });
                            // Dispara análise automática após upload de vídeo
                            handleManualRoomAnalysis(room.id, updatedVideos);
                          }} 
                          onRemoveVideo={(videoId) => updateRoom(room.id, { videos: room.videos.filter(v => v.id !== videoId) })}
                        />
                      </div>

                      {/* Grade de Fotos com Edição IA e Tags */}
                      {room.photos.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {room.photos.map(photo => (
                            <div key={photo.id} className="flex flex-col gap-2">
                                <div className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md">
                                  <img src={photo.data} className="w-full h-full object-cover" />
                                  
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                                      <button 
                                        onClick={() => setEditingPhotoId(editingPhotoId === photo.id ? null : photo.id)}
                                        className="p-2 bg-white text-slate-900 rounded-full hover:bg-red-500 hover:text-white transition-all shadow-lg"
                                        title="Edição Mágica David Oliveira"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 00-3.86.517L6.05 15.21a2 2 0 00-1.183.394l-1.154.908a2.41 2.41 0 01-3.057 0l-1.154-.908a2 2 0 00-1.183-.394l-1.93-.386a6 6 0 01-3.86-.517l-.318-.158a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547l-1.154.908a2.41 2.41 0 01-3.057 0l-1.154-.908a2 2 0 00-1.183-.394" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 3l.867 2.6A1 1 0 0014.816 6.3l2.6.867a1 1 0 010 1.866l-2.6.867a1 1 0 00-.949.633L13 13.134l-.867-2.6a1 1 0 00-.949-.633l-2.6-.867a1 1 0 010-1.866l2.6-.867a1 1 0 00.949-.633L13 3z" />
                                        </svg>
                                      </button>
                                      <button onClick={() => updateRoom(room.id, { photos: room.photos.filter(p => p.id !== photo.id) })} className="p-2 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all shadow-lg">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                  </div>

                                  {isEditingIA && editingPhotoId === photo.id && (
                                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-30">
                                      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                                      <span className="text-[8px] font-black text-white uppercase tracking-widest">Processando IA...</span>
                                    </div>
                                  )}

                                  {editingPhotoId === photo.id && !isEditingIA && (
                                    <div className="absolute inset-0 bg-white/95 p-3 flex flex-col justify-center gap-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                                      <p className="text-[8px] font-black uppercase text-slate-400">Edição Mágica Pericial</p>
                                      <textarea 
                                        autoFocus
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px] h-16 resize-none focus:ring-1 focus:ring-red-500 outline-none"
                                        placeholder='Ex: "Remova a mancha", "Destaque a trinca"'
                                        value={iaPrompt}
                                        onChange={(e) => setIaPrompt(e.target.value)}
                                      />
                                      <div className="flex gap-1">
                                          <button 
                                            disabled={!iaPrompt}
                                            onClick={() => handleEditImageIA(room.id, photo.id)}
                                            className="flex-1 bg-red-600 text-white text-[9px] font-black uppercase py-2 rounded-lg"
                                          >
                                            Aplicar
                                          </button>
                                          <button 
                                            onClick={() => { setEditingPhotoId(null); setIaPrompt(''); }}
                                            className="bg-slate-200 text-slate-700 text-[9px] font-black uppercase px-2 rounded-lg"
                                          >
                                            X
                                          </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <input 
                                  className="w-full text-[8px] font-black uppercase bg-transparent border-b border-slate-100 focus:border-red-500 outline-none p-1 text-slate-400"
                                  placeholder="TAG DO ITEM"
                                  value={photo.label || ''}
                                  onChange={(e) => {
                                    const updatedPhotos = room.photos.map(p => p.id === photo.id ? { ...p, label: e.target.value } : p);
                                    updateRoom(room.id, { photos: updatedPhotos });
                                  }}
                                />
                            </div>
                          ))}
                        </div>
                      )}

                      {room.videos.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Vídeos salvos
                            </p>
                            <span className="text-[9px] font-bold text-slate-400">
                              {room.videos.length} vídeo(s)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {room.videos.map((video, index) => (
                              <div
                                key={video.id}
                                className="bg-white border border-slate-100 rounded-[1.5rem] overflow-hidden shadow-sm"
                              >
                                <video
                                  src={video.data}
                                  controls
                                  preload="metadata"
                                  className="w-full h-56 object-cover bg-slate-900"
                                />

                                <div className="p-4 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase text-slate-700 truncate">
                                      {((video as any).name) || ((video as any).fileName) || `Vídeo ${index + 1}`}
                                    </p>
                                    <p className="text-[9px] text-slate-400">
                                      {((video as any).duration ? `${Math.round((video as any).duration)}s` : 'Sem duração')}
                                      {((video as any).size ? ` • ${Math.round((((video as any).size / 1024 / 1024) * 10)) / 10} MB` : '')}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateRoom(room.id, {
                                        videos: room.videos.filter(v => v.id !== video.id),
                                      })
                                    }
                                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all"
                                    title="Excluir vídeo"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex gap-3 bg-slate-900 p-2.5 rounded-2xl shadow-xl items-center">
                           <VoiceTranscription settings={settings} onTranscriptionComplete={(text, dest) => handleTranscription(text, dest)} mode="room" />
                           <button 
                             onClick={() => handleManualRoomAnalysis(room.id)} 
                             disabled={processingRoomId === room.id} 
                             className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${processingRoomId === room.id ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                           >
                             {processingRoomId === room.id ? 'Analisando...' : 'Análise IA David Oliveira'}
                           </button>
                        </div>
                        
                        {analysisError && processingRoomId === room.id && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Erro na Análise Técnica</p>
                              <p className="text-[9px] text-red-500 font-bold mt-0.5">{analysisError}</p>
                            </div>
                          </div>
                        )}

                        <textarea className="w-full bg-white p-6 rounded-[2rem] border border-slate-100 text-xs h-64 leading-relaxed font-medium outline-none focus:ring-4 focus:ring-red-50 transition-all" placeholder="A IA David Oliveira gerará o laudo técnico..." value={room.description} onChange={(e) => updateRoom(room.id, { description: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent no-print pointer-events-none z-40">
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 pointer-events-auto">
                <button
                  onClick={handleSaveDraft}
                  className="bg-slate-200 text-slate-700 py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Salvar Rascunho
                </button>

                <button
                  onClick={handleCompleteInspection}
                  className="bg-slate-900 text-white py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all"
                >
                  Gerar Laudo
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'report' && current && (
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl mb-24 animate-in zoom-in-95 duration-700">
            <div className="mb-10 no-print flex justify-between items-center">
              <button onClick={() => setView(current.type === 'Comparação' ? 'comparison' : 'editor')} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
              <button onClick={() => window.print()} className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-colors">Imprimir PDF</button>
            </div>
            <InspectionReport inspection={current} />
          </div>
        )}
      </main>

      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-10 animate-in fade-in duration-500">
          <div className="bg-white p-16 rounded-[4rem] max-w-sm w-full text-center shadow-2xl border border-red-50">
            <div className="w-24 h-24 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-10"></div>
            <h3 className="font-black text-slate-900 uppercase text-xl mb-4 tracking-tighter">David Oliveira AI</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed tracking-widest">Processando mídias e comparando perícias...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
