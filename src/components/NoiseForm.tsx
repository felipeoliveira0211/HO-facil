import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Form = Record<string, string>;

interface Props {
  data: Form;
  onChange: (key: string, value: string) => void;
}

function Field({
  k,
  label,
  value,
  onChange,
  type = "text",
}: {
  k: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs font-medium">
        {label}
      </Label>
      <Input id={k} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-noise">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function NoiseForm({ data, onChange }: Props) {
  const set = (k: string) => (v: string) => onChange(k, v);

  return (
    <div className="space-y-4">
      <Section title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="setor" label="Setor" value={data.setor || ""} onChange={set("setor")} />
          <Field k="cargo" label="Cargo" value={data.cargo || ""} onChange={set("cargo")} />
          <Field
            k="jornada"
            label="Jornada de Trabalho"
            value={data.jornada || ""}
            onChange={set("jornada")}
          />
          <Field
            k="intervalo_intrajornada"
            label="Intervalo Intrajornada"
            value={data.intervalo_intrajornada || ""}
            onChange={set("intervalo_intrajornada")}
          />
        </div>
      </Section>

      <Section title="Dados da Amostragem">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field k="local" label="Local" value={data.local || ""} onChange={set("local")} />
          <Field
            k="data"
            label="Data"
            type="date"
            value={data.data || ""}
            onChange={set("data")}
          />
          <Field k="ges" label="GES" value={data.ges || ""} onChange={set("ges")} />
          <Field
            k="equipamento"
            label="Marca/Modelo equipamento"
            value={data.equipamento || ""}
            onChange={set("equipamento")}
          />
          <Field
            k="equip_serie"
            label="Nº identificação/série"
            value={data.equip_serie || ""}
            onChange={set("equip_serie")}
          />
        </div>
      </Section>

      <Section title="Horário da Avaliação">
        <div className="grid gap-4 sm:grid-cols-4">
          <Field
            k="hora_inicio"
            label="Início"
            type="time"
            value={data.hora_inicio || ""}
            onChange={set("hora_inicio")}
          />
          <Field
            k="intervalo_inicio"
            label="Intervalo início"
            type="time"
            value={data.intervalo_inicio || ""}
            onChange={set("intervalo_inicio")}
          />
          <Field
            k="intervalo_fim"
            label="Intervalo fim"
            type="time"
            value={data.intervalo_fim || ""}
            onChange={set("intervalo_fim")}
          />
          <Field
            k="hora_fim"
            label="Fim"
            type="time"
            value={data.hora_fim || ""}
            onChange={set("hora_fim")}
          />
        </div>
      </Section>

      <Section title="Dados da Dosimetria | Calibração">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            k="tempo_amostragem"
            label="Tempo amostragem"
            value={data.tempo_amostragem || ""}
            onChange={set("tempo_amostragem")}
          />
          <Field
            k="dose_medida"
            label="Dose Medida"
            value={data.dose_medida || ""}
            onChange={set("dose_medida")}
          />
          <Field
            k="calib_inicial"
            label="Calibração Inicial"
            value={data.calib_inicial || "114,0"}
            onChange={set("calib_inicial")}
          />
          <Field
            k="calib_final"
            label="Calibração Final"
            value={data.calib_final || ""}
            onChange={set("calib_final")}
          />
          <Field k="lavg" label="Lavg" value={data.lavg || ""} onChange={set("lavg")} />
          <Field
            k="dose_8h"
            label="Dose (8h)"
            value={data.dose_8h || ""}
            onChange={set("dose_8h")}
          />
          <Field k="nen" label="NEN" value={data.nen || ""} onChange={set("nen")} />
        </div>
      </Section>

      <Section title="Atividades e Observações">
        <div className="space-y-4">
          <Textarea
            placeholder="Atividades realizadas durante a avaliação quantitativa"
            rows={3}
            value={data.atividades || ""}
            onChange={(e) => onChange("atividades", e.target.value)}
          />
          <Textarea
            placeholder="Fonte(s) geradora(s)"
            rows={2}
            value={data.fontes || ""}
            onChange={(e) => onChange("fontes", e.target.value)}
          />
          <Textarea
            placeholder="Observações sobre o ambiente"
            rows={3}
            value={data.observacoes || ""}
            onChange={(e) => onChange("observacoes", e.target.value)}
          />
        </div>
      </Section>

      <Section title="Responsáveis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            k="responsavel_tecnico"
            label="Responsável técnico pela avaliação"
            value={data.responsavel_tecnico || ""}
            onChange={set("responsavel_tecnico")}
          />
          <Field
            k="monitoramento_campo"
            label="Monitoramento em campo"
            value={data.monitoramento_campo || ""}
            onChange={set("monitoramento_campo")}
          />
        </div>
      </Section>
    </div>
  );
}
