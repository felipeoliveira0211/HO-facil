import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Form = Record<string, string>;

interface Props {
  data: Form;
  onChange: (key: string, value: string) => void;
}

const CHEM_AGENTS = [
  "Poeira Total",
  "Poeira Respirável",
  "Sílica",
  "Algodão",
  "Madeira",
  "Manganês",
  "Ferro",
  "Cromo",
  "Chumbo",
  "Tolueno",
  "Xileno",
  "Etilbenzeno",
  "Álcool Etílico",
  "n-hexano",
  "Negro de Fumo",
  "Níquel",
  "Estireno",
  "Ozônio",
  "Ác. Clorídrico",
  "Ác. Sulfúrico",
  "Amônia",
  "Cloro",
  "Benzeno",
];

function Field({
  k,
  label,
  value,
  onChange,
  type = "text",
  span,
}: {
  k: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  span?: string;
}) {
  return (
    <div className={`space-y-1.5 ${span ?? ""}`}>
      <Label htmlFor={k} className="text-xs font-medium">
        {label}
      </Label>
      <Input id={k} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({
  k,
  label,
  value,
  onChange,
}: {
  k: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={k} className="text-xs font-medium">
        {label}
      </Label>
      <Textarea
        id={k}
        rows={3}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h3 className="mb-4 font-display text-sm font-semibold uppercase tracking-wider text-chemical">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ChemicalForm({ data, onChange }: Props) {
  const set = (k: string) => (v: string) => onChange(k, v);
  const toggleAgent = (agent: string) => {
    const list = (data.agentes || "").split(",").map((s) => s.trim()).filter(Boolean);
    const exists = list.includes(agent);
    const next = exists ? list.filter((a) => a !== agent) : [...list, agent];
    onChange("agentes", next.join(", "));
  };
  const selected = new Set((data.agentes || "").split(",").map((s) => s.trim()).filter(Boolean));

  return (
    <div className="space-y-4">
      <Section title="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field k="setor" label="Setor" value={data.setor || ""} onChange={set("setor")} />
          <Field k="cargo" label="Cargo" value={data.cargo || ""} onChange={set("cargo")} />
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
          <Field
            k="relatorio"
            label="Nº do Relatório"
            value={data.relatorio || ""}
            onChange={set("relatorio")}
          />
          <Field
            k="codigo_amostrador"
            label="Código do amostrador"
            value={data.codigo_amostrador || ""}
            onChange={set("codigo_amostrador")}
          />
          <Field k="ges" label="GES" value={data.ges || ""} onChange={set("ges")} />
        </div>

        <div className="mt-5">
          <Label className="text-xs font-medium">Agentes monitorados</Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CHEM_AGENTS.map((a) => {
              const on = selected.has(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAgent(a)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    on
                      ? "border-chemical bg-chemical text-chemical-foreground"
                      : "border-border bg-background hover:bg-secondary"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          <Input
            className="mt-3"
            placeholder="Outro (especificar)"
            value={data.agente_outro || ""}
            onChange={(e) => onChange("agente_outro", e.target.value)}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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

      <Section title="Vazão e Volume">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            k="vazao_inicial"
            label="Vazão inicial (l/min)"
            value={data.vazao_inicial || ""}
            onChange={set("vazao_inicial")}
          />
          <Field
            k="vazao_final"
            label="Vazão final (l/min)"
            value={data.vazao_final || ""}
            onChange={set("vazao_final")}
          />
          <Field
            k="vazao_media"
            label="Vazão média (l/min)"
            value={data.vazao_media || ""}
            onChange={set("vazao_media")}
          />
          <Field
            k="variacao_vazao"
            label="Variação Vazão"
            value={data.variacao_vazao || ""}
            onChange={set("variacao_vazao")}
          />
          <Field
            k="tempo_amostragem"
            label="Tempo amostragem"
            value={data.tempo_amostragem || ""}
            onChange={set("tempo_amostragem")}
          />
          <Field
            k="volume"
            label="Volume (litros)"
            value={data.volume || ""}
            onChange={set("volume")}
          />
        </div>
      </Section>

      <Section title="Atividades e Ambiente">
        <div className="space-y-4">
          <Area
            k="atividades"
            label="Atividades realizadas durante a avaliação quantitativa"
            value={data.atividades || ""}
            onChange={set("atividades")}
          />
          <Area
            k="fontes"
            label="Fonte(s) geradora(s)"
            value={data.fontes || ""}
            onChange={set("fontes")}
          />
          <Area
            k="observacoes"
            label="Observações sobre o ambiente"
            value={data.observacoes || ""}
            onChange={set("observacoes")}
          />
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ambiente</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={data.ambiente || ""}
                onChange={(e) => onChange("ambiente", e.target.value)}
              >
                <option value="">—</option>
                <option value="Aberto">Aberto</option>
                <option value="Fechado">Fechado</option>
              </select>
            </div>
            <Field
              k="umidade"
              label="Umidade (%)"
              value={data.umidade || ""}
              onChange={set("umidade")}
            />
            <Field
              k="temperatura"
              label="Temperatura (ºC)"
              value={data.temperatura || ""}
              onChange={set("temperatura")}
            />
            <Field
              k="condicoes"
              label="Cond. Climáticas"
              value={data.condicoes || ""}
              onChange={set("condicoes")}
            />
          </div>
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
