
import React, { useState, useEffect } from 'react';
import { Inspection, Room, Photo, Video, COMMON_ROOMS } from './types';
import PhotoUploader from './components/PhotoUploader';
import VideoUploader from './components/VideoUploader';
import InspectionReport from './components/InspectionReport';
import { analyzeRoomWithAI } from './services/geminiService';

const App: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [currentInspection, setCurrentInspection] = useState<Inspection | null>(null);
  const [view, setView] = useState<'list' | 'editor' | 'report'>('list');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('vistorias_pro_data');
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        setInspections(parsedData);
      } catch (e) { console.error(e); }
    }
  }, []);

  const saveToLocalStorage = (data: Inspection[]) => {
    localStorage.setItem('vistorias_pro_data', JSON.stringify(data));
  };

  const createNewInspection = () => {
    const newInspection: Inspection = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      clientName: '',
      tenants: [''],
      ownerName: '',
      type: 'Entrada',
      address: '',
      generalRemarks: '',
      date: new Date().toISOString(),
      rooms: [],
      status: 'draft'
    };
    setCurrentInspection(newInspection);
    setView('editor');
  };

  const addRoom = (type: string) => {
    if (!currentInspection) return;
    const newRoom: Room = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      description: '',
      photos: [],
      videos: [],
      condition: 'Bom'
    };
    setCurrentInspection({
      ...currentInspection,
      rooms: [...currentInspection.rooms, newRoom]
    });
    setEditingRoomId(newRoom.id);
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    if (!currentInspection) return;
    setCurrentInspection({
      ...currentInspection,
      rooms: currentInspection.rooms.map(r => r.id === roomId ? { ...r, ...updates } : r)
    });
  };

  const deleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentInspection) return;
    if (window.confirm("Confirmar exclusão deste ambiente?")) {
        setCurrentInspection(prev => {
            if (!prev) return null;
            return {
                ...prev,
                rooms: prev.rooms.filter(r => r.id !== roomId)
            };
        });
        if (editingRoomId === roomId) {
            setEditingRoomId(null);
        }
    }
  };

  const handleAIAnalysis = async (room: Room) => {
    if (room.photos.length === 0 && room.videos.length === 0) {
      alert("Adicione mídia para análise.");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzeRoomWithAI(room.customName || room.type, room.photos, room.videos, room.description);
      updateRoom(room.id, { description: result });
    } catch (err) {
      alert("Erro na análise inteligente.");
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleTenantChange = (index: number, value: string) => {
    if (!currentInspection) return;
    const newTenants = [...currentInspection.tenants];
    newTenants[index] = value;
    setCurrentInspection({ ...currentInspection, tenants: newTenants });
  };

  const addTenant = () => {
    if (!currentInspection) return;
    setCurrentInspection({ ...currentInspection, tenants: [...currentInspection.tenants, ''] });
  };

  const removeTenant = (index: number) => {
    if (!currentInspection || currentInspection.tenants.length <= 1) return;
    const newTenants = currentInspection.tenants.filter((_, i) => i !== index);
    setCurrentInspection({ ...currentInspection, tenants: newTenants });
  };

  const saveDraft = () => {
    if (!currentInspection) return;
    setIsSavingDraft(true);
    const updatedInspections = [...inspections];
    const index = updatedInspections.findIndex(i => i.id === currentInspection.id);
    const draftInspection = { ...currentInspection, status: 'draft' as const };
    
    if (index !== -1) {
      updatedInspections[index] = draftInspection;
    } else {
      updatedInspections.unshift(draftInspection);
    }
    
    setInspections(updatedInspections);
    saveToLocalStorage(updatedInspections);

    setTimeout(() => {
      setIsSavingDraft(false);
    }, 2000);
  };

  const saveInspection = () => {
    if (!currentInspection) return;
    const updatedInspections = [...inspections];
    const index = updatedInspections.findIndex(i => i.id === currentInspection.id);
    
    const finalInspection = { ...currentInspection, status: 'completed' as const };
    
    if (index !== -1) updatedInspections[index] = finalInspection;
    else updatedInspections.unshift(finalInspection);
    
    setInspections(updatedInspections);
    saveToLocalStorage(updatedInspections);
    setView('list');
    setCurrentInspection(null);
  };

  const handleDownloadPdf = () => {
    if (!(window as any).html2pdf || !currentInspection) return;
    setIsGeneratingPdf(true);
    
    const element = document.getElementById('report-content');
    if (!element) {
        console.error("Elemento do relatório não encontrado");
        setIsGeneratingPdf(false);
        return;
    }

    const opt = {
      margin:       [10, 5, 10, 5],
      filename:     `laudo-vistoria-${currentInspection.id}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    (window as any).html2pdf().set(opt).from(element).save().then(() => {
      setIsGeneratingPdf(false);
    }).catch((err: any) => {
        console.error("Erro ao gerar PDF:", err);
        setIsGeneratingPdf(false);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col no-select print:block">
      <header className="bg-slate-900 border-b border-red-700/30 sticky top-0 z-30 no-print">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3" onClick={() => { setView('list'); setCurrentInspection(null); }}>
             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-inner">
                <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                  <circle cx="50" cy="50" r="45" fill="#be1e2d" />
                  <path d="M25 50L50 30L75 50V75H25V50Z" fill="white" />
                </svg>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-black uppercase text-sm tracking-tighter">Qdez Imóveis</h1>
              <p className="text-[8px] text-red-500 font-bold uppercase tracking-widest">CRECI 34.873 J</p>
            </div>
          </div>
          
          {view === 'list' && (
            <button onClick={createNewInspection} className="bg-red-700 text-white px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 shadow-lg shadow-red-900/20 active:scale-95 transition-all">
              + Novo Laudo
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-grow print:p-0 print:max-w-full">
        {view === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {inspections.length === 0 ? (
              <div className="col-span-full py-20 text-center opacity-50">
                <p className="font-black uppercase text-xs tracking-[0.3em] text-slate-400">Nenhum laudo encontrado</p>
              </div>
            ) : (
              inspections.map(ins => (
                <div key={ins.id} className="bg-white rounded-[2rem] border border-slate-200/60 p-6 hover:shadow-xl transition-all cursor-pointer group active:bg-slate-50" onClick={() => { setCurrentInspection(ins); setView('editor'); }}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">{ins.rooms.length} Ambientes</span>
                        {ins.status === 'draft' && (
                            <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">Rascunho</span>
                        )}
                    </div>
                    <span className="text-[9px] font-black text-slate-300">#{ins.id}</span>
                  </div>
                  <h3 className="font-black uppercase truncate text-slate-800 leading-tight">{ins.address || 'Local não informado'}</h3>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(ins.date).toLocaleDateString()}</span>
                    <button onClick={(e) => { e.stopPropagation(); setCurrentInspection(ins); setView('report'); }} className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-red-700 transition-colors shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"/></svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : view === 'editor' && currentInspection ? (
          <div className="space-y-6 pb-32">
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-6 md:p-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Endereço Completo</label>
                  <input type="text" className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 font-bold text-slate-700 placeholder:text-slate-300" placeholder="Ex: Av. Paulista, 1000 - Ap 52" value={currentInspection.address} onChange={(e) => setCurrentInspection({ ...currentInspection, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Finalidade</label>
                  <select className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 font-bold text-slate-700 appearance-none" value={currentInspection.type} onChange={(e) => setCurrentInspection({ ...currentInspection, type: e.target.value as any })}>
                    <option value="Entrada">Vistoria de Entrada</option>
                    <option value="Saída">Vistoria de Saída</option>
                    <option value="Constatação">Vistoria de Constatação</option>
                  </select>
                </div>
                 <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Proprietário / Locador</label>
                  <input type="text" className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 font-bold text-slate-700 placeholder:text-slate-300" placeholder="Nome do proprietário" value={currentInspection.ownerName} onChange={(e) => setCurrentInspection({ ...currentInspection, ownerName: e.target.value })} />
                </div>
              </div>
              <div className="pt-5 mt-5 border-t border-slate-100 space-y-4">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Locatários / Interessados</label>
                 {currentInspection.tenants.map((tenant, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        className="flex-grow px-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 font-bold text-slate-700 placeholder:text-slate-300" 
                        placeholder={`Nome do locatário ${index + 1}`} 
                        value={tenant} 
                        onChange={(e) => handleTenantChange(index, e.target.value)} 
                      />
                      {currentInspection.tenants.length > 1 && (
                        <button onClick={() => removeTenant(index)} className="w-10 h-10 flex-shrink-0 bg-red-50 text-red-500 rounded-full flex items-center justify-center font-black text-lg active:bg-red-100 transition-colors">&times;</button>
                      )}
                    </div>
                 ))}
                 <button onClick={addTenant} className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-4 py-2.5 rounded-xl hover:bg-slate-200 transition-all">+ Adicionar outro locatário</button>
              </div>
               <div className="pt-5 mt-5 border-t border-slate-100 space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Observações Gerais do Laudo</label>
                  <textarea className="w-full h-24 px-6 py-4 bg-slate-50 rounded-2xl border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 font-medium text-slate-600 text-sm" placeholder="Detalhes importantes sobre a vistoria, chaves, medidores, etc." value={currentInspection.generalRemarks} onChange={(e) => setCurrentInspection({ ...currentInspection, generalRemarks: e.target.value })} />
                </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Ambientes do Imóvel</h2>
                <div className="relative">
                  <select className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all appearance-none pr-10" value="" onChange={(e) => e.target.value === 'custom' ? addRoom('Ambiente Extra') : addRoom(e.target.value)}>
                    <option value="" disabled>+ Adicionar</option>
                    {COMMON_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                    <option value="custom" className="text-red-500">+ Outro...</option>
                  </select>
                </div>
              </div>

              {currentInspection.rooms.map(room => (
                <div key={room.id} className="bg-white rounded-[2rem] border border-slate-200/50 overflow-hidden shadow-sm transition-all">
                  <div className="p-6 flex justify-between items-center cursor-pointer active:bg-slate-50" onClick={() => setEditingRoomId(editingRoomId === room.id ? null : room.id)}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${room.photos.length > 0 || room.videos.length > 0 ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'bg-slate-100 text-slate-400'}`}>
                        {room.videos.length > 0 ? (
                           <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z"/></svg>
                        ) : (
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black uppercase text-slate-800 text-sm">{room.customName || room.type}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{room.photos.length} Fotos • {room.videos.length} Vídeos</p>
                      </div>
                    </div>
                    <svg className={`w-5 h-5 text-slate-300 transition-transform ${editingRoomId === room.id ? 'rotate-180 text-red-600' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                  </div>

                  {editingRoomId === room.id && (
                    <div className="px-6 pb-8 space-y-6 bg-slate-50/20 border-t border-slate-50 pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Galeria de Fotos</label>
                          <div className="grid grid-cols-3 gap-2">
                            {room.photos.map(p => (
                              <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group">
                                <img src={p.data} className="w-full h-full object-cover" />
                                <button onClick={() => updateRoom(room.id, { photos: room.photos.filter(x => x.id !== p.id) })} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
                              </div>
                            ))}
                            <PhotoUploader onPhotosAdded={(newP) => updateRoom(room.id, { photos: [...room.photos, ...newP] })} />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Filmagem (Análise IA)</label>
                          <div className="grid grid-cols-3 gap-2">
                            {room.videos.map(v => (
                              <div key={v.id} className="relative aspect-square rounded-xl overflow-hidden shadow-md bg-black group">
                                <img src={v.thumbnail} className="w-full h-full object-cover opacity-60" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <svg className="w-6 h-6 text-white/80" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                                </div>
                                <button onClick={() => updateRoom(room.id, { videos: room.videos.filter(x => x.id !== v.id) })} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg></button>
                              </div>
                            ))}
                            <VideoUploader onVideosAdded={(newV) => updateRoom(room.id, { videos: [...room.videos, ...newV] })} />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição Técnica</label>
                          <button onClick={() => handleAIAnalysis(room)} disabled={isAnalyzing} className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg active:scale-95 ${isAnalyzing ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-red-500 hover:bg-slate-800 shadow-slate-900/10'}`}>
                            <svg className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                            {isAnalyzing ? 'Processando Mídia...' : 'Auto-Descrever com IA'}
                          </button>
                        </div>
                        <textarea className="w-full h-32 px-5 py-4 bg-white rounded-2xl ring-1 ring-slate-100 focus:ring-2 focus:ring-red-600 text-xs leading-relaxed font-medium text-slate-600" placeholder="A IA preencherá aqui após analisar seus vídeos e fotos..." value={room.description} onChange={(e) => updateRoom(room.id, { description: e.target.value })} />
                      </div>

                      <div className="flex justify-between items-center pt-2">
                         <button type="button" onClick={(e) => deleteRoom(room.id, e)} className="text-[9px] font-black text-red-600 uppercase bg-red-50 px-4 py-2.5 rounded-xl hover:bg-red-100 transition-all">Excluir Ambiente</button>
                         <div className="flex gap-3">
                            {['Novo', 'Bom', 'Regular', 'Ruim'].map(cond => (
                              <button key={cond} onClick={() => updateRoom(room.id, { condition: cond as any })} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${room.condition === cond ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{cond}</button>
                            ))}
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-40">
              <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-3.5 rounded-[2.5rem] shadow-2xl flex gap-3">
                  <button onClick={saveDraft} disabled={isSavingDraft} className="flex-1 px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 active:bg-slate-700 transition-colors disabled:bg-slate-600">
                    {isSavingDraft ? 'Salvo!' : 'Salvar Rascunho'}
                  </button>
                  <button onClick={saveInspection} className="flex-1 px-8 py-4 bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 shadow-xl active:scale-95 transition-all">Finalizar Laudo</button>
              </div>
            </div>
          </div>
        ) : view === 'report' && currentInspection ? (
           <>
            <InspectionReport inspection={currentInspection} />
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-40 no-print">
              <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-3.5 rounded-[2.5rem] shadow-2xl flex gap-3">
                  <button onClick={() => setView('editor')} className="flex-1 px-6 py-4 bg-slate-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 active:bg-slate-600 transition-colors">Voltar à Edição</button>
                  <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="flex-1 px-8 py-4 bg-red-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 shadow-xl active:scale-95 transition-all disabled:bg-slate-500 disabled:cursor-not-allowed">
                    {isGeneratingPdf ? 'Gerando...' : 'Salvar PDF'}
                  </button>
                   <button onClick={handlePrint} type="button" title="Imprimir Laudo" className="px-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 active:bg-slate-700 transition-colors">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                   </button>
              </div>
            </div>
           </>
        ) : null}
      </main>

      {view === 'list' && (
        <footer className="text-center py-12 text-slate-400 text-[9px] font-bold uppercase tracking-[0.4em] opacity-40">
          <p>Qdez Imóveis Profissional</p>
        </footer>
      )}
    </div>
  );
};

export default App;
