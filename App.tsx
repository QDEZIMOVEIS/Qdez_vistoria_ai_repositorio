
import React, { useState, useEffect, useMemo } from 'react';
import localforage from 'localforage';
import { Inspection, Room, COMMON_ROOMS, Photo, Video } from './types';
import PhotoUploader from './components/PhotoUploader';
import VideoUploader from './components/VideoUploader';
import VoiceTranscription from './components/VoiceTranscription';
import InspectionReport from './components/InspectionReport';
import { performComparisonAI, analyzeRoomMediaAI } from './services/geminiService';

const DEFAULT_INSPECTOR = "David Oliveira - Creci 84926-F";

const App: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [current, setCurrent] = useState<Inspection | null>(null);
  const [view, setView] = useState<'list' | 'editor' | 'report' | 'comparison'>('list');
  const [isBusy, setIsBusy] = useState(false);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [pdfEntry, setPdfEntry] = useState<string | null>(null);
  const [pdfExit, setPdfExit] = useState<string | null>(null);
  const [manualComparisonObs, setManualComparisonObs] = useState('');

  useEffect(() => {
    localforage.getItem<Inspection[]>('qdez_rascunhos').then(data => {
      if (data) setInspections(data);
    });
  }, []);

  useEffect(() => {
    if (inspections.length > 0) {
      localforage.setItem('qdez_rascunhos', inspections);
    }
  }, [inspections]);

  const saveToGlobalList = (updatedIns: Inspection) => {
    setInspections(prev => {
      const filtered = prev.filter(i => i.id !== updatedIns.id);
      return [updatedIns, ...filtered];
    });
    setLastSaved(new Date().toLocaleTimeString());
  };

  const updateCurrent = (updates: Partial<Inspection>) => {
    if (!current) return;
    const updated = { ...current, ...updates };
    setCurrent(updated);
    saveToGlobalList(updated);
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    if (!current) return;
    const updatedRooms = current.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r);
    const updatedIns = { ...current, rooms: updatedRooms };
    setCurrent(updatedIns);
    saveToGlobalList(updatedIns);
  };

  const handleMediaAnalysis = async (roomId: string, photos: Photo[], videos: Video[]) => {
    if (!current) return;
    const room = current.rooms.find(r => r.id === roomId);
    if (!room) return;

    setProcessingRoomId(roomId);
    
    try {
      const mediaToAnalyze = [
        ...photos.map(p => ({ data: p.data, mimeType: p.mimeType })),
        ...videos.map(v => ({ data: v.data, mimeType: v.mimeType }))
      ];

      const analysisItems = mediaToAnalyze.slice(-10); 

      const result = await analyzeRoomMediaAI(room.customName || room.type, analysisItems);
      
      if (result) {
        const itemsText = result.itensIdentificados
          .map((i: any) => `- ${i.item}: ${i.estado}${i.detalhes ? ` (${i.detalhes})` : ''}`)
          .join('\n');

        const newDesc = `${result.descricaoGeral}\n\nITENS:\n${itemsText}`;

        updateRoom(roomId, { 
          description: newDesc,
          condition: result.estadoConservacao,
          aiAnalysis: {
            itens: result.itensIdentificados,
            evidencias: result.evidenciasDanos.map((ev: any) => ({
              timestampInicio: ev.timestampOuLocal || 'Local',
              descricao: ev.descricao,
              gravidade: ev.gravidade
            }))
          }
        });
      }
    } catch (error) {
      console.error("Erro na análise automática:", error);
    } finally {
      setProcessingRoomId(null);
    }
  };

  const addRoom = (type: string) => {
    if (!current) return;
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      description: '',
      photos: [],
      videos: [],
      condition: 'Bom'
    };
    const updated = { ...current, rooms: [...current.rooms, newRoom] };
    setCurrent(updated);
    saveToGlobalList(updated);
    setEditingRoom(newRoom.id);
  };

  const getStatusColor = (status: Room['condition']) => {
    switch (status) {
      case 'Ótimo': return 'bg-green-600';
      case 'Bom': return 'bg-blue-600';
      case 'Regular': return 'bg-amber-500';
      case 'Ruim': return 'bg-red-600';
      default: return 'bg-slate-400';
    }
  };

  const startNew = (type: Inspection['type'] = 'Entrada') => {
    const id = 'VST-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    const newIns: Inspection = {
      id,
      clientName: '',
      tenantName: '',
      inspectorName: DEFAULT_INSPECTOR,
      type,
      address: '',
      date: new Date().toISOString(),
      rooms: [],
      status: 'draft'
    };

    if (type === 'Comparação') {
      setCurrent(newIns);
      setPdfEntry(null);
      setPdfExit(null);
      setManualComparisonObs('');
      setView('comparison');
      return;
    }

    setCurrent(newIns);
    saveToGlobalList(newIns);
    setView('editor');
  };

  const roomSummary = useMemo(() => {
    if (!current) return null;
    const counts: Record<string, number> = { Ótimo: 0, Bom: 0, Regular: 0, Ruim: 0 };
    current.rooms.forEach(r => {
      counts[r.condition]++;
    });
    return counts;
  }, [current]);

  const handleRunComparison = async () => {
    if (!pdfEntry || !pdfExit || !current) return;
    setIsBusy(true);
    try {
      const res = await performComparisonAI(pdfEntry, pdfExit, manualComparisonObs);
      const updatedComparisonResult = {
        ...res,
        manualObservations: manualComparisonObs
      };
      
      const updatedCurrent = { 
        ...current, 
        comparisonResult: updatedComparisonResult, 
        status: 'completed' as const 
      };
      
      setCurrent(updatedCurrent);
      saveToGlobalList(updatedCurrent);
      setView('report');
    } catch(e) { 
      alert("Erro na comparação pericial. Verifique os arquivos PDF."); 
    } finally { 
      setIsBusy(false); 
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
          <div className="flex gap-2">
            <button onClick={() => startNew('Comparação')} className="bg-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-600">Comparar PDFs</button>
            <button onClick={() => startNew()} className="bg-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-red-700">+ Nova Vistoria</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 w-full flex-1">
        {view === 'list' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Em Andamento</h2>
              <div className="grid gap-4">
                {inspections.filter(i => i.status === 'draft').length === 0 ? (
                  <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center">
                    <p className="text-slate-400 font-bold uppercase text-[10px]">Sem vistorias ativas</p>
                    <button onClick={() => startNew()} className="mt-4 text-red-600 font-black text-xs uppercase">Começar Agora</button>
                  </div>
                ) : (
                  inspections.filter(i => i.status === 'draft').map(ins => (
                    <div key={ins.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center hover:border-red-500 transition-all cursor-pointer group" onClick={() => { setCurrent(ins); setView(ins.type === 'Comparação' ? 'comparison' : 'editor'); }}>
                      <div>
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[9px] font-black uppercase text-red-600">{ins.type}</span>
                          <span className="text-[9px] font-bold text-slate-400">#{ins.id}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 group-hover:text-red-600 transition-colors">{ins.address || 'Endereço Pendente'}</h3>
                        <p className="text-[10px] text-slate-500 font-medium">Locatário: {ins.tenantName || 'Não informado'}</p>
                      </div>
                      <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-colors">
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {view === 'editor' && current && (
          <div className="space-y-6 pb-40 animate-in fade-in duration-300">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
              <div className="flex justify-between items-start mb-6">
                <input 
                  className="flex-1 text-2xl font-black border-none focus:ring-0 p-0 placeholder:text-slate-200 bg-transparent" 
                  placeholder="Endereço Completo do Imóvel" 
                  value={current.address} 
                  onChange={(e) => updateCurrent({ address: e.target.value })} 
                />
                {lastSaved && <span className="text-[8px] font-black text-slate-300 uppercase bg-slate-50 px-2 py-1 rounded-full">Salvo {lastSaved}</span>}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Proprietário / Cliente</label>
                  <input className="w-full bg-slate-50 p-3.5 rounded-2xl text-sm font-bold border-none ring-0 focus:bg-white focus:ring-1 focus:ring-red-100 transition-all" value={current.clientName} onChange={(e) => updateCurrent({ clientName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Locatário / Interessado</label>
                  <input className="w-full bg-slate-50 p-3.5 rounded-2xl text-sm font-bold border-none ring-0 focus:bg-white focus:ring-1 focus:ring-red-100 transition-all" value={current.tenantName} onChange={(e) => updateCurrent({ tenantName: e.target.value })} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Vistoriador Responsável</label>
                  <input className="w-full bg-slate-100 p-3.5 rounded-2xl text-xs font-bold border-none cursor-default" readOnly value={current.inspectorName} />
                </div>
              </div>
            </div>

            {current.rooms.length > 0 && roomSummary && (
              <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Estado Geral do Imóvel</h4>
                <div className="flex h-3 rounded-full overflow-hidden mb-6 shadow-inner bg-slate-100">
                  {Object.entries(roomSummary).map(([key, count]) => (
                    (count as number) > 0 && (
                      <div 
                        key={key} 
                        className={`${getStatusColor(key as any)} h-full transition-all duration-700`} 
                        style={{ width: `${((count as number) / current.rooms.length) * 100}%` }}
                      ></div>
                    )
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(roomSummary).map(([key, count]) => (
                    <div key={key} className="flex flex-col items-center">
                      <span className={`w-2 h-2 rounded-full mb-1 ${getStatusColor(key as any)}`}></span>
                      <span className="text-[8px] font-black uppercase text-slate-800">{(count as number)} {key}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between items-center px-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ambientes</h3>
                <select 
                  className="bg-slate-900 text-white text-[10px] font-black px-5 py-2.5 rounded-2xl shadow-xl border-none ring-0"
                  onChange={(e) => e.target.value && addRoom(e.target.value)}
                  value=""
                >
                  <option value="" disabled>+ ADICIONAR CÔMODO</option>
                  {COMMON_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {current.rooms.map(room => (
                <div key={room.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="p-6 flex justify-between items-center cursor-pointer" onClick={() => setEditingRoom(editingRoom === room.id ? null : room.id)}>
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center text-white font-black shadow-lg transform transition-transform group-hover:scale-105 ${getStatusColor(room.condition)}`}>
                         {room.condition.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-slate-800 uppercase text-xs tracking-tight">{room.customName || room.type}</h4>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(room.condition)}`}></span>
                        </div>
                        <div className="flex gap-3 mt-1.5">
                           <span className="text-[8px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">{room.photos.length} Fotos</span>
                           <span className="text-[8px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">{room.videos.length} Vídeos</span>
                        </div>
                      </div>
                    </div>
                    {processingRoomId === room.id ? (
                      <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 animate-pulse">
                         <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                         <span className="text-[9px] font-black text-red-600 uppercase">IA Analisando...</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors">
                        <svg className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${editingRoom === room.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    )}
                  </div>

                  {editingRoom === room.id && (
                    <div className="p-8 border-t border-slate-50 space-y-8 bg-slate-50/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome Customizado</label>
                          <input className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-slate-200 shadow-sm focus:ring-2 focus:ring-red-100 outline-none" value={room.customName} onChange={(e) => updateRoom(room.id, { customName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Estado</label>
                          <div className="flex gap-1.5">
                            {(['Ótimo', 'Bom', 'Regular', 'Ruim'] as const).map(s => (
                              <button key={s} onClick={() => updateRoom(room.id, { condition: s })} className={`flex-1 text-[8px] font-black py-3 rounded-xl uppercase transition-all ${room.condition === s ? getStatusColor(s) + ' text-white shadow-lg scale-105' : 'bg-white text-slate-400 border border-slate-200'}`}>{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <PhotoUploader 
                          onPhotosAdded={(newPhotos) => {
                            const updatedPhotos = [...room.photos, ...newPhotos];
                            updateRoom(room.id, { photos: updatedPhotos });
                            handleMediaAnalysis(room.id, updatedPhotos, room.videos);
                          }} 
                        />
                        <VideoUploader 
                          onVideosAdded={(newVideos) => {
                            const updatedVideos = [...room.videos, ...newVideos];
                            updateRoom(room.id, { videos: updatedVideos });
                            handleMediaAnalysis(room.id, room.photos, updatedVideos);
                          }} 
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Descrição Técnica (IA Automática)</label>
                          <VoiceTranscription onTranscriptionComplete={(text) => updateRoom(room.id, { description: (room.description + '\n' + text).trim() })} />
                        </div>
                        <textarea 
                          className="w-full bg-white p-6 rounded-[2rem] border border-slate-200 text-xs h-48 leading-relaxed focus:ring-4 focus:ring-red-50 outline-none transition-all shadow-inner" 
                          placeholder="Aguardando análise de mídias..." 
                          value={room.description} 
                          onChange={(e) => updateRoom(room.id, { description: e.target.value })} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent no-print pointer-events-none">
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 pointer-events-auto">
                <button onClick={() => setView('list')} className="bg-slate-200 text-slate-700 py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-transform">Salvar e Sair</button>
                <button onClick={() => { updateCurrent({ status: 'completed' }); setView('report'); }} className="bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-transform">Finalizar Laudo</button>
              </div>
            </div>
          </div>
        )}

        {view === 'report' && current && (
          <div className="bg-white p-12 rounded-[3rem] shadow-2xl mb-24 animate-in zoom-in-95 duration-500">
            <div className="mb-10 no-print flex justify-between items-center">
              <button onClick={() => setView(current.type === 'Comparação' ? 'comparison' : 'editor')} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
              <button onClick={() => window.print()} className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-colors">Imprimir Laudo</button>
            </div>
            <InspectionReport inspection={current} />
          </div>
        )}

        {view === 'comparison' && current && (
          <div className="max-w-xl mx-auto space-y-6 pt-10 pb-40">
             <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
               <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">Comparativo de Laudos</h2>
               <p className="text-[10px] text-slate-400 font-bold uppercase mb-8">Análise Pericial de Entrada vs. Saída</p>
               
               <div className="space-y-4">
                 <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 group hover:border-red-400 transition-colors">
                   <label className="text-[9px] font-black uppercase text-slate-400 block mb-3">Laudo de Entrada (PDF)</label>
                   <input type="file" accept=".pdf" onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onload = (ev) => setPdfEntry((ev.target?.result as string).split(',')[1]);
                       reader.readAsDataURL(file);
                     }
                   }} className="text-xs font-bold" />
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 group hover:border-red-400 transition-colors">
                   <label className="text-[9px] font-black uppercase text-slate-400 block mb-3">Laudo de Saída (PDF)</label>
                   <input type="file" accept=".pdf" onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onload = (ev) => setPdfExit((ev.target?.result as string).split(',')[1]);
                       reader.readAsDataURL(file);
                     }
                   }} className="text-xs font-bold" />
                 </div>

                 <div className="space-y-2 mt-4">
                   <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Minhas Observações do Perito</label>
                   <textarea 
                     className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs h-32 leading-relaxed focus:ring-4 focus:ring-red-50 outline-none transition-all"
                     placeholder="Aponte danos específicos que você notou..."
                     value={manualComparisonObs}
                     onChange={(e) => setManualComparisonObs(e.target.value)}
                   />
                 </div>
               </div>

               <button 
                 onClick={handleRunComparison}
                 disabled={isBusy || !pdfEntry || !pdfExit}
                 className="w-full mt-8 bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-xs tracking-widest disabled:opacity-50 shadow-2xl active:scale-95 transition-all"
               >
                 {isBusy ? "Periciando Documentos..." : "Iniciar Comparação com IA"}
               </button>
               
               <button onClick={() => setView('list')} className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
             </div>
          </div>
        )}
      </main>

      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-10">
          <div className="bg-white p-12 rounded-[3.5rem] max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
            <h3 className="font-black text-slate-900 uppercase text-lg mb-3">Análise Pericial</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed tracking-widest">David Oliveira (IA) está cruzando os dados dos laudos e buscando custos de reparo...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
