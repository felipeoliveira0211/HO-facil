import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Resp {
  id: string;
  name: string;
  role: string | null;
  registry: string | null;
}

/**
 * Dropdown of saved responsibles. Stores the readable label in form_data
 * and the responsible id in `${field}_id` for signature lookups in PDF.
 */
export function ResponsibleSelect({
  label,
  fieldKey,
  data,
  onChange,
}: {
  label: string;
  fieldKey: string;
  data: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const [list, setList] = useState<Resp[]>([]);

  useEffect(() => {
    supabase
      .from("responsibles")
      .select("id, name, role, registry")
      .order("name")
      .then(({ data }) => setList((data ?? []) as Resp[]));
  }, []);

  const selectedId = data[`${fieldKey}_id`] || "";

  const handleSelect = (id: string) => {
    if (!id) {
      onChange(`${fieldKey}_id`, "");
      onChange(fieldKey, "");
      return;
    }
    const r = list.find((x) => x.id === id);
    if (!r) return;
    onChange(`${fieldKey}_id`, id);
    onChange(
      fieldKey,
      [r.name, r.role, r.registry].filter(Boolean).join(" — "),
    );
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={selectedId}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">— Selecionar cadastrado —</option>
        {list.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.role ? ` (${r.role})` : ""}
          </option>
        ))}
      </select>
      <Input
        placeholder="Ou digite manualmente"
        value={data[fieldKey] || ""}
        onChange={(e) => {
          onChange(fieldKey, e.target.value);
          if (selectedId) onChange(`${fieldKey}_id`, "");
        }}
      />
    </div>
  );
}
