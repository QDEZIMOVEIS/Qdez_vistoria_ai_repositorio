
import React, { useState, useEffect, useMemo } from 'react';
import localforage from 'localforage';
import { Inspection, Room, COMMON_ROOMS, Photo, Video, AppSettings } from './types';
import PhotoUploader from './components/PhotoUploader';
import VideoUploader from './components/VideoUploader';
import VoiceTranscription from './components/VoiceTranscription';
import InspectionReport from './components/InspectionReport';
import { performComparisonAI, analyzeRoomMediaAI } from './services/geminiService';

const DEFAULT_INSPECTOR = "David Oliveira - Creci 84926-F";
const DEFAULT_SETTINGS: AppSettings = {
  detailLevel: 'Normal',
  defaultSeverity: 'Média',
  tone: 'Técnico'
};

const App: React.FC = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [current, setCurrent] = useState<Inspection | null>(null);
  const [view, setView] = useState<'list' | 'editor' | 'report' | 'comparison' | 'type_selector' | 'settings'>('list');
  const [isBusy, setIsBusy] = useState(false);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [pdfEntry, setPdfEntry] = useState<string | null>(null);
  const [pdfExit, setPdfExit] = useState<string | null>(null);
  const [manualComparisonObs, setManualComparisonObs] = useState('');

  // Carregar vistorias e configurações ao iniciar
  useEffect(() => {
    Promise.all([
      localforage.getItem<Inspection[]>('qdez_rascunhos'),
      localforage.getItem<AppSettings>('qdez_settings')
    ]).then(([storedInspections, storedSettings]) => {
      if (storedInspections) setInspections(storedInspections);
      if (storedSettings) setSettings(storedSettings);
      setIsLoaded(true);
    });
  }, []);

  // Persistência automática
  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('qdez_rascunhos', inspections);
      localforage.setItem('qdez_settings', settings);
    }
  }, [inspections, settings, isLoaded]);

  // Calculate room summary based on current inspection rooms to fix "Cannot find name 'roomSummary'" error
  const roomSummary = useMemo(() => {
    if (!current || current.rooms.length === 0) return null;
    const summary = {
      'Ótimo': 0,
      'Bom': 0,
      'Regular': 0,
      'Ruim': 0
    };
    current.rooms.forEach(room => {
      summary[room.condition]++;
    });
    return summary;
  }, [current?.rooms]);

  const saveToGlobalList = (updatedIns: Inspection) => {
    setInspections(prev => {
      const filtered = prev.filter(i => i.id !== updatedIns.id);
      return [updatedIns, ...filtered];
    });
    setLastSaved(new Date().toLocaleTimeString());
  };

  const deleteInspection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmDelete = window.confirm("ATENÇÃO: Deseja realmente excluir esta vistoria? Esta ação é permanente.");
    
    if (confirmDelete) {
      setInspections(prev => prev.filter(ins => ins.id !== id));
      if (current?.id === id) {
        setCurrent(null);
        setView('list');
      }
    }
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

  const handleManualRoomAnalysis = async (roomId: string) => {
    if (!current) return;
    const room = current.rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.photos.length === 0 && room.videos.length === 0) {
      alert("Por favor, adicione fotos ou vídeos antes de iniciar a análise por IA.");
      return;
    }

    setProcessingRoomId(roomId);
    
    try {
      const mediaToAnalyze = [
        ...room.photos.map(p => ({ data: p.data, mimeType: p.mimeType })),
        ...room.videos.map(v => ({ data: v.data, mimeType: v.mimeType }))
      ];

      const result = await analyzeRoomMediaAI(
        room.customName || room.type, 
        current.type, 
        mediaToAnalyze.slice(-10),
        settings
      );
      
      if (result) {
        const itemsText = result.itensIdentificados
          .map((i: any) => `- ${i.item}: ${i.estado}. ${i.detalhes}`)
          .join('\n');

        const newDesc = `${result.descricaoGeral}\n\nITENS IDENTIFICADOS:\n${itemsText}`;

        updateRoom(roomId, { 
          description: newDesc,
          condition: result.estadoConservacao,
          aiAnalysis: {
            itens: result.itensIdentificados,
            evidencias: result.evidenciasDanos.map((ev: any) => ({
              timestampInicio: ev.timestampOuLocal || 'Localizado',
              descricao: ev.descricao,
              gravidade: ev.gravidade
            }))
          }
        });
      }
    } catch (error) {
      console.error("Erro na análise IA:", error);
      alert("Não foi possível completar a análise IA deste ambiente. Tente novamente.");
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

  const startNewSequence = () => {
    setView('type_selector');
  };

  const confirmNewInspection = (type: Inspection['type']) => {
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

    setCurrent(newIns);
    saveToGlobalList(newIns);

    if (type === 'Comparação') {
      setView('comparison');
    } else {
      setView('editor');
    }
  };

  const handleRunComparison = async () => {
    if (!pdfEntry || !pdfExit || !current) return;
    setIsBusy(true);
    try {
      const res = await performComparisonAI(pdfEntry, pdfExit, settings, manualComparisonObs);
      const updatedComparisonResult = {
        ...res,
        manualObservations: manualComparisonObs
      };
      
      const updatedCurrent = { 
        ...current, 
        comparisonResult: updatedComparisonResult, 
        status: 'completed' as const,
        date: new Date().toISOString()
      };
      
      setCurrent(updatedCurrent);
      saveToGlobalList(updatedCurrent);
      setView('report');
    } catch(e) { 
      alert("Erro na comparação pericial. Verifique se os PDFs são válidos."); 
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
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setView('settings')} 
              className={`p-2 rounded-xl transition-colors ${view === 'settings' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="Configurações da IA"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button onClick={startNewSequence} className="bg-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-red-700 transition-colors shadow-lg">+ Nova Vistoria</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 w-full flex-1">
        {view === 'settings' && (
          <div className="max-w-xl mx-auto py-10 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Parâmetros David Oliveira</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personalize o comportamento da IA</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Nível de Detalhe */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Nível de Detalhamento Técnico</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {(['Conciso', 'Normal', 'Muito Detalhado'] as const).map(option => (
                      <button 
                        key={option}
                        onClick={() => setSettings(s => ({ ...s, detailLevel: option }))}
                        className={`py-3 text-[9px] font-black uppercase rounded-xl transition-all ${settings.detailLevel === option ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-slate-400 font-medium px-1">"Muito Detalhado" aumentará o rigor com texturas e marcas de uso leves.</p>
                </div>

                {/* Gravidade Padrão */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Gravidade Sugerida (Danos Ambíguos)</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {(['Baixa', 'Média', 'Alta'] as const).map(option => (
                      <button 
                        key={option}
                        onClick={() => setSettings(s => ({ ...s, defaultSeverity: option }))}
                        className={`py-3 text-[9px] font-black uppercase rounded-xl transition-all ${settings.defaultSeverity === option ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tom de Voz */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Tom da Redação</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {(['Técnico', 'Formal', 'Direto'] as const).map(option => (
                      <button 
                        key={option}
                        onClick={() => setSettings(s => ({ ...s, tone: option }))}
                        className={`py-3 text-[9px] font-black uppercase rounded-xl transition-all ${settings.tone === option ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-100 flex gap-4">
                <button 
                  onClick={() => setView('list')} 
                  className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                >
                  Salvar e Voltar
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Relatórios Ativos</h2>
              <div className="grid gap-4">
                {!isLoaded ? (
                   <div className="p-20 text-center text-slate-300 font-black uppercase text-[10px] animate-pulse">Carregando Banco de Dados...</div>
                ) : (inspections.filter(i => i.status === 'draft').length === 0 ? (
                  <div className="p-16 border-2 border-dashed border-slate-200 rounded-[3rem] text-center bg-white/50">
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Inicie um novo laudo profissional</p>
                    <button onClick={startNewSequence} className="mt-4 text-red-600 font-black text-xs uppercase hover:underline">Criar Vistoria</button>
                  </div>
                ) : (
                  inspections.filter(i => i.status === 'draft').map(ins => (
                    <div key={ins.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex justify-between items-center hover:border-red-500 transition-all cursor-pointer group" onClick={() => { setCurrent(ins); setView(ins.type === 'Comparação' ? 'comparison' : 'editor'); }}>
                      <div className="flex-1">
                        <div className="flex gap-2 items-center mb-1">
                          <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{ins.type}</span>
                          <span className="text-[9px] font-bold text-slate-400">#{ins.id}</span>
                        </div>
                        <h3 className="font-bold text-slate-800 group-hover:text-red-600 transition-colors">{ins.address || 'Endereço Pendente'}</h3>
                        <p className="text-[10px] text-slate-500 font-medium">Locatário: {ins.tenantName || 'Não informado'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => deleteInspection(ins.id, e)}
                          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-50 text-slate-300 hover:text-red-600 transition-all active:scale-90"
                          title="Excluir Vistoria"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-red-50 transition-colors">
                          <svg className="w-5 h-5 text-slate-300 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"/></svg>
                        </div>
                      </div>
                    </div>
                  ))
                ))}
              </div>
            </section>
          </div>
        )}

        {view === 'type_selector' && (
          <div className="max-w-md mx-auto pt-20 animate-in zoom-in-95 duration-300">
            <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Novo Relatório</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Selecione o modelo do laudo</p>
              
              <div className="grid gap-3">
                <button onClick={() => confirmNewInspection('Entrada')} className="p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 group-hover:text-red-600 uppercase text-xs">Vistoria de Entrada</span>
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Laudo inicial de entrega de imóvel</span>
                </button>
                <button onClick={() => confirmNewInspection('Saída')} className="p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 group-hover:text-red-600 uppercase text-xs">Vistoria de Saída</span>
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Verificação para encerramento de contrato</span>
                </button>
                <button onClick={() => confirmNewInspection('Constatação')} className="p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 transition-all text-left group">
                  <span className="block font-black text-slate-800 group-hover:text-red-600 uppercase text-xs">Constatação de Imóvel</span>
                  <span className="text-[9px] font-medium text-slate-400 uppercase">Registro fiel da situação atual</span>
                </button>
              </div>
              
              <button onClick={() => setView('list')} className="mt-8 text-[10px] font-black text-slate-300 uppercase hover:text-slate-500">Voltar para lista</button>
            </div>
          </div>
        )}

        {view === 'editor' && current && (
          <div className="space-y-6 pb-40 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
              <div className="flex justify-between items-start mb-6">
                <input 
                  className="flex-1 text-2xl font-black border-none focus:ring-0 p-0 placeholder:text-slate-200 bg-transparent uppercase tracking-tighter" 
                  placeholder="Endereço do Imóvel" 
                  value={current.address} 
                  onChange={(e) => updateCurrent({ address: e.target.value })} 
                />
                {lastSaved && <span className="text-[8px] font-black text-slate-300 uppercase bg-slate-50 px-2 py-1 rounded-full">Salvo {lastSaved}</span>}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Proprietário / Cliente</label>
                  <input className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold border-none" value={current.clientName} onChange={(e) => updateCurrent({ clientName: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Locatário / Interessado</label>
                  <input className="w-full bg-slate-50 p-4 rounded-2xl text-xs font-bold border-none" value={current.tenantName} onChange={(e) => updateCurrent({ tenantName: e.target.value })} />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Vistoriador Responsável</label>
                  <input className="w-full bg-slate-100 p-4 rounded-2xl text-[10px] font-black border-none text-slate-500 cursor-not-allowed" readOnly value={current.inspectorName} />
                </div>
              </div>
            </div>

            {current.rooms.length > 0 && roomSummary && (
              <div className="bg-white px-8 py-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Estado Geral da Propriedade</h4>
                <div className="flex h-2.5 rounded-full overflow-hidden mb-6 shadow-inner bg-slate-100 max-w-sm mx-auto">
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
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Checklist por Ambientes</h3>
                <select 
                  className="bg-slate-900 text-white text-[10px] font-black px-5 py-2.5 rounded-2xl shadow-xl border-none ring-0 appearance-none text-center hover:scale-105 transition-transform"
                  onChange={(e) => e.target.value && addRoom(e.target.value)}
                  value=""
                >
                  <option value="" disabled>+ NOVO AMBIENTE</option>
                  {COMMON_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {current.rooms.map(room => (
                <div key={room.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className="p-6 flex justify-between items-center cursor-pointer" onClick={() => setEditingRoom(editingRoom === room.id ? null : room.id)}>
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg transform transition-transform group-hover:scale-105 ${getStatusColor(room.condition)}`}>
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
                         <span className="text-[9px] font-black text-red-600 uppercase tracking-tighter">Periciando...</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors">
                        <svg className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${editingRoom === room.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    )}
                  </div>

                  {editingRoom === room.id && (
                    <div className="p-8 border-t border-slate-50 space-y-8 bg-slate-50/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Nome Personalizado</label>
                          <input className="w-full bg-white p-4 rounded-2xl text-xs font-bold border border-slate-200 shadow-sm focus:ring-2 focus:ring-red-100 outline-none" value={room.customName} onChange={(e) => updateRoom(room.id, { customName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">Estado Sugerido</label>
                          <div className="flex gap-1.5">
                            {(['Ótimo', 'Bom', 'Regular', 'Ruim'] as const).map(s => (
                              <button key={s} onClick={() => updateRoom(room.id, { condition: s })} className={`flex-1 text-[8px] font-black py-3 rounded-xl uppercase transition-all ${room.condition === s ? getStatusColor(s) + ' text-white shadow-lg scale-105' : 'bg-white text-slate-400 border border-slate-200 hover:border-red-300'}`}>{s}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <PhotoUploader onPhotosAdded={(newPhotos) => updateRoom(room.id, { photos: [...room.photos, ...newPhotos] })} />
                        <VideoUploader onVideosAdded={(newVideos) => updateRoom(room.id, { videos: [...room.videos, ...newVideos] })} />
                      </div>

                      {room.photos.length > 0 && (
                        <div className="grid grid-cols-5 gap-3">
                          {room.photos.map(photo => (
                            <div key={photo.id} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md">
                               <img src={photo.data} className="w-full h-full object-cover" />
                               <button onClick={() => updateRoom(room.id, { photos: room.photos.filter(p => p.id !== photo.id) })} className="absolute top-1.5 right-1.5 bg-red-600 text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg>
                               </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-2xl shadow-xl">
                          <div className="flex gap-3">
                             <VoiceTranscription settings={settings} onTranscriptionComplete={(text) => updateRoom(room.id, { description: (room.description + '\n' + text).trim() })} />
                             <button 
                               onClick={() => handleManualRoomAnalysis(room.id)}
                               disabled={processingRoomId === room.id}
                               className="flex items-center gap-2.5 px-5 py-2.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 hover:bg-red-700"
                             >
                               <svg className={`w-4 h-4 ${processingRoomId === room.id ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                               Análise Técnica IA
                             </button>
                          </div>
                        </div>
                        <textarea 
                          className="w-full bg-white p-6 rounded-[2rem] border border-slate-200 text-xs h-64 leading-relaxed focus:ring-4 focus:ring-red-50 outline-none transition-all shadow-inner font-medium text-slate-700" 
                          placeholder="A IA David Oliveira gerará uma descrição detalhada seguindo suas configurações de detalhamento e tom..." 
                          value={room.description} 
                          onChange={(e) => updateRoom(room.id, { description: e.target.value })} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent no-print pointer-events-none z-40">
              <div className="max-w-md mx-auto grid grid-cols-2 gap-4 pointer-events-auto">
                <button onClick={() => setView('list')} className="bg-slate-200 text-slate-700 py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-transform">Pausar e Salvar</button>
                <button onClick={() => { updateCurrent({ status: 'completed', date: new Date().toISOString() }); setView('report'); }} className="bg-slate-900 text-white py-5 rounded-[2.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95 transition-transform">Finalizar e Gerar Laudo</button>
              </div>
            </div>
          </div>
        )}

        {view === 'report' && current && (
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl mb-24 animate-in zoom-in-95 duration-700">
            <div className="mb-10 no-print flex justify-between items-center">
              <button onClick={() => setView(current.type === 'Comparação' ? 'comparison' : 'editor')} className="bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar ao Editor</button>
              <button onClick={() => window.print()} className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-red-700 transition-colors">Imprimir Laudo PDF</button>
            </div>
            <InspectionReport inspection={current} />
          </div>
        )}

        {view === 'comparison' && current && (
          <div className="max-w-xl mx-auto space-y-6 pt-10 pb-40 animate-in fade-in duration-500">
             <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
               <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Comparativo IA</h2>
               <p className="text-[10px] text-slate-400 font-bold uppercase mb-10 tracking-[0.2em]">Análise Pericial de Divergências</p>
               
               <div className="space-y-5">
                 <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 group hover:border-red-400 transition-colors cursor-pointer relative">
                   <label className="text-[10px] font-black uppercase text-slate-400 block mb-4">Laudo de ENTRADA (PDF)</label>
                   <input type="file" accept=".pdf" onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onload = (ev) => setPdfEntry((ev.target?.result as string).split(',')[1]);
                       reader.readAsDataURL(file);
                     }
                   }} className="text-xs font-bold w-full" />
                 </div>
                 <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 group hover:border-red-400 transition-colors cursor-pointer">
                   <label className="text-[10px] font-black uppercase text-slate-400 block mb-4">Laudo de SAÍDA (PDF)</label>
                   <input type="file" accept=".pdf" onChange={(e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onload = (ev) => setPdfExit((ev.target?.result as string).split(',')[1]);
                       reader.readAsDataURL(file);
                     }
                   }} className="text-xs font-bold w-full" />
                 </div>

                 <div className="space-y-3 mt-6">
                   <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observações Manuais do Perito</label>
                   <textarea 
                     className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-200 text-xs h-36 leading-relaxed focus:ring-4 focus:ring-red-50 outline-none transition-all shadow-inner font-medium"
                     placeholder="Aponte danos específicos, faltas de chaves ou detalhes periciais..."
                     value={manualComparisonObs}
                     onChange={(e) => setManualComparisonObs(e.target.value)}
                   />
                 </div>
               </div>

               <button 
                 onClick={handleRunComparison}
                 disabled={isBusy || !pdfEntry || !pdfExit}
                 className="w-full mt-10 bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] disabled:opacity-50 shadow-2xl active:scale-95 transition-all hover:bg-slate-800"
               >
                 {isBusy ? "David Oliveira Analisando..." : "Iniciar Comparação Pericial IA"}
               </button>
               
               <button onClick={() => setView('list')} className="w-full mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Voltar para lista</button>
             </div>
          </div>
        )}
      </main>

      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-10 animate-in fade-in duration-500">
          <div className="bg-white p-16 rounded-[4rem] max-w-sm w-full text-center shadow-[0_0_120px_rgba(220,38,38,0.15)] border border-red-50">
            <div className="w-24 h-24 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-10 shadow-inner"></div>
            <h3 className="font-black text-slate-900 uppercase text-xl mb-4 tracking-tighter">Perícia David Oliveira</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase leading-relaxed tracking-[0.2em]">Consultando parâmetros personalizados e cruzando dados visuais...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
