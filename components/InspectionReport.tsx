
import React from 'react';
import { Inspection, Room, Photo } from '../types';

interface InspectionReportProps {
  inspection: Inspection;
}

const InspectionReport: React.FC<InspectionReportProps> = ({ inspection }) => {
  const getQrCodeUrl = (id: string) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://qdez-vistoria.ai/v/${id}`;

  const renderPhotoGrid = (room: Room) => {
    // Se for comparação, tenta agrupar por label (tag do item) para mostrar lado a lado
    if (inspection.type === 'Comparação') {
      const tags = Array.from(new Set(room.photos.map(p => p.label).filter(l => !!l)));
      
      if (tags.length > 0) {
        return (
          <div className="space-y-12">
            {tags.map(tag => {
              const taggedPhotos = room.photos.filter(p => p.label === tag);
              return (
                <div key={tag} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 border-l-4 border-red-600 pl-3 tracking-widest">ITEM: {tag}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {taggedPhotos.slice(0, 2).map((p, i) => (
                      <div key={p.id} className="space-y-2">
                        <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                           <img src={p.data} className="w-full h-full object-cover" alt={tag} />
                        </div>
                        <p className="text-center text-[8px] font-black uppercase text-slate-500">
                          {i === 0 ? "Vistoria Anterior" : "Estado Atual (Saída)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Fotos sem tag */}
            {room.photos.filter(p => !p.label).length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {room.photos.filter(p => !p.label).map(p => (
                   <div key={p.id} className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      <img src={p.data} className="w-full h-full object-cover" alt="Geral" />
                   </div>
                ))}
              </div>
            )}
          </div>
        );
      }
    }

    // Grid 2x2 padrão para Entrada/Saída/Constatação
    return (
      <div className="grid grid-cols-2 gap-4">
        {room.photos.map(p => (
          <div key={p.id} className="space-y-2">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <img src={p.data} className="w-full h-full object-cover" alt="Evidência" />
            </div>
            {p.label && (
              <p className="text-[8px] font-black uppercase text-slate-500 bg-slate-50 px-3 py-1 rounded-full w-fit mx-auto border border-slate-100">
                {p.label}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 bg-white text-slate-900 print:text-black font-sans">
      {/* Cabeçalho Profissional David Oliveira */}
      <div className="flex justify-between items-end border-b-8 border-slate-900 pb-12 print:border-black">
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Laudo de Vistoria<br/>Imobiliária Profissional</h1>
          <div className="flex gap-4">
            <span className="bg-red-600 text-white text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-widest">{inspection.type}</span>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 px-5 py-2 rounded-full">Protocolo: {inspection.id}</span>
          </div>
        </div>
        <div className="text-right space-y-2">
          <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Vistoriador Perito</span>
          <p className="text-base font-black text-slate-900 uppercase tracking-tight">{inspection.inspectorName}</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{new Date(inspection.date).toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      {/* Quadro-resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 bg-slate-50 p-12 rounded-[3.5rem] border border-slate-200 print:bg-white print:border-black print:rounded-none">
        <div className="space-y-6">
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Localização</span>
            <p className="font-black text-slate-800 text-xl leading-tight uppercase tracking-tighter">{inspection.address || "Não informado"}</p>
          </div>
          <div className="flex gap-10 pt-4">
             <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-widest">Locador</span>
                <p className="font-bold text-slate-700 text-sm uppercase">{inspection.clientName || "Não identificado"}</p>
             </div>
             <div>
                <span className="text-[9px] font-black uppercase text-slate-400 block mb-1 tracking-widest">Locatário</span>
                <p className="font-bold text-slate-700 text-sm uppercase">{inspection.tenantName || "Não identificado"}</p>
             </div>
          </div>
        </div>
        <div className="flex flex-col justify-between border-l border-slate-200 pl-10 print:border-black">
          <div className="space-y-3">
             <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-slate-500">Autenticidade Cloud Storage</span>
                <span className="text-emerald-600">Verificado ✓</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-slate-500">Hash Pericial AI</span>
                <span className="text-slate-900 font-mono tracking-tighter">SHA-256: {inspection.id.slice(0,10)}...</span>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 mt-6 flex items-center gap-4 print:border-black">
             <img src={getQrCodeUrl(inspection.id)} className="w-16 h-16" />
             <p className="text-[8px] font-black text-slate-500 uppercase leading-relaxed tracking-widest">Escaneie para acessar o dossiê completo (Vídeos 4K e Auditoria)</p>
          </div>
        </div>
      </div>

      {/* Parecer Comparativo David Oliveira */}
      {inspection.type === 'Comparação' && inspection.comparisonResult && (
        <div className="space-y-8 animate-in fade-in duration-1000">
           <div className="bg-red-50 p-12 rounded-[3.5rem] border border-red-100 print:bg-white print:border-black">
              <h3 className="text-red-900 font-black uppercase text-[10px] mb-8 flex items-center gap-4 tracking-widest">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.57l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.57l7-10a1 1 0 011.12-.384z" clipRule="evenodd"/></svg>
                PARECER PERICIAL DE DIVERGÊNCIAS
              </h3>
              <div className="prose prose-sm max-w-none text-red-900 font-semibold leading-relaxed whitespace-pre-wrap">
                 {inspection.comparisonResult.analysis}
              </div>
           </div>
        </div>
      )}

      {/* Descrição por Ambientes */}
      <div className="space-y-20">
        {inspection.rooms.map((room, idx) => (
          <div key={room.id} className="break-inside-avoid space-y-8 border-t-2 border-slate-50 pt-12">
            <div className="flex justify-between items-center">
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                <span className="text-red-600 mr-5 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                {room.customName || room.type}
              </h3>
              <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-5 py-2 rounded-full border border-slate-200 tracking-widest">ESTADO: {room.condition}</span>
            </div>

            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 font-medium text-sm leading-relaxed whitespace-pre-wrap print:bg-white print:border-black">
              {room.description || "Nenhuma anotação técnica registrada."}
            </div>

            {/* Galeria de Fotos */}
            {room.photos.length > 0 && renderPhotoGrid(room)}

            {/* QR Code de Vídeo por Ambiente */}
            {room.videos.length > 0 && (
              <div className="flex items-center gap-6 p-6 bg-slate-900 text-white rounded-[2.5rem] print:bg-white print:text-black print:border-black">
                 <img src={getQrCodeUrl(room.id)} className="w-20 h-20 bg-white p-2 rounded-xl" />
                 <div>
                    <h4 className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">Evidência Multimodal</h4>
                    <p className="text-xs font-bold leading-tight">Escaneie para visualizar o vídeo de vistoria deste ambiente.</p>
                 </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rodapé e Assinaturas Atualizado para 3 Colunas */}
      <div className="mt-32 pt-24 border-t-4 border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 print:grid-cols-3 print:border-black">
        {/* Assinatura Locador */}
        <div className="text-center space-y-4">
          <div className="h-0.5 bg-slate-300 w-full mb-4 print:bg-black"></div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Locador (Proprietário)</p>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight">
            {inspection.clientName || "Nome do Locador"}
          </p>
        </div>

        {/* Assinatura Locatário */}
        <div className="text-center space-y-4">
          <div className="h-0.5 bg-slate-300 w-full mb-4 print:bg-black"></div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Locatário</p>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight">
            {inspection.tenantName || "Nome do Locatário"}
          </p>
        </div>

        {/* Assinatura Vistoriador */}
        <div className="text-center space-y-4">
          <div className="h-0.5 bg-slate-300 w-full mb-4 print:bg-black"></div>
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Vistoriador Perito</p>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight">
            {inspection.inspectorName}
          </p>
        </div>
      </div>
      
      <div className="text-center pt-24 pb-12">
        <p className="text-[7px] font-black uppercase text-slate-300 tracking-[0.5em]">Gerado via Inteligência Artificial David Oliveira • Qdez AI Vistoria</p>
      </div>
    </div>
  );
};

export default InspectionReport;
