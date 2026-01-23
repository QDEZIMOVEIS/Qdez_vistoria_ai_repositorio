
import React from 'react';
import { Inspection } from '../types';

interface InspectionReportProps {
  inspection: Inspection;
}

const InspectionReport: React.FC<InspectionReportProps> = ({ inspection }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Cabeçalho do Laudo */}
      <div className="flex justify-between items-end border-b-4 border-slate-900 pb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Relatório de<br/>Vistoria Imobiliária</h1>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{inspection.type}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código: {inspection.id}</span>
            </div>
            <div className="mt-2">
              <span className="text-[10px] font-black uppercase text-slate-400">Vistoriador:</span>
              <p className="text-xs font-black text-slate-900 uppercase">{inspection.inspectorName}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Data da Vistoria</p>
          <p className="text-xl font-black text-slate-900 tabular-nums">{new Date(inspection.date).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Dados Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
        <div className="space-y-4">
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Proprietário</span>
            <p className="font-bold text-slate-800 text-lg">{inspection.clientName || "Não Informado"}</p>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Endereço do Imóvel</span>
            <p className="font-bold text-slate-800 leading-tight">{inspection.address || "Endereço não preenchido"}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Locatário / Interessado</span>
            <p className="font-bold text-slate-800 text-lg">{inspection.tenantName || "Não Informado"}</p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200">
             <div className="w-2 h-2 bg-green-500 rounded-full"></div>
             <span className="text-[10px] font-black uppercase text-slate-600">Documento Gerado via Qdez AI</span>
          </div>
        </div>
      </div>

      {/* Comparação IA se existir */}
      {inspection.type === 'Comparação' && inspection.comparisonResult && (
        <div className="space-y-6">
          <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 shadow-sm">
             <h3 className="text-red-900 font-black uppercase text-xs mb-6 flex items-center gap-2 tracking-widest">
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45 0l-7 7a1 1 0 000 1.414l7 7a1 1 0 001.45 0l8-8a1 1 0 000-1.414l-8-8zm-1.414 1.414L3.414 11l6.586 6.586L17.586 10 10.981 3.967z" clipRule="evenodd"/></svg>
               Análise Técnica de Divergências
             </h3>

             {inspection.comparisonResult.manualObservations && (
               <div className="mb-6 p-4 bg-white rounded-2xl border border-red-200">
                  <span className="text-[9px] font-black uppercase text-red-500 block mb-2">Observações Adicionais do Vistoriador:</span>
                  <p className="text-xs font-bold text-slate-800 italic leading-relaxed">
                    "{inspection.comparisonResult.manualObservations}"
                  </p>
               </div>
             )}

             <div className="prose prose-sm prose-red max-w-none text-red-900/80 leading-relaxed font-medium">
                <div className="whitespace-pre-wrap">{inspection.comparisonResult.analysis}</div>
             </div>
          </div>

          {inspection.comparisonResult.sources.length > 0 && (
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
              <h4 className="text-[9px] font-black uppercase text-slate-500 mb-6 tracking-widest">Fontes de Preço e Materiais (Google Search)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {inspection.comparisonResult.sources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <span className="text-xs font-bold truncate pr-4">{s.title}</span>
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ambientes */}
      <div className="space-y-16">
        {inspection.rooms.map((room, idx) => (
          <div key={room.id} className="break-inside-avoid border-t-2 border-slate-100 pt-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                <span className="text-red-600 mr-3">{String(idx + 1).padStart(2, '0')}</span>
                {room.customName || room.type}
              </h3>
              <div className="flex gap-2">
                <span className="text-[9px] font-black uppercase text-slate-400 px-3 py-1 bg-slate-100 rounded-full">Estado: {room.condition}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8">
               <p className="text-xs text-slate-700 leading-relaxed italic whitespace-pre-wrap">{room.description || "Sem observações detalhadas para este ambiente."}</p>
            </div>

            {room.photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {room.photos.map(p => (
                  <div key={p.id} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                    <img src={p.data} className="w-full h-full object-cover" alt="Evidência Fotográfica" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
            
            {room.aiAnalysis && room.aiAnalysis.evidencias.length > 0 && (
              <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100">
                <h5 className="text-[10px] font-black text-red-700 uppercase mb-4 tracking-widest">Danos Detectados</h5>
                <div className="space-y-2">
                  {room.aiAnalysis.evidencias.map((ev, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-3 bg-white rounded-xl shadow-sm border border-red-50">
                      <div className="flex gap-4 items-center">
                        <span className="font-black text-red-600 tabular-nums">{ev.timestampInicio}</span>
                        <span className="font-bold text-slate-800">{ev.descricao}</span>
                      </div>
                      <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-red-100 text-red-700 rounded-lg">{ev.gravidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Assinaturas */}
      <div className="mt-32 pt-20 border-t-2 border-slate-100 grid grid-cols-2 gap-20">
        <div className="text-center space-y-4">
          <div className="h-px bg-slate-300 w-full mx-auto"></div>
          <p className="text-[10px] font-black uppercase text-slate-400">Vistoriador Responsável</p>
          <p className="text-[8px] font-black uppercase text-slate-900">{inspection.inspectorName}</p>
        </div>
        <div className="text-center space-y-4">
          <div className="h-px bg-slate-300 w-full mx-auto"></div>
          <p className="text-[10px] font-black uppercase text-slate-400">Locatário / Interessado</p>
        </div>
      </div>
    </div>
  );
};

export default InspectionReport;
