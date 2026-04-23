import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PdfInput {
  type: "chemical" | "noise";
  worker: string | null;
  company: string | null;
  completedAt: string | null;
  formData: Record<string, unknown>;
  signatureDataUrl?: string;
  technicianSignatureDataUrl?: string;
  fieldSignatureDataUrl?: string;
}

export function generateEvaluationPdf(input: PdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  // Header bar
  const headerColor: [number, number, number] =
    input.type === "chemical" ? [126, 58, 174] : [196, 88, 40];
  doc.setFillColor(...headerColor);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("HigieneOK", margin, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(
    input.type === "chemical"
      ? "Monitoramento de Exposição a Agentes Químicos"
      : "Monitoramento de Exposição ao Ruído",
    margin,
    52,
  );
  y = 100;

  doc.setTextColor(20, 20, 30);
  doc.setFontSize(10);

  const printRow = (label: string, value: string | undefined | null) => {
    if (y > 760) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const text = value && String(value).trim() ? String(value) : "—";
    const lines = doc.splitTextToSize(text, pageW - margin * 2 - 140);
    doc.text(lines, margin + 140, y);
    y += Math.max(16, lines.length * 14);
  };

  const section = (title: string) => {
    if (y > 740) {
      doc.addPage();
      y = margin;
    }
    y += 8;
    doc.setFillColor(245, 247, 252);
    doc.rect(margin - 4, y - 12, pageW - margin * 2 + 8, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...headerColor);
    doc.text(title.toUpperCase(), margin, y + 2);
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(10);
    y += 22;
  };

  const signatureBlock = (label: string, signatureDataUrl?: string) => {
    const blockHeight = signatureDataUrl ? 92 : 44;
    if (y + blockHeight > pageH - 48) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    y += 12;

    doc.setDrawColor(210, 215, 223);
    doc.line(margin, y + 34, margin + 170, y + 34);

    if (signatureDataUrl) {
      try {
        doc.addImage(signatureDataUrl, "PNG", margin + 8, y - 4, 120, 36);
      } catch {
        doc.setFont("helvetica", "normal");
        doc.text("(assinatura não pôde ser carregada)", margin, y + 16);
      }
    } else {
      doc.setFont("helvetica", "normal");
      doc.text("(sem assinatura registrada)", margin, y + 16);
    }

    y += 52;
  };

  const f = input.formData as Record<string, string>;

  section("Identificação");
  printRow("Empresa:", input.company);
  printRow("Trabalhador:", input.worker);
  printRow("Setor:", f.setor);
  printRow("Cargo:", f.cargo);
  if (input.type === "noise") {
    printRow("Jornada:", f.jornada);
    printRow("Intervalo Intrajornada:", f.intervalo_intrajornada);
  }

  section("Dados da Amostragem");
  printRow("Local:", f.local);
  printRow("Data:", f.data);
  printRow("GES:", f.ges);
  if (input.type === "chemical") {
    printRow("Nº do Relatório:", f.relatorio);
    printRow("Código do amostrador:", f.codigo_amostrador);
    printRow("Agentes:", f.agentes);
  }
  printRow("Marca:", f.equip_marca);
  printRow("Modelo equipamento:", f.equipamento);
  printRow("Nº de identificação/série:", f.equip_serie);

  section("Horário da Avaliação");
  printRow("Início:", f.hora_inicio);
  printRow("Intervalo:", `${f.intervalo_inicio || ""} / ${f.intervalo_fim || ""}`);
  printRow("Fim:", f.hora_fim);

  if (input.type === "chemical") {
    section("Vazão e Volume");
    printRow("Vazão inicial (l/min):", f.vazao_inicial);
    printRow("Vazão final (l/min):", f.vazao_final);
    printRow("Vazão média (l/min):", f.vazao_media);
    printRow("Variação Vazão:", f.variacao_vazao);
    printRow("Tempo amostragem:", f.tempo_amostragem);
    printRow("Volume (litros):", f.volume);
  } else {
    section("Dados da Dosimetria");
    printRow("Tempo amostragem:", f.tempo_amostragem);
    printRow("Dose Medida:", f.dose_medida);
    printRow("Calibração Inicial:", f.calib_inicial || "114,0");
    printRow("Calibração Final:", f.calib_final);
    printRow("Lavg:", f.lavg);
    printRow("Dose (8h):", f.dose_8h);
    printRow("NEN:", f.nen);
  }

  section("Atividades e Ambiente");
  printRow("Atividades realizadas:", f.atividades);
  printRow("Fonte(s) geradora(s):", f.fontes);
  printRow("Observações:", f.observacoes);
  if (input.type === "chemical") {
    printRow("Ambiente:", f.ambiente);
    printRow("Umidade (%):", f.umidade);
    printRow("Temperatura (ºC):", f.temperatura);
    printRow("Condições Climáticas:", f.condicoes);
  }

  section("Responsáveis");
  printRow("Responsável técnico:", f.responsavel_tecnico);
  signatureBlock("Assinatura do responsável técnico", input.technicianSignatureDataUrl);
  printRow("Monitoramento em campo:", f.monitoramento_campo);
  signatureBlock("Assinatura do monitoramento em campo", input.fieldSignatureDataUrl);

  section("Assinatura do Trabalhador");
  signatureBlock("Assinatura do trabalhador", input.signatureDataUrl);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 24;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} • HigieneOK`,
    margin,
    footerY,
  );

  const fileName = `${input.type === "chemical" ? "quimico" : "ruido"}_${(input.worker || "avaliacao").replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(fileName);
}
