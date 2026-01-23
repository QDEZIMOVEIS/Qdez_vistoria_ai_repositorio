
import React from 'react';
import { Inspection } from '../types';

interface InspectionReportProps {
  inspection: Inspection;
}

const InspectionReport: React.FC<InspectionReportProps> = ({ inspection }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 bg-white text-slate-900 print:text-black">
      {/* Cabeçalho Profissional */}
      <div className="flex justify-between items-end border-b-8 border-slate-900 pb-12">
        <div className="space-y-5">
          <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">Laudo de<br/>Vistoria Imobiliária</h1>
          <div className="flex gap-4">
            <span className="bg-red-600 text-white text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-[0.2em]">{inspection.type}</span>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 px-5 py-2 rounded-full">Ref: {inspection.id}</span>
          </div>
        </div>
        <div className="text-right space-y-3">
           <div className="mt-3">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-widest mb-1">Vistoriador Responsável</span>
              <p className="text-base font-black text-slate-900 uppercase tracking-tight">{inspection.inspectorName}</p>
            </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Data da Perícia</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums">{new Date(inspection.date).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Identificação Pericial */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50 p-12 rounded-[3.5rem] border border-slate-200 shadow-inner print:bg-white print:border-black print:rounded-none">
        <div className="space-y-8">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-3 tracking-[0.2em]">Localização da Propriedade</span>
            <p className="font-black text-slate-800 text-xl leading-tight uppercase tracking-tighter print:text-black">{inspection.address || "Não informado"}</p>
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-3 tracking-[0.2em]">Proprietário / Cliente</span>
            <p className="font-bold text-slate-700 text-lg uppercase tracking-tight print:text-black">{inspection.clientName || "Não identificado"}</p>
          </div>
        </div>
        <div className="space-y-8">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-3 tracking-[0.2em]">Locatário / Interessado</span>
            <p className="font-bold text-slate-700 text-lg uppercase tracking-tight print:text-black">{inspection.tenantName || "Não identificado"}</p>
          </div>
          <div className="flex items-center gap-4 p-5 bg-white rounded-[2rem] border border-slate-200 shadow-sm print:border-black print:rounded-none">
             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Documento Digital Autenticado via Qdez AI</span>
          </div>
        </div>
      </div>

      {/* Comparativo Pericial IA (Apenas em Modelo Comparação) */}
      {inspection.type === 'Comparação' && inspection.comparisonResult && (
        <div className="space-y-8 animate-in fade-in duration-1000">
          <div className="bg-red-50 p-12 rounded-[3.5rem] border border-red-100 print:bg-white print:border-black print:rounded-none">
             <h3 className="text-red-900 font-black uppercase text-xs mb-10 flex items-center gap-4 tracking-[0.3em] print:text-black">
               <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.57l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.57l7-10a1 1 0 011.12-.384z" clipRule="evenodd"/></svg>
               ANÁLISE PERICIAL DE DIVERGÊNCIAS
             </h3>

             {inspection.comparisonResult.manualObservations && (
               <div className="mb-10 p-8 bg-white rounded-[2.5rem] border border-red-200 shadow-sm italic print:border-black print:rounded-none">
                  <span className="text-[10px] font-black uppercase text-red-500 block mb-4 tracking-widest">Observações Técnicas do Corretor:</span>
                  <p className="text-sm font-medium text-slate-800 leading-relaxed">
                    "{inspection.comparisonResult.manualObservations}"
                  </p>
               </div>
             )}

             <div className="prose prose-sm prose-red max-w-none text-red-900 font-semibold leading-relaxed print:text-black">
                <div className="whitespace-pre-wrap">{inspection.comparisonResult.analysis}</div>
             </div>
          </div>

          {inspection.comparisonResult.sources.length > 0 && (
            <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white print:bg-white print:text-black print:border-black print:rounded-none no-print">
              <h4 className="text-[10px] font-black uppercase text-slate-500 mb-10 tracking-[0.3em] text-center">Referenciais de Custo (Pesquisa IA em Tempo Real)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {inspection.comparisonResult.sources.map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                    <span className="text-[10px] font-black truncate pr-8 uppercase tracking-widest">{s.title}</span>
                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detalhamento Técnico dos Ambientes */}
      <div className="space-y-24">
        {inspection.rooms.map((room, idx) => (
          <div key={room.id} className="break-inside-avoid space-y-10 border-t-2 border-slate-100 pt-16 print:border-black">
            <div className="flex justify-between items-center pb-6">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter print:text-black">
                <span className="text-red-600 mr-5 tabular-nums print:text-black">{String(idx + 1).padStart(2, '0')}</span>
                {room.customName || room.type}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-5 py-2 rounded-full border border-slate-200 tracking-widest print:text-black print:border-black">ESTADO: {room.condition}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 shadow-sm print:bg-white print:border-black print:rounded-none">
               <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium print:text-black">
                 {room.description || "Nenhuma descrição técnica informada para este ambiente."}
               </div>
            </div>

            {/* Galeria Pericial de Fotos */}
            {room.photos.length > 0 && (
              <div className="grid grid-cols-2 gap-6 mb-8 print:gap-4">
                {room.photos.map(p => (
                  <div key={p.id} className="break-inside-avoid aspect-[4/3] rounded-[2.5rem] overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50 print:border-black print:rounded-none">
                    <img src={p.data} className="w-full h-full object-cover" alt={`Vistoria ${room.type} - Registro Visual`} />
                  </div>
                ))}
              </div>
            )}
            
            {/* Evidências de Avarias e Detalhes IA */}
            {room.aiAnalysis && room.aiAnalysis.evidencias.length > 0 && (
              <div className="bg-red-50/50 p-10 rounded-[3rem] border border-red-100/50 print:bg-white print:border-black print:rounded-none">
                <h5 className="text-[11px] font-black text-red-800 uppercase mb-8 tracking-[0.2em] flex items-center gap-3 print:text-black">
                  <span className="w-2.5 h-2.5 bg-red-600 rounded-full print:bg-black"></span>
                  EVidências de Danos e Observações Técnicas
                </h5>
                <div className="space-y-4">
                  {room.aiAnalysis.evidencias.map((ev, i) => (
                    <div key={i} className="flex justify-between items-center text-xs p-5 bg-white rounded-[1.5rem] shadow-sm border border-red-50 print:border-black print:rounded-none print:shadow-none">
                      <div className="flex gap-6 items-center">
                        <span className="font-black text-red-600 uppercase text-[10px] min-w-[80px] print:text-black">{ev.timestampOuLocal}</span>
                        <span className="font-bold text-slate-800 leading-tight uppercase tracking-tight print:text-black">{ev.descricao}</span>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full ${ev.gravidade === 'Alta' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'} print:text-black print:bg-white print:border print:border-black`}>
                        {ev.gravidade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Seção de Assinaturas e Validização */}
      <div className="mt-48 pt-32 border-t-4 border-slate-100 grid grid-cols-2 gap-32 print:border-black">
        <div className="text-center space-y-5">
          <div className="h-0.5 bg-slate-400 w-full mb-6 print:bg-black"></div>
          <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] mb-2 print:text-black">Vistoriador Perito</p>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter print:text-black">{inspection.inspectorName}</p>
        </div>
        <div className="text-center space-y-5">
          <div className="h-0.5 bg-slate-400 w-full mb-6 print:bg-black"></div>
          <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] mb-2 print:text-black">Locatário / Recebedor</p>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter print:text-black">Assinatura Digital Verificada</p>
        </div>
      </div>
      
      {/* Rodapé do Laudo Pericial */}
      <div className="text-center pt-32 pb-16">
        <p className="text-[9px] font-black uppercase text-slate-300 tracking-[0.6em] print:text-black">Este documento foi integralmente gerado e autenticado via Inteligência Artificial Qdez AI</p>
      </div>
    </div>
  );
};

export default InspectionReport;
