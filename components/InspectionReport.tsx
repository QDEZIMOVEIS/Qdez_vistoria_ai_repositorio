
import React from 'react';
import { Inspection } from '../types';

interface InspectionReportProps {
  inspection: Inspection;
}

const InspectionReport: React.FC<InspectionReportProps> = ({ inspection }) => {
  return (
    <div id="report-content" className="bg-white p-8 max-w-4xl mx-auto shadow-sm print:shadow-none print:p-0">
      {/* Cabeçalho Profissional */}
      <div className="border-b-4 border-red-700 pb-6 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="w-24 flex-shrink-0">
            {/* Logo Vetorial Q.DEZ (Estilo aproximado) */}
            <svg viewBox="0 0 200 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* O "Q" estilizado vermelho */}
              <circle cx="40" cy="50" r="35" fill="#be1e2d" />
              <path d="M25 55L40 40L55 55V75H25V55Z" fill="white" /> {/* Casa negativa */}
              <circle cx="40" cy="50" r="10" fill="#be1e2d" /> {/* Centro */}
              
              {/* Texto Q.DEZ */}
              <text x="85" y="55" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="38" fill="#6d6e71">Q.DEZ</text>
              <circle cx="123" cy="55" r="4" fill="#be1e2d" /> {/* Ponto vermelho no texto */}
              
              {/* Texto IMÓVEIS */}
              <text x="85" y="75" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="14" fill="#6d6259" letterSpacing="0.2em">IMÓVEIS</text>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Qdez Imóveis</h1>
            <p className="text-red-700 font-bold text-xs uppercase tracking-widest">CRECI 34.873 J</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 font-medium">
          <p className="text-slate-900 font-bold mb-1 uppercase">LAUDO DE VISTORIA DE {inspection.type || 'IMÓVEL'}</p>
          <p>Data: {new Date(inspection.date).toLocaleDateString('pt-BR')}</p>
          <p>Documento: #{inspection.id.toUpperCase()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <div className="col-span-2 md:col-span-1">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Localização do Imóvel</h3>
          <p className="text-base font-semibold text-slate-800">{inspection.address || 'Não informado'}</p>
        </div>
        <div>
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Proprietário</h3>
           <p className="text-base font-semibold text-slate-800">{inspection.ownerName || 'Não informado'}</p>
        </div>
        <div className="col-span-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Locatários / Interessados</h3>
          <p className="text-base font-semibold text-slate-800">
            {inspection.tenants && inspection.tenants.length > 0 && inspection.tenants[0] !== '' 
              ? inspection.tenants.join(', ') 
              : (inspection.clientName || 'Não informado')}
          </p>
        </div>
      </div>

      {inspection.generalRemarks && (
        <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Observações Gerais</h3>
          <p className="text-sm text-slate-700 leading-relaxed italic">{inspection.generalRemarks}</p>
        </div>
      )}

      <div className="space-y-12">
        {inspection.rooms.map((room, idx) => (
          <div key={room.id} className="break-inside-avoid">
            <div className="flex justify-between items-end border-b border-slate-200 pb-2 mb-4">
              <h2 className="text-lg font-black text-slate-900 uppercase flex items-center gap-3">
                <span className="bg-slate-900 text-white w-6 h-6 flex items-center justify-center rounded text-xs">{idx + 1}</span> 
                {room.customName || room.type}
              </h2>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${
                room.condition === 'Novo' ? 'bg-green-100 text-green-700' :
                room.condition === 'Bom' ? 'bg-amber-100 text-amber-700' :
                room.condition === 'Regular' ? 'bg-slate-100 text-slate-700' :
                'bg-red-100 text-red-700'
              }`}>
                Estado: {room.condition}
              </span>
            </div>
            
            <p className="text-slate-600 leading-relaxed whitespace-pre-line mb-6 text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              {room.description || 'Nenhuma descrição técnica informada para este ambiente.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {room.photos.map((photo) => (
                <div key={photo.id} className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={photo.data} alt="Evidência" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rodapé de Assinaturas */}
      <div className="mt-20 pt-10 border-t-2 border-slate-100">
        <div className="grid grid-cols-2 gap-x-16 gap-y-12">
          {/* Assinatura do Vistoriador */}
          <div className="text-center break-inside-avoid">
            <div className="h-px bg-slate-400 w-full mb-3"></div>
            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Qdez Imóveis</p>
            <p className="text-[9px] text-slate-500 uppercase">CRECI 34.873 J</p>
          </div>

          {/* Assinatura do Proprietário */}
          <div className="text-center break-inside-avoid">
            <div className="h-px bg-slate-400 w-full mb-3"></div>
            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{inspection.ownerName || 'Proprietário'}</p>
            <p className="text-[9px] text-slate-500 uppercase">Proprietário / Representante</p>
          </div>

          {/* Assinaturas dos Locatários (Múltiplos) */}
          {inspection.tenants && inspection.tenants.length > 0 && inspection.tenants[0] !== '' 
             ? inspection.tenants.map((tenant, idx) => (
                <div key={idx} className="text-center break-inside-avoid">
                  <div className="h-px bg-slate-400 w-full mb-3"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{tenant}</p>
                  <p className="text-[9px] text-slate-500 uppercase">Locatário / Interessado {idx + 1}</p>
                </div>
             ))
             : (
                <div className="text-center break-inside-avoid">
                  <div className="h-px bg-slate-400 w-full mb-3"></div>
                  <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{inspection.clientName || 'Locatário'}</p>
                  <p className="text-[9px] text-slate-500 uppercase">Ciência do Laudo</p>
                </div>
             )
          }
        </div>
      </div>
      
      <div className="mt-12 text-center no-print">
        <p className="text-[10px] text-slate-400 italic">Este laudo foi gerado eletronicamente e possui validade jurídica mediante assinaturas.</p>
      </div>
    </div>
  );
};

export default InspectionReport;
